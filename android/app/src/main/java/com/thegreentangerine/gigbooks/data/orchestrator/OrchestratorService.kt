package com.thegreentangerine.gigbooks.data.orchestrator

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import com.thegreentangerine.gigbooks.R
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch

/**
 * Drummer-side gig orchestrator (S118).
 *
 * APK reclaimed phone-director role. This service is the brain of the gig-time
 * phone fleet on the S23 hotspot LAN.
 *
 * A1 (this commit): Reaper OSC trigger only — Nathan taps RECORD on the APK,
 * Reaper on the E6330 starts recording 18-channel multitrack from the XR18.
 * A2 (next session): mDNS advertise + TCP server for peer Android phones.
 * A3: peer JPEG preview ingest + grid drawer.
 *
 * Foreground because the LAN socket + mDNS advertisement (when added in A2)
 * must survive screen-off during a gig.
 */
class OrchestratorService : Service() {

    companion object {
        const val CHANNEL_ID = "tgt_orchestrator"
        const val NOTIFICATION_ID = 9200
    }

    inner class LocalBinder : Binder() {
        val service: OrchestratorService get() = this@OrchestratorService
    }

    private val binder = LocalBinder()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var wakeLock: PowerManager.WakeLock? = null

    val osc = ReaperOscClient()
    val gigCmd by lazy { GigCommandClient(this) }
    val session = GigSession()
    private lateinit var discovery: OrchestratorDiscovery
    val discoveryFlow get() = discovery.discovered
    val isSearching get() = discovery.isSearching

    val peerServer = OrchestratorPeerServer()
    private lateinit var publisher: OrchestratorPublisher
    val peerInfos: StateFlow<List<OrchestratorPeerServer.PeerInfo>> get() = peerServer.peerInfos

    /** When true, OSC target follows mDNS discovery; when false, user override holds. */
    private val _autoDiscover = MutableStateFlow(true)
    val autoDiscover: StateFlow<Boolean> = _autoDiscover

    fun setAutoDiscover(enabled: Boolean) {
        _autoDiscover.value = enabled
        if (enabled) {
            // Re-apply latest discovered target if present. OSC follows discovery
            // verbatim; gigCmd uses the same host on its own fixed HTTP port.
            discovery.discovered.value?.let {
                osc.setTarget(it.host, it.port)
                gigCmd.setTarget(it.host)
            }
        }
    }

    private val _isRecording = MutableStateFlow(false)
    val isRecording: StateFlow<Boolean> = _isRecording

    private val _peerCount = MutableStateFlow(0)
    val peerCount: StateFlow<Int> = _peerCount

    /** Per-set session id, regenerated on each /record fan-out so peers can correlate files. */
    private fun newSessionId(): String =
        "set-${System.currentTimeMillis()}"

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        discovery = OrchestratorDiscovery(this)
        discovery.start()
        publisher = OrchestratorPublisher(this)
        // Start TCP server first, then advertise the bound port over mDNS
        val port = peerServer.start()
        if (port > 0) publisher.register(port)
        // When discovery resolves, route the OSC client unless the user overrode it.
        // Gig-command HTTP target follows the same host (different fixed port).
        scope.launch {
            discovery.discovered.collect { d ->
                if (d != null && _autoDiscover.value) {
                    osc.setTarget(d.host, d.port)
                    gigCmd.setTarget(d.host)
                }
            }
        }
        // Keep peer count in sync with the server's peer list. Only update the
        // notification when the count changes — preview frames update the list on
        // every cycle and we don't want to spam NotificationManager.
        scope.launch {
            var lastCount = -1
            peerServer.peerInfos.collect { list ->
                _peerCount.value = list.size
                if (list.size != lastCount) {
                    lastCount = list.size
                    updateNotification()
                }
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = buildNotification("TGT Orchestrator", statusText())
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
        acquireWakeLock()
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onDestroy() {
        discovery.stop()
        publisher.unregister()
        peerServer.shutdown()
        scope.cancel()
        releaseWakeLock()
        super.onDestroy()
    }

    fun startRecording() {
        scope.launch {
            val sessionId = newSessionId()
            // Reaper first (the source of truth), then peer fan-out, then local
            // orchestrator camera if Gig Mode wired CameraGate. All within the
            // same dispatcher tick so latency is dominated by network, not code.
            osc.sendRecord()
            peerServer.broadcastStartRec(sessionId)
            CameraGate.startLocalRecording(sessionName = "orchestrator", sessionId = sessionId)
            _isRecording.value = true
            updateNotification()
        }
    }

    fun stopRecording() {
        scope.launch {
            osc.sendStop()
            peerServer.broadcastStopRec()
            CameraGate.stopLocalRecording()
            _isRecording.value = false
            updateNotification()
        }
    }

    fun sendSongMarker(title: String) {
        // S129: HTTP file-drop preferred (named marker via song-marker-listener.lua).
        // OSC fallback still wired for the no-daemon case — drops a generic
        // unnamed marker via /action/40157 if the daemon is unreachable.
        scope.launch {
            gigCmd.sendSongMarker(title)
            if (gigCmd.lastSendOk.value == false) {
                osc.sendSongMarker(title)
            }
        }
    }

    // ─── Gig-level lifecycle (S129 row 6, v1.2.3 refined) ──────────────────
    //
    // Two-phase start: armGig (project rename/save only, no transport) ->
    // beginRecording (record fanout). The drummer reviews state in the ARMED
    // phase before committing to the take.
    //
    // BREAK has two continue paths: continueSameSet (no marker, same #) for
    // brief mid-set interruptions, and continueNewSet (marker + #++) for
    // genuine set boundaries.

    /** Wizard saves project + arms — does NOT start recording. */
    fun armGig(name: String) {
        scope.launch {
            session.arm(name)
            // Reaper rename + save runs immediately so the named project exists
            // on disk. Recording transport stays idle until beginRecording().
            gigCmd.start(name)
            updateNotification()
        }
    }

    /** ARMED -> ACTIVE_SET (set 1). Fires the per-set record fanout. */
    fun beginRecording() {
        scope.launch {
            session.beginRecording()
            osc.sendRecord()
            peerServer.broadcastStartRec(newSessionId())
            CameraGate.startLocalRecording(sessionName = "orchestrator", sessionId = newSessionId())
            _isRecording.value = true
            updateNotification()
        }
    }

    fun pauseSet() {
        scope.launch {
            // Stop the per-set transport, then tell Reaper to save. Per S119
            // every set is its own take and saved-on-disk before continuing.
            osc.sendStop()
            peerServer.broadcastStopRec()
            CameraGate.stopLocalRecording()
            _isRecording.value = false
            gigCmd.save()
            session.pause()
            updateNotification()
        }
    }

    /** Brief mid-set pause continuing — no marker, same set #. */
    fun continueSameSet() {
        scope.launch {
            session.continueSameSet()
            // Cursor-at-end-then-record bundle (S120 lock) — new take starts
            // strictly after the previous so they don't overwrite.
            osc.sendRecord()
            peerServer.broadcastStartRec(newSessionId())
            CameraGate.startLocalRecording(sessionName = "orchestrator", sessionId = newSessionId())
            _isRecording.value = true
            updateNotification()
        }
    }

    /** Set-boundary continue — marker dropped, set #++ . */
    fun continueNewSet() {
        scope.launch {
            session.continueNewSet()
            osc.sendRecord()
            peerServer.broadcastStartRec(newSessionId())
            CameraGate.startLocalRecording(sessionName = "orchestrator", sessionId = newSessionId())
            // Drop the named "Set N" marker via HTTP file-drop (Reaper-side
            // song-marker-listener.lua picks it up). OSC fallback if HTTP fails.
            val markerTitle = "Set ${session.setNumber}"
            gigCmd.sendSongMarker(markerTitle)
            if (gigCmd.lastSendOk.value == false) {
                osc.sendSongMarker(markerTitle)
            }
            _isRecording.value = true
            updateNotification()
        }
    }

    fun endGig() {
        scope.launch {
            // If we're mid-set, stop first.
            if (_isRecording.value) {
                osc.sendStop()
                peerServer.broadcastStopRec()
                CameraGate.stopLocalRecording()
                _isRecording.value = false
            }
            gigCmd.stop()  // final save (Reaper-side does not auto-close)
            session.end()
            session.reset()  // free the wizard for the next gig
            updateNotification()
        }
    }

    private fun statusText(): String {
        val rec = if (_isRecording.value) "● REC" else "Idle"
        val peers = _peerCount.value
        return "$rec  ·  $peers peer${if (peers == 1) "" else "s"}"
    }

    private fun updateNotification() {
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIFICATION_ID, buildNotification("TGT Orchestrator", statusText()))
    }

    private fun buildNotification(title: String, text: String): Notification =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "TGT Orchestrator",
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = "Drummer-side orchestrator: Reaper trigger + phone fleet"
        }
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(channel)
    }

    private fun acquireWakeLock() {
        if (wakeLock == null) {
            val pm = getSystemService(POWER_SERVICE) as PowerManager
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "TGT:Orchestrator")
        }
        wakeLock?.takeIf { !it.isHeld }?.acquire(4 * 60 * 60 * 1000L) // 4 hour max gig length
    }

    private fun releaseWakeLock() {
        wakeLock?.takeIf { it.isHeld }?.release()
    }
}

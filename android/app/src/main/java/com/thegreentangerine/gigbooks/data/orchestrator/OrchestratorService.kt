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
import android.util.Log
import androidx.core.app.NotificationCompat
import com.thegreentangerine.gigbooks.R
import com.thegreentangerine.gigbooks.data.supabase.GigLockRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.net.InetSocketAddress
import java.net.Socket

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
        /** Reaper's OSC receive port is fixed by the rig config; the discovered SRV port is the MS HTTP bridge (9200). */
        const val REAPER_OSC_PORT = 8000
    }

    inner class LocalBinder : Binder() {
        val service: OrchestratorService get() = this@OrchestratorService
    }

    private val binder = LocalBinder()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var wakeLock: PowerManager.WakeLock? = null

    val osc = ReaperOscClient()
    val gigCmd by lazy { GigCommandClient(this) }
    val rigStore by lazy { RigTargetStore(this) }
    val session = GigSession()
    private val bookendTone by lazy { BookendTonePlayer(this) }
    val battery by lazy { BatteryMonitor(this) }
    private lateinit var discovery: OrchestratorDiscovery
    val discoveryFlow get() = discovery.discovered
    val isSearching get() = discovery.isSearching

    val peerServer = OrchestratorPeerServer()
    private lateinit var publisher: OrchestratorPublisher
    val peerInfos: StateFlow<List<OrchestratorPeerServer.PeerInfo>> get() = peerServer.peerInfos

    /** When true, OSC target follows mDNS discovery; when false, user/default override holds. */
    private val _autoDiscover = MutableStateFlow(false)
    val autoDiscover: StateFlow<Boolean> = _autoDiscover

    fun setAutoDiscover(enabled: Boolean) {
        _autoDiscover.value = enabled
        scope.launch { rigStore.setAutoDiscover(enabled) }  // S211: persist across restarts
        if (enabled) {
            // Re-apply latest discovered target if present. OSC follows discovery
            // verbatim; gigCmd uses the same host on its own fixed HTTP port.
            discovery.discovered.value?.let {
                osc.setTarget(it.host, REAPER_OSC_PORT)
                gigCmd.setTarget(it.host)
            }
        }
    }

    /**
     * S211: persist + apply a manual rig host (set via ReaperConfigPane). Survives
     * reboot/reinstall and supersedes the BuildConfig default — replacing the dead
     * 2026-06-13 hotspot-IP pin. A manual host implies auto-discover off. One host
     * drives both transports: OSC (host:oscPort) + the MS HTTP bridge (host:9200).
     */
    fun setManualRig(host: String, oscPort: Int) {
        _autoDiscover.value = false
        osc.setTarget(host, oscPort)
        gigCmd.setTarget(host)
        // S233 (DARK): the API secret is PER-RIG — a new host invalidates the previous rig's secret.
        // Clear the cached + persisted secret so we never send the wrong rig's bearer (harmless
        // log-only today, but it would 401 EVERY command on the new rig once enforcement flips). The
        // flip slice's pairing UX re-mints + persists a secret for the new rig: it MUST write through
        // BOTH rigStore.setApiSecret(...) (read back on restart, see onCreate) AND gigCmd.setApiSecret(...).
        gigCmd.setApiSecret("")
        scope.launch { rigStore.setManual(host, oscPort); rigStore.setApiSecret("") }
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
        // S192 batch-D: battery monitor starts with the service so the gig-mode
        // UI has a live LiveData/StateFlow to subscribe to before the user
        // ever opens the wizard.
        battery.start()
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
                    // S211: knock before trusting. Only adopt a discovered host that
                    // actually answers on the MS bridge port — stops the APK locking
                    // onto a stale mDNS address (the dead 10.117.x pill). If the MS is
                    // up, the co-located Reaper (OSC 8000) is up too. Re-fires on every
                    // (re)discovery + network change, so it self-heals when the rig
                    // comes online or the network switches.
                    if (probeHost(d.host, d.port)) {
                        osc.setTarget(d.host, REAPER_OSC_PORT)
                        gigCmd.setTarget(d.host)
                    } else {
                        Log.w("OrchestratorService", "Discovered ${d.host}:${d.port} but no answer — not adopting")
                    }
                }
            }
        }
        // S211: a manually-saved rig host (ReaperConfigPane -> setManualRig) survives
        // reboot/reinstall and supersedes the BuildConfig default + the dead hotspot
        // pin. Loaded async; the discovery.collect above respects _autoDiscover, so a
        // saved manual host (autoDiscover=false) is never clobbered by mDNS.
        scope.launch {
            val saved = rigStore.current()
            _autoDiscover.value = saved.autoDiscover
            // S233 (DARK): apply the saved per-rig MS API secret regardless of auto/manual mode —
            // it gates the HTTP bridge in both. "" until a pairing slice writes it, so the header
            // is simply not sent and the server stays log-only. Plumbed now so the flip slice is
            // a no-op on the APK beyond adding the entry UX.
            gigCmd.setApiSecret(saved.apiSecret)
            if (!saved.autoDiscover && saved.host != null) {
                osc.setTarget(saved.host, saved.oscPort)
                gigCmd.setTarget(saved.host)
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
        battery.stop()
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
            val gigName = session.gigName
            val gigDate = session.gigDate
            // Reaper first (the source of truth), then peer fan-out, then local
            // orchestrator camera if Gig Mode wired CameraGate. All within the
            // same dispatcher tick so latency is dominated by network, not code.
            osc.sendRecord()
            peerServer.broadcastStartRec(sessionId, gigName, gigDate)
            CameraGate.startLocalRecording(sessionName = "orchestrator", sessionId = sessionId, gigName = gigName, gigDate = gigDate)
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
    fun armGig(name: String, armedTracks: Set<Int>) {
        scope.launch {
            session.arm(name, armedTracks)
            // Reaper rename + save runs immediately so the named project exists
            // on disk. Recording transport stays idle until beginRecording().
            gigCmd.start(name)
            // S141: flip gig_lock_state.is_locked = true so the cross-surface
            // setlist authoring routes through pending_edits queue. Fire-and-forget
            // per Sovereign Spec §B.5 — Supabase failure does not block gig.
            GigLockRepository.setLocked(locked = true, gigLabel = name)
            updateNotification()
        }
    }

    /** ARMED -> ACTIVE_SET (set 1). Fires the per-set record fanout. */
    fun beginRecording() {
        scope.launch {
            session.beginRecording()
            scope.launch { bookendTone.playSetStart() }  // fire-and-forget; OSC must not wait
            // S155: single sessionId per record event — peer + local cam previously
            // diverged because each called newSessionId() independently, breaking
            // file-name correlation. Same fix in continueSameSet / continueNewSet.
            val sessionId = newSessionId()
            val gigName = session.gigName
            val gigDate = session.gigDate
            // S202: arm the chosen channel set immediately before record. Sent
            // here (not at armGig) so it lands after the project has loaded and
            // the ARMED review has passed. Arm state persists in Reaper memory
            // across sets, so continue* paths don't re-send.
            osc.sendRecArm(session.armedTracks)
            osc.sendRecord()
            peerServer.broadcastStartRec(sessionId, gigName, gigDate)
            CameraGate.startLocalRecording(sessionName = "orchestrator", sessionId = sessionId, gigName = gigName, gigDate = gigDate)
            _isRecording.value = true
            updateNotification()
        }
    }

    fun pauseSet() {
        scope.launch {
            // Stop per-set transport. We do NOT save here: pauses are often
            // mid-set (talk between songs) and full-project saves on every
            // pause add visible lag. Reaper holds state in RAM; durability
            // happens at set boundaries (continueNewSet) and at endGig.
            osc.sendStop()
            peerServer.broadcastStopRec()
            CameraGate.stopLocalRecording()
            _isRecording.value = false
            session.pause()
            updateNotification()
        }
    }

    /** Brief mid-set pause continuing — no marker, same set #. */
    fun continueSameSet() {
        scope.launch {
            session.continueSameSet()
            val sessionId = newSessionId()
            val gigName = session.gigName
            val gigDate = session.gigDate
            // Cursor-at-end-then-record bundle (S120 lock) — new take starts
            // strictly after the previous so they don't overwrite.
            osc.sendRecord()
            peerServer.broadcastStartRec(sessionId, gigName, gigDate)
            CameraGate.startLocalRecording(sessionName = "orchestrator", sessionId = sessionId, gigName = gigName, gigDate = gigDate)
            _isRecording.value = true
            updateNotification()
        }
    }

    /** Set-boundary continue — marker dropped, set #++ . */
    fun continueNewSet() {
        scope.launch {
            // Save the just-finished set BEFORE bumping the set number, so
            // the saved .rpp captures the prior set's takes/markers cleanly.
            // (v1.2.8: replaces per-pause save — pauses no longer trigger save.)
            gigCmd.save()
            session.continueNewSet()
            scope.launch { bookendTone.playSetStart() }  // fire-and-forget; OSC must not wait
            val sessionId = newSessionId()
            val gigName = session.gigName
            val gigDate = session.gigDate
            osc.sendRecord()
            peerServer.broadcastStartRec(sessionId, gigName, gigDate)
            CameraGate.startLocalRecording(sessionName = "orchestrator", sessionId = sessionId, gigName = gigName, gigDate = gigDate)
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
            scope.launch { bookendTone.playSetEnd() }  // fire-and-forget; gig save must not wait
            gigCmd.stop()  // final save (Reaper-side does not auto-close)
            session.end()
            // S141: flip gig_lock_state.is_locked = false so cross-surface
            // setlist authoring resumes direct writes (and S142 daemon, when
            // shipped, will drain pending_edits at this point).
            GigLockRepository.setLocked(locked = false)
            session.reset()  // free the wizard for the next gig
            updateNotification()
        }
    }

    /**
     * S211: liveness knock. TCP-connect to the MS bridge port with a short timeout;
     * a discovered host is only trusted (target adopted) if it answers. Pure I/O.
     */
    private suspend fun probeHost(host: String, port: Int, timeoutMs: Int = 1500): Boolean =
        withContext(Dispatchers.IO) {
            try {
                Socket().use { s ->
                    s.connect(InetSocketAddress(host, port), timeoutMs)
                    true
                }
            } catch (_: Exception) { false }
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

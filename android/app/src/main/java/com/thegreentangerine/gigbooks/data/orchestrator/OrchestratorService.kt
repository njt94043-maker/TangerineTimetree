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
    private lateinit var discovery: OrchestratorDiscovery
    val discoveryFlow get() = discovery.discovered
    val isSearching get() = discovery.isSearching

    /** When true, OSC target follows mDNS discovery; when false, user override holds. */
    private val _autoDiscover = MutableStateFlow(true)
    val autoDiscover: StateFlow<Boolean> = _autoDiscover

    fun setAutoDiscover(enabled: Boolean) {
        _autoDiscover.value = enabled
        if (enabled) {
            // Re-apply latest discovered target if present
            discovery.discovered.value?.let { osc.setTarget(it.host, it.port) }
        }
    }

    private val _isRecording = MutableStateFlow(false)
    val isRecording: StateFlow<Boolean> = _isRecording

    private val _peerCount = MutableStateFlow(0)
    val peerCount: StateFlow<Int> = _peerCount

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        discovery = OrchestratorDiscovery(this)
        discovery.start()
        // When discovery resolves, route the OSC client unless the user overrode it
        scope.launch {
            discovery.discovered.collect { d ->
                if (d != null && _autoDiscover.value) {
                    osc.setTarget(d.host, d.port)
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
        scope.cancel()
        releaseWakeLock()
        super.onDestroy()
    }

    fun startRecording() {
        scope.launch {
            osc.sendRecord()
            _isRecording.value = true
            updateNotification()
        }
    }

    fun stopRecording() {
        scope.launch {
            osc.sendStop()
            _isRecording.value = false
            updateNotification()
        }
    }

    fun sendSongMarker(title: String) {
        scope.launch { osc.sendSongMarker(title) }
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

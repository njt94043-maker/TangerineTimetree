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

/**
 * Foreground service for peer-mode camera phones.
 *
 * Without this, Android's background-policy tears down CameraX the moment the
 * peer phone's screen sleeps — recording stops mid-set. With this, the phone can
 * sit on its stand with the screen off and still record reliably for the whole
 * gig. Service holds a partial wake lock and shows an ongoing notification so
 * the user can return to the screen with one tap.
 *
 * Lifecycle: started by PeerScreen on entry, stopped on exit. The actual CameraX
 * recording is still owned by the AppViewModel-scoped CameraRecordingManager; the
 * service exists purely to win the foreground-service contract with the OS.
 */
class PeerCameraService : Service() {

    companion object {
        const val CHANNEL_ID = "tgt_peer_camera"
        const val NOTIFICATION_ID = 9210
    }

    inner class LocalBinder : Binder() {
        val service: PeerCameraService get() = this@PeerCameraService
    }

    private val binder = LocalBinder()
    private var wakeLock: PowerManager.WakeLock? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = buildNotification("TGT Peer Camera", "Standing by — recording controlled by drummer")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
        acquireWakeLock()
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onDestroy() {
        releaseWakeLock()
        super.onDestroy()
    }

    fun updateState(isRecording: Boolean) {
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        val text = if (isRecording) "● REC" else "Standing by — recording controlled by drummer"
        nm.notify(NOTIFICATION_ID, buildNotification("TGT Peer Camera", text))
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
            "TGT Peer Camera",
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = "Peer camera service: keeps recording alive when the screen sleeps"
        }
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(channel)
    }

    private fun acquireWakeLock() {
        if (wakeLock == null) {
            val pm = getSystemService(POWER_SERVICE) as PowerManager
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "TGT:PeerCamera")
        }
        wakeLock?.takeIf { !it.isHeld }?.acquire(4 * 60 * 60 * 1000L) // 4h max gig length
    }

    private fun releaseWakeLock() {
        wakeLock?.takeIf { it.isHeld }?.release()
    }
}

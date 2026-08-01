package com.thegreentangerine.gigbooks.data.orchestrator

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import androidx.core.content.ContextCompat

/**
 * Foreground-service type masks, computed from the runtime permissions actually held.
 *
 * S287. Declaring `microphone` in the manifest is NOT enough: on Android 14+ the mic
 * is gated on the type passed to `startForeground()` (the manifest only sets the
 * permitted superset), and RECORD_AUDIO's app-op runs in `foreground` mode. A
 * camera-only FGS therefore keeps its camera grant when the screen sleeps and
 * silently loses the mic — and Android hands the app digital silence rather than an
 * error, by design, so it cannot detect it is blocked. CameraX goes on writing a
 * full-length, correctly-encoded, completely silent AAC track and reports nothing.
 * That cost the Potters, Newport gig 54 minutes of room audio on 2026-07-31.
 *
 * The masks are permission-gated because `startForeground()` THROWS when a camera- or
 * microphone-typed service is promoted without the matching runtime grant. Losing the
 * whole service (no camera, no rig fan-out) is worse than losing the mic, so a missing
 * grant degrades the type instead of killing the service.
 */
object FgsTypes {

    private fun has(context: Context, permission: String): Boolean =
        ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED

    /** camera + microphone when RECORD_AUDIO is held — [PeerCameraService]. */
    fun peerCamera(context: Context): Int {
        var mask = ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
        if (has(context, Manifest.permission.RECORD_AUDIO)) {
            mask = mask or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
        }
        return mask
    }

    /**
     * connectedDevice + camera/microphone when granted — [OrchestratorService].
     *
     * The orchestrator drives `CameraGate.startLocalRecording`, which records with
     * `withAudioEnabled()`, so it needs the same mic contract as the peer whenever
     * the drummer's screen is allowed to sleep.
     */
    fun orchestrator(context: Context): Int {
        var mask = ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE
        if (has(context, Manifest.permission.CAMERA)) {
            mask = mask or ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
        }
        if (has(context, Manifest.permission.RECORD_AUDIO)) {
            mask = mask or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
        }
        return mask
    }
}

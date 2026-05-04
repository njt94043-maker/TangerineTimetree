package com.thegreentangerine.gigbooks.data.orchestrator

import android.util.Log
import com.thegreentangerine.gigbooks.data.xr18.CameraRecordingManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.io.File

/**
 * Process-scoped link between Gig Mode (which binds CameraX) and OrchestratorService
 * (which fans out RECORD to Reaper + peers). When Nathan hits RECORD on Gig Mode the
 * service consults this gate and starts local camera recording too — giving us a
 * 3rd camera (S23U's selfie / drummer-cam) alongside Reaper multitrack + peer cams.
 *
 * GigModeScreen owns the bind lifecycle (it has the LifecycleOwner). The service
 * just looks here on start/stop. If [manager] is null the gate is closed and the
 * service raises a [RecordError.CameraNotBound] so the UI can surface it (S122 gig
 * was lost partly because failures were swallowed silently — never again).
 */
object CameraGate {

    private const val TAG = "CameraGate"

    @Volatile var manager: CameraRecordingManager? = null
    @Volatile var orchestratorOutputDir: File? = null

    private val _enabled = MutableStateFlow(true)
    val enabled: StateFlow<Boolean> = _enabled
    fun setEnabled(v: Boolean) { _enabled.value = v }

    /** True once the local CameraX recorder has actually started for the current set. */
    private val _isRecording = MutableStateFlow(false)
    val isRecording: StateFlow<Boolean> = _isRecording

    /** Last failure encountered while starting/stopping local capture, null when healthy. */
    private val _lastError = MutableStateFlow<RecordError?>(null)
    val lastError: StateFlow<RecordError?> = _lastError
    fun clearError() { _lastError.value = null }

    fun startLocalRecording(sessionName: String, sessionId: String): Boolean {
        if (!_enabled.value) {
            // Not an error — Nathan toggled the self-cam off on the Cameras drawer
            // tile. Clear any stale error so the UI doesn't yell.
            _lastError.value = null
            return false
        }
        val mgr = manager ?: run {
            val msg = "CameraGate.manager is null — Gig Mode hasn't bound CameraX yet."
            Log.e(TAG, msg)
            _lastError.value = RecordError.CameraNotBound(msg)
            return false
        }
        val dir = orchestratorOutputDir ?: run {
            val msg = "orchestrator output dir not set."
            Log.e(TAG, msg)
            _lastError.value = RecordError.CameraNotBound(msg)
            return false
        }
        return try {
            mgr.startRecording(dir, sessionName.ifBlank { "orchestrator" }, sessionId)
            _isRecording.value = true
            _lastError.value = null
            Log.i(TAG, "local camera recording started (session=$sessionId, dir=$dir)")
            true
        } catch (e: Exception) {
            Log.e(TAG, "startRecording failed: ${e.message}", e)
            _lastError.value = RecordError.StartFailed(e.message ?: e.javaClass.simpleName)
            false
        }
    }

    fun stopLocalRecording() {
        try {
            manager?.stopRecording()
            _isRecording.value = false
            Log.i(TAG, "local camera recording stopped")
        } catch (e: Exception) {
            Log.e(TAG, "stopRecording failed: ${e.message}", e)
            _lastError.value = RecordError.StopFailed(e.message ?: e.javaClass.simpleName)
        }
    }
}

/** Failures raised by [CameraGate] so the UI can surface them as a banner. */
sealed class RecordError {
    abstract val msg: String

    data class CameraNotBound(override val msg: String) : RecordError()
    data class StartFailed(override val msg: String) : RecordError()
    data class StopFailed(override val msg: String) : RecordError()
}

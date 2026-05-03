package com.thegreentangerine.gigbooks.data.orchestrator

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
 * service skips local capture quietly.
 */
object CameraGate {

    @Volatile var manager: CameraRecordingManager? = null
    @Volatile var orchestratorOutputDir: File? = null

    private val _enabled = MutableStateFlow(true)
    val enabled: StateFlow<Boolean> = _enabled
    fun setEnabled(v: Boolean) { _enabled.value = v }

    fun startLocalRecording(sessionName: String, sessionId: String): Boolean {
        if (!_enabled.value) return false
        val mgr = manager ?: return false
        val dir = orchestratorOutputDir ?: return false
        return runCatching {
            mgr.startRecording(dir, sessionName.ifBlank { "orchestrator" }, sessionId)
            true
        }.getOrDefault(false)
    }

    fun stopLocalRecording() {
        runCatching { manager?.stopRecording() }
    }
}

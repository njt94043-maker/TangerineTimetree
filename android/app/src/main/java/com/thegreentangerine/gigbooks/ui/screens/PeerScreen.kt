package com.thegreentangerine.gigbooks.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.FiberManualRecord
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import com.thegreentangerine.gigbooks.data.orchestrator.PeerOrchestratorClient
import com.thegreentangerine.gigbooks.data.xr18.PhoneSettings
import com.thegreentangerine.gigbooks.ui.AppViewModel
import com.thegreentangerine.gigbooks.ui.theme.Karla
import com.thegreentangerine.gigbooks.ui.theme.TangerineColors
import java.io.File

/**
 * Peer-mode screen for non-drummer phones in the gig camera fleet (S118 A2 + S121).
 *
 * Auto-discovers the drummer's orchestrator via mDNS (`_tgt-orchestrator._tcp.`),
 * connects, pairs, and binds CameraX. When the orchestrator broadcasts StartRec,
 * this peer starts a local MP4 recording AND begins streaming JPEG preview frames
 * back so the drummer's orchestrator drawer can show a live thumbnail. StopRec
 * finalises the recording.
 *
 * Output dir: `<filesDir>/peer_recordings`. File names include the orchestrator's
 * sessionId so audio (Reaper) and per-peer video can be correlated post-gig.
 *
 * The same APK runs in either orchestrator OR peer mode depending on which drawer
 * entry the user opens. Picking the right device is on the human, by design — gig
 * setup is an explicit ritual, not auto-elected.
 *
 * Note: this screen has no foreground service yet. Backgrounding the app or
 * navigating away mid-recording will tear down the peer connection and stop the
 * recording. Foreground-service lift is a follow-up; gig usage is "open the
 * screen, leave it open, screen on" for now.
 */
@Composable
fun PeerScreen(onMenuClick: () -> Unit) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val vm: AppViewModel = viewModel()
    val client = remember { PeerOrchestratorClient(context) }
    val cameraManager = vm.cameraRecording
    var lastSession by remember { mutableStateOf<String?>(null) }
    var lastRecToggleMs by remember { mutableLongStateOf(0L) }
    var previewView by remember { mutableStateOf<PreviewView?>(null) }

    // Camera permission flow — peer mode requires camera + audio (CameraX records audio with video)
    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        )
    }
    val permLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        hasCameraPermission = granted
    }
    LaunchedEffect(Unit) {
        if (!hasCameraPermission) permLauncher.launch(Manifest.permission.CAMERA)
    }

    // Bind CameraX as soon as permission + PreviewView are both ready. CameraX is
    // idempotent on rebind via applySettings → rebind, so re-entering the screen
    // won't double-bind.
    LaunchedEffect(hasCameraPermission, previewView) {
        val pv = previewView
        if (hasCameraPermission && pv != null) {
            vm.bindCamera(lifecycleOwner, pv, PhoneSettings())
        }
    }

    // Wire client callbacks → CameraRecordingManager. Output goes to a dedicated
    // peer dir so it doesn't collide with the legacy XR18 camera flow's files.
    DisposableEffect(client, cameraManager) {
        val outputDir = File(context.filesDir, "peer_recordings")
        client.onStartRec = { sessionId, sessionName ->
            lastSession = sessionId
            lastRecToggleMs = System.currentTimeMillis()
            runCatching {
                cameraManager.startRecording(outputDir, sessionName.ifBlank { "gig-set" }, sessionId)
            }
        }
        client.onStopRec = {
            lastRecToggleMs = System.currentTimeMillis()
            runCatching { cameraManager.stopRecording() }
        }
        // Periodic preview heartbeat (3s when paired, 8s when recording — see PeerOrchestratorClient).
        client.providePreviewFrame = { cameraManager.capturePreviewFrame() }
        client.start()
        onDispose {
            client.shutdown()
            // Stop any in-flight recording when the user navigates away. The
            // CameraRecordingManager itself outlives the screen (ViewModel-owned)
            // so the camera doesn't have to re-bind on every visit.
            runCatching { cameraManager.stopRecording() }
        }
    }

    val state by client.state.collectAsState()
    val discovered by client.discovered.collectAsState()
    val phoneId by client.phoneId.collectAsState()
    val isRecording by cameraManager.isRecording.collectAsState()

    val statusText = when (state) {
        PeerOrchestratorClient.State.Idle -> "Idle"
        PeerOrchestratorClient.State.Discovering -> "Searching for orchestrator…"
        PeerOrchestratorClient.State.Connecting -> "Connecting…"
        PeerOrchestratorClient.State.Paired -> "Paired — standing by"
        PeerOrchestratorClient.State.Recording -> "Recording"
    }
    val statusColor = when (state) {
        PeerOrchestratorClient.State.Recording -> TangerineColors.danger
        PeerOrchestratorClient.State.Paired -> TangerineColors.green
        PeerOrchestratorClient.State.Connecting -> TangerineColors.orange
        else -> TangerineColors.textMuted
    }

    Column(modifier = Modifier.fillMaxSize().background(TangerineColors.background)) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onMenuClick) {
                Icon(Icons.Default.Menu, "Menu", tint = TangerineColors.text)
            }
            Spacer(Modifier.width(4.dp))
            Text(
                "Peer camera",
                fontFamily = Karla,
                fontWeight = FontWeight.Bold,
                fontSize = 22.sp,
                color = TangerineColors.text,
            )
        }

        if (!hasCameraPermission) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.CameraAlt, "Camera", tint = TangerineColors.textMuted, modifier = Modifier.size(48.dp))
                    Spacer(Modifier.height(12.dp))
                    Text("Camera permission required", color = TangerineColors.text, fontFamily = Karla)
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "Peer mode records video while the drummer's RECORD is active.",
                        color = TangerineColors.textMuted, fontFamily = Karla, fontSize = 12.sp,
                    )
                    Spacer(Modifier.height(12.dp))
                    Button(onClick = { permLauncher.launch(Manifest.permission.CAMERA) }) {
                        Text("Grant permission")
                    }
                }
            }
            return@Column
        }

        Column(
            modifier = Modifier.padding(horizontal = 16.dp).fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // Status card — orchestrator + connection state
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(TangerineColors.surface)
                    .border(1.dp, TangerineColors.textMuted.copy(alpha = 0.2f), RoundedCornerShape(12.dp))
                    .padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(modifier = Modifier.size(10.dp).clip(CircleShape).background(statusColor))
                    Spacer(Modifier.width(8.dp))
                    Text(
                        "Orchestrator",
                        fontFamily = Karla,
                        fontWeight = FontWeight.SemiBold,
                        color = TangerineColors.text,
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(statusText, fontFamily = Karla, color = TangerineColors.textMuted, fontSize = 12.sp)
                }
                Text(
                    discovered?.let { "Found: ${it.name} → ${it.host}:${it.port}" }
                        ?: "Not yet discovered",
                    fontFamily = Karla,
                    color = TangerineColors.textMuted,
                    fontSize = 12.sp,
                )
                phoneId?.let {
                    Text(
                        "Phone ID: $it",
                        fontFamily = Karla,
                        color = TangerineColors.textMuted.copy(alpha = 0.7f),
                        fontSize = 11.sp,
                    )
                }
            }

            // Camera preview — fills space; red border + REC pill when recording
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(4f / 3f)
                    .clip(RoundedCornerShape(12.dp))
                    .background(Color.Black)
                    .border(
                        2.dp,
                        if (isRecording) TangerineColors.danger else TangerineColors.textMuted.copy(alpha = 0.2f),
                        RoundedCornerShape(12.dp),
                    ),
            ) {
                AndroidView(
                    factory = { ctx ->
                        PreviewView(ctx).also { pv -> previewView = pv }
                    },
                    modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(12.dp)),
                )
                if (isRecording) {
                    Row(
                        modifier = Modifier
                            .align(Alignment.TopStart)
                            .padding(10.dp)
                            .background(TangerineColors.danger.copy(alpha = 0.85f), RoundedCornerShape(20.dp))
                            .padding(horizontal = 10.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            Icons.Default.FiberManualRecord,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(10.dp),
                        )
                        Spacer(Modifier.width(6.dp))
                        Text("REC", color = Color.White, fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    }
                }
            }

            lastSession?.let {
                Text(
                    "Last session: $it",
                    fontFamily = Karla,
                    color = TangerineColors.textMuted.copy(alpha = 0.7f),
                    fontSize = 11.sp,
                )
            }

            Text(
                "Recording is controlled by the drummer. Keep this screen open during the gig.",
                fontFamily = Karla,
                color = TangerineColors.textMuted.copy(alpha = 0.6f),
                fontSize = 11.sp,
            )
        }
    }
}

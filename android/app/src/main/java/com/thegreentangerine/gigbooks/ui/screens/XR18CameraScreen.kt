package com.thegreentangerine.gigbooks.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.thegreentangerine.gigbooks.data.xr18.*
import com.thegreentangerine.gigbooks.ui.theme.TangerineColors
import com.thegreentangerine.gigbooks.ui.theme.Karla
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.io.File

@OptIn(ExperimentalGetImage::class)
@Composable
fun XR18CameraScreen(
    onMenuClick: () -> Unit,
    onBack: () -> Unit,
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val scope = rememberCoroutineScope()

    // State
    var hasCameraPermission by remember {
        mutableStateOf(ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED)
    }
    val permLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        hasCameraPermission = granted
    }

    // Bluetooth permission (Android 12+ requires BLUETOOTH_CONNECT)
    var hasBtPermission by remember {
        mutableStateOf(
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
                ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED
            else true
        )
    }
    val btPermLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        hasBtPermission = granted
    }

    // Managers
    val manager = remember { PhoneCompanionManager(context) }
    val cameraManager = remember { CameraRecordingManager(context) }
    val connectionState by manager.state.collectAsState()
    val phoneId by manager.phoneId.collectAsState()
    val error by manager.error.collectAsState()
    val isRecording by cameraManager.isRecording.collectAsState()
    val settings by manager.currentSettings.collectAsState()
    val isBtConnected by manager.btConnected.collectAsState()
    val isTcpConnected by manager.tcpConnected.collectAsState()
    val isRelayConnected by manager.relayConnected.collectAsState()

    // Scan mode state
    var showManualEntry by remember { mutableStateOf(false) }
    var manualIp by remember { mutableStateOf("") }
    var manualPort by remember { mutableStateOf("8730") }
    var manualSecret by remember { mutableStateOf("") }
    var isScanning by remember { mutableStateOf(true) }
    var previewView by remember { mutableStateOf<PreviewView?>(null) }

    // Recording elapsed time
    var recStartTime by remember { mutableLongStateOf(0L) }
    var elapsedSec by remember { mutableIntStateOf(0) }

    // Wire callbacks
    DisposableEffect(manager) {
        manager.onStartRecording = { sessionName, sessionId ->
            val dir = File(context.filesDir, "xr18_recordings")
            cameraManager.startRecording(dir, sessionName, sessionId)
            recStartTime = System.currentTimeMillis()
        }
        manager.onStopRecording = {
            cameraManager.stopRecording()
        }
        manager.onSettingsChanged = { newSettings ->
            previewView?.let { pv ->
                cameraManager.applySettings(lifecycleOwner, pv, newSettings)
            }
        }
        manager.capturePreviewFrame = { cameraManager.capturePreviewFrame() }

        // QR code scanning: auto-connect when a valid QR code is detected
        cameraManager.onQrCodeScanned = { pairingInfo ->
            manager.connect(pairingInfo)
        }

        onDispose {
            manager.disconnect()
            cameraManager.release()
        }
    }

    // Enable QR scanning when disconnected
    LaunchedEffect(connectionState) {
        cameraManager.qrScanEnabled = connectionState == ConnectionState.Disconnected || connectionState == ConnectionState.Error
    }

    // Elapsed time ticker
    LaunchedEffect(isRecording) {
        if (isRecording) {
            while (true) {
                elapsedSec = ((System.currentTimeMillis() - recStartTime) / 1000).toInt()
                delay(1000)
            }
        } else {
            elapsedSec = 0
        }
    }

    // Request camera + BT permissions on first compose
    LaunchedEffect(Unit) {
        if (!hasCameraPermission) {
            permLauncher.launch(Manifest.permission.CAMERA)
        }
        if (!hasBtPermission && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            btPermLauncher.launch(Manifest.permission.BLUETOOTH_CONNECT)
        }
    }

    if (!hasCameraPermission) {
        Box(Modifier.fillMaxSize().background(TangerineColors.background), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(Icons.Default.CameraAlt, "Camera", tint = TangerineColors.textMuted, modifier = Modifier.size(48.dp))
                Spacer(Modifier.height(12.dp))
                Text("Camera permission required", color = TangerineColors.text, fontFamily = Karla)
                Spacer(Modifier.height(8.dp))
                Button(onClick = { permLauncher.launch(Manifest.permission.CAMERA) }) {
                    Text("Grant Permission")
                }
            }
        }
        return
    }

    Box(Modifier.fillMaxSize().background(TangerineColors.background)) {
        // Camera preview (full screen background)
        AndroidView(
            factory = { ctx ->
                PreviewView(ctx).also { pv ->
                    previewView = pv
                    cameraManager.bind(lifecycleOwner, pv, settings)
                }
            },
            modifier = Modifier.fillMaxSize(),
        )

        // Top status bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(12.dp)
                .background(Color.Black.copy(alpha = 0.6f), RoundedCornerShape(8.dp))
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onMenuClick, modifier = Modifier.size(32.dp)) {
                Icon(Icons.Default.Menu, "Menu", tint = Color.White)
            }
            Spacer(Modifier.width(8.dp))
            Text("XR18 Camera", color = Color.White, fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            Spacer(Modifier.weight(1f))

            // Connection indicator
            val (statusColor, statusText) = when (connectionState) {
                ConnectionState.Disconnected -> TangerineColors.textMuted to "Disconnected"
                ConnectionState.Connecting -> TangerineColors.orange to "Connecting…"
                ConnectionState.Pairing -> TangerineColors.orange to "Pairing…"
                ConnectionState.Connected -> TangerineColors.green to "Connected"
                ConnectionState.Recording -> Color.Red to "REC"
                ConnectionState.Error -> Color.Red to "Error"
            }
            Box(
                Modifier.size(8.dp).clip(CircleShape).background(statusColor)
            )
            Spacer(Modifier.width(6.dp))
            Text(statusText, color = Color.White, fontFamily = Karla, fontSize = 12.sp)
        }

        // Recording indicator overlay
        if (isRecording) {
            Box(
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .statusBarsPadding()
                    .padding(top = 56.dp)
                    .background(Color.Red.copy(alpha = 0.85f), RoundedCornerShape(20.dp))
                    .padding(horizontal = 16.dp, vertical = 6.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(10.dp).clip(CircleShape).background(Color.White))
                    Spacer(Modifier.width(8.dp))
                    Text(
                        "REC  ${String.format("%02d:%02d:%02d", elapsedSec / 3600, (elapsedSec % 3600) / 60, elapsedSec % 60)}",
                        color = Color.White, fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 14.sp,
                    )
                }
            }
        }

        // Bottom panel: scan/connect controls or connection info
        Column(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .background(Color.Black.copy(alpha = 0.7f), RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp))
                .padding(16.dp),
        ) {
            when {
                connectionState == ConnectionState.Disconnected || connectionState == ConnectionState.Error -> {
                    // Scan / connect UI
                    if (error != null) {
                        Text("⚠ $error", color = Color(0xFFFF6B6B), fontFamily = Karla, fontSize = 13.sp)
                        Spacer(Modifier.height(8.dp))
                    }

                    Text("Scan QR code from XR18 Studio", color = Color.White, fontFamily = Karla, fontWeight = FontWeight.Bold)
                    Text("Point camera at QR code on the PHONES tab", color = TangerineColors.textMuted, fontFamily = Karla, fontSize = 12.sp)
                    Spacer(Modifier.height(12.dp))

                    // Manual entry toggle
                    TextButton(onClick = { showManualEntry = !showManualEntry }) {
                        Text(
                            if (showManualEntry) "Hide manual entry" else "Enter manually instead",
                            color = TangerineColors.orange, fontFamily = Karla,
                        )
                    }

                    if (showManualEntry) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(
                                value = manualIp, onValueChange = { manualIp = it },
                                label = { Text("IP Address") },
                                modifier = Modifier.weight(2f),
                                singleLine = true,
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedTextColor = Color.White, unfocusedTextColor = Color.White,
                                    focusedBorderColor = TangerineColors.orange, unfocusedBorderColor = TangerineColors.textMuted,
                                    focusedLabelColor = TangerineColors.orange, unfocusedLabelColor = TangerineColors.textMuted,
                                ),
                            )
                            OutlinedTextField(
                                value = manualPort, onValueChange = { manualPort = it },
                                label = { Text("Port") },
                                modifier = Modifier.weight(1f),
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedTextColor = Color.White, unfocusedTextColor = Color.White,
                                    focusedBorderColor = TangerineColors.orange, unfocusedBorderColor = TangerineColors.textMuted,
                                    focusedLabelColor = TangerineColors.orange, unfocusedLabelColor = TangerineColors.textMuted,
                                ),
                            )
                        }
                        Spacer(Modifier.height(8.dp))
                        OutlinedTextField(
                            value = manualSecret, onValueChange = { manualSecret = it },
                            label = { Text("Secret") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = Color.White, unfocusedTextColor = Color.White,
                                focusedBorderColor = TangerineColors.orange, unfocusedBorderColor = TangerineColors.textMuted,
                                focusedLabelColor = TangerineColors.orange, unfocusedLabelColor = TangerineColors.textMuted,
                            ),
                        )
                        Spacer(Modifier.height(12.dp))
                        Button(
                            onClick = {
                                val port = manualPort.toIntOrNull() ?: 8730
                                manager.connect(PairingInfo(listOf(manualIp), port, 0, manualSecret))
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = TangerineColors.orange),
                            modifier = Modifier.fillMaxWidth().height(48.dp),
                        ) {
                            Text("Connect", fontFamily = Karla, fontWeight = FontWeight.Bold)
                        }
                    }
                }

                connectionState == ConnectionState.Connected || connectionState == ConnectionState.Recording -> {
                    // Connected info
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Column {
                            Text("Connected to XR18 Studio", color = TangerineColors.green, fontFamily = Karla, fontWeight = FontWeight.Bold)
                            Text("ID: ${phoneId ?: "—"}", color = TangerineColors.textMuted, fontFamily = Karla, fontSize = 12.sp)
                            Text("${settings.resolution} @ ${settings.framerate}fps", color = TangerineColors.textMuted, fontFamily = Karla, fontSize = 12.sp)
                            // Transport indicators
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                val btColor = if (isBtConnected) TangerineColors.green else TangerineColors.textMuted
                                val tcpColor = if (isTcpConnected) TangerineColors.green else TangerineColors.textMuted
                                val relayColor = if (isRelayConnected) TangerineColors.green else TangerineColors.textMuted
                                Text("BT", color = btColor, fontFamily = Karla, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                Spacer(Modifier.width(4.dp))
                                Box(Modifier.size(6.dp).clip(CircleShape).background(btColor))
                                Spacer(Modifier.width(12.dp))
                                Text("TCP", color = tcpColor, fontFamily = Karla, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                Spacer(Modifier.width(4.dp))
                                Box(Modifier.size(6.dp).clip(CircleShape).background(tcpColor))
                                Spacer(Modifier.width(12.dp))
                                Text("RELAY", color = relayColor, fontFamily = Karla, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                Spacer(Modifier.width(4.dp))
                                Box(Modifier.size(6.dp).clip(CircleShape).background(relayColor))
                            }
                        }
                        OutlinedButton(
                            onClick = { manager.disconnect() },
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.Red),
                        ) {
                            Text("Disconnect", fontFamily = Karla)
                        }
                    }
                    if (isRecording) {
                        Spacer(Modifier.height(8.dp))
                        Text(
                            "Recording controlled by XR18 Studio",
                            color = TangerineColors.orange, fontFamily = Karla, fontSize = 12.sp,
                        )
                    }
                }

                else -> {
                    // Connecting/Pairing
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        CircularProgressIndicator(modifier = Modifier.size(20.dp), color = TangerineColors.orange, strokeWidth = 2.dp)
                        Spacer(Modifier.width(12.dp))
                        Text(
                            when (connectionState) {
                                ConnectionState.Connecting -> "Connecting…"
                                ConnectionState.Pairing -> "Pairing…"
                                else -> ""
                            },
                            color = Color.White, fontFamily = Karla,
                        )
                    }
                }
            }
        }
    }
}

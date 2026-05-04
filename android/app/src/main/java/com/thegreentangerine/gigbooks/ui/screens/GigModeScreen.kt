package com.thegreentangerine.gigbooks.ui.screens

import android.Manifest
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import android.os.Build
import android.os.IBinder
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.FiberManualRecord
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.QueueMusic
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.SkipPrevious
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.viewmodel.compose.viewModel
import com.thegreentangerine.gigbooks.data.orchestrator.CameraGate
import com.thegreentangerine.gigbooks.data.orchestrator.OrchestratorPeerServer
import com.thegreentangerine.gigbooks.data.orchestrator.OrchestratorService
import com.thegreentangerine.gigbooks.data.orchestrator.ReaperOscClient
import com.thegreentangerine.gigbooks.data.orchestrator.RecordError
import com.thegreentangerine.gigbooks.data.supabase.SetlistEntriesRepository
import com.thegreentangerine.gigbooks.data.supabase.models.SetlistEntry
import com.thegreentangerine.gigbooks.data.xr18.CameraSettingsStore
import com.thegreentangerine.gigbooks.data.xr18.PhoneSettings
import com.thegreentangerine.gigbooks.ui.AppViewModel
import com.thegreentangerine.gigbooks.ui.components.CameraSettingsSheet
import com.thegreentangerine.gigbooks.ui.theme.JetBrainsMono
import com.thegreentangerine.gigbooks.ui.theme.Karla
import com.thegreentangerine.gigbooks.ui.theme.TangerineColors
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.io.File

/**
 * The drummer's gig surface (S118 / S121). Single screen merging the older
 * "Drummer Prompter" + "Orchestrator" surfaces.
 *
 * **Main view (always visible):**
 *  - Top bar: menu, "Gig Mode" + position sub-line, Reaper status pill.
 *  - BPM-flash hero showing the current setlist entry (title / artist / click
 *    chip). The card border + fill pulses on every beat at the entry's BPM.
 *  - Prev / Advance nav (Advance fires `/song_marker <title>` to Reaper as
 *    a bundled OSC packet — see [ReaperOscClient.sendSongMarker]).
 *  - Bottom row: Setlist drawer trigger (with position chip), Cameras drawer
 *    trigger (with peer count chip), RECORD / STOP toggle with set timer.
 *
 * **Drawers (slide-up bottom sheets):**
 *  - Setlist: full list view per `gig-mode-screen.html` (locked S97).
 *    Staples primary; pin Party or Classic Rock as a secondary side-by-side
 *    column. Played / current / queued row states. Tap any row → jump to it
 *    as the new "now" + fire `/song_marker`.
 *  - Cameras: peer fleet thumbnail grid. Tap → fullscreen.
 *  - Reaper config: tappable from the status pill. Auto-discovery toggle +
 *    manual host override.
 *
 * **Out of scope per `proj-tgt--mixer-deferred-xair-until-x32.md`:** mixer,
 * Main LR fader, click-IEM-solo, phantom master, emergency mute. Use the
 * Behringer X-Air official app.
 *
 * **Out of scope per Nathan (S121):** between-sets state, HUD strip, display
 * swap, projection override, visuals preview — those live elsewhere
 * (Media Server PWA / Studio v2) when wired.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GigModeScreen(onMenuClick: () -> Unit) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val vm: AppViewModel = viewModel()
    val cameraManager = vm.cameraRecording
    val settingsStore = remember { CameraSettingsStore(context) }
    val scope = rememberCoroutineScope()
    val orchestratorSettings by settingsStore.observe(CameraSettingsStore.Role.Orchestrator)
        .collectAsState(initial = PhoneSettings(cameraFacing = "front"))
    val cameraEnabled by CameraGate.enabled.collectAsState()
    var service by remember { mutableStateOf<OrchestratorService?>(null) }
    var cameraSettingsOpen by remember { mutableStateOf(false) }

    // Camera + audio runtime permissions for the orchestrator self-cam. Both
    // are required — withAudioEnabled() throws SecurityException without
    // RECORD_AUDIO. Was the v1.1.9/10 bug that lost gig video.
    fun hasPerm(p: String) = ContextCompat.checkSelfPermission(context, p) == PackageManager.PERMISSION_GRANTED
    var hasCamPerm by remember { mutableStateOf(hasPerm(Manifest.permission.CAMERA)) }
    var hasAudioPerm by remember { mutableStateOf(hasPerm(Manifest.permission.RECORD_AUDIO)) }
    val permLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { granted ->
        hasCamPerm = granted[Manifest.permission.CAMERA] == true || hasPerm(Manifest.permission.CAMERA)
        hasAudioPerm = granted[Manifest.permission.RECORD_AUDIO] == true || hasPerm(Manifest.permission.RECORD_AUDIO)
    }
    LaunchedEffect(cameraEnabled) {
        if (cameraEnabled) {
            val needed = buildList {
                if (!hasCamPerm) add(Manifest.permission.CAMERA)
                if (!hasAudioPerm) add(Manifest.permission.RECORD_AUDIO)
            }
            if (needed.isNotEmpty()) permLauncher.launch(needed.toTypedArray())
        }
    }

    DisposableEffect(Unit) {
        val intent = Intent(context, OrchestratorService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }
        val conn = object : ServiceConnection {
            override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
                service = (binder as? OrchestratorService.LocalBinder)?.service
            }
            override fun onServiceDisconnected(name: ComponentName?) { service = null }
        }
        context.bindService(intent, conn, Context.BIND_AUTO_CREATE)
        onDispose { runCatching { context.unbindService(conn) } }
    }

    // Hidden CameraX bind for orchestrator-as-3rd-camera. Bound only when the
    // orchestrator camera is enabled AND both perms granted (otherwise
    // withAudioEnabled() throws SecurityException at RECORD time and silently
    // fails — the gig-night S122 bug). previewView=null means no preview surface;
    // ImageAnalysis still snapshots JPEGs for the self-tile thumbnail.
    DisposableEffect(cameraEnabled, hasCamPerm, hasAudioPerm, orchestratorSettings.cameraFacing, orchestratorSettings.resolution, orchestratorSettings.framerate) {
        if (cameraEnabled && hasCamPerm && hasAudioPerm) {
            cameraManager.bind(lifecycleOwner, previewView = null, orchestratorSettings)
            CameraGate.manager = cameraManager
            CameraGate.orchestratorOutputDir = File(context.filesDir, "orchestrator_recordings")
        } else {
            CameraGate.manager = null
            runCatching { cameraManager.stopRecording() }
        }
        onDispose {
            CameraGate.manager = null
            CameraGate.orchestratorOutputDir = null
            runCatching { cameraManager.stopRecording() }
        }
    }
    LaunchedEffect(orchestratorSettings.useAutoRotation, orchestratorSettings.rotationDegrees) {
        cameraManager.applyRotation(orchestratorSettings)
    }

    LaunchedEffect(Unit) { SetlistEntriesRepository.start() }
    val entries by SetlistEntriesRepository.entries.collectAsState()
    val loading by SetlistEntriesRepository.loading.collectAsState()
    val repoError by SetlistEntriesRepository.error.collectAsState()

    var activeListId by remember { mutableStateOf(SetlistEntry.LIST_STAPLES) }
    var pinnedSecondaryListId by remember { mutableStateOf<String?>(null) }
    var activeEntryId by remember { mutableStateOf<String?>(null) }
    var openDrawer by remember { mutableStateOf<DrawerKind?>(null) }
    var fullscreenPeer by remember { mutableStateOf<OrchestratorPeerServer.PeerInfo?>(null) }
    var fullscreenSelf by remember { mutableStateOf(false) }
    var reaperConfigOpen by remember { mutableStateOf(false) }

    // Self-tile preview is real-time — local device, no network, so we collect
    // every frame ImageAnalysis emits (~camera fps). Drawer thumbnail + fullscreen
    // both update live without any polling delay.
    val selfPreviewJpeg by cameraManager.previewFlow.collectAsState()

    val activeList = remember(entries, activeListId) {
        entries.filter { it.listId == activeListId }.sortedBy { it.position }
    }
    LaunchedEffect(activeList, activeEntryId) {
        if (activeEntryId == null || activeList.none { it.id == activeEntryId }) {
            activeEntryId = activeList.firstOrNull()?.id
        }
    }
    val activeEntry = activeList.firstOrNull { it.id == activeEntryId }
    val activeIdx = activeEntry?.let { activeList.indexOf(it) } ?: 0

    val isRecording = service?.isRecording?.collectAsState()?.value ?: false
    val target = service?.osc?.target?.collectAsState()?.value
    val lastSendOk = service?.osc?.lastSendOk?.collectAsState()?.value
    val peerCount = service?.peerCount?.collectAsState()?.value ?: 0
    val peers = service?.peerInfos?.collectAsState()?.value ?: emptyList()
    val localCameraRecording by CameraGate.isRecording.collectAsState()
    val recordError by CameraGate.lastError.collectAsState()
    val discovered = service?.discoveryFlow?.collectAsState()?.value
    val isSearching = service?.isSearching?.collectAsState()?.value ?: false
    val autoDiscover = service?.autoDiscover?.collectAsState()?.value ?: true

    var setStartMs by remember { mutableLongStateOf(0L) }
    var setElapsedSec by remember { mutableIntStateOf(0) }
    LaunchedEffect(isRecording) {
        if (isRecording) {
            setStartMs = System.currentTimeMillis()
            while (isActive) {
                setElapsedSec = ((System.currentTimeMillis() - setStartMs) / 1000).toInt()
                delay(500)
            }
        } else {
            setElapsedSec = 0
        }
    }

    // BPM flash — only fires when entry has a populated BPM. Most seeded rows
    // are currently null (BPM-fill is the authoring-UI workstream).
    val bpm = (activeEntry?.bpm ?: 0).coerceIn(0, 300)
    var beatPulse by remember { mutableStateOf(false) }
    LaunchedEffect(bpm, activeEntry?.id) {
        if (bpm <= 0) return@LaunchedEffect
        val periodMs = (60_000L / bpm).coerceAtLeast(50L)
        while (isActive) {
            beatPulse = true; delay(80L)
            beatPulse = false; delay(periodMs - 80L)
        }
    }
    val pulseAlpha by animateFloatAsState(
        targetValue = if (beatPulse) 1f else 0f,
        animationSpec = tween(durationMillis = 70),
        label = "bpm-pulse",
    )

    if (entries.isEmpty()) {
        EmptyGigMode(onMenuClick = onMenuClick, loading = loading, errorMsg = repoError)
        return
    }

    Column(modifier = Modifier.fillMaxSize().background(TangerineColors.background)) {
        // ── Top bar ──
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onMenuClick) {
                Icon(Icons.Default.Menu, "Menu", tint = TangerineColors.text)
            }
            Spacer(Modifier.width(4.dp))
            Column(
                modifier = Modifier
                    .weight(1f)
                    .clickable { openDrawer = DrawerKind.Setlist },
            ) {
                Text(
                    "Gig Mode",
                    fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 18.sp,
                    color = TangerineColors.text,
                )
                Text(
                    if (activeEntry != null) "${activeIdx + 1} of ${activeList.size} — ${SetlistEntry.LIST_LABELS[activeListId] ?: activeListId}"
                    else "no entry selected",
                    fontFamily = Karla, fontSize = 11.sp, color = TangerineColors.textMuted,
                )
            }
            ReaperStatusPill(
                target = target?.let { "${it.host}:${it.port}" },
                lastSendOk = lastSendOk,
                peerCount = peerCount,
                onClick = { reaperConfigOpen = true },
            )
        }

        // ── Capture status banner — visible at-a-glance "is RECORD actually working" ──
        // Counts everything the orchestrator fans out to: Reaper (1), self-cam (0/1
        // depending on toggle), peer phones (N). Gives an honest live answer instead
        // of the silent failure that lost S122.
        CaptureStatusBanner(
            reaperReady = target != null && lastSendOk != false,
            selfCameraEnabled = cameraEnabled,
            selfCameraReady = cameraEnabled && CameraGate.manager != null,
            selfCameraRecording = localCameraRecording,
            peerCount = peerCount,
            peerRecordingCount = peers.count { it.isRecording },
            isRecording = isRecording,
            recordError = recordError,
            onClearError = { CameraGate.clearError() },
        )

        // ── BPM flash hero ──
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp)
                .height(280.dp)
                .clip(RoundedCornerShape(20.dp))
                .background(TangerineColors.surface)
                .border(
                    width = 2.dp,
                    color = TangerineColors.green.copy(alpha = 0.25f + pulseAlpha * 0.7f),
                    shape = RoundedCornerShape(20.dp),
                ),
            contentAlignment = Alignment.Center,
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .clip(RoundedCornerShape(20.dp))
                    .background(TangerineColors.green.copy(alpha = pulseAlpha * 0.10f)),
            )
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    if (bpm > 0) bpm.toString() else "—",
                    fontFamily = JetBrainsMono, fontWeight = FontWeight.Bold,
                    fontSize = 88.sp, color = TangerineColors.green,
                )
                Text(
                    "BPM",
                    fontFamily = JetBrainsMono, fontSize = 11.sp,
                    color = TangerineColors.green.copy(alpha = 0.6f),
                )
                Spacer(Modifier.height(14.dp))
                Text(
                    activeEntry?.title ?: "—",
                    fontFamily = Karla, fontWeight = FontWeight.Bold,
                    fontSize = 22.sp, color = TangerineColors.text,
                )
                if (!activeEntry?.artist.isNullOrBlank()) {
                    Text(
                        activeEntry!!.artist!!,
                        fontFamily = Karla, fontSize = 13.sp, color = TangerineColors.textMuted,
                    )
                }
                if (activeEntry?.clickYN == true) {
                    Spacer(Modifier.height(6.dp))
                    Text(
                        "CLICK",
                        fontFamily = JetBrainsMono, fontWeight = FontWeight.Bold,
                        fontSize = 9.sp, color = TangerineColors.purple, letterSpacing = 2.sp,
                    )
                }
            }
        }

        // ── Prev / Advance nav ──
        val prev = activeList.getOrNull(activeIdx - 1)
        val next = activeList.getOrNull(activeIdx + 1)
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            NavSongButton(
                modifier = Modifier.weight(1f),
                label = "PREV", songName = prev?.title,
                icon = Icons.Default.SkipPrevious, enabled = prev != null,
                onClick = { activeEntryId = prev?.id },
            )
            NavSongButton(
                modifier = Modifier.weight(1f),
                label = "ADVANCE", songName = next?.title,
                icon = Icons.Default.SkipNext, accent = TangerineColors.green,
                enabled = next != null,
                onClick = {
                    val tgt = next ?: return@NavSongButton
                    activeEntryId = tgt.id
                    service?.sendSongMarker(tgt.title)
                },
            )
        }

        Spacer(Modifier.weight(1f))

        // ── Bottom row: drawer triggers + RECORD ──
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            DrawerTrigger(
                modifier = Modifier.weight(1f),
                icon = Icons.Default.QueueMusic,
                label = "Setlist",
                badge = if (activeEntry != null) "${activeIdx + 1}/${activeList.size}" else null,
                onClick = { openDrawer = DrawerKind.Setlist },
            )
            DrawerTrigger(
                modifier = Modifier.weight(1f),
                icon = Icons.Default.Videocam,
                label = "Cameras",
                badge = if (peerCount > 0) peerCount.toString() else null,
                onClick = { openDrawer = DrawerKind.Cameras },
            )
            RecordButton(
                modifier = Modifier.weight(1.5f),
                isRecording = isRecording,
                elapsedSec = setElapsedSec,
                enabled = target != null,
                onClick = {
                    if (isRecording) service?.stopRecording() else service?.startRecording()
                },
            )
        }
    }

    // ── Setlist drawer ──
    if (openDrawer == DrawerKind.Setlist) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(
            onDismissRequest = { openDrawer = null },
            sheetState = sheetState,
            containerColor = TangerineColors.surface,
            scrimColor = Color.Black.copy(alpha = 0.6f),
        ) {
            SetlistDrawer(
                entries = entries,
                primaryListId = activeListId,
                secondaryListId = pinnedSecondaryListId,
                activeEntryId = activeEntryId,
                onPickPrimary = { activeListId = it; pinnedSecondaryListId = null },
                onTogglePinSecondary = { listId ->
                    pinnedSecondaryListId = if (pinnedSecondaryListId == listId) null else listId
                },
                onTapEntry = { entry ->
                    activeListId = entry.listId
                    activeEntryId = entry.id
                    service?.sendSongMarker(entry.title)
                    openDrawer = null
                },
            )
        }
    }

    // ── Cameras drawer ──
    if (openDrawer == DrawerKind.Cameras) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(
            onDismissRequest = { openDrawer = null },
            sheetState = sheetState,
            containerColor = TangerineColors.surface,
            scrimColor = Color.Black.copy(alpha = 0.6f),
        ) {
            CamerasDrawer(
                peers = peers,
                isRecording = isRecording,
                selfEnabled = cameraEnabled,
                selfPreviewJpeg = selfPreviewJpeg,
                selfFacingLabel = if (orchestratorSettings.cameraFacing == "front") "front" else "back",
                onSelfEnabledChange = { CameraGate.setEnabled(it) },
                onSelfSettingsClick = { cameraSettingsOpen = true },
                onSelfTap = { fullscreenSelf = true },
                onPeerTap = { fullscreenPeer = it },
            )
        }
    }

    // ── Reaper config sheet ──
    if (reaperConfigOpen) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(
            onDismissRequest = { reaperConfigOpen = false },
            sheetState = sheetState,
            containerColor = TangerineColors.surface,
            scrimColor = Color.Black.copy(alpha = 0.6f),
        ) {
            ReaperConfigPane(
                target = target,
                discovered = discovered,
                isSearching = isSearching,
                lastSendOk = lastSendOk,
                autoDiscover = autoDiscover,
                onAutoDiscoverChange = { service?.setAutoDiscover(it) },
                onManualHostChange = { host, port -> service?.osc?.setTarget(host, port) },
            )
        }
    }

    // ── Fullscreen peer preview ──
    fullscreenPeer?.let { peer ->
        PeerPreviewFullscreen(peer = peer, onDismiss = { fullscreenPeer = null })
    }

    // ── Fullscreen self (drummer-cam) preview ──
    if (fullscreenSelf) {
        CameraPreviewFullscreen(
            label = "Drummer cam (S23U)",
            jpeg = selfPreviewJpeg,
            onDismiss = { fullscreenSelf = false },
        )
    }

    // ── Orchestrator camera settings sheet ──
    if (cameraSettingsOpen) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(
            onDismissRequest = { cameraSettingsOpen = false },
            sheetState = sheetState,
            containerColor = TangerineColors.surface,
            scrimColor = Color.Black.copy(alpha = 0.6f),
        ) {
            CameraSettingsSheet(
                title = "Drummer cam (S23U)",
                subtitle = "S23U records its own video while running the prompter. Mount it where you want it filming from, then forget it.",
                settings = orchestratorSettings,
                onChange = { new ->
                    scope.launch { settingsStore.update(CameraSettingsStore.Role.Orchestrator, new) }
                },
            )
        }
    }
}

private enum class DrawerKind { Setlist, Cameras }

// ─── Reusable bits ───────────────────────────────────────────────────────────

@Composable
private fun ReaperStatusPill(
    target: String?, lastSendOk: Boolean?, peerCount: Int, onClick: () -> Unit,
) {
    val color = when {
        target == null -> TangerineColors.textMuted
        lastSendOk == false -> TangerineColors.danger
        lastSendOk == true -> TangerineColors.green
        else -> TangerineColors.orange
    }
    Column(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 8.dp, vertical = 4.dp),
        horizontalAlignment = Alignment.End,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(modifier = Modifier.size(8.dp).clip(CircleShape).background(color))
            Spacer(Modifier.width(6.dp))
            Text(
                target ?: "no Reaper",
                fontFamily = JetBrainsMono, fontSize = 10.sp, color = TangerineColors.textMuted,
            )
        }
        Text(
            "$peerCount peer${if (peerCount == 1) "" else "s"}",
            fontFamily = JetBrainsMono, fontSize = 9.sp,
            color = TangerineColors.textMuted.copy(alpha = 0.7f),
        )
    }
}

@Composable
private fun NavSongButton(
    modifier: Modifier,
    label: String,
    songName: String?,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    accent: Color = TangerineColors.textMuted,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    val tint = if (enabled) accent else TangerineColors.textMuted.copy(alpha = 0.3f)
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(14.dp))
            .background(TangerineColors.surface)
            .border(
                1.dp,
                tint.copy(alpha = if (enabled) 0.5f else 0.15f),
                RoundedCornerShape(14.dp),
            )
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 14.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, contentDescription = label, tint = tint, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(6.dp))
            Text(label, fontFamily = JetBrainsMono, fontSize = 11.sp, color = tint, fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.height(4.dp))
        Text(
            songName ?: "—",
            fontFamily = Karla, fontSize = 13.sp,
            color = if (enabled) TangerineColors.text else TangerineColors.textMuted.copy(alpha = 0.5f),
            fontWeight = FontWeight.SemiBold, maxLines = 1,
        )
    }
}

@Composable
private fun DrawerTrigger(
    modifier: Modifier,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    badge: String?,
    onClick: () -> Unit,
) {
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(TangerineColors.surface)
            .border(1.dp, TangerineColors.textMuted.copy(alpha = 0.2f), RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = label, tint = TangerineColors.text, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(6.dp))
        Text(label, fontFamily = Karla, fontSize = 12.sp, color = TangerineColors.text, fontWeight = FontWeight.SemiBold)
        if (badge != null) {
            Spacer(Modifier.width(6.dp))
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(10.dp))
                    .background(TangerineColors.orange.copy(alpha = 0.18f))
                    .padding(horizontal = 6.dp, vertical = 1.dp),
            ) {
                Text(badge, fontFamily = JetBrainsMono, fontSize = 10.sp, color = TangerineColors.orange)
            }
        }
    }
}

@Composable
private fun RecordButton(
    modifier: Modifier,
    isRecording: Boolean,
    elapsedSec: Int,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    val tint = if (isRecording) TangerineColors.danger else TangerineColors.orange
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(14.dp))
            .background(tint.copy(alpha = if (enabled) 0.12f else 0.04f))
            .border(
                2.dp,
                tint.copy(alpha = if (enabled) 0.6f else 0.2f),
                RoundedCornerShape(14.dp),
            )
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        Icon(
            imageVector = if (isRecording) Icons.Default.Stop else Icons.Default.FiberManualRecord,
            contentDescription = if (isRecording) "Stop set" else "Record",
            tint = tint, modifier = Modifier.size(22.dp),
        )
        Spacer(Modifier.width(6.dp))
        Column {
            Text(
                when {
                    !enabled -> "no Reaper"
                    isRecording -> "STOP SET"
                    else -> "RECORD"
                },
                fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = tint,
            )
            if (isRecording) {
                Text(
                    "%02d:%02d:%02d".format(elapsedSec / 3600, (elapsedSec % 3600) / 60, elapsedSec % 60),
                    fontFamily = JetBrainsMono, fontSize = 10.sp,
                    color = tint.copy(alpha = 0.8f),
                )
            }
        }
    }
}

// ─── Setlist drawer ──────────────────────────────────────────────────────────

@Composable
private fun SetlistDrawer(
    entries: List<SetlistEntry>,
    primaryListId: String,
    secondaryListId: String?,
    activeEntryId: String?,
    onPickPrimary: (String) -> Unit,
    onTogglePinSecondary: (String) -> Unit,
    onTapEntry: (SetlistEntry) -> Unit,
) {
    val primaryList = entries.filter { it.listId == primaryListId }.sortedBy { it.position }
    val secondaryList = secondaryListId?.let { id -> entries.filter { it.listId == id }.sortedBy { it.position } }

    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(bottom = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "Setlist",
                fontFamily = Karla, fontWeight = FontWeight.Bold,
                fontSize = 16.sp, color = TangerineColors.text,
                modifier = Modifier.weight(1f),
            )
            Text(
                "tap to jump",
                fontFamily = JetBrainsMono, fontSize = 9.sp, color = TangerineColors.textMuted,
            )
        }

        // List pills — primary + pinnable secondaries.
        Row(
            modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            SetlistEntry.LIST_ORDER.forEach { listId ->
                val isPrimary = listId == primaryListId
                val isPinnedSecondary = listId == secondaryListId
                val count = entries.count { it.listId == listId }
                ListPill(
                    modifier = Modifier.weight(1f),
                    label = SetlistEntry.LIST_LABELS[listId] ?: listId,
                    count = count,
                    role = when {
                        isPrimary -> ListPillRole.Primary
                        isPinnedSecondary -> ListPillRole.PinnedSecondary
                        else -> ListPillRole.Available
                    },
                    onClick = {
                        if (isPrimary) {
                            // Tapping the primary pill is a no-op (already primary).
                        } else if (isPinnedSecondary) {
                            // Promote secondary → primary.
                            onPickPrimary(listId)
                        } else {
                            // Toggle pin alongside.
                            onTogglePinSecondary(listId)
                        }
                    },
                    onLongClick = {
                        // Long-press → make primary directly. (Not yet wired to a
                        // gesture detector here; left as a future affordance.)
                        onPickPrimary(listId)
                    },
                )
            }
        }

        Text(
            when {
                secondaryList != null -> "${SetlistEntry.LIST_LABELS[primaryListId]} (primary) + ${SetlistEntry.LIST_LABELS[secondaryListId]} (alongside) — tap +list pill to pin/unpin, tap a pinned pill to promote.".replace(" — ", " — ")
                else -> "Tap +Party / +Classic Rock to pin a second list alongside."
            },
            fontFamily = Karla, fontSize = 10.sp,
            color = TangerineColors.textMuted.copy(alpha = 0.7f),
            modifier = Modifier.padding(bottom = 6.dp),
        )

        if (secondaryList == null) {
            // Single column.
            LazyColumn(modifier = Modifier.fillMaxWidth().height(560.dp)) {
                itemsIndexed(primaryList, key = { _, e -> e.id }) { idx, entry ->
                    SetlistRow(
                        entry = entry,
                        position = idx + 1,
                        state = rowState(idx, entry.id, activeEntryId, primaryList),
                        onClick = { onTapEntry(entry) },
                    )
                }
            }
        } else {
            // Two columns side-by-side. On a phone, this is tight — each column ~160dp.
            Row(modifier = Modifier.fillMaxWidth().height(560.dp)) {
                SetlistColumn(
                    modifier = Modifier.weight(1f).padding(end = 4.dp),
                    label = SetlistEntry.LIST_LABELS[primaryListId] ?: primaryListId,
                    sub = "primary",
                    list = primaryList,
                    activeEntryId = activeEntryId,
                    onTap = onTapEntry,
                )
                SetlistColumn(
                    modifier = Modifier.weight(1f).padding(start = 4.dp),
                    label = SetlistEntry.LIST_LABELS[secondaryListId] ?: secondaryListId,
                    sub = "alongside",
                    list = secondaryList,
                    activeEntryId = activeEntryId,
                    onTap = onTapEntry,
                )
            }
        }
    }
}

private enum class ListPillRole { Primary, PinnedSecondary, Available }

@Composable
private fun ListPill(
    modifier: Modifier,
    label: String,
    count: Int,
    role: ListPillRole,
    onClick: () -> Unit,
    onLongClick: () -> Unit,
) {
    val bg = when (role) {
        ListPillRole.Primary -> TangerineColors.orange.copy(alpha = 0.14f)
        ListPillRole.PinnedSecondary -> TangerineColors.teal.copy(alpha = 0.12f)
        ListPillRole.Available -> TangerineColors.surface
    }
    val border = when (role) {
        ListPillRole.Primary -> TangerineColors.orange.copy(alpha = 0.6f)
        ListPillRole.PinnedSecondary -> TangerineColors.teal.copy(alpha = 0.5f)
        ListPillRole.Available -> TangerineColors.textMuted.copy(alpha = 0.2f)
    }
    val textColor = when (role) {
        ListPillRole.Primary -> TangerineColors.orange
        ListPillRole.PinnedSecondary -> TangerineColors.teal
        ListPillRole.Available -> TangerineColors.textMuted
    }
    val prefix = when (role) {
        ListPillRole.Primary -> ""
        ListPillRole.PinnedSecondary -> "+ "
        ListPillRole.Available -> "+ "
    }
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(bg)
            .border(1.dp, border, RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 8.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        Text(
            "$prefix$label",
            fontFamily = Karla, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = textColor,
        )
        Spacer(Modifier.width(4.dp))
        Text(
            count.toString(),
            fontFamily = JetBrainsMono, fontSize = 10.sp,
            color = textColor.copy(alpha = 0.6f),
        )
    }
}

private enum class RowState { Played, Current, Queued, Default }

private fun rowState(idx: Int, entryId: String, activeEntryId: String?, list: List<SetlistEntry>): RowState {
    val activeIdx = list.indexOfFirst { it.id == activeEntryId }
    return when {
        entryId == activeEntryId -> RowState.Current
        activeIdx >= 0 && idx < activeIdx -> RowState.Played
        activeIdx >= 0 && idx == activeIdx + 1 -> RowState.Queued
        else -> RowState.Default
    }
}

@Composable
private fun SetlistColumn(
    modifier: Modifier,
    label: String,
    sub: String,
    list: List<SetlistEntry>,
    activeEntryId: String?,
    onTap: (SetlistEntry) -> Unit,
) {
    Column(modifier = modifier) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(label, fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 12.sp, color = TangerineColors.text)
            Spacer(Modifier.width(6.dp))
            Text(sub, fontFamily = JetBrainsMono, fontSize = 9.sp, color = TangerineColors.textMuted)
        }
        Spacer(Modifier.height(4.dp))
        LazyColumn {
            itemsIndexed(list, key = { _, e -> e.id }) { idx, entry ->
                SetlistRow(
                    entry = entry,
                    position = idx + 1,
                    state = rowState(idx, entry.id, activeEntryId, list),
                    onClick = { onTap(entry) },
                )
            }
        }
    }
}

@Composable
private fun SetlistRow(
    entry: SetlistEntry,
    position: Int,
    state: RowState,
    onClick: () -> Unit,
) {
    val bg = when (state) {
        RowState.Current -> TangerineColors.green.copy(alpha = 0.12f)
        RowState.Queued -> TangerineColors.orange.copy(alpha = 0.06f)
        else -> TangerineColors.background
    }
    val border = when (state) {
        RowState.Current -> TangerineColors.green.copy(alpha = 0.5f)
        RowState.Queued -> TangerineColors.orange.copy(alpha = 0.3f)
        else -> Color.Transparent
    }
    val titleColor = when (state) {
        RowState.Played -> TangerineColors.textMuted
        RowState.Current -> TangerineColors.text
        else -> TangerineColors.text
    }
    val subColor = when (state) {
        RowState.Played -> TangerineColors.textMuted.copy(alpha = 0.5f)
        else -> TangerineColors.textMuted
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(bg)
            .border(1.dp, border, RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            position.toString().padStart(2, '0'),
            fontFamily = JetBrainsMono, fontSize = 11.sp, color = subColor,
            modifier = Modifier.width(24.dp),
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                entry.title,
                fontFamily = Karla, fontWeight = FontWeight.SemiBold,
                fontSize = 13.sp, color = titleColor, maxLines = 1,
            )
            if (!entry.artist.isNullOrBlank()) {
                Text(
                    entry.artist,
                    fontFamily = Karla, fontSize = 10.sp, color = subColor, maxLines = 1,
                )
            }
        }
        if (entry.bpm != null) {
            Text(
                entry.bpm.toString(),
                fontFamily = JetBrainsMono, fontSize = 11.sp, color = subColor,
                modifier = Modifier.padding(start = 6.dp),
            )
        }
        if (entry.clickYN) {
            Spacer(Modifier.width(6.dp))
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(4.dp))
                    .background(TangerineColors.purple.copy(alpha = 0.15f))
                    .padding(horizontal = 5.dp, vertical = 1.dp),
            ) {
                Text("CLK", fontFamily = JetBrainsMono, fontSize = 8.sp, color = TangerineColors.purple)
            }
        }
        if (state == RowState.Current) {
            Spacer(Modifier.width(6.dp))
            Text("NOW", fontFamily = JetBrainsMono, fontSize = 8.sp, color = TangerineColors.green, fontWeight = FontWeight.Bold)
        } else if (state == RowState.Queued) {
            Spacer(Modifier.width(6.dp))
            Text("NEXT", fontFamily = JetBrainsMono, fontSize = 8.sp, color = TangerineColors.orange, fontWeight = FontWeight.Bold)
        }
    }
}

// ─── Cameras drawer ──────────────────────────────────────────────────────────

@Composable
private fun CamerasDrawer(
    peers: List<OrchestratorPeerServer.PeerInfo>,
    isRecording: Boolean,
    selfEnabled: Boolean,
    selfPreviewJpeg: ByteArray?,
    selfFacingLabel: String,
    onSelfEnabledChange: (Boolean) -> Unit,
    onSelfSettingsClick: () -> Unit,
    onSelfTap: () -> Unit,
    onPeerTap: (OrchestratorPeerServer.PeerInfo) -> Unit,
) {
    val totalCams = peers.size + (if (selfEnabled) 1 else 0)
    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "Cameras",
                fontFamily = Karla, fontWeight = FontWeight.Bold,
                fontSize = 16.sp, color = TangerineColors.text,
                modifier = Modifier.weight(1f),
            )
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(
                        if (isRecording) TangerineColors.danger.copy(alpha = 0.15f)
                        else TangerineColors.green.copy(alpha = 0.12f),
                    )
                    .padding(horizontal = 8.dp, vertical = 3.dp),
            ) {
                Text(
                    if (isRecording) "$totalCams/$totalCams REC" else "$totalCams ready",
                    fontFamily = JetBrainsMono, fontSize = 10.sp,
                    color = if (isRecording) TangerineColors.danger else TangerineColors.green,
                )
            }
        }
        Spacer(Modifier.height(8.dp))

        // Drummer-cam control row — toggle + cog above the preview grid.
        // The preview itself lives as a tile inside the grid alongside peers.
        DrummerCamControlRow(
            enabled = selfEnabled,
            facingLabel = selfFacingLabel,
            onEnabledChange = onSelfEnabledChange,
            onSettingsClick = onSelfSettingsClick,
        )
        Spacer(Modifier.height(8.dp))

        // Unified preview grid — self + peers as equal-citizen tiles.
        // 1 cam: full-width single tile so coverage is readable.
        // 2+ cams: 2-col grid.
        // Each tile uses ContentScale.Fit + dynamic aspect from its bitmap so what
        // you see is what gets recorded (Nathan's S123 ask: accurate coverage for
        // placement decisions).
        val tiles = buildList {
            if (selfEnabled) add(
                CameraTileSpec.Self(
                    label = "Drummer cam (S23U)",
                    sub = "$selfFacingLabel · this phone",
                    jpeg = selfPreviewJpeg,
                    isRecording = isRecording,
                    onTap = onSelfTap,
                )
            )
            peers.forEach { peer ->
                add(
                    CameraTileSpec.Remote(
                        label = peer.deviceName,
                        jpeg = peer.lastPreviewJpeg,
                        isRecording = peer.isRecording,
                        onTap = { onPeerTap(peer) },
                    )
                )
            }
        }

        when {
            tiles.isEmpty() -> {
                Box(
                    modifier = Modifier.fillMaxWidth().height(140.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        "Drummer cam off + no peer phones paired. Toggle drummer cam on or open Peer (camera) on a non-drummer phone.",
                        fontFamily = Karla, fontSize = 11.sp,
                        color = TangerineColors.textMuted.copy(alpha = 0.7f), maxLines = 4,
                    )
                }
            }
            // Single tile: render directly, no grid wrapper. Tile's own aspectRatio
            // drives height. Drawer's ModalBottomSheet manages overall scroll.
            tiles.size == 1 -> {
                CameraGridTile(tiles[0])
            }
            // 2+ tiles: hand-chunked 2-col layout. Avoids LazyVerticalGrid's need
            // for a bounded height (which clipped tall portrait tiles in v1.1.18).
            else -> {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    tiles.chunked(2).forEach { row ->
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            row.forEach { spec ->
                                Box(modifier = Modifier.weight(1f)) {
                                    CameraGridTile(spec)
                                }
                            }
                            // Pad an odd row so the last tile doesn't stretch full-width.
                            if (row.size == 1) Spacer(modifier = Modifier.weight(1f))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DrummerCamControlRow(
    enabled: Boolean,
    facingLabel: String,
    onEnabledChange: (Boolean) -> Unit,
    onSettingsClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(TangerineColors.surface)
            .border(
                1.dp,
                if (enabled) TangerineColors.green.copy(alpha = 0.35f)
                else TangerineColors.textMuted.copy(alpha = 0.2f),
                RoundedCornerShape(10.dp),
            )
            .padding(horizontal = 10.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            Icons.Default.CameraAlt,
            contentDescription = null,
            tint = if (enabled) TangerineColors.green else TangerineColors.textMuted,
            modifier = Modifier.size(18.dp),
        )
        Spacer(Modifier.width(8.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                "Drummer cam (S23U)",
                fontFamily = Karla, fontWeight = FontWeight.SemiBold,
                fontSize = 12.sp, color = TangerineColors.text,
            )
            Text(
                if (enabled) "$facingLabel · records with sets" else "off — toggle to enable",
                fontFamily = Karla, fontSize = 10.sp, color = TangerineColors.textMuted,
            )
        }
        Switch(
            checked = enabled,
            onCheckedChange = onEnabledChange,
            colors = SwitchDefaults.colors(
                checkedThumbColor = TangerineColors.green,
                checkedTrackColor = TangerineColors.green.copy(alpha = 0.45f),
            ),
        )
        IconButton(onClick = onSettingsClick) {
            Icon(Icons.Default.Tune, "Drummer cam settings", tint = TangerineColors.text)
        }
    }
}

private sealed class CameraTileSpec {
    abstract val label: String
    abstract val jpeg: ByteArray?
    abstract val isRecording: Boolean
    abstract val onTap: () -> Unit

    data class Self(
        override val label: String,
        val sub: String,
        override val jpeg: ByteArray?,
        override val isRecording: Boolean,
        override val onTap: () -> Unit,
    ) : CameraTileSpec()

    data class Remote(
        override val label: String,
        override val jpeg: ByteArray?,
        override val isRecording: Boolean,
        override val onTap: () -> Unit,
    ) : CameraTileSpec()
}

@Composable
private fun CameraGridTile(spec: CameraTileSpec) {
    val bitmap = remember(spec.jpeg) {
        spec.jpeg?.let {
            runCatching { BitmapFactory.decodeByteArray(it, 0, it.size) }.getOrNull()
        }
    }
    // Dynamic aspect ratio = WYSIWYG. Falls back to 16/9 when no frame yet.
    val aspect = if (bitmap != null && bitmap.height > 0) {
        bitmap.width.toFloat() / bitmap.height.toFloat()
    } else {
        16f / 9f
    }
    Column(
        modifier = Modifier
            .clip(RoundedCornerShape(10.dp))
            .background(TangerineColors.background),
    ) {
        // Clickable on the inner preview Box so the actual visible preview area
        // is the tap target. Wrapping the whole Column was unreliable inside
        // ModalBottomSheet + LazyVerticalGrid (Nathan reported tap not firing).
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(aspect)
                .clip(RoundedCornerShape(10.dp))
                .background(Color.Black)
                .border(
                    1.dp,
                    if (spec.isRecording) TangerineColors.danger else TangerineColors.textMuted.copy(alpha = 0.25f),
                    RoundedCornerShape(10.dp),
                )
                .clickable(onClick = spec.onTap),
        ) {
            if (bitmap != null) {
                Image(
                    bitmap = bitmap.asImageBitmap(),
                    contentDescription = spec.label,
                    contentScale = ContentScale.Fit,  // WYSIWYG — no cropping
                    modifier = Modifier.fillMaxSize(),
                )
            } else {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        "warming up…",
                        fontFamily = JetBrainsMono, fontSize = 10.sp,
                        color = TangerineColors.textMuted,
                    )
                }
            }
            if (spec.isRecording) {
                Row(
                    modifier = Modifier
                        .padding(6.dp)
                        .background(TangerineColors.danger.copy(alpha = 0.85f), RoundedCornerShape(10.dp))
                        .padding(horizontal = 6.dp, vertical = 2.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(Color.White))
                    Spacer(Modifier.width(4.dp))
                    Text("REC", color = Color.White, fontFamily = JetBrainsMono, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
        Text(
            spec.label,
            fontFamily = Karla, fontSize = 11.sp,
            color = TangerineColors.text, maxLines = 1,
            modifier = Modifier.padding(horizontal = 4.dp, vertical = 4.dp),
        )
    }
}

/**
 * Generic full-screen preview — used by both self and peer fullscreen triggers.
 *
 * Wrapped in [Dialog] so it renders in a system window above the active
 * ModalBottomSheet (Cameras drawer). Without Dialog the fullscreen Box was a
 * regular Compose sibling and the BottomSheet's window covered it — Nathan saw
 * "fullscreen opens behind the drawer."
 */
@Composable
private fun CameraPreviewFullscreen(
    label: String,
    jpeg: ByteArray?,
    onDismiss: () -> Unit,
) {
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            dismissOnBackPress = true,
            dismissOnClickOutside = false,  // we handle dismiss via the close button + tap-to-dismiss inside
        ),
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black)
                .clickable(onClick = onDismiss),
            contentAlignment = Alignment.Center,
        ) {
            val bitmap = remember(jpeg) {
                jpeg?.let { runCatching { BitmapFactory.decodeByteArray(it, 0, it.size) }.getOrNull() }
            }
            if (bitmap != null) {
                Image(
                    bitmap = bitmap.asImageBitmap(),
                    contentDescription = label,
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.fillMaxSize(),
                )
            } else {
                Text("No preview yet", color = TangerineColors.text, fontFamily = Karla)
            }
            Row(
                modifier = Modifier.padding(20.dp).align(Alignment.TopStart),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = onDismiss) {
                    Icon(Icons.Default.Close, "Close", tint = Color.White)
                }
                Spacer(Modifier.width(8.dp))
                Text(label, fontFamily = Karla, color = Color.White, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
private fun PeerPreviewFullscreen(
    peer: OrchestratorPeerServer.PeerInfo,
    onDismiss: () -> Unit,
) {
    // Same Dialog-based windowing as CameraPreviewFullscreen so this also stacks
    // above the Cameras drawer ModalBottomSheet.
    CameraPreviewFullscreen(
        label = peer.deviceName,
        jpeg = peer.lastPreviewJpeg,
        onDismiss = onDismiss,
    )
}

// ─── Reaper config sheet ─────────────────────────────────────────────────────

@Composable
private fun ReaperConfigPane(
    target: ReaperOscClient.Target?,
    discovered: com.thegreentangerine.gigbooks.data.orchestrator.OrchestratorDiscovery.Discovered?,
    isSearching: Boolean,
    lastSendOk: Boolean?,
    autoDiscover: Boolean,
    onAutoDiscoverChange: (Boolean) -> Unit,
    onManualHostChange: (String, Int) -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.Tune, contentDescription = null, tint = TangerineColors.text, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(8.dp))
            Text(
                "Reaper connection",
                fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 16.sp,
                color = TangerineColors.text,
            )
        }
        Text(
            text = when {
                target == null && isSearching -> "Searching the network…"
                target == null -> "No Reaper found yet"
                discovered != null && autoDiscover -> "Found: ${discovered.name} → ${target.host}:${target.port}"
                else -> "Manual: ${target.host}:${target.port}"
            },
            fontFamily = Karla, fontSize = 12.sp, color = TangerineColors.textMuted,
        )
        Text(
            text = when (lastSendOk) {
                true -> "Last OSC packet OK"
                false -> "Last OSC packet failed"
                null -> "No OSC packets sent yet"
            },
            fontFamily = Karla, fontSize = 11.sp, color = TangerineColors.textMuted.copy(alpha = 0.7f),
        )

        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Auto-discover", fontFamily = Karla, fontSize = 13.sp, color = TangerineColors.text, modifier = Modifier.weight(1f))
            Switch(
                checked = autoDiscover,
                onCheckedChange = onAutoDiscoverChange,
                colors = SwitchDefaults.colors(
                    checkedThumbColor = TangerineColors.orange,
                    checkedTrackColor = TangerineColors.orange.copy(alpha = 0.4f),
                ),
            )
        }

        if (!autoDiscover) {
            var host by remember { mutableStateOf(TextFieldValue(target?.host ?: "192.168.1.222")) }
            var port by remember { mutableStateOf(TextFieldValue((target?.port ?: 8000).toString())) }
            OutlinedTextField(
                value = host,
                onValueChange = { host = it; onManualHostChange(it.text, port.text.toIntOrNull() ?: 8000) },
                label = { Text("Host") }, singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = port,
                onValueChange = { port = it; onManualHostChange(host.text, it.text.toIntOrNull() ?: 8000) },
                label = { Text("Port") }, singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        Spacer(Modifier.height(8.dp))
    }
}

// ─── Capture status banner ───────────────────────────────────────────────────

@Composable
private fun CaptureStatusBanner(
    reaperReady: Boolean,
    selfCameraEnabled: Boolean,
    selfCameraReady: Boolean,
    selfCameraRecording: Boolean,
    peerCount: Int,
    peerRecordingCount: Int,
    isRecording: Boolean,
    recordError: RecordError?,
    onClearError: () -> Unit,
) {
    // Targets = how many capture endpoints the RECORD button fans out to.
    val totalTargets = 1 + (if (selfCameraEnabled) 1 else 0) + peerCount  // Reaper + self + peers
    val readyTargets = (if (reaperReady) 1 else 0) +
        (if (selfCameraReady) 1 else 0) +
        peerCount  // peers count once paired
    val recordingTargets = (if (isRecording) 1 else 0) +  // Reaper recording
        (if (selfCameraRecording) 1 else 0) +
        peerRecordingCount

    val accent: Color
    val icon: String
    val label: String

    if (recordError != null) {
        accent = TangerineColors.danger
        icon = "⚠"
        label = "${recordError::class.simpleName} — ${recordError.msg}"
    } else if (isRecording) {
        if (recordingTargets < totalTargets) {
            accent = TangerineColors.danger
            icon = "● REC"
            label = "$recordingTargets/$totalTargets capturing — ${totalTargets - recordingTargets} not engaged"
        } else {
            accent = TangerineColors.danger
            icon = "● REC"
            label = "$recordingTargets/$totalTargets capturing"
        }
    } else {
        if (readyTargets < totalTargets) {
            accent = TangerineColors.orange
            icon = "ARMED"
            label = "$readyTargets/$totalTargets ready — ${totalTargets - readyTargets} pending"
        } else {
            accent = TangerineColors.green
            icon = "ARMED"
            label = "$readyTargets/$totalTargets ready"
        }
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(accent.copy(alpha = 0.10f))
            .border(1.dp, accent.copy(alpha = 0.45f), RoundedCornerShape(8.dp))
            .padding(horizontal = 10.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            icon,
            fontFamily = JetBrainsMono, fontSize = 10.sp, fontWeight = FontWeight.Bold,
            color = accent,
        )
        Spacer(Modifier.width(8.dp))
        Text(
            label,
            fontFamily = Karla, fontSize = 11.sp, color = TangerineColors.text,
            modifier = Modifier.weight(1f),
            maxLines = 2,
        )
        if (recordError != null) {
            IconButton(onClick = onClearError, modifier = Modifier.size(28.dp)) {
                Icon(Icons.Default.Close, "Dismiss error", tint = TangerineColors.textMuted, modifier = Modifier.size(16.dp))
            }
        }
    }
}

// ─── Empty state ─────────────────────────────────────────────────────────────

@Composable
private fun EmptyGigMode(onMenuClick: () -> Unit, loading: Boolean, errorMsg: String?) {
    Column(modifier = Modifier.fillMaxSize().background(TangerineColors.background)) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onMenuClick) {
                Icon(Icons.Default.Menu, "Menu", tint = TangerineColors.text)
            }
            Text("Gig Mode", fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = TangerineColors.text)
        }
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(32.dp)) {
                Text(
                    if (loading) "Loading setlist…" else "No setlist found",
                    fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = TangerineColors.text,
                )
                if (errorMsg != null) {
                    Spacer(Modifier.height(8.dp))
                    Text(errorMsg, fontFamily = JetBrainsMono, fontSize = 11.sp, color = TangerineColors.danger)
                }
                Spacer(Modifier.height(8.dp))
                Text(
                    "Setlist edits sync via Supabase Realtime. Check connectivity then re-open this screen.",
                    fontFamily = Karla, fontSize = 12.sp, color = TangerineColors.textMuted,
                )
            }
        }
    }
}

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
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.FiberManualRecord
import androidx.compose.material.icons.filled.LibraryMusic
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.SkipPrevious
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.rememberDrawerState
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
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.viewmodel.compose.viewModel
import com.thegreentangerine.gigbooks.data.orchestrator.CameraGate
import com.thegreentangerine.gigbooks.data.recordings.RecordingsRepository
import com.thegreentangerine.gigbooks.data.orchestrator.GigSession
import com.thegreentangerine.gigbooks.data.orchestrator.OrchestratorPeerServer
import com.thegreentangerine.gigbooks.data.orchestrator.OrchestratorService
import com.thegreentangerine.gigbooks.data.orchestrator.ReaperOscClient
import com.thegreentangerine.gigbooks.data.orchestrator.RecordError
import com.thegreentangerine.gigbooks.data.supabase.SetlistEntriesRepository
import com.thegreentangerine.gigbooks.data.supabase.SetlistEntryPracticeTracksRepository
import com.thegreentangerine.gigbooks.data.supabase.models.SetlistActor
import com.thegreentangerine.gigbooks.data.supabase.models.SetlistEntry
import com.thegreentangerine.gigbooks.data.supabase.models.SetlistEntryPracticeTrack
import com.thegreentangerine.gigbooks.data.xr18.CameraSettingsStore
import com.thegreentangerine.gigbooks.data.xr18.PhoneSettings
import com.thegreentangerine.gigbooks.ui.AppViewModel
import com.thegreentangerine.gigbooks.ui.components.CameraSettingsSheet
import com.thegreentangerine.gigbooks.ui.components.GigEndConfirm
import com.thegreentangerine.gigbooks.ui.components.GigStartWizard
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
            // S148: external app-specific dir (accessible via `adb pull`) so the
            // post-prod video chain (pull-videos.py -> insert-videos.lua) can fetch
            // these mp4s. Pre-S148 used context.filesDir which is private and
            // invisible to adb on release builds.
            CameraGate.orchestratorOutputDir = File(RecordingsRepository.videoBaseDir(context), "orchestrator_recordings")
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
    // Rebind-free zoom + exposure for the drummer-cam (S150 P2). Both
    // mid-recording-safe via cameraControl. §B.4 gig-safety upheld.
    LaunchedEffect(orchestratorSettings.zoomRatio) { cameraManager.applyZoom(orchestratorSettings.zoomRatio) }
    LaunchedEffect(orchestratorSettings.exposure) { cameraManager.applyExposure(orchestratorSettings.exposure) }

    LaunchedEffect(Unit) { SetlistEntriesRepository.start() }
    LaunchedEffect(Unit) { SetlistEntryPracticeTracksRepository.start() }
    val entries by SetlistEntriesRepository.entries.collectAsState()
    val loading by SetlistEntriesRepository.loading.collectAsState()
    val repoError by SetlistEntriesRepository.error.collectAsState()
    val allPracticeTracks by SetlistEntryPracticeTracksRepository.tracks.collectAsState()

    var activeListId by remember { mutableStateOf(SetlistEntry.LIST_STAPLES) }
    var activeEntryId by remember { mutableStateOf<String?>(null) }
    var openDrawer by remember { mutableStateOf<DrawerKind?>(null) }
    var fullscreenPeer by remember { mutableStateOf<OrchestratorPeerServer.PeerInfo?>(null) }
    var fullscreenSelf by remember { mutableStateOf(false) }
    var reaperConfigOpen by remember { mutableStateOf(false) }

    // ── S129 row 6: gig wizard state ──
    // Wizard opens on the first Start-gig tap (only when session is IDLE).
    // End-confirm opens on End-gig tap (avoids accidental end mid-gig).
    // Pre-fill is computed from today's calendar entry the moment the wizard opens.
    var startWizardOpen by remember { mutableStateOf(false) }
    var endConfirmOpen by remember { mutableStateOf(false) }
    var startPrefill by remember { mutableStateOf("") }
    val gigSnapshot = service?.session?.snapshot?.collectAsState()?.value
        ?: GigSession.Snapshot()
    val gigCmdLastOk = service?.gigCmd?.lastSendOk?.collectAsState()?.value
    LaunchedEffect(startWizardOpen) {
        if (startWizardOpen) {
            startPrefill = vm.getTodaysGigName()
        }
    }

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

    // S130 W3b: per-version practice tracks for the active entry. Drives
    // the chip on the BPM hero (only shown when ours_* exist) + the picker.
    val activePracticeTracks = remember(activeEntry?.id, allPracticeTracks) {
        SetlistEntryPracticeTracksRepository.tracksForEntry(activeEntry?.id)
    }
    val oursVersionsCount = activePracticeTracks.count { it.isOurs }
    var practicePickerOpen by remember { mutableStateOf(false) }

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

    // v1.2.4: bail on nested ModalNavigationDrawer entirely (Rtl flip caused
    // scrim placement bugs + left-edge gesture conflicts with the outer nav
    // drawer). Setlist is now a custom slide-in panel in the same Box.
    //
    // Tell AppViewModel when our drawer is open so TangerineMediaApp can
    // disable its nav-drawer gestures + close the nav if it's open. Enforces
    // one-drawer-at-a-time across the whole app.
    LaunchedEffect(openDrawer) {
        vm.gigDrawerOpen = openDrawer != null
    }

    Box(modifier = Modifier.fillMaxSize().background(TangerineColors.background)) {
    Column(modifier = Modifier.fillMaxSize()) {
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
                    if (gigSnapshot.state != GigSession.State.IDLE && gigSnapshot.gigName.isNotBlank())
                        gigSnapshot.gigName
                    else
                        "Gig Mode",
                    fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 18.sp,
                    color = TangerineColors.text,
                    maxLines = 1,
                )
                Text(
                    when (gigSnapshot.state) {
                        GigSession.State.ARMED -> "Armed — ready to record"
                        GigSession.State.ACTIVE_SET -> "Set ${gigSnapshot.setNumber} • ${
                            if (activeEntry != null) "${activeIdx + 1}/${activeList.size}" else "no entry"
                        }"
                        GigSession.State.BREAK -> "Break after Set ${gigSnapshot.setNumber}"
                        GigSession.State.ENDED -> "Gig ended"
                        else -> if (activeEntry != null)
                            "${activeIdx + 1} of ${activeList.size} — ${SetlistEntry.LIST_LABELS[activeListId] ?: activeListId}"
                        else "no entry selected"
                    },
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
            // S130 W3b: practice-version chip — only when ours_* takes exist.
            if (oursVersionsCount > 0) {
                PracticeVersionsChip(
                    count = oursVersionsCount,
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(10.dp),
                    onClick = { practicePickerOpen = true },
                )
            }
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

        // ── Cameras peek bar (v1.2.4 — inline, above bottom row) ──
        // Was an overlay that fought the bottom-row buttons + Android's
        // gesture region. Now part of the Column flow: a 36dp tappable
        // strip with a centered drag handle. Tap or swipe-up opens.
        CamerasPeekHandle(
            modifier = Modifier.fillMaxWidth(),
            peerCount = peerCount,
            onOpen = { openDrawer = DrawerKind.Cameras },
        )

        // ── Bottom row: gig controls (S129 rows 5+6 — pills removed,
        //     setlist via right-swipe, cameras via the peek above). ──
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            when (gigSnapshot.state) {
                GigSession.State.IDLE, GigSession.State.ENDED -> {
                    GigPrimaryButton(
                        modifier = Modifier.weight(1f),
                        label = "Start gig",
                        accent = TangerineColors.orange,
                        enabled = target != null,
                        disabledLabel = if (target == null) "no Reaper" else null,
                        onClick = { startWizardOpen = true },
                    )
                }
                GigSession.State.ARMED -> {
                    // v1.2.3: post-wizard ARMED stage. Project saved, transport
                    // idle. Drummer reviews everything (peers, mixer, prompter)
                    // before tapping Begin recording.
                    GigPrimaryButton(
                        modifier = Modifier.weight(1f),
                        label = "Begin recording",
                        sublabel = "armed — review then tap",
                        accent = TangerineColors.green,
                        enabled = true,
                        onClick = { service?.beginRecording() },
                    )
                    GigSecondaryButton(
                        modifier = Modifier.weight(0.4f),
                        label = "End",
                        accent = TangerineColors.danger,
                        onClick = { endConfirmOpen = true },
                    )
                }
                GigSession.State.ACTIVE_SET -> {
                    GigPrimaryButton(
                        modifier = Modifier.weight(1f),
                        label = "Pause",
                        sublabel = "%02d:%02d:%02d".format(
                            setElapsedSec / 3600, (setElapsedSec % 3600) / 60, setElapsedSec % 60,
                        ),
                        accent = TangerineColors.green,
                        enabled = true,
                        onClick = { service?.pauseSet() },
                    )
                    GigSecondaryButton(
                        modifier = Modifier.weight(0.4f),
                        label = "End",
                        accent = TangerineColors.danger,
                        onClick = { endConfirmOpen = true },
                    )
                }
                GigSession.State.BREAK -> {
                    // v1.2.3: two continue paths. "Continue" treats the pause
                    // as a brief mid-set interruption (no marker, same set#).
                    // "+ Set N+1" drops a "Set N+1" marker and increments —
                    // for genuine set boundaries between break music etc.
                    GigPrimaryButton(
                        modifier = Modifier.weight(1f),
                        label = "Continue",
                        sublabel = "same set — no marker",
                        accent = TangerineColors.orange,
                        enabled = true,
                        onClick = { service?.continueSameSet() },
                    )
                    GigPrimaryButton(
                        modifier = Modifier.weight(1f),
                        label = "+ Set ${gigSnapshot.setNumber + 1}",
                        sublabel = "drops marker",
                        accent = TangerineColors.green,
                        enabled = true,
                        onClick = { service?.continueNewSet() },
                    )
                    GigSecondaryButton(
                        modifier = Modifier.weight(0.4f),
                        label = "End",
                        accent = TangerineColors.danger,
                        onClick = { endConfirmOpen = true },
                    )
                }
            }
        }
    }

    // ── Setlist right-edge swipe band (S144 fix) ──
    // 96dp-wide band on the right — drag-left to open the setlist panel.
    // S131 used Modifier.draggable(startDragImmediately = false) on the
    // (mistaken) belief that overlapping clickables would still get taps.
    // They don't — Compose hit-tests the topmost overlapping element, so
    // the band absorbs every tap inside its area. S144 restricts the band
    // to the upper portion of the screen (above the prev/advance row) so
    // the button row + Start-gig card receive their taps. Cameras drawer
    // is opened via CamerasPeekHandle (inline in Column flow) instead of
    // a sibling overlay — the duplicate 96dp bottom band has been removed.
    if (openDrawer == null) {
        var setlistDragAccum by remember { mutableStateOf(0f) }
        Box(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .fillMaxHeight(0.54f)  // upper 54% only — clears prev/advance row at y≈1273
                .width(96.dp)
                .draggable(
                    orientation = Orientation.Horizontal,
                    state = rememberDraggableState { delta ->
                        setlistDragAccum += delta
                        if (setlistDragAccum < -32f) {
                            openDrawer = DrawerKind.Setlist
                            setlistDragAccum = 0f
                        }
                    },
                    onDragStarted = { setlistDragAccum = 0f },
                    onDragStopped = { setlistDragAccum = 0f },
                    startDragImmediately = false,
                ),
        )
    }

    // ── Custom slide-in setlist drawer (v1.2.4) ──
    // Replaces the broken ModalNavigationDrawer + Rtl flip. Own scrim,
    // own tap-to-dismiss, own drag-to-dismiss.
    SlideInSetlistDrawer(
        open = openDrawer == DrawerKind.Setlist,
        entries = entries,
        primaryListId = activeListId,
        activeEntryId = activeEntryId,
        onPickPrimary = { activeListId = it },
        onTapEntry = { entry ->
            activeListId = entry.listId
            activeEntryId = entry.id
            service?.sendSongMarker(entry.title)
            openDrawer = null
        },
        onDismiss = { openDrawer = null },
    )
    }    // close Box wrapping content + drawer + scrim

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
                onManualHostChange = { host, port ->
                    // v1.2.4 hotfix: also point the HTTP gig-command client at
                    // the same host (port stays fixed at 8666). Otherwise the
                    // gig wizard fires HTTP at e6330.local:8666 which won't
                    // resolve when mDNS isn't propagating (S23 hotspot AP-mode
                    // multicast is flaky).
                    service?.osc?.setTarget(host, port)
                    service?.gigCmd?.setTarget(host)
                },
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

    // ── Gig start wizard ──
    if (startWizardOpen) {
        GigStartWizard(
            prefill = startPrefill,
            onCancel = { startWizardOpen = false },
            onStart = { name ->
                startWizardOpen = false
                // v1.2.3: wizard arms only — separate Begin button starts recording
                service?.armGig(name)
            },
        )
    }

    // ── Gig end confirm ──
    if (endConfirmOpen) {
        GigEndConfirm(
            gigName = gigSnapshot.gigName,
            setsRecorded = gigSnapshot.setNumber,
            onCancel = { endConfirmOpen = false },
            onConfirm = {
                endConfirmOpen = false
                service?.endGig()
            },
        )
    }

    // ── S130 W3b: practice-versions picker ──
    if (practicePickerOpen && activeEntry != null) {
        val coroutineScope = rememberCoroutineScope()
        val activeUserId = remember { vm.profileNames.keys.firstOrNull() ?: "drummer" }
        val activeUserName = remember(activeUserId) { vm.profileNames[activeUserId] ?: "drummer" }
        PracticeVersionsPickerSheet(
            entry = activeEntry,
            tracks = activePracticeTracks,
            activeRef = activeEntry.practiceAudioRef,
            onSelect = { track ->
                val ref = track.msRefOrNull() ?: return@PracticeVersionsPickerSheet
                coroutineScope.launch {
                    SetlistEntriesRepository.updateField(
                        id = activeEntry.id,
                        field = "practice_audio_ref",
                        value = ref,
                        prev = activeEntry,
                        actor = SetlistActor(activeUserId, activeUserName),
                    )
                }
                practicePickerOpen = false
            },
            onDismiss = { practicePickerOpen = false },
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
                zoomRange = cameraManager.zoomRange.collectAsState().value,
                exposureCaps = cameraManager.exposureCaps.collectAsState().value,
                stabilisationSupported = cameraManager.stabilisationSupported.collectAsState().value,
                freeStorageBytes = runCatching {
                    LocalContext.current.getExternalFilesDir(null)?.usableSpace
                }.getOrNull(),
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
private fun CamerasPeekHandle(
    modifier: Modifier,
    peerCount: Int,
    onOpen: () -> Unit,
) {
    // v1.2.4: inline bar in the Column flow above the bottom-row gig controls.
    // 36dp tall touch zone (well above accidental hit-test on system gesture
    // bar) with a centered drag handle + optional peer-count badge. Tap or
    // short upward drag opens the cameras drawer.
    Row(
        modifier = modifier
            .height(36.dp)
            .pointerInput(Unit) {
                detectVerticalDragGestures { _, dragAmount ->
                    if (dragAmount < -3f) onOpen()
                }
            }
            .clickable(onClick = onOpen),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        Box(
            modifier = Modifier
                .width(48.dp)
                .height(4.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(TangerineColors.textMuted.copy(alpha = 0.55f)),
        )
        if (peerCount > 0) {
            Spacer(Modifier.width(8.dp))
            Text(
                "${peerCount} cam${if (peerCount == 1) "" else "s"}",
                fontFamily = JetBrainsMono,
                fontSize = 9.sp,
                color = TangerineColors.textMuted,
            )
        }
    }
}

/**
 * v1.2.4 custom slide-in right-side drawer.
 *
 * Replaces the broken nested ModalNavigationDrawer + Rtl flip. Owns its scrim,
 * its open/close animation, its tap-to-dismiss + drag-right-to-dismiss.
 * Cleanly separates from the app-level nav drawer (which is locked at the
 * AppViewModel level when this is open). Must be called from within a Box.
 */
@Composable
private fun BoxScope.SlideInSetlistDrawer(
    open: Boolean,
    entries: List<SetlistEntry>,
    primaryListId: String,
    activeEntryId: String?,
    onPickPrimary: (String) -> Unit,
    onTapEntry: (SetlistEntry) -> Unit,
    onDismiss: () -> Unit,
) {
    val drawerWidth = 320.dp
    val density = LocalDensity.current
    val drawerWidthPx = with(density) { drawerWidth.toPx() }
    val offsetX = remember { Animatable(drawerWidthPx) }

    LaunchedEffect(open) {
        offsetX.animateTo(
            if (open) 0f else drawerWidthPx,
            animationSpec = tween(durationMillis = 250),
        )
    }

    val isVisible = open || offsetX.value < drawerWidthPx
    if (!isVisible) return

    val scrimAlpha = ((drawerWidthPx - offsetX.value) / drawerWidthPx).coerceIn(0f, 1f) * 0.6f

    // Scrim — covers the whole screen. Tap anywhere to dismiss.
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = scrimAlpha))
            .clickable(
                indication = null,
                interactionSource = remember { MutableInteractionSource() },
                onClick = onDismiss,
            ),
    )

    // Drawer panel — right-aligned, animates X-offset in/out.
    val dismissThresholdPx = with(density) { 80.dp.toPx() }
    Box(
        modifier = Modifier
            .align(Alignment.CenterEnd)
            .fillMaxHeight()
            .width(drawerWidth)
            .offset { IntOffset(offsetX.value.toInt(), 0) }
            .background(TangerineColors.surface)
            .pointerInput(Unit) {
                // Drag-right-to-close: accumulate horizontal drag; dismiss
                // when total > 80dp to the right.
                var totalDx = 0f
                detectHorizontalDragGestures(
                    onDragEnd = {
                        if (totalDx > dismissThresholdPx) onDismiss()
                        totalDx = 0f
                    },
                    onDragCancel = { totalDx = 0f },
                ) { _, dragAmount ->
                    if (dragAmount > 0) totalDx += dragAmount
                }
            },
    ) {
        SetlistDrawer(
            entries = entries,
            primaryListId = primaryListId,
            activeEntryId = activeEntryId,
            onPickPrimary = onPickPrimary,
            onTapEntry = onTapEntry,
        )
    }
}

@Composable
private fun GigPrimaryButton(
    modifier: Modifier,
    label: String,
    sublabel: String? = null,
    accent: Color,
    enabled: Boolean,
    disabledLabel: String? = null,
    onClick: () -> Unit,
) {
    val tint = if (enabled) accent else TangerineColors.textMuted.copy(alpha = 0.3f)
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(14.dp))
            .background(tint.copy(alpha = if (enabled) 0.14f else 0.04f))
            .border(
                2.dp,
                tint.copy(alpha = if (enabled) 0.7f else 0.2f),
                RoundedCornerShape(14.dp),
            )
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        Icon(
            imageVector = Icons.Default.FiberManualRecord,
            contentDescription = label,
            tint = tint, modifier = Modifier.size(20.dp),
        )
        Spacer(Modifier.width(8.dp))
        Column {
            Text(
                if (!enabled && disabledLabel != null) disabledLabel else label,
                fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = tint,
            )
            if (sublabel != null) {
                Text(
                    sublabel,
                    fontFamily = JetBrainsMono, fontSize = 10.sp,
                    color = tint.copy(alpha = 0.8f),
                )
            }
        }
    }
}

@Composable
private fun GigSecondaryButton(
    modifier: Modifier,
    label: String,
    accent: Color,
    onClick: () -> Unit,
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(14.dp))
            .background(accent.copy(alpha = 0.08f))
            .border(1.dp, accent.copy(alpha = 0.5f), RoundedCornerShape(14.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 8.dp, vertical = 14.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            fontFamily = Karla, fontWeight = FontWeight.Bold,
            fontSize = 13.sp, color = accent,
        )
    }
}

// ─── Setlist drawer ──────────────────────────────────────────────────────────

@Composable
private fun SetlistDrawer(
    entries: List<SetlistEntry>,
    primaryListId: String,
    activeEntryId: String?,
    onPickPrimary: (String) -> Unit,
    onTapEntry: (SetlistEntry) -> Unit,
) {
    val primaryList = entries.filter { it.listId == primaryListId }.sortedBy { it.position }

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

        // ── 3-tab list selector (v1.2.11: replaced pin-second-list pills) ──
        // Single source list at a time. Tap a tab to switch which list is shown.
        Row(
            modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            SetlistEntry.LIST_ORDER.forEach { listId ->
                val isActive = listId == primaryListId
                val count = entries.count { it.listId == listId }
                ListTabPill(
                    modifier = Modifier.weight(1f),
                    label = SetlistEntry.LIST_LABELS[listId] ?: listId,
                    count = count,
                    isActive = isActive,
                    onClick = { if (!isActive) onPickPrimary(listId) },
                )
            }
        }

        // Single-column list — bumped sizing for distance readability.
        //
        // S149: per-list scroll state. Beddau-RFC gig surfaced a UX bug —
        // switching Staples -> Party (to play Hound Dog) -> Staples reset the
        // list scroll position to top, so Nathan lost his place mid-gig and
        // had to swipe back down. Each list now keeps its own LazyListState in
        // a remembered map keyed by listId, so toggling between Staples /
        // Party / Classic Rock preserves where you were in each.
        val listScrollStates = remember { mutableMapOf<String, LazyListState>() }
        val scrollState = listScrollStates.getOrPut(primaryListId) { LazyListState() }
        LazyColumn(
            state = scrollState,
            modifier = Modifier.fillMaxWidth().height(620.dp),
        ) {
            itemsIndexed(primaryList, key = { _, e -> e.id }) { idx, entry ->
                SetlistRow(
                    entry = entry,
                    position = idx + 1,
                    state = rowState(idx, entry.id, activeEntryId, primaryList),
                    onClick = { onTapEntry(entry) },
                )
            }
        }
    }
}

@Composable
private fun ListTabPill(
    modifier: Modifier,
    label: String,
    count: Int,
    isActive: Boolean,
    onClick: () -> Unit,
) {
    val bg = if (isActive) TangerineColors.orange.copy(alpha = 0.16f) else TangerineColors.surface
    val border = if (isActive) TangerineColors.orange.copy(alpha = 0.7f) else TangerineColors.textMuted.copy(alpha = 0.25f)
    val textColor = if (isActive) TangerineColors.orange else TangerineColors.textMuted
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(bg)
            .border(1.dp, border, RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 8.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        Text(
            label,
            fontFamily = Karla, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = textColor,
        )
        Spacer(Modifier.width(6.dp))
        Text(
            count.toString(),
            fontFamily = JetBrainsMono, fontSize = 11.sp,
            color = textColor.copy(alpha = 0.65f),
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
            .padding(vertical = 3.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(bg)
            .border(1.dp, border, RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // v1.2.11: distance-readable sizing — pos 14sp, title 18sp, artist
        // 14sp, BPM 14sp. Up from 11/13/10/11. ~40% larger glyphs without
        // pushing rows off-screen (height(620.dp) above accommodates).
        Text(
            position.toString().padStart(2, '0'),
            fontFamily = JetBrainsMono, fontSize = 14.sp, color = subColor,
            modifier = Modifier.width(30.dp),
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                entry.title,
                fontFamily = Karla, fontWeight = FontWeight.SemiBold,
                fontSize = 18.sp, color = titleColor, maxLines = 1,
            )
            if (!entry.artist.isNullOrBlank()) {
                Text(
                    entry.artist,
                    fontFamily = Karla, fontSize = 14.sp, color = subColor, maxLines = 1,
                )
            }
        }
        if (entry.bpm != null) {
            Text(
                entry.bpm.toString(),
                fontFamily = JetBrainsMono, fontSize = 14.sp, color = subColor,
                modifier = Modifier.padding(start = 8.dp),
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

// ─── S130 W3b: practice-versions chip + picker ───────────────────────────────

@Composable
private fun PracticeVersionsChip(
    count: Int,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    Surface(
        modifier = modifier.clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        color = TangerineColors.purple.copy(alpha = 0.18f),
        border = BorderStroke(1.dp, TangerineColors.purple.copy(alpha = 0.6f)),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                Icons.Default.LibraryMusic,
                contentDescription = null,
                tint = TangerineColors.purple,
                modifier = Modifier.size(14.dp),
            )
            Spacer(Modifier.width(6.dp))
            Text(
                text = "$count ours",
                fontFamily = JetBrainsMono,
                fontSize = 11.sp,
                color = TangerineColors.purple,
                letterSpacing = 1.sp,
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PracticeVersionsPickerSheet(
    entry: SetlistEntry,
    tracks: List<SetlistEntryPracticeTrack>,
    activeRef: String?,
    onSelect: (SetlistEntryPracticeTrack) -> Unit,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = TangerineColors.surface,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp)
                .padding(bottom = 24.dp),
        ) {
            Text(
                "PRACTICE TRACKS",
                fontFamily = JetBrainsMono, fontWeight = FontWeight.Bold,
                fontSize = 12.sp, color = TangerineColors.purple, letterSpacing = 2.sp,
            )
            Text(
                entry.title,
                fontFamily = Karla, fontWeight = FontWeight.Bold,
                fontSize = 16.sp, color = TangerineColors.text,
            )
            if (!entry.artist.isNullOrBlank()) {
                Text(
                    entry.artist,
                    fontFamily = Karla, fontSize = 12.sp, color = TangerineColors.textMuted,
                )
            }
            Spacer(Modifier.height(14.dp))
            if (tracks.isEmpty()) {
                Text(
                    "No versions ingested yet.",
                    fontFamily = Karla, fontSize = 13.sp, color = TangerineColors.textMuted,
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    "MS ingest pipeline populates these from Reaper post-prod renders.",
                    fontFamily = Karla, fontSize = 11.sp, color = TangerineColors.textMuted,
                )
            } else {
                tracks.forEach { t ->
                    val isActive = t.msTrackId != null && t.msTrackId == activeRef
                    PracticeVersionRow(track = t, isActive = isActive, onClick = { onSelect(t) })
                    Spacer(Modifier.height(6.dp))
                }
            }
        }
    }
}

@Composable
private fun PracticeVersionRow(
    track: SetlistEntryPracticeTrack,
    isActive: Boolean,
    onClick: () -> Unit,
) {
    val accent = if (track.isOurs) TangerineColors.purple else TangerineColors.green
    val canSelect = track.msTrackId != null
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .clickable(enabled = canSelect, onClick = onClick),
        color = if (isActive) accent.copy(alpha = 0.18f) else TangerineColors.surfaceLight,
        border = BorderStroke(1.dp, accent.copy(alpha = if (isActive) 0.7f else 0.25f)),
        shape = RoundedCornerShape(10.dp),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    track.displayLabel(),
                    fontFamily = JetBrainsMono, fontWeight = FontWeight.Bold,
                    fontSize = 12.sp, color = accent, letterSpacing = 1.sp,
                )
                if (!track.gigAlbum.isNullOrBlank()) {
                    Text(
                        track.gigAlbum,
                        fontFamily = Karla, fontSize = 11.sp, color = TangerineColors.textMuted,
                    )
                }
                if (!canSelect) {
                    Text(
                        "Schema-only — not yet ingested",
                        fontFamily = JetBrainsMono, fontSize = 9.sp,
                        color = TangerineColors.textMuted, letterSpacing = 0.5.sp,
                    )
                }
            }
            if (isActive) {
                Icon(
                    Icons.Default.Check,
                    contentDescription = "active",
                    tint = accent,
                    modifier = Modifier.size(18.dp),
                )
            }
        }
    }
}

package com.thegreentangerine.gigbooks.ui.screens

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Build
import android.os.IBinder
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AddBox
import androidx.compose.material.icons.filled.Album
import androidx.compose.material.icons.filled.AutoFixHigh
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Equalizer
import androidx.compose.material.icons.filled.FiberManualRecord
import androidx.compose.material.icons.filled.Layers
import androidx.compose.material.icons.filled.LibraryMusic
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.Piano
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.SkipPrevious
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.thegreentangerine.gigbooks.data.orchestrator.OrchestratorService
import com.thegreentangerine.gigbooks.data.orchestrator.TakeSong
import com.thegreentangerine.gigbooks.data.orchestrator.TakeLayerInfo
import com.thegreentangerine.gigbooks.data.orchestrator.TakeStatus
import com.thegreentangerine.gigbooks.data.orchestrator.TakeTakeInfo
import com.thegreentangerine.gigbooks.ui.components.ArmPresetMode
import com.thegreentangerine.gigbooks.ui.components.ArmPresetState
import com.thegreentangerine.gigbooks.ui.components.ChannelArmPresetSelector
import com.thegreentangerine.gigbooks.ui.components.computeArmedTracks
import com.thegreentangerine.gigbooks.ui.theme.JetBrainsMono
import com.thegreentangerine.gigbooks.ui.theme.Karla
import com.thegreentangerine.gigbooks.ui.theme.TangerineColors
import kotlin.math.roundToInt
import kotlinx.coroutines.launch

/**
 * S206 4b: how long Record stays disabled after Stop so the prior take's items
 * finalize on the rig before the next take-record fires (the rapid-retake race
 * from the S205 live-test). Generous + tunable; the robust fix is a rig->APK
 * "take committed" signal, scoped separately.
 */
private const val TAKE_SETTLE_MS = 5_000L

/**
 * S206 Slice 4c — Take Mode: the drummer's home-studio cover surface.
 *
 * Opens to a BROWSER of stem-ready songs (MS `GET /take/songs`, 4c-1) — newest
 * first, each badged ✓verified / ⚠unverified by its beatmap sidecar. Tap a song
 * to drop into the 4b take SURFACE (load the cover on the Reaper rig, set the
 * kit, record stacked takes). Lenient gate (§4): every stem-ready song is listed;
 * recording against a ⚠ (unverified) song prompts a one-time warn.
 *
 * Drives the proven take backend — MS `/take/load` + `/take/record` (S206 4a)
 * over the orchestrator's configured GigCommandClient, and OSC `/stop` over
 * ReaperOscClient to stop the transport (the Lua's save-on-stop watcher then
 * saves the take). Stop is OSC, NOT a `/take/stop` endpoint.
 */
@Composable
fun TakeModeScreen(onMenuClick: () -> Unit) {
    val context = LocalContext.current

    // Reach the orchestrator's CONFIGURED clients (the discovered MS host + OSC
    // target carry over) the same way GigModeScreen does — bind the singleton
    // service. Never construct fresh GigCommandClient/ReaperOscClient: those
    // would miss the discovered target and fire at the BuildConfig default.
    var service by remember { mutableStateOf<OrchestratorService?>(null) }
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

    // ── Slice 4c-2 browser state ──
    var songs by remember { mutableStateOf<List<TakeSong>?>(null) } // null = loading
    var loadFailed by remember { mutableStateOf(false) }
    var selectedSong by remember { mutableStateOf<TakeSong?>(null) }
    var refreshTick by remember { mutableIntStateOf(0) }            // bumped by Refresh / Retry

    val gigTarget = service?.gigCmd?.target?.collectAsState()?.value
    val gigLastOk = service?.gigCmd?.lastSendOk?.collectAsState()?.value

    // Fetch on bind, again when the discovered host resolves (gigTarget flips from
    // the BuildConfig default to the mDNS host), and on manual refresh.
    LaunchedEffect(service, gigTarget, refreshTick) {
        val svc = service ?: return@LaunchedEffect
        songs = null
        loadFailed = false
        val result = svc.gigCmd.fetchTakeSongs()
        if (result == null) loadFailed = true else songs = result
    }

    val svc = service
    val sel = selectedSong
    if (sel == null || svc == null) {
        TakeBrowser(
            onMenuClick = onMenuClick,
            hostLabel = gigTarget?.let { "${it.host}:${it.port}" },
            lastSendOk = gigLastOk,
            songs = songs,
            loadFailed = loadFailed,
            onRefresh = { refreshTick++ },
            onSelect = { selectedSong = it },
            onCreateScratch = { selectedSong = scratchSong(it) },
        )
    } else {
        TakeSurface(
            song = sel,
            service = svc,
            onBack = { selectedSong = null },
            onCreateScratch = { selectedSong = scratchSong(it) },
        )
    }
}

// ─── S224: from-scratch source helpers ─────────────────────────────────────────
private const val SCRATCH_PREFIX = "scratch:"
/** S224: a from-scratch cover has no library track. Synthesise a TakeSong so it rides the same
 *  selectedSong→TakeSurface path; the `scratch:` sentinel trackId branches the load (takeNewScratch
 *  vs takeLoad) + keys the surface state. trackId carries the title so distinct names key distinctly
 *  (title-only, matching the rig's title-only cover-dir keying). artist/bpm/beatmapVerified are never
 *  shown for a scratch cover. */
private fun scratchSong(title: String) = TakeSong(
    trackId = SCRATCH_PREFIX + title, title = title, artist = "", bpm = null, beatmapVerified = false,
)

// ─── Browser (the locked-UX song list) ────────────────────────────────────────

@Composable
private fun TakeBrowser(
    onMenuClick: () -> Unit,
    hostLabel: String?,
    lastSendOk: Boolean?,
    songs: List<TakeSong>?,
    loadFailed: Boolean,
    onRefresh: () -> Unit,
    onSelect: (TakeSong) -> Unit,
    onCreateScratch: (String) -> Unit,
) {
    // S221 ②·4b — the ⋮ overflow + New Project source wizard (v4 mockup §panel-4). On the browser the
    // wizard's "Original song" just dismisses the sheet: this song list IS the library, already on
    // screen behind it. overflowOpen = the ⋮ menu; showWizard = the source-picker sheet.
    var overflowOpen by remember { mutableStateOf(false) }
    var showWizard by remember { mutableStateOf(false) }
    Box(modifier = Modifier.fillMaxSize().background(TangerineColors.background)) {
        Column(modifier = Modifier.fillMaxSize()) {
            // ── Top bar: menu · title · host pill · refresh · ⋮ ──
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = onMenuClick) {
                    Icon(Icons.Default.Menu, "Menu", tint = TangerineColors.text)
                }
                Spacer(Modifier.width(4.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        "Take Mode",
                        fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 18.sp,
                        color = TangerineColors.text, maxLines = 1,
                    )
                    Text(
                        "home studio · drum covers",
                        fontFamily = Karla, fontSize = 11.sp, color = TangerineColors.textMuted,
                    )
                }
                TakeHostPill(target = hostLabel, lastSendOk = lastSendOk)
                IconButton(onClick = onRefresh) {
                    Icon(Icons.Default.Refresh, "Refresh songs", tint = TangerineColors.textMuted)
                }
                Box {
                    IconButton(onClick = { overflowOpen = true }) {
                        Icon(Icons.Default.MoreVert, "More", tint = TangerineColors.textDim)
                    }
                    DropdownMenu(
                        expanded = overflowOpen,
                        onDismissRequest = { overflowOpen = false },
                    ) {
                        DropdownMenuItem(
                            text = {
                                Text(
                                    "New project…",
                                    fontFamily = Karla, fontSize = 14.sp, color = TangerineColors.text,
                                )
                            },
                            onClick = { overflowOpen = false; showWizard = true },
                        )
                    }
                }
            }

            // ── Body: loading / failed / empty / list (server order = newest-first) ──
            when {
                loadFailed -> Box(
                    modifier = Modifier.fillMaxWidth().weight(1f),
                    contentAlignment = Alignment.Center,
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            "Couldn't reach the media server",
                            fontFamily = Karla, fontSize = 14.sp, color = TangerineColors.textMuted,
                        )
                        Spacer(Modifier.height(12.dp))
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .background(TangerineColors.green.copy(alpha = 0.14f))
                                .border(1.dp, TangerineColors.green.copy(alpha = 0.6f), RoundedCornerShape(12.dp))
                                .clickable(onClick = onRefresh)
                                .padding(horizontal = 22.dp, vertical = 10.dp),
                        ) {
                            Text(
                                "Retry",
                                fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 14.sp,
                                color = TangerineColors.green,
                            )
                        }
                    }
                }
                songs == null -> Box(
                    modifier = Modifier.fillMaxWidth().weight(1f),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        "Loading songs…",
                        fontFamily = Karla, fontSize = 14.sp, color = TangerineColors.textMuted,
                    )
                }
                songs.isEmpty() -> Box(
                    modifier = Modifier.fillMaxWidth().weight(1f),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        "No stem-ready songs yet",
                        fontFamily = Karla, fontSize = 14.sp, color = TangerineColors.textMuted,
                    )
                }
                else -> LazyColumn(
                    modifier = Modifier.fillMaxWidth().weight(1f),
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(songs) { song ->
                        TakeSongRow(song = song, onClick = { onSelect(song) })
                    }
                }
            }
        }

        // ── New Project source wizard (v4 mockup §panel-4) ── On the browser, "Original song" just
        //    dismisses: the library list is already the screen behind this sheet.
        if (showWizard) {
            NewProjectWizard(
                onDismiss = { showWizard = false },
                onOriginalSong = { showWizard = false },
                onFromScratch = { showWizard = false; onCreateScratch(it) },
            )
        }
    }
}

@Composable
private fun TakeSongRow(song: TakeSong, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(TangerineColors.surface)
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    song.title,
                    fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 17.sp,
                    color = TangerineColors.text, maxLines = 2,
                )
                // "artist · 144 BPM" — drop the BPM clause when bpm is null, drop
                // artist when it's blank; the server returns newest-first so we
                // never re-sort.
                val subtitle = listOfNotNull(
                    song.artist.takeIf { it.isNotBlank() },
                    song.bpm?.let { "${it.roundToInt()} BPM" },
                ).joinToString(" · ")
                if (subtitle.isNotEmpty()) {
                    Spacer(Modifier.height(2.dp))
                    Text(
                        subtitle,
                        fontFamily = Karla, fontSize = 12.sp, color = TangerineColors.textMuted,
                    )
                }
            }
            Spacer(Modifier.width(10.dp))
            BeatmapBadge(verified = song.beatmapVerified)
        }
    }
}

@Composable
private fun BeatmapBadge(verified: Boolean) {
    val color = if (verified) TangerineColors.green else TangerineColors.orange
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(color.copy(alpha = 0.14f))
            .border(1.dp, color.copy(alpha = 0.5f), RoundedCornerShape(8.dp))
            .padding(horizontal = 8.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            if (verified) Icons.Default.CheckCircle else Icons.Default.Warning,
            contentDescription = if (verified) "verified beatmap" else "unverified beatmap",
            tint = color,
            modifier = Modifier.size(13.dp),
        )
        Spacer(Modifier.width(4.dp))
        Text(
            if (verified) "verified" else "unverified",
            fontFamily = JetBrainsMono, fontSize = 10.sp, color = color,
        )
    }
}

// ─── Surface (the wrapped 4b take control surface) ─────────────────────────────

@Composable
private fun TakeSurface(
    song: TakeSong,
    service: OrchestratorService,
    onBack: () -> Unit,
    onCreateScratch: (String) -> Unit,
) {
    val scope = rememberCoroutineScope()

    // Build/open the cover when this song loads into the surface (re-fires when the
    // browser swaps to a different song).
    LaunchedEffect(song.trackId) {
        if (song.trackId.startsWith(SCRATCH_PREFIX)) service.gigCmd.takeNewScratch(song.title)
        else service.gigCmd.takeLoad(song.trackId, song.title)
    }

    // S214: Reaper-mirror status. Poll GET /take/status every 1 s while this surface is
    // composed; the effect cancels on leave / song-swap (keyed on song.trackId). Drives the
    // status bar (REAPER/REC/SSD) + the transport readout. null = MS unreachable (greys out).
    var status by remember { mutableStateOf<TakeStatus?>(null) }
    LaunchedEffect(song.trackId) {
        while (true) {
            status = service.gigCmd.fetchTakeStatus()
            kotlinx.coroutines.delay(1_000L)
        }
    }
    // CAMS = live peer cams; BATT = this phone (both local, independent of the rig mirror).
    val camCount = service.peerCount.collectAsState().value
    val batteryPct = service.battery.levelPct.collectAsState().value

    var armState by remember { mutableStateOf(ArmPresetState()) }  // Acoustic, overheads + full kit on
    // S221 ②·4a-UI (v4 re-housing): the inline LAYERS/KIT + BACKING MIX cards moved into bottom-sheet
    // DRAWERS opened by the 5-chip dock (LAYERS · KIT · MIX · CAMS · PRO), per the locked v4 mockup
    // (apk--take-controller-v4-drawers.html). openDrawer = which sheet is showing (null = clean face);
    // overflowOpen = the ⋮ menu. Pure presentation — every callback/state below is unchanged.
    var openDrawer by remember { mutableStateOf<TakeDrawer?>(null) }
    var overflowOpen by remember { mutableStateOf(false) }
    var showWizard by remember { mutableStateOf(false) }           // S221 ②·4b: the New-project source wizard
    var showAddLayer by remember { mutableStateOf(false) }         // S221 ②·4a: the Add-layer kind picker
    // S213: the 4-stem backing mix, defaulting to the template's exact values (Drums (ref)
    // muted — Nathan's the drummer). Keyed on song.trackId so swapping songs RESETS to
    // template defaults without auto-sending (a freshly-loaded cover already carries these;
    // only user actions send). The panel is the source of truth — no rig->APK readback yet.
    var mix by remember(song.trackId) { mutableStateOf(defaultBackingMix()) }
    // S218 ②·2.5 — live recording indicator. Optimistic overlay, RIG-DRIVEN-RECONCILED so it can't
    // drift (the S216 lesson): the rig's take set stays the source of truth; these locals only paint
    // the in-flight take until the rig's own pill catches up, then self-clear.
    //   provisionalTake = index of the NEW take being recorded (fresh Record); null for record-over / idle
    //   recordOverIndex = index of the EXISTING take being re-recorded (Re-do / long-press); null otherwise
    var provisionalTake by remember(song.trackId) { mutableStateOf<Int?>(null) }
    var recordOverIndex by remember(song.trackId) { mutableStateOf<Int?>(null) }
    // S218·2 — record-over hold. The rig CLEARS the take's slab before re-recording, so it briefly
    // reports a lower take_count + drops the pill. Freeze the pre-record-over count + take list so the
    // counter never ticks DOWN and the redone pill stays visible (ringed). Self-clears on Stop.
    var recordOverFloor by remember(song.trackId) { mutableStateOf<Int?>(null) }
    var recordOverSnapshot by remember(song.trackId) { mutableStateOf<List<TakeTakeInfo>?>(null) }
    var isRecording by remember { mutableStateOf(false) }
    var recordReady by remember { mutableStateOf(true) }           // false during the post-Stop settle window

    // S206 4b fix: after Stop, keep Record disabled for a settle window so the
    // prior take's items finalize on the rig before the next take-record fires —
    // otherwise it reads a stale max_drum_end and records on top of the prior
    // take (the rapid-retake race). Interim APK guard until a rig->APK "take
    // committed" signal replaces the fixed delay.
    LaunchedEffect(recordReady) {
        if (!recordReady) {
            kotlinx.coroutines.delay(TAKE_SETTLE_MS)
            recordReady = true
        }
    }

    // S216 slice2: rig-driven take readback — the rig's count/takes/activeTake are the source of
    // truth and drive the strip. S218 paints an optimistic in-flight take ON TOP, derived so it can
    // never double-show with or outlive the rig's own pill.
    val rigTakeCount = status?.takeCount ?: 0
    val activeTake = status?.activeTake ?: 0
    // S219 ②·3a: the rig-driven ★ master (kept) take, 0 = none. Drives the green ★ on its pill +
    // the action-sheet "Set/Unset master" label. Rig is the source of truth — no local master state.
    val masterTake = status?.masterTake ?: 0
    val takes = status?.takes ?: emptyList()
    // S221 ②·4a: the cover's layers + active layer, rig-driven (the registry via /take/status). Empty
    // until a cover loads (seed-on-load gives a 1-layer Drums cover); the active-layer pill hides while empty.
    val layers = status?.layers ?: emptyList()
    val activeLayer = status?.activeLayer ?: ""
    // Show the provisional pill ONLY in the gap between firing Record and the rig enumerating the new
    // take. Derived against the live rig count, so the synthetic pill can NEVER double-show with the
    // rig's own pill, even for a frame.
    val showProvisional = provisionalTake?.let { rigTakeCount < it } == true
    // S218·2: floor in the record-over hold so the count can't tick DOWN under the rig's slab-clear.
    val displayTakeCount = maxOf(rigTakeCount, provisionalTake ?: 0, recordOverFloor ?: 0)
    val isRecordingNow = isRecording || showProvisional || recordOverIndex != null
    // Self-heal: once the rig has enumerated the new take, drop the provisional flag (the display
    // already switched off it via showProvisional; this just tidies state).
    LaunchedEffect(status) {
        provisionalTake?.let { if (rigTakeCount >= it) provisionalTake = null }
    }
    // On Stop: clear the record-over ring immediately; for a fresh take keep painting it through the
    // rig's finalize latency, but ROLL IT BACK if the take never commits within the settle window
    // (so the strip/counter can't lie about a take that didn't land).
    LaunchedEffect(isRecording) {
        if (!isRecording) {
            recordOverIndex = null
            recordOverFloor = null        // S218·2: release the held count; rig truth takes over
            recordOverSnapshot = null
            val pending = provisionalTake
            if (pending != null) {
                kotlinx.coroutines.delay(TAKE_SETTLE_MS)   // existing 5 s constant
                if (provisionalTake == pending && rigTakeCount < pending) provisionalTake = null
            }
        }
    }
    // S217: cap state, rig-driven (the Lua's TAKE_CAP via /take/status). takeCap 0 = no cap info
    // (pre-deploy MS / stale rig) -> never "at cap". atCap = cap known AND reached -> disables
    // Record + shows the "cap reached" note. Single source of truth = the rig, not a local const.
    val takeCap = status?.takeCap ?: 0
    val atCap = takeCap in 1..displayTakeCount
    // Long-press chooser targets (S217): which take's record-over/delete menu is open, and the
    // delete-confirm target. Both clear on dismiss / after firing.
    var longPressTake by remember { mutableStateOf<TakeTakeInfo?>(null) }
    var confirmDeleteTake by remember { mutableStateOf<TakeTakeInfo?>(null) }
    var renameTake by remember { mutableStateOf<TakeTakeInfo?>(null) }   // S220 ②·3b: label-edit dialog target

    // TAKE mode = drums only (band + music hidden / forced off in the compute).
    val armedCsv = computeArmedTracks(
        mode = ArmPresetMode.TAKE,
        kitType = armState.kitType,
        overheads = armState.overheads,
        fullKit = armState.fullKit,
        music = false,
        ead = armState.ead,
    ).joinToString(",")
    val armedCount = if (armedCsv.isEmpty()) 0 else armedCsv.split(",").size

    val gigTarget = service.gigCmd.target.collectAsState().value
    val gigLastOk = service.gigCmd.lastSendOk.collectAsState().value

    // The record action (armed CSV → take-record). Record fires this directly — the
    // unverified-beatmap warn gate was dropped per Nathan (recording shouldn't need a
    // dialog); the ✓/⚠ badge in the browser stays as info only.
    fun doRecord() {                       // fresh take → new provisional pill at rigTakeCount+1
        scope.launch { service.gigCmd.takeRecord(armedCsv) }
        provisionalTake = rigTakeCount + 1
        recordOverIndex = null
        isRecording = true
    }

    // S217 Re-do = record-over the LAST take. ONE primitive backs both this face button and the
    // long-press "record over this take". It RECORDS but does NOT add a take, so the rig count is
    // unchanged — S218 paints the record-over ring in place rather than a phantom +1.
    fun doRedo() {                         // record over the LAST take → ring in place, count UNCHANGED
        val n = displayTakeCount; if (n < 1) return
        scope.launch { service.gigCmd.takeRecordOver(n, armedCsv) }
        recordOverIndex = n
        recordOverFloor = displayTakeCount   // S218·2: hold the count through the rig's slab-clear
        recordOverSnapshot = takes           // freeze the pre-clear pill list so the ring stays put
        provisionalTake = null
        isRecording = true
    }

    Box(modifier = Modifier.fillMaxSize().background(TangerineColors.background)) {
        Column(modifier = Modifier.fillMaxSize()) {
            // ── Reaper-mirror status bar (S214) — the very top strip, per mockup ──
            TakeStatusBar(status = status, camCount = camCount, batteryPct = batteryPct)

            // ── Top bar: ‹ Songs (back to browser) · title · host pill ──
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(10.dp))
                        .clickable(onClick = onBack)
                        .padding(horizontal = 8.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        "‹ Songs",
                        fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 15.sp,
                        color = TangerineColors.text,
                    )
                }
                Spacer(Modifier.width(4.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        "Take Mode",
                        fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 18.sp,
                        color = TangerineColors.text, maxLines = 1,
                    )
                    Text(
                        "home studio · drum covers",
                        fontFamily = Karla, fontSize = 11.sp, color = TangerineColors.textMuted,
                    )
                }
                TakeHostPill(
                    target = "${gigTarget.host}:${gigTarget.port}",
                    lastSendOk = gigLastOk,
                )
                // ⋮ overflow (v4 mockup §panel-1) → "New project…" opens the source wizard (mockup
                // §panel-4, S221 ②·4b). From a loaded cover, "Original song" returns to the library
                // browser (onBack), where the user picks a song → the existing /take/load flow.
                Box {
                    IconButton(onClick = { overflowOpen = true }) {
                        Icon(Icons.Default.MoreVert, "More", tint = TangerineColors.textDim)
                    }
                    DropdownMenu(
                        expanded = overflowOpen,
                        onDismissRequest = { overflowOpen = false },
                    ) {
                        DropdownMenuItem(
                            text = {
                                Text(
                                    "New project…",
                                    fontFamily = Karla, fontSize = 14.sp, color = TangerineColors.text,
                                )
                            },
                            onClick = { overflowOpen = false; showWizard = true },
                        )
                    }
                }
            }

            // ── Scrollable middle (S218·2) ── everything between the pinned top bar and the pinned
            // Record/Stop row scrolls when a long (2-line) title would otherwise push Record off the
            // bottom (unreachable on a non-scrolling Column). weight(1f) takes the slack — it REPLACES
            // the old Spacer(weight(1f)) that used to sit before the Record row.
            Column(
                modifier = Modifier
                    .weight(1f)
                    .verticalScroll(rememberScrollState()),
            ) {

            // ── Now-playing block (S221 ②·4b polish — v4 mockup §panel-1) ── Clean media-player face:
            //    a waveform-art rectangle, the title, then a COVER pill + "artist · BPM". Pure
            //    presentation over the same song fields; no state/callback touched.
            TakeNowPlaying(song = song)

            // ── (S223) the active-layer pill is gone — it opened the same LAYERS drawer the dock chip
            //    already opens (redundant), and on a 1-layer cover it only read "Drums · 1/1". Layer
            //    context now lives solely in the LAYERS drawer. ──

            // ── Transport · audition takes (S214) — between NOW LOADED and the take strip ──
            TakeTransport(
                status = status,
                onToStart = { scope.launch { service.osc.sendToStart() } },
                onPlay = { scope.launch { service.osc.sendPlay() } },
                onPause = { scope.launch { service.osc.sendPause() } },
                onStop = { scope.launch { service.osc.sendStop() } },
                onSeek = { posSec -> scope.launch { service.gigCmd.takeSeek(posSec) } },
            )

            // ── Take strip (S216 slice2) — rig-driven pills T1..TN, tap to preview, long-press for
            //    the record-over / delete chooser (S217) ──
            // S218·2: while a record-over is in flight, feed the FROZEN snapshot so pills don't
            // vanish / renumber under the rig's slab-clear; the ring (recordOverIndex) lands on the
            // right pill. Live rig list at all other times.
            val stripTakes = if (recordOverIndex != null && recordOverSnapshot != null) recordOverSnapshot!! else takes
            TakeStrip(
                takes = stripTakes,
                activeTake = activeTake,
                masterTake = masterTake,
                showProvisional = showProvisional,
                provisionalIndex = provisionalTake,
                recordOverIndex = recordOverIndex,
                onTakeTap = { take ->
                    scope.launch {
                        service.gigCmd.takeSeek(take.startSec)
                        // The seek rides the file bridge (the Lua applies it on its 0.2 s poll);
                        // wait a beat before the OSC play so preview starts AT the take's start
                        // rather than wherever the playhead happened to be (same bridge-vs-OSC
                        // ordering the manual transport sidesteps by being human-paced).
                        kotlinx.coroutines.delay(300)
                        service.osc.sendPlay()
                    }
                },
                onTakeLong = { take -> longPressTake = take },
            )

            // ── Take counter + live armed summary ──
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column {
                    Text(
                        "TAKE",
                        fontFamily = JetBrainsMono, fontWeight = FontWeight.Bold,
                        fontSize = 10.sp, letterSpacing = 2.sp, color = TangerineColors.orange,
                    )
                    // Big count + a muted "/ cap" when the rig reports one (S217). "cap reached" note
                    // when at the ceiling, so the disabled Record button has an explanation. S218: the
                    // digit animates (odometer slide) and goes RED while a take is in flight, so the
                    // 1->2 tick lands the moment Record is tapped and reads as "live/provisional".
                    Row(verticalAlignment = Alignment.Bottom) {
                        AnimatedContent(
                            targetState = displayTakeCount,
                            transitionSpec = {
                                (slideInVertically { it } + fadeIn()) togetherWith
                                    (slideOutVertically { -it } + fadeOut())
                            },
                            label = "take-count",
                        ) { n ->
                            Text(
                                if (n == 0) "—" else n.toString(),
                                fontFamily = JetBrainsMono, fontWeight = FontWeight.Bold,
                                fontSize = 44.sp,
                                color = if (isRecordingNow) TangerineColors.danger else TangerineColors.text,
                            )
                        }
                        if (takeCap > 0) {
                            Text(
                                " / $takeCap",
                                fontFamily = JetBrainsMono, fontSize = 18.sp,
                                color = TangerineColors.textMuted,
                                modifier = Modifier.padding(bottom = 7.dp),
                            )
                        }
                    }
                    if (atCap) {
                        Text(
                            "cap reached",
                            fontFamily = JetBrainsMono, fontSize = 10.sp, color = TangerineColors.danger,
                        )
                    }
                }
                Spacer(Modifier.weight(1f))
                Column(horizontalAlignment = Alignment.End) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier.size(8.dp).clip(CircleShape).background(
                                if (isRecordingNow) TangerineColors.danger else TangerineColors.textMuted,
                            ),
                        )
                        Spacer(Modifier.width(6.dp))
                        Text(
                            if (isRecordingNow) "RECORDING" else "idle",
                            fontFamily = JetBrainsMono, fontSize = 11.sp,
                            color = if (isRecordingNow) TangerineColors.danger else TangerineColors.textMuted,
                        )
                    }
                    Spacer(Modifier.height(4.dp))
                    Text(
                        if (armedCsv.isEmpty()) "no channels" else "arm $armedCsv",
                        fontFamily = JetBrainsMono, fontSize = 11.sp, color = TangerineColors.textDim,
                    )
                    Text(
                        "$armedCount ch",
                        fontFamily = JetBrainsMono, fontSize = 10.sp, color = TangerineColors.textMuted,
                    )
                }
            }

            // ── (v4 re-housing) the LAYERS/KIT + BACKING MIX cards no longer live on the face — they
            //    are bottom-sheet DRAWERS opened by the dock below. The clean now-playing face ends here.
            }   // ── end scrollable middle (S218·2); Spacer(weight(1f)) removed — the scroll column
                //    now owns the vertical slack so the Record/Stop row below stays pinned + reachable.

            // ── Record / Re-do  ·  Stop (S217 state-toggle: the recording Stop is full-width and
            //    can never be crowded out; idle shows Record + Re-do). Re-do + long-press record-over
            //    both RECORD, so they honour recordReady + !isRecording exactly like Record (the 5 s
            //    post-Stop settle), or the rapid-retake race re-appears. ──
            if (!isRecording) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    TakeRecordButton(
                        modifier = Modifier.weight(2f),
                        label = when {
                            atCap -> "Cap reached ($takeCap)"
                            !recordReady -> "Saving take…"
                            else -> "Record Take"
                        },
                        enabled = recordReady && !atCap,
                        onClick = { doRecord() },
                    )
                    TakeRedoButton(
                        modifier = Modifier.weight(1f),
                        enabled = recordReady && displayTakeCount >= 1,
                        onClick = { doRedo() },
                    )
                }
            } else {
                Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 16.dp)) {
                    TakeStopButton(
                        modifier = Modifier.fillMaxWidth(),
                        enabled = true,
                        onClick = {
                            scope.launch { service.osc.sendStop() }
                            isRecording = false
                            recordReady = false   // settle before the next take can fire
                        },
                    )
                }
            }

            // ── Dock (v4 mockup §panel-1) — the 4 drawer chips pinned to the bottom of the face.
            //    LAYERS carries the orange accent (it's the build-the-cover home, now also the active
            //    layer's kit — S223); the chip whose drawer is open lights teal. Each opens its
            //    bottom-sheet below. ──
            TakeDock(openDrawer = openDrawer, onChip = { kind -> openDrawer = kind })
        }

        // ── Drawers (v4 re-housing) — bottom-sheets opened by the dock chips ──────────────────────
        when (openDrawer) {
            TakeDrawer.LAYERS -> TakeBottomSheet(onDismiss = { openDrawer = null }) {
                LayersDrawerContent(
                    layers = layers,
                    activeLayer = activeLayer,
                    armState = armState,
                    onArmState = { armState = it },
                    onSwitchLayer = { id -> scope.launch { service.gigCmd.takeSwitchLayer(id) } },
                    onArmLayers = { ids -> scope.launch { service.gigCmd.takeArmLayers(ids) } },
                    onAddLayer = { showAddLayer = true },
                )
            }
            TakeDrawer.MIX -> TakeBottomSheet(onDismiss = { openDrawer = null }) {
                MixDrawerContent(
                    mix = mix,
                    onMuteToggle = { i ->
                        val stem = mix[i]
                        val newMute = !stem.mute
                        mix = mix.mapIndexed { idx, s -> if (idx == i) s.copy(mute = newMute) else s }
                        scope.launch { service.gigCmd.takeMix(stem.name, newMute, stem.volDb.toDouble()) }
                    },
                    onVolChange = { i, v ->
                        mix = mix.mapIndexed { idx, s -> if (idx == i) s.copy(volDb = v) else s }
                    },
                    onVolChangeFinished = { i ->
                        val cur = mix[i]
                        scope.launch { service.gigCmd.takeMix(cur.name, cur.mute, cur.volDb.toDouble()) }
                    },
                )
            }
            TakeDrawer.CAMS -> TakeBottomSheet(onDismiss = { openDrawer = null }) {
                CamsDrawerContent(peers = service.peerInfos.collectAsState().value)
            }
            TakeDrawer.PRO -> TakeBottomSheet(onDismiss = { openDrawer = null }) {
                ProDrawerContent()
            }
            null -> {}
        }

        // ── Long-press chooser + destructive-delete confirm (S217) ──
        longPressTake?.let { take ->
            TakeActionSheet(
                take = take,
                isMaster = take.index == masterTake,         // S219 ②·3a: toggles label Set/Unset
                canDelete = takes.size >= 2,                 // never offer deleting the only take
                canRecordOver = recordReady && !isRecording, // reuse the post-Stop settle guard
                onDismiss = { longPressTake = null },
                onSetMaster = {
                    longPressTake = null
                    // S219 ②·3a: set/toggle the ★ master. No transport/record involved, so it's
                    // independent of the settle guards; the next /take/status poll repaints the ★.
                    scope.launch { service.gigCmd.takeSetMaster(take.index) }
                },
                onRename = {
                    longPressTake = null
                    renameTake = take   // S220 ②·3b: open the label-edit dialog for this take
                },
                onRecordOver = {
                    longPressTake = null
                    scope.launch { service.gigCmd.takeRecordOver(take.index, armedCsv) }
                    recordOverIndex = take.index         // S218: ring THIS pill red in place
                    recordOverFloor = displayTakeCount   // S218·2: hold count through the slab-clear
                    recordOverSnapshot = takes           // freeze the pre-clear pill list
                    provisionalTake = null
                    isRecording = true                   // records; rig count UNCHANGED, no new pill
                },
                onDelete = {
                    longPressTake = null
                    confirmDeleteTake = take
                },
            )
        }
        confirmDeleteTake?.let { take ->
            TakeDeleteConfirm(
                take = take,
                onDismiss = { confirmDeleteTake = null },
                onConfirm = {
                    confirmDeleteTake = null
                    scope.launch { service.gigCmd.takeDelete(take.index) }
                },
            )
        }
        renameTake?.let { take ->
            TakeLabelDialog(
                take = take,
                onDismiss = { renameTake = null },
                onSave = { newLabel ->
                    renameTake = null
                    // S220 ②·3b: set/clear the take's label; the MS sanitizes, the rig persists, the
                    // next /take/status poll repaints the strip caption. Empty = clear.
                    scope.launch { service.gigCmd.takeLabel(take.index, newLabel) }
                },
            )
        }
        // ── Add-layer kind picker (S221 ②·4a) ──
        if (showAddLayer) {
            AddLayerDialog(
                onDismiss = { showAddLayer = false },
                onPick = { kind ->
                    showAddLayer = false
                    // The rig materialises the layer (track + chain + bus) + makes it active; the next
                    // /take/status poll repaints the LAYERS/KIT tab + the active-layer pill.
                    scope.launch { service.gigCmd.takeAddLayer(kind) }
                },
            )
        }
        // ── New Project source wizard (S221 ②·4b, v4 mockup §panel-4) ── From a loaded cover,
        //    "Original song" returns to the library browser (onBack) — the existing /take/load flow.
        if (showWizard) {
            NewProjectWizard(
                onDismiss = { showWizard = false },
                onOriginalSong = { showWizard = false; onBack() },
                onFromScratch = { showWizard = false; onCreateScratch(it) },
            )
        }
    }
}

// ─── Now-playing block (S221 ②·4b polish — v4 mockup §panel-1) ─────────────────

/**
 * The clean now-playing face block (v4 mockup §panel-1, apk--take-controller-v4-drawers.html):
 * a decorative waveform-art rectangle, the song title, then a COVER pill + "artist · BPM". This
 * replaces the old green "NOW LOADED" card so the surface reads as a high-quality media player
 * ([[feedback--drummer-controller-design-language]]). PURE PRESENTATION — it reads only the
 * already-loaded song's title/artist/bpm; no state, callback, or endpoint is involved.
 */
@Composable
private fun TakeNowPlaying(song: TakeSong) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // Waveform-art rectangle — faint orange bars + a centred faded disc. Decoration only;
        // the bar heights are a fixed set matching the mockup (not a real waveform).
        WaveformArt()
        Spacer(Modifier.height(9.dp))
        Text(
            song.title,
            fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 20.sp,
            color = TangerineColors.text, maxLines = 2,
        )
        Spacer(Modifier.height(6.dp))
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(7.dp),
        ) {
            // COVER pill — mono, letter-spaced, orange on a low-alpha orange bg (mockup §panel-1).
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .background(TangerineColors.orange.copy(alpha = 0.16f))
                    .padding(horizontal = 7.dp, vertical = 2.dp),
            ) {
                Text(
                    "COVER",
                    fontFamily = JetBrainsMono, fontWeight = FontWeight.Bold,
                    fontSize = 10.sp, letterSpacing = 1.sp, color = TangerineColors.orange,
                )
            }
            // "artist · 157 BPM" — drop the BPM clause when bpm is null, drop artist when blank
            // (same rule as the browser row). textDim = the mockup's #7a7a94 subtitle grey.
            val meta = listOfNotNull(
                song.artist.takeIf { it.isNotBlank() },
                song.bpm?.let { "${it.roundToInt()} BPM" },
            ).joinToString(" · ")
            if (meta.isNotEmpty()) {
                Text(
                    meta,
                    fontFamily = Karla, fontSize = 12.sp, color = TangerineColors.textDim,
                )
            }
        }
    }
}

/**
 * The decorative waveform-art rectangle (v4 mockup §panel-1): a rounded dark box with a row of
 * faint orange vertical bars and a centred faded disc icon. Static art — bar heights are the
 * mockup's fixed 12-bar set. The box bg #101018 is a literal (between surface and surfaceInset).
 */
@Composable
private fun WaveformArt() {
    // The mockup's 12 bar heights as fractions of the box height.
    val barFractions = listOf(
        0.34f, 0.62f, 0.48f, 0.80f, 0.40f, 0.70f,
        0.55f, 0.88f, 0.46f, 0.64f, 0.38f, 0.74f,
    )
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(104.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(Color(0xFF101018))
            .border(1.dp, TangerineColors.textDim.copy(alpha = 0.3f), RoundedCornerShape(16.dp)),
        contentAlignment = Alignment.Center,
    ) {
        // Faint orange bars across the box.
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 14.dp),
            horizontalArrangement = Arrangement.SpaceAround,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            barFractions.forEach { frac ->
                Box(
                    modifier = Modifier
                        .width(3.dp)
                        .fillMaxHeight(frac)
                        .clip(RoundedCornerShape(2.dp))
                        .background(TangerineColors.orange.copy(alpha = 0.5f)),
                )
            }
        }
        // Centred faded disc over the bars.
        Icon(
            Icons.Default.Album,
            contentDescription = null,
            tint = TangerineColors.textMuted.copy(alpha = 0.7f),
            modifier = Modifier.size(30.dp),
        )
    }
}

// ─── Reaper-mirror status bar + transport (S214) ───────────────────────────────

/**
 * The thin status strip at the very top of the surface (mockup top row). REAPER turns green
 * only when the mirror is live (status present + not stale); REC shows only while the rig is
 * actually recording; CAMS/BATT are local; SSD is the recording-drive headroom from the rig.
 */
@Composable
private fun TakeStatusBar(status: TakeStatus?, camCount: Int, batteryPct: Int?) {
    val reaperLive = status != null && !status.stale
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(TangerineColors.surfaceInset)
            .padding(horizontal = 16.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        StatusChip(
            label = "REAPER",
            textColor = TangerineColors.textDim,
            dotColor = if (reaperLive) TangerineColors.green else TangerineColors.textMuted,
        )
        // Red REC only when the rig reports it's actually recording (mirror, not optimistic).
        if (status?.recording == true) {
            StatusChip(label = "REC", textColor = TangerineColors.textDim, dotColor = TangerineColors.danger)
        }
        StatusChip(
            label = "CAMS $camCount",
            textColor = TangerineColors.textDim,
            dotColor = if (camCount > 0) TangerineColors.green else TangerineColors.textMuted,
        )
        Text(
            "SSD ${status?.ssdFreeLabel ?: "—"}",
            fontFamily = JetBrainsMono, fontSize = 10.sp, color = TangerineColors.textMuted,
        )
        Text(
            "BATT ${batteryPct?.let { "$it%" } ?: "—"}",
            fontFamily = JetBrainsMono, fontSize = 10.sp, color = TangerineColors.textMuted,
        )
    }
}

@Composable
private fun StatusChip(label: String, textColor: Color, dotColor: Color?) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        if (dotColor != null) {
            Box(modifier = Modifier.size(7.dp).clip(CircleShape).background(dotColor))
            Spacer(Modifier.width(5.dp))
        }
        Text(label, fontFamily = JetBrainsMono, fontSize = 10.sp, color = textColor)
    }
}

/**
 * Transport row — audition the loaded cover from the throne. Play/Pause/Stop/to-start are
 * instant OSC actions; the progress Slider FOLLOWS the polled position EXCEPT while the finger
 * is down (local drag value), committing the seek on finger-up only (the file bridge can't take
 * a drag stream — same discipline as the S213 backing-mix fader). Greys out when stale/no-length.
 */
@Composable
private fun TakeTransport(
    status: TakeStatus?,
    onToStart: () -> Unit,
    onPlay: () -> Unit,
    onPause: () -> Unit,
    onStop: () -> Unit,
    onSeek: (Double) -> Unit,
) {
    val stale = status == null || status.stale
    val playing = status?.playing == true
    val posSec = if (stale) null else status?.positionSec
    val lenSec = if (stale) null else status?.lengthSec
    val maxSec = (lenSec?.toFloat() ?: 0f).coerceAtLeast(0f)
    val seekable = maxSec > 0f

    var dragging by remember { mutableStateOf(false) }
    var dragValue by remember { mutableFloatStateOf(0f) }
    val followValue = (posSec?.toFloat() ?: 0f).coerceIn(0f, if (seekable) maxSec else 0f)
    val sliderValue = if (dragging) dragValue.coerceIn(0f, maxSec) else followValue

    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)) {
        Text(
            "TRANSPORT · AUDITION TAKES",
            fontFamily = JetBrainsMono, fontWeight = FontWeight.Bold,
            fontSize = 11.sp, letterSpacing = 2.sp, color = TangerineColors.teal,
        )
        Spacer(Modifier.height(6.dp))
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(TangerineColors.surface)
                .border(1.dp, TangerineColors.textMuted.copy(alpha = 0.25f), RoundedCornerShape(16.dp))
                .padding(horizontal = 14.dp, vertical = 12.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onToStart) {
                    Icon(Icons.Default.SkipPrevious, "Go to start", tint = TangerineColors.textDim)
                }
                Spacer(Modifier.width(4.dp))
                Box(
                    modifier = Modifier
                        .size(46.dp)
                        .clip(CircleShape)
                        .background(if (stale) TangerineColors.textMuted else TangerineColors.orange)
                        .clickable(enabled = !stale) { if (playing) onPause() else onPlay() },
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        if (playing) Icons.Default.Pause else Icons.Default.PlayArrow,
                        contentDescription = if (playing) "Pause" else "Play",
                        tint = TangerineColors.surfaceInset,
                        modifier = Modifier.size(26.dp),
                    )
                }
                Spacer(Modifier.width(4.dp))
                IconButton(onClick = onStop) {
                    Icon(Icons.Default.Stop, "Stop", tint = TangerineColors.textDim)
                }
                Spacer(Modifier.weight(1f))
                Text(
                    "${fmtClock(posSec)} / ${fmtClock(lenSec)}",
                    fontFamily = JetBrainsMono, fontSize = 12.sp, color = TangerineColors.text,
                )
            }
            Slider(
                value = sliderValue,
                onValueChange = { dragging = true; dragValue = it },
                onValueChangeFinished = {
                    onSeek(dragValue.toDouble())
                    dragging = false
                },
                valueRange = 0f..(if (seekable) maxSec else 1f),
                enabled = seekable,
                colors = SliderDefaults.colors(
                    thumbColor = TangerineColors.orange,
                    activeTrackColor = TangerineColors.orange,
                    inactiveTrackColor = TangerineColors.textMuted.copy(alpha = 0.3f),
                ),
            )
        }
    }
}

/** m:ss for the transport readout; "—:—" when null/unknown (stale or no cover). */
private fun fmtClock(sec: Double?): String {
    if (sec == null || sec.isNaN() || sec < 0) return "—:—"
    val total = sec.roundToInt()
    return "%d:%02d".format(total / 60, total % 60)
}

/**
 * S216 slice2 — the take strip. One pill per clone-forward take (T1..TN), rig-driven from
 * `/take/status` (the source of truth — no local counter). The active take is highlighted in
 * tangerine (v4 mockup styling, apk--take-controller-v4-drawers.html); tapping a pill seeks the
 * rig to that take's start and plays it (preview), and long-pressing opens the S217 record-over /
 * delete chooser.
 *
 * S219 ②·3a — ★ master. The pill whose index == [masterTake] shows a green ★ + green border (the
 * "kept take" marker), rig-driven from `/take/status`. A take can be active AND master (orange fill
 * kept, green ★/border take precedence) — see [TakePill].
 *
 * S218 ②·2.5 — the in-flight take. A take being RECORDED isn't committed yet, so the rig can't
 * enumerate it until Stop. We paint it APK-side as a red animated [RecordingPill]: record-over
 * rings the existing pill in place ([recordOverIndex]); a fresh take appends one extra pill
 * ([showProvisional]/[provisionalIndex]). Both are derived/self-healing in [TakeSurface] so they
 * never double-show with or outlive the rig's own pill.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun TakeStrip(
    takes: List<TakeTakeInfo>,
    activeTake: Int,
    masterTake: Int,
    showProvisional: Boolean,
    provisionalIndex: Int?,
    recordOverIndex: Int?,
    onTakeTap: (TakeTakeInfo) -> Unit,
    onTakeLong: (TakeTakeInfo) -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)) {
        Text(
            "TAKES",
            fontFamily = JetBrainsMono, fontWeight = FontWeight.Bold,
            fontSize = 11.sp, letterSpacing = 2.sp, color = TangerineColors.teal,
        )
        Spacer(Modifier.height(6.dp))
        // Hint only when there's genuinely nothing to show — not while the very first take records.
        if (takes.isEmpty() && !showProvisional) {
            Text(
                "no takes yet — record one to start",
                fontFamily = JetBrainsMono, fontSize = 11.sp, color = TangerineColors.textMuted,
            )
        } else {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(5.dp),
            ) {
                takes.forEach { take ->
                    if (take.index == recordOverIndex) {
                        // This committed take is being re-recorded — ring it red in place.
                        RecordingPill(modifier = Modifier.weight(1f), label = "T${take.index}")
                    } else {
                        TakePill(
                            modifier = Modifier.weight(1f),
                            take = take,
                            active = take.index == activeTake,
                            master = take.index == masterTake,
                            onTap = { onTakeTap(take) },
                            onLong = { onTakeLong(take) },
                        )
                    }
                }
                // The fresh in-flight take has no rig pill yet — append a provisional recording pill.
                if (showProvisional && provisionalIndex != null) {
                    RecordingPill(modifier = Modifier.weight(1f), label = "T$provisionalIndex")
                }
            }
        }
    }
}

/**
 * A committed take's pill. Colour lock (S219 §5): idle = muted outline · active = orange fill/border ·
 * ★ master = green border + a green ★ leading the label. A take can be active AND master — the orange
 * fill stays (the "currently auditioning" cue) while the green ★/border/label take precedence (the
 * "this is the keeper" cue), matching the v4 mockup's green `★4`. Tap previews; long-press opens the
 * record-over / delete / set-master chooser.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun TakePill(
    modifier: Modifier,
    take: TakeTakeInfo,
    active: Boolean,
    master: Boolean,
    onTap: () -> Unit,
    onLong: () -> Unit,
) {
    val orange = TangerineColors.orange
    val green = TangerineColors.green
    // Fill follows ACTIVE (orange wash) — an active+master take keeps it so the audition cue isn't
    // lost. Border + label tint: green when master (precedence), else orange when active, else muted.
    val fill = if (active) orange.copy(alpha = 0.14f) else Color.Transparent
    val borderColor = when {
        master -> green.copy(alpha = 0.8f)
        active -> orange.copy(alpha = 0.7f)
        else -> TangerineColors.textMuted.copy(alpha = 0.4f)
    }
    val labelColor = when {
        master -> green
        active -> orange
        else -> TangerineColors.textMuted
    }
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(fill)
            .border(
                if (master) 1.5.dp else 1.dp,
                borderColor,
                RoundedCornerShape(8.dp),
            )
            .combinedClickable(onClick = onTap, onLongClick = onLong)
            .padding(vertical = 7.dp, horizontal = 4.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (master) {
                    Icon(
                        Icons.Default.Star,
                        contentDescription = "master take",
                        tint = green,
                        modifier = Modifier.size(12.dp),
                    )
                    Spacer(Modifier.width(3.dp))
                }
                Text(
                    "T${take.index}",
                    fontFamily = JetBrainsMono,
                    fontWeight = if (active || master) FontWeight.Bold else FontWeight.Normal,
                    fontSize = 11.sp,
                    color = labelColor,
                )
            }
            // S220 ②·3b: free-text label under T{index} — quiet caption tone, ellipsized so it never
            // widens / wraps the pill even at the 8-take cap. No label -> just T{index}, as before.
            if (take.label.isNotBlank()) {
                Text(
                    take.label,
                    fontFamily = JetBrainsMono,
                    fontSize = 9.sp,
                    color = TangerineColors.textMuted,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

/**
 * S218 — the animated "this take is recording NOW" pill. Composes Nathan's three cues, all in red
 * (`danger`) so it reads distinct from orange = active and the future green = ★master:
 *   • Alive   — a pulsing red border + fill (rememberInfiniteTransition, ~650 ms reverse).
 *   • Loading — a thin indeterminate LinearProgressIndicator pinned along the bottom (pure
 *               material3, no extra dep) — the literal "loading bar… recording" affordance.
 *   • Label   — a solid red REC dot + the take label (e.g. T2) in JetBrainsMono.
 * Matches the committed-pill geometry (RoundedCornerShape(8.dp), padding(vertical = 7.dp), weight).
 */
@Composable
private fun RecordingPill(modifier: Modifier, label: String) {
    val rec = TangerineColors.danger
    val pulse = rememberInfiniteTransition(label = "rec-pulse")
    val alpha by pulse.animateFloat(
        initialValue = 0.35f,
        targetValue = 0.9f,
        animationSpec = infiniteRepeatable(tween(650), RepeatMode.Reverse),
        label = "rec-alpha",
    )
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(rec.copy(alpha = 0.06f + 0.16f * alpha))
            .border(1.dp, rec.copy(alpha = alpha), RoundedCornerShape(8.dp)),
    ) {
        Row(
            modifier = Modifier.align(Alignment.Center).padding(vertical = 7.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(modifier = Modifier.size(7.dp).clip(CircleShape).background(rec))
            Spacer(Modifier.width(5.dp))
            Text(
                label,
                fontFamily = JetBrainsMono, fontWeight = FontWeight.Bold,
                fontSize = 11.sp, color = rec,
            )
        }
        // Indeterminate loading bar pinned to the bottom edge — the "…recording" cue.
        LinearProgressIndicator(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .height(3.dp)
                .clip(RoundedCornerShape(bottomStart = 8.dp, bottomEnd = 8.dp)),
            color = rec,
            trackColor = rec.copy(alpha = 0.15f),
        )
    }
}

// ─── Layers (S221 ②·4a) ────────────────────────────────────────────────────────

/** Material icon per instrument kind (material-icons-extended). Used by the active-layer pill, the
 *  layer rows, and the Add-layer picker. */
private fun layerKindIcon(kind: String): ImageVector = when (kind.lowercase()) {
    "drums" -> Icons.Default.Album
    "vocals" -> Icons.Default.Mic
    "keys" -> Icons.Default.Piano
    else -> Icons.Default.MusicNote   // guitar / bass / other
}

/** Compute the new armed-id list after toggling [toggledId] to [newOn], preserving display order and
 *  always keeping the active layer armed (the rig forces it; the UI mirrors so the set stays consistent). */
private fun armedLayerIdsAfterToggle(
    layers: List<TakeLayerInfo>,
    toggledId: String,
    newOn: Boolean,
    activeLayer: String,
): List<String> {
    val set = layers.filter { it.armed }.map { it.id }.toMutableSet()
    if (newOn) set.add(toggledId) else set.remove(toggledId)
    if (activeLayer.isNotEmpty()) set.add(activeLayer)
    return layers.map { it.id }.filter { it in set }
}

// ─── Dock + drawers (v4 re-housing — apk--take-controller-v4-drawers.html) ──────

/** The 4 drawer chips of the dock; also keys the open bottom-sheet. (S223: KIT folded into LAYERS.) */
private enum class TakeDrawer { LAYERS, MIX, CAMS, PRO }

/**
 * The 4-chip dock pinned at the bottom of the playing face (v4 mockup §panel-1, the `.drw` row):
 * LAYERS · MIX · CAMS · PRO, icon-first. LAYERS carries the orange accent (the build-the-cover home,
 * now also home to the active layer's KIT — S223); the chip whose drawer is open lights teal
 * (`.drw.on`); the rest are muted. Pure navigation — tapping a chip just sets [openDrawer].
 */
@Composable
private fun TakeDock(openDrawer: TakeDrawer?, onChip: (TakeDrawer) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 13.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        DockChip(Icons.Default.Layers, "LAYERS", TakeDrawer.LAYERS, openDrawer, accent = true, onChip)
        DockChip(Icons.Default.Equalizer, "MIX", TakeDrawer.MIX, openDrawer, accent = false, onChip)
        DockChip(Icons.Default.Videocam, "CAMS", TakeDrawer.CAMS, openDrawer, accent = false, onChip)
        DockChip(Icons.Default.AutoFixHigh, "PRO", TakeDrawer.PRO, openDrawer, accent = false, onChip)
    }
}

/** One dock chip: icon over a tiny caption. Open = teal fill/border; LAYERS (accent) = orange when
 *  idle; the rest = muted outline. Matches the mockup `.drw` / `.drw.on` / `.drw.lay` styling. */
@Composable
private fun RowScope.DockChip(
    icon: ImageVector,
    label: String,
    kind: TakeDrawer,
    openDrawer: TakeDrawer?,
    accent: Boolean,
    onChip: (TakeDrawer) -> Unit,
) {
    val on = openDrawer == kind
    val tint = when {
        on -> TangerineColors.teal
        accent -> TangerineColors.orange
        else -> TangerineColors.textDim
    }
    val border = when {
        on -> TangerineColors.teal.copy(alpha = 0.7f)
        accent -> TangerineColors.orange.copy(alpha = 0.6f)
        else -> TangerineColors.textMuted.copy(alpha = 0.4f)
    }
    Column(
        modifier = Modifier
            .weight(1f)
            .clip(RoundedCornerShape(11.dp))
            .background(if (on) TangerineColors.teal.copy(alpha = 0.12f) else Color.Transparent)
            .border(1.dp, border, RoundedCornerShape(11.dp))
            .clickable { onChip(kind) }
            .padding(vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        Icon(icon, contentDescription = label, tint = tint, modifier = Modifier.size(20.dp))
        Text(
            label,
            fontFamily = JetBrainsMono, fontWeight = FontWeight.Bold, fontSize = 9.sp,
            letterSpacing = 0.5.sp, color = tint,
        )
    }
}

/** Shared bottom-sheet shell for the dock drawers — same `ModalBottomSheet` styling the app's other
 *  drawers use (GigModeScreen Cameras/Reaper sheets). [content] is the drawer body. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TakeBottomSheet(onDismiss: () -> Unit, content: @Composable () -> Unit) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = TangerineColors.surface,
        scrimColor = Color.Black.copy(alpha = 0.6f),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 18.dp)
                .padding(bottom = 28.dp),
        ) {
            content()
        }
    }
}

/**
 * LAYERS drawer (v4 mockup §panel-2) — build the cover, arm to record together. The layer-management
 * content lifted out of the old inline LAYERS/KIT card: a row per layer (kind · name · arm control,
 * tap to make active), an Add-layer row, and the "Record lays a take on every armed layer at once"
 * hint. Takes stay GLOBAL — no per-layer take count is rendered. Below a divider, the ACTIVE layer's
 * *kit* (drums = channel-arm presets; vocals/other = a 1-track summary) is folded in (S223), since a
 * kit is a property of the active layer, not a sibling of it — so it no longer needs its own chip.
 */
@Composable
private fun LayersDrawerContent(
    layers: List<TakeLayerInfo>,
    activeLayer: String,
    armState: ArmPresetState,
    onArmState: (ArmPresetState) -> Unit,
    onSwitchLayer: (String) -> Unit,
    onArmLayers: (List<String>) -> Unit,
    onAddLayer: () -> Unit,
) {
    DrawerHeader(label = "LAYERS", accent = TangerineColors.orange, caption = "tap a layer to make it active")
    Spacer(Modifier.height(10.dp))
    if (layers.isEmpty()) {
        Text(
            "load a cover to see its layers",
            fontFamily = Karla, fontSize = 13.sp, color = TangerineColors.textMuted,
        )
    } else {
        layers.forEachIndexed { i, layer ->
            val isActive = layer.id == activeLayer || (activeLayer.isEmpty() && i == 0)
            LayerRow(
                layer = layer,
                isActive = isActive,
                onSwitch = { if (!isActive) onSwitchLayer(layer.id) },
                onArmToggle = { newOn ->
                    onArmLayers(armedLayerIdsAfterToggle(layers, layer.id, newOn, activeLayer))
                },
            )
            Spacer(Modifier.height(9.dp))
        }
    }
    AddLayerRow(onClick = onAddLayer)
    Spacer(Modifier.height(12.dp))
    Text(
        "arm one or more layers — Record lays a take on every armed layer at once",
        fontFamily = JetBrainsMono, fontSize = 10.sp, color = TangerineColors.textDim,
    )

    // ── Active-layer KIT section (S223 — folded in from the old KIT drawer) ── what am I using on the
    //    active layer today? Drums → the s202 ChannelArmPresetSelector (full drum-channel arm
    //    presets/toggles); vocals/other → the 1-track LayerKitSummary. Only shown once a cover loads.
    if (layers.isNotEmpty()) {
        val active = layers.firstOrNull { it.id == activeLayer } ?: layers.firstOrNull()
        val kind = active?.kind?.lowercase() ?: "drums"
        Spacer(Modifier.height(18.dp))
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(1.dp)
                .background(TangerineColors.textMuted.copy(alpha = 0.25f)),
        )
        Spacer(Modifier.height(14.dp))
        DrawerHeader(
            label = "KIT",
            accent = TangerineColors.orange,
            caption = active?.let { "${it.name.ifBlank { it.id }} · what am I using today?" }
                ?: "load a cover to set the kit",
        )
        Spacer(Modifier.height(12.dp))
        when (kind) {
            "drums" -> ChannelArmPresetSelector(mode = ArmPresetMode.TAKE, state = armState, onState = onArmState)
            "vocals" -> LayerKitSummary("Vox · 1 track", "pro vocal chain → BALANCE")
            else -> LayerKitSummary("${active?.name?.ifBlank { active.id } ?: "Layer"} · 1 track", "")
        }
    }
}

/**
 * MIX drawer (v4 mockup §panel-3) — the BACKING MIX as pro-audio VERTICAL faders. Same 4-stem state +
 * the same send discipline as the old inline rows (mute sends immediately; the fader sends on
 * finger-up only). Drums (ref) reads as the muted reference column. Indices map back to the [mix] list
 * in the caller, so every send is identical to before — only the fader is vertical now.
 */
@Composable
private fun MixDrawerContent(
    mix: List<BackingStem>,
    onMuteToggle: (Int) -> Unit,
    onVolChange: (Int, Float) -> Unit,
    onVolChangeFinished: (Int) -> Unit,
) {
    DrawerHeader(
        label = "BACKING MIX",
        accent = TangerineColors.teal,
        caption = "ride from the throne · monitoring only",
    )
    Spacer(Modifier.height(16.dp))
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.Bottom,
    ) {
        mix.forEachIndexed { i, stem ->
            VerticalMixFader(
                stem = stem,
                onMuteToggle = { onMuteToggle(i) },
                onVolChange = { v -> onVolChange(i, v) },
                onVolChangeFinished = { onVolChangeFinished(i) },
            )
        }
    }
}

/** CAMS drawer — a minimal live list of the peer cams this surface already knows about
 *  (service.peerInfos). Full preview tiles / fullscreen are a later slice; this shows presence +
 *  recording state only, with a clean empty state when no peers are paired. */
@Composable
private fun CamsDrawerContent(peers: List<com.thegreentangerine.gigbooks.data.orchestrator.OrchestratorPeerServer.PeerInfo>) {
    DrawerHeader(
        label = "CAMS",
        accent = TangerineColors.green,
        caption = "peer cameras on the rig network",
    )
    Spacer(Modifier.height(12.dp))
    if (peers.isEmpty()) {
        Text(
            "No peer cameras connected",
            fontFamily = Karla, fontSize = 14.sp, color = TangerineColors.textMuted,
        )
        Spacer(Modifier.height(4.dp))
        Text(
            "phones that join the rig network appear here",
            fontFamily = JetBrainsMono, fontSize = 10.sp, color = TangerineColors.textMuted,
        )
    } else {
        peers.forEach { peer ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 5.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(TangerineColors.surfaceInset)
                    .border(1.dp, TangerineColors.textMuted.copy(alpha = 0.3f), RoundedCornerShape(12.dp))
                    .padding(horizontal = 12.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Default.Videocam, contentDescription = null, tint = TangerineColors.green, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(11.dp))
                Text(
                    peer.deviceName,
                    fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 14.sp,
                    color = TangerineColors.text, modifier = Modifier.weight(1f),
                )
                if (peer.isRecording) {
                    Box(modifier = Modifier.size(8.dp).clip(CircleShape).background(TangerineColors.danger))
                    Spacer(Modifier.width(6.dp))
                    Text("REC", fontFamily = JetBrainsMono, fontSize = 10.sp, color = TangerineColors.danger)
                } else {
                    Text("ready", fontFamily = JetBrainsMono, fontSize = 10.sp, color = TangerineColors.textDim)
                }
            }
        }
    }
}

/** PRO drawer — placeholder (the v4 mockup leaves PRO undefined). Clean "coming soon" sheet so the
 *  chip has a destination; the functions land in a later slice. */
@Composable
private fun ProDrawerContent() {
    DrawerHeader(label = "PRO", accent = TangerineColors.purple, caption = "advanced tools")
    Spacer(Modifier.height(16.dp))
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = 20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(Icons.Default.AutoFixHigh, contentDescription = null, tint = TangerineColors.textMuted, modifier = Modifier.size(34.dp))
        Text("Coming soon", fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = TangerineColors.textDim)
        Text(
            "pro tools land in a later slice",
            fontFamily = JetBrainsMono, fontSize = 10.sp, color = TangerineColors.textMuted,
        )
    }
}

/** A drawer's header row — coloured label + caption, matching the mockup's `.lbl` + sub-caption. */
@Composable
private fun DrawerHeader(label: String, accent: Color, caption: String) {
    Column(modifier = Modifier.fillMaxWidth().padding(top = 6.dp)) {
        Text(
            label,
            fontFamily = JetBrainsMono, fontWeight = FontWeight.Bold,
            fontSize = 12.sp, letterSpacing = 2.sp, color = accent,
        )
        Spacer(Modifier.height(3.dp))
        Text(caption, fontFamily = JetBrainsMono, fontSize = 10.sp, color = TangerineColors.textMuted)
    }
}

/** One layer row: kind icon · name (+ "· active") · arm control. Active row = orange wash + an ARMED
 *  badge (the rig always implies it). Other rows = a green/grey arm toggle; tapping the row body
 *  switches the active layer. */
@Composable
private fun LayerRow(
    layer: TakeLayerInfo,
    isActive: Boolean,
    onSwitch: () -> Unit,
    onArmToggle: (Boolean) -> Unit,
) {
    val orange = TangerineColors.orange
    val borderC = if (isActive) orange.copy(alpha = 0.7f) else TangerineColors.textMuted.copy(alpha = 0.4f)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(if (isActive) orange.copy(alpha = 0.12f) else Color.Transparent)
            .border(1.dp, borderC, RoundedCornerShape(12.dp))
            .clickable(enabled = !isActive, onClick = onSwitch)
            .padding(horizontal = 11.dp, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            layerKindIcon(layer.kind), contentDescription = null,
            tint = if (isActive) orange else TangerineColors.textDim, modifier = Modifier.size(20.dp),
        )
        Spacer(Modifier.width(11.dp))
        Row(modifier = Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
            Text(
                layer.name.ifBlank { layer.id },
                fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 14.sp,
                color = if (isActive) orange else TangerineColors.text,
            )
            if (isActive) {
                Spacer(Modifier.width(6.dp))
                Text("· active", fontFamily = JetBrainsMono, fontSize = 10.sp, color = TangerineColors.textDim)
            }
        }
        Spacer(Modifier.width(8.dp))
        if (isActive) {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(7.dp))
                    .background(orange)
                    .padding(horizontal = 9.dp, vertical = 4.dp),
            ) {
                Text(
                    "ARMED",
                    fontFamily = JetBrainsMono, fontWeight = FontWeight.Bold, fontSize = 9.sp,
                    color = TangerineColors.surfaceInset, letterSpacing = 0.5.sp,
                )
            }
        } else {
            LayerArmToggle(armed = layer.armed, onToggle = { onArmToggle(!layer.armed) })
        }
    }
}

/** Green-on / grey-off arm toggle (a small pill switch, matching the v4 mockup). */
@Composable
private fun LayerArmToggle(armed: Boolean, onToggle: () -> Unit) {
    val green = TangerineColors.green
    val edge = (if (armed) green else TangerineColors.textMuted).copy(alpha = 0.5f)
    Box(
        modifier = Modifier
            .width(40.dp).height(22.dp)
            .clip(RoundedCornerShape(11.dp))
            .background(if (armed) green.copy(alpha = 0.3f) else TangerineColors.surfaceInset)
            .border(1.dp, edge, RoundedCornerShape(11.dp))
            .clickable(onClick = onToggle),
        contentAlignment = if (armed) Alignment.CenterEnd else Alignment.CenterStart,
    ) {
        Box(
            modifier = Modifier
                .padding(2.dp).size(16.dp).clip(CircleShape)
                .background(if (armed) green else TangerineColors.textMuted),
        )
    }
}

/** A non-drum layer's minimal kit summary (Vocals etc. have no channel matrix — just the track + chain). */
@Composable
private fun LayerKitSummary(title: String, caption: String) {
    Column(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Text(title, fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = TangerineColors.text)
        if (caption.isNotEmpty()) {
            Text(caption, fontFamily = JetBrainsMono, fontSize = 10.sp, color = TangerineColors.textMuted)
        }
    }
}

/** The "Add layer" row → opens the kind picker. */
@Composable
private fun AddLayerRow(onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .border(1.dp, TangerineColors.textMuted.copy(alpha = 0.6f), RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(vertical = 12.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Default.Add, contentDescription = null, tint = TangerineColors.textDim, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(8.dp))
        Text("Add layer", fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = TangerineColors.textDim)
        Spacer(Modifier.width(8.dp))
        Text(
            "vocals · guitar · bass · keys",
            fontFamily = JetBrainsMono, fontSize = 9.sp, color = TangerineColors.textMuted,
        )
    }
}

/**
 * S221 ②·4a — the Add-layer kind picker. Vocals is enabled (②·4a builds its full template on the rig);
 * Guitar/Bass/Keys/Other are shown "soon" (②·4b adds their templates + amp-sim installs). Picking a kind
 * fires takeAddLayer; the rig materialises the layer and makes it active.
 */
@Composable
private fun AddLayerDialog(onDismiss: () -> Unit, onPick: (String) -> Unit) {
    val kinds = listOf(
        Triple("vocals", "Vocals", true),
        Triple("guitar", "Guitar", false),
        Triple("bass", "Bass", false),
        Triple("keys", "Keys", false),
        Triple("other", "Other", false),
    )
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = TangerineColors.surface,
        title = {
            Text("Add layer", fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = TangerineColors.text)
        },
        text = {
            Column {
                Text(
                    "Build the cover layer by layer. A Record lays a take on every armed layer at once.",
                    fontFamily = Karla, fontSize = 13.sp, color = TangerineColors.textMuted,
                )
                Spacer(Modifier.height(12.dp))
                kinds.forEach { (kind, label, enabled) ->
                    val tint = if (enabled) TangerineColors.orange else TangerineColors.textMuted
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(tint.copy(alpha = if (enabled) 0.1f else 0.04f))
                            .border(1.dp, tint.copy(alpha = if (enabled) 0.6f else 0.25f), RoundedCornerShape(10.dp))
                            .clickable(enabled = enabled) { onPick(kind) }
                            .padding(horizontal = 12.dp, vertical = 11.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(layerKindIcon(kind), contentDescription = null, tint = tint, modifier = Modifier.size(20.dp))
                        Spacer(Modifier.width(10.dp))
                        Text(
                            label,
                            fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 14.sp,
                            color = if (enabled) TangerineColors.text else TangerineColors.textMuted,
                        )
                        Spacer(Modifier.weight(1f))
                        if (!enabled) {
                            Text("soon", fontFamily = JetBrainsMono, fontSize = 10.sp, color = TangerineColors.textMuted)
                        }
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", fontFamily = Karla, color = TangerineColors.textMuted)
            }
        },
    )
}

// ─── New Project source wizard (S221 ②·4b — apk--take-controller-v4-drawers.html §panel-4) ──────

/**
 * S221 ②·4b — the New Project SOURCE WIZARD, reached from the ⋮ menu (v4 mockup §panel-4). A bottom-
 * sheet (same [TakeBottomSheet] shell the dock drawers use) showing the 3 source cards + the footer
 * line. Only ONE source is wired this slice:
 *   • Original song — FULLY wired: tap → [onOriginalSong] (the caller routes to the existing TakeBrowser
 *     library list, where picking a song runs the proven /take/load flow). The one working source.
 *   • From scratch / Media file — rendered exactly per the mockup but the backend isn't built yet, so
 *     tapping reveals an inline "Coming soon — backend lands next" note (a clean, graceful gate — no
 *     endpoint is called, no silent no-op, no crash). Media file also shows the (inert) "generate
 *     beat-map + click track" toggle from the mockup.
 * Hard rule (the prompt): NO backend changes — From-scratch/Media-file call nothing.
 */
@Composable
private fun NewProjectWizard(
    onDismiss: () -> Unit,
    onOriginalSong: () -> Unit,
    onFromScratch: (String) -> Unit,
) {
    // Which gated source's "Coming soon" note is showing (null = none). Reset whenever the sheet
    // re-opens (fresh remember per composition of the `if (showWizard)` block in the caller).
    var comingSoon by remember { mutableStateOf<String?>(null) }
    // S224: From scratch is now wired — tapping opens the name-entry dialog (overlaid on the sheet).
    var nameEntry by remember { mutableStateOf(false) }
    TakeBottomSheet(onDismiss = onDismiss) {
        // Header — ‹ chevron · "New project" / "start from a source" (mockup §panel-4 top row).
        Row(
            modifier = Modifier.fillMaxWidth().padding(top = 4.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column {
                Text(
                    "New project",
                    fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 18.sp,
                    color = TangerineColors.text,
                )
                Text(
                    "start from a source",
                    fontFamily = JetBrainsMono, fontSize = 11.sp, color = TangerineColors.textMuted,
                )
            }
        }
        Spacer(Modifier.height(8.dp))

        // 1) Original song — the one fully-wired source. Orange vinyl/Album icon.
        SourceCard(
            icon = Icons.Default.Album,
            iconTint = TangerineColors.orange,
            title = "Original song",
            caption = "browse library · stems ready",
            enabled = true,
            onClick = { comingSoon = null; onOriginalSong() },
        )
        Spacer(Modifier.height(11.dp))

        // 2) From scratch — teal square-plus/AddBox. S224: WIRED — tapping opens the name-entry dialog,
        //    then builds a blank 1-layer Drums cover via /take/new-scratch (no stems, no click).
        SourceCard(
            icon = Icons.Default.AddBox,
            iconTint = TangerineColors.teal,
            title = "From scratch",
            caption = "empty · build it layer by layer",
            enabled = true,
            onClick = { comingSoon = null; nameEntry = true },
        )
        Spacer(Modifier.height(11.dp))

        // 3) Media file — teal file-music/LibraryMusic, with the mockup's beat-map+click toggle. Gated.
        SourceCard(
            icon = Icons.Default.LibraryMusic,
            iconTint = TangerineColors.teal,
            title = "Media file",
            caption = "a rough band recording",
            enabled = false,
            onClick = { comingSoon = "Media file" },
            extra = {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 11.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    // Inert visual toggle (ON look per mockup) — wires to nothing this slice.
                    Box(
                        modifier = Modifier
                            .width(34.dp).height(20.dp)
                            .clip(RoundedCornerShape(11.dp))
                            .background(TangerineColors.green.copy(alpha = 0.3f)),
                        contentAlignment = Alignment.CenterEnd,
                    ) {
                        Box(
                            modifier = Modifier
                                .padding(2.dp).size(16.dp).clip(CircleShape)
                                .background(TangerineColors.green),
                        )
                    }
                    Spacer(Modifier.width(9.dp))
                    Text(
                        "generate beat-map + click track",
                        fontFamily = Karla, fontSize = 12.sp, color = TangerineColors.text,
                    )
                }
            },
        )

        // Footer line (mockup §panel-4).
        Spacer(Modifier.height(8.dp))
        Text(
            "guitar+vox, a bassline — anything with a pulse to play to",
            fontFamily = JetBrainsMono, fontSize = 10.sp, color = TangerineColors.textMuted,
            modifier = Modifier.fillMaxWidth(),
        )

        // Inline "coming soon" note for the gated sources — clean affordance, no backend call.
        comingSoon?.let { name ->
            Spacer(Modifier.height(12.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(11.dp))
                    .background(TangerineColors.teal.copy(alpha = 0.08f))
                    .border(1.dp, TangerineColors.teal.copy(alpha = 0.5f), RoundedCornerShape(11.dp))
                    .padding(horizontal = 12.dp, vertical = 11.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    Icons.Default.AutoFixHigh, contentDescription = null,
                    tint = TangerineColors.teal, modifier = Modifier.size(18.dp),
                )
                Spacer(Modifier.width(10.dp))
                Column {
                    Text(
                        "$name — coming soon",
                        fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 13.sp,
                        color = TangerineColors.teal,
                    )
                    Text(
                        "backend lands next",
                        fontFamily = JetBrainsMono, fontSize = 10.sp, color = TangerineColors.textMuted,
                    )
                }
            }
        }
    }

    // S224: name-entry dialog overlaid on the sheet (an AlertDialog, not an in-sheet OutlinedTextField —
    // IME handling inside a bottom sheet is fiddly on the real phone). On Create with a non-empty trimmed
    // name the caller dismisses the sheet + spins up the scratch cover (onCreateScratch).
    if (nameEntry) {
        ScratchNameDialog(
            onDismiss = { nameEntry = false },
            onCreate = { onFromScratch(it) },
        )
    }
}

/**
 * S224 — from-scratch name entry. A single-line cover name; Create is disabled until the trimmed name is
 * non-empty. Sends the RAW name (the MS CleanTitle + the Lua sanitise it; jsonString escapes it for the
 * wire), capped at 40 to match the MS title cap. Mirrors [TakeLabelDialog]'s dialog idiom.
 */
@Composable
private fun ScratchNameDialog(onDismiss: () -> Unit, onCreate: (String) -> Unit) {
    var text by remember { mutableStateOf("") }
    val canCreate = text.trim().isNotEmpty()
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = TangerineColors.surface,
        title = {
            Text(
                "Name your cover",
                fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 18.sp,
                color = TangerineColors.text,
            )
        },
        text = {
            Column {
                Text(
                    "A blank Drums cover to record against — no stems, no click.",
                    fontFamily = Karla, fontSize = 13.sp, color = TangerineColors.textMuted,
                )
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(
                    value = text,
                    onValueChange = { if (it.length <= 40) text = it },   // cap 40 to match the MS CleanTitle
                    singleLine = true,
                    placeholder = {
                        Text(
                            "e.g. Jam in E",
                            fontFamily = Karla, fontSize = 14.sp, color = TangerineColors.textMuted,
                        )
                    },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = TangerineColors.teal,
                        unfocusedBorderColor = TangerineColors.textMuted.copy(alpha = 0.4f),
                        focusedTextColor = TangerineColors.text,
                        unfocusedTextColor = TangerineColors.text,
                        cursorColor = TangerineColors.teal,
                    ),
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        },
        confirmButton = {
            TextButton(enabled = canCreate, onClick = { onCreate(text.trim()) }) {
                Text(
                    "Create",
                    fontFamily = Karla, fontWeight = FontWeight.Bold,
                    color = if (canCreate) TangerineColors.teal else TangerineColors.textMuted,
                )
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", fontFamily = Karla, color = TangerineColors.textMuted)
            }
        },
    )
}

/**
 * One source-picker row (mockup §panel-4 `.src`): leading icon · bold title + mono caption · trailing
 * chevron. [enabled] sources read full-strength and route on tap; gated sources are dimmed (no chevron-
 * forward promise) and their tap reveals the wizard's inline "coming soon" note instead. [extra] hangs
 * extra content (Media file's toggle) under the row, divider'd per the mockup.
 */
@Composable
private fun SourceCard(
    icon: ImageVector,
    iconTint: Color,
    title: String,
    caption: String,
    enabled: Boolean,
    onClick: () -> Unit,
    extra: (@Composable () -> Unit)? = null,
) {
    val titleColor = if (enabled) TangerineColors.text else TangerineColors.textDim
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(TangerineColors.surfaceInset)
            .border(
                1.dp,
                (if (enabled) iconTint else TangerineColors.textMuted).copy(alpha = if (enabled) 0.35f else 0.3f),
                RoundedCornerShape(14.dp),
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 15.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                icon, contentDescription = null,
                tint = if (enabled) iconTint else iconTint.copy(alpha = 0.6f),
                modifier = Modifier.size(26.dp),
            )
            Spacer(Modifier.width(13.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    title,
                    fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = titleColor,
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    caption,
                    fontFamily = JetBrainsMono, fontSize = 11.sp, color = TangerineColors.textDim,
                )
            }
            Spacer(Modifier.width(10.dp))
            Icon(
                Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null,
                tint = TangerineColors.textMuted, modifier = Modifier.size(18.dp),
            )
        }
        extra?.let {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 12.dp)
                    .height(1.dp)
                    .background(TangerineColors.textMuted.copy(alpha = 0.25f)),
            )
            it()
        }
    }
}

// ─── Reusable bits ───────────────────────────────────────────────────────────

@Composable
private fun TakeHostPill(target: String?, lastSendOk: Boolean?) {
    val color = when {
        target == null -> TangerineColors.textMuted
        lastSendOk == false -> TangerineColors.danger
        lastSendOk == true -> TangerineColors.green
        else -> TangerineColors.orange
    }
    Row(
        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(modifier = Modifier.size(8.dp).clip(CircleShape).background(color))
        Spacer(Modifier.width(6.dp))
        Text(
            target ?: "connecting…",
            fontFamily = JetBrainsMono, fontSize = 10.sp, color = TangerineColors.textMuted,
        )
    }
}

@Composable
private fun TakeRecordButton(modifier: Modifier, label: String, enabled: Boolean, onClick: () -> Unit) {
    val accent = TangerineColors.orange
    val tint = if (enabled) accent else TangerineColors.textMuted.copy(alpha = 0.3f)
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .background(tint.copy(alpha = if (enabled) 0.14f else 0.04f))
            .border(2.dp, tint.copy(alpha = if (enabled) 0.7f else 0.2f), RoundedCornerShape(16.dp))
            .clickable(enabled = enabled, onClick = onClick)
            .padding(vertical = 20.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            Icons.Default.FiberManualRecord,
            contentDescription = "Record take",
            tint = tint, modifier = Modifier.size(24.dp),
        )
        Spacer(Modifier.width(10.dp))
        Text(
            label,   // S217: honours "Cap reached (N)" / "Saving take…" / "Record Take" from the caller
            fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 17.sp, color = tint,
            maxLines = 1,
        )
    }
}

/** S217 Re-do button — secondary (teal) styling next to Record. Records over the LAST take via
 *  doRedo(); enabled only when a take exists AND the post-Stop settle has cleared (recordReady). */
@Composable
private fun TakeRedoButton(modifier: Modifier, enabled: Boolean, onClick: () -> Unit) {
    val accent = TangerineColors.teal
    val tint = if (enabled) accent else TangerineColors.textMuted.copy(alpha = 0.3f)
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .background(tint.copy(alpha = if (enabled) 0.12f else 0.04f))
            .border(1.dp, tint.copy(alpha = if (enabled) 0.6f else 0.2f), RoundedCornerShape(16.dp))
            .clickable(enabled = enabled, onClick = onClick)
            .padding(vertical = 20.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            Icons.Default.Refresh,
            contentDescription = "Re-do last take",
            tint = tint, modifier = Modifier.size(20.dp),
        )
        Spacer(Modifier.width(8.dp))
        Text(
            "Re-do",
            fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = tint,
        )
    }
}

@Composable
private fun TakeStopButton(modifier: Modifier, enabled: Boolean, onClick: () -> Unit) {
    val accent = TangerineColors.green
    val tint = if (enabled) accent else TangerineColors.textMuted.copy(alpha = 0.3f)
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .background(tint.copy(alpha = if (enabled) 0.1f else 0.04f))
            .border(1.dp, tint.copy(alpha = if (enabled) 0.6f else 0.2f), RoundedCornerShape(16.dp))
            .clickable(enabled = enabled, onClick = onClick)
            .padding(vertical = 20.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            Icons.Default.Stop,
            contentDescription = "Stop take",
            tint = tint, modifier = Modifier.size(22.dp),
        )
        Spacer(Modifier.width(8.dp))
        Text(
            "Stop",
            fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = tint,
        )
    }
}

// ─── Take long-press chooser + delete confirm (S217) ───────────────────────────

/**
 * Long-press a take pill → this chooser for take K. Body actions: a green ★ "Set as master" /
 * "Unset master" toggle (S219 ②·3a — marks the KEPT take) and a teal "Rename…" (S220 ②·3b — opens the
 * label-edit dialog); both are independent of the record/settle guards (neither touches the rig
 * transport). Then "Record over take K" (records in place, keeping its backing clone), and — only when
 * more than one take exists — "Delete take K". Record-over is gated on [canRecordOver] (the post-Stop
 * settle / not-already-recording guard, same as Record); Delete routes through [TakeDeleteConfirm]
 * before anything is removed. Plain tap still previews.
 */
@Composable
private fun TakeActionSheet(
    take: TakeTakeInfo,
    isMaster: Boolean,
    canDelete: Boolean,
    canRecordOver: Boolean,
    onDismiss: () -> Unit,
    onSetMaster: () -> Unit,
    onRename: () -> Unit,
    onRecordOver: () -> Unit,
    onDelete: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = TangerineColors.surface,
        title = {
            Text(
                "Take ${take.index}",
                fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 18.sp,
                color = TangerineColors.text,
            )
        },
        text = {
            Column {
                Text(
                    if (canRecordOver) "Replace this take's drums in place, or remove it."
                    else "Finish the current take before recording over.",
                    fontFamily = Karla, fontSize = 13.sp, color = TangerineColors.textMuted,
                )
                Spacer(Modifier.height(14.dp))
                // ★ master toggle (green) — the "this is the keeper" marker. Always enabled (marking a
                // take never touches the rig transport, so it's free of the record/settle guards).
                val mg = TangerineColors.green
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(mg.copy(alpha = if (isMaster) 0.18f else 0.08f))
                        .border(1.dp, mg.copy(alpha = if (isMaster) 0.8f else 0.5f), RoundedCornerShape(10.dp))
                        .clickable(onClick = onSetMaster)
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Default.Star, contentDescription = null, tint = mg, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(
                        if (isMaster) "Unset master" else "Set as master",
                        fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = mg,
                    )
                }
                Spacer(Modifier.height(8.dp))
                // Rename… (teal) — opens the label-edit dialog. Also guard-free (a label is metadata,
                // not a transport op). Shows the current label inline when there is one.
                val mt = TangerineColors.teal
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(mt.copy(alpha = 0.08f))
                        .border(1.dp, mt.copy(alpha = 0.5f), RoundedCornerShape(10.dp))
                        .clickable(onClick = onRename)
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Default.Edit, contentDescription = null, tint = mt, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(
                        if (take.label.isBlank()) "Rename…" else "Rename — ${take.label}",
                        fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = mt,
                        maxLines = 1, overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onRecordOver, enabled = canRecordOver) {
                Text(
                    "Record over take ${take.index}",
                    fontFamily = Karla, fontWeight = FontWeight.Bold,
                    color = if (canRecordOver) TangerineColors.orange else TangerineColors.textMuted,
                )
            }
        },
        dismissButton = {
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                if (canDelete) {
                    TextButton(onClick = onDelete) {
                        Text("Delete", fontFamily = Karla, fontWeight = FontWeight.Bold, color = TangerineColors.danger)
                    }
                }
                TextButton(onClick = onDismiss) {
                    Text("Cancel", fontFamily = Karla, color = TangerineColors.textMuted)
                }
            }
        },
    )
}

/** Destructive-delete confirm — the data-loss net for the first mutating slice. Deleting a take
 *  removes its recording (adjacent takes are kept). Reached only via the chooser's Delete. */
@Composable
private fun TakeDeleteConfirm(
    take: TakeTakeInfo,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = TangerineColors.surface,
        title = {
            Text(
                "Delete take ${take.index}?",
                fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 18.sp,
                color = TangerineColors.text,
            )
        },
        text = {
            Text(
                "This removes its recording. Adjacent takes are kept.",
                fontFamily = Karla, fontSize = 13.sp, color = TangerineColors.textMuted,
            )
        },
        confirmButton = {
            TextButton(onClick = onConfirm) {
                Text("Delete", fontFamily = Karla, fontWeight = FontWeight.Bold, color = TangerineColors.danger)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", fontFamily = Karla, color = TangerineColors.textMuted)
            }
        },
    )
}

/**
 * S220 ②·3b — label-edit dialog. A single-line [OutlinedTextField] pre-filled with the take's current
 * label (input capped at 40 chars to match the MS cap), so each take can be tagged ("alt chorus",
 * "different drums") for skipping through them. Save commits `text.trim()`; "Clear" (shown only when a
 * label exists) commits "" to remove it. The MS sanitizes before the rig stores it.
 */
@Composable
private fun TakeLabelDialog(
    take: TakeTakeInfo,
    onDismiss: () -> Unit,
    onSave: (String) -> Unit,
) {
    var text by remember { mutableStateOf(take.label) }
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = TangerineColors.surface,
        title = {
            Text(
                "Label take ${take.index}",
                fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 18.sp,
                color = TangerineColors.text,
            )
        },
        text = {
            Column {
                Text(
                    "A short note so you can tell takes apart when skipping through them.",
                    fontFamily = Karla, fontSize = 13.sp, color = TangerineColors.textMuted,
                )
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(
                    value = text,
                    onValueChange = { if (it.length <= 40) text = it },   // cap 40 to match the MS
                    singleLine = true,
                    placeholder = {
                        Text(
                            "e.g. alt chorus",
                            fontFamily = Karla, fontSize = 14.sp, color = TangerineColors.textMuted,
                        )
                    },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = TangerineColors.teal,
                        unfocusedBorderColor = TangerineColors.textMuted.copy(alpha = 0.4f),
                        focusedTextColor = TangerineColors.text,
                        unfocusedTextColor = TangerineColors.text,
                        cursorColor = TangerineColors.teal,
                    ),
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        },
        confirmButton = {
            TextButton(onClick = { onSave(text.trim()) }) {
                Text("Save", fontFamily = Karla, fontWeight = FontWeight.Bold, color = TangerineColors.teal)
            }
        },
        dismissButton = {
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                if (take.label.isNotBlank()) {
                    TextButton(onClick = { onSave("") }) {   // clear the label
                        Text("Clear", fontFamily = Karla, fontWeight = FontWeight.Bold, color = TangerineColors.danger)
                    }
                }
                TextButton(onClick = onDismiss) {
                    Text("Cancel", fontFamily = Karla, color = TangerineColors.textMuted)
                }
            }
        },
    )
}

// ─── Backing mix (S213) ────────────────────────────────────────────────────────

/** S213 backing-mix state: one entry per stem. volDb is Float for the Slider; sent as Double. */
private data class BackingStem(val name: String, val mute: Boolean, val volDb: Float)

/** Template defaults — backing stems at the cover's current level (−8 dB), Drums (ref) muted
 *  (Nathan's the drummer). The panel overrides these at runtime; the template is unchanged. */
private fun defaultBackingMix(): List<BackingStem> = listOf(
    BackingStem("Bass", mute = false, volDb = -8f),
    BackingStem("Vocals", mute = false, volDb = -8f),
    BackingStem("Other", mute = false, volDb = -8f),
    BackingStem("Drums (ref)", mute = true, volDb = -8f),
)

/**
 * V4 MIX drawer — one stem as a pro-audio VERTICAL fader (mockup §panel-3 `.col`/`.fad`/`.fill`/`.knob`):
 * a dB/MUTE readout on top · the upright fader · a mute toggle + the stem name below. Behaviour matches
 * the old horizontal row — same −40..+6 dB range, mute sends immediately, the fader sends on finger-up
 * only. The fader is a real upright control (not a rotated [Slider]): a dark rounded track with an orange
 * fill rising from the bottom (height = dB fraction, greyed when muted) and a short light pill thumb on
 * the fill's top edge; a vertical drag / tap on the track maps the finger Y to dB (top = +6, bottom =
 * −40). Drums (ref) is the muted reference column. The fader stays live while muted so a level can be
 * pre-set before un-muting.
 */
@Composable
private fun VerticalMixFader(
    stem: BackingStem,
    onMuteToggle: () -> Unit,
    onVolChange: (Float) -> Unit,
    onVolChangeFinished: () -> Unit,
) {
    val mc = if (stem.mute) TangerineColors.danger else TangerineColors.textMuted
    Column(
        modifier = Modifier.width(64.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            if (stem.mute) "MUTE" else "${stem.volDb.roundToInt()}",
            fontFamily = JetBrainsMono, fontSize = 11.sp,
            color = if (stem.mute) TangerineColors.danger else TangerineColors.text,
        )
        Spacer(Modifier.height(7.dp))
        // The fader: a real upright fader (mockup §panel-3 `.fad`/`.fill`/`.knob`). A 30×150 dp dark
        // rounded track; an orange fill rising from the bottom whose height = the dB fraction (greyed
        // when muted); a short light pill thumb centred on the fill's top edge. Vertical drag (and a
        // tap) maps the finger Y within the track to −40..+6 dB (top = +6, bottom = −40), sending
        // live via onVolChange and committing on finger-up via onVolChangeFinished — same discipline
        // as the old Slider. The fader stays live while muted so a level can be pre-set.
        val faderHeight = 150.dp
        val trackWidth = 30.dp
        val thumbHeight = 14.dp
        // dB → 0f..1f fill fraction.
        val frac = ((stem.volDb - (-40f)) / (6f - (-40f))).coerceIn(0f, 1f)
        val fillColor = if (stem.mute) TangerineColors.textMuted else TangerineColors.orange
        // Map a finger Y (px, 0 = top) within a known track height (px) to a dB, clamped.
        fun yToDb(y: Float, heightPx: Float): Float {
            val f = (1f - (y / heightPx)).coerceIn(0f, 1f)   // top = 1.0, bottom = 0.0
            return (-40f + f * (6f - (-40f))).coerceIn(-40f, 6f)
        }
        Box(
            modifier = Modifier
                .height(faderHeight)
                .width(trackWidth)
                .clip(RoundedCornerShape(8.dp))
                .background(TangerineColors.background)
                .border(1.dp, TangerineColors.textMuted.copy(alpha = 0.4f), RoundedCornerShape(8.dp))
                .pointerInput(Unit) {
                    val h = size.height.toFloat()
                    detectVerticalDragGestures(
                        onDragStart = { offset -> onVolChange(yToDb(offset.y, h)) },
                        onDragEnd = { onVolChangeFinished() },
                        onDragCancel = { onVolChangeFinished() },
                        onVerticalDrag = { change, _ -> onVolChange(yToDb(change.position.y, h)) },
                    )
                }
                .pointerInput(Unit) {
                    val h = size.height.toFloat()
                    detectTapGestures(onTap = { offset ->
                        onVolChange(yToDb(offset.y, h))
                        onVolChangeFinished()
                    })
                },
        ) {
            // Fill rises from the bottom; height = frac of the track.
            Box(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .fillMaxHeight(frac)
                    .clip(RoundedCornerShape(bottomStart = 8.dp, bottomEnd = 8.dp))
                    .background(fillColor),
            )
            // Thumb: a short light pill, wider than the track, centred on the fill's top edge.
            // Offset from the bottom = frac of the travel (track height − thumb height), then back up
            // by half the thumb so it straddles the fill edge.
            val travel = faderHeight - thumbHeight
            Box(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .offset(y = -(travel * frac))
                    .width(trackWidth + 8.dp)
                    .height(thumbHeight)
                    .clip(RoundedCornerShape(5.dp))
                    .background(TangerineColors.text)
                    .border(1.dp, TangerineColors.background, RoundedCornerShape(5.dp)),
            )
        }
        Spacer(Modifier.height(7.dp))
        // Mute toggle pill (same styling as the old row).
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(8.dp))
                .background(mc.copy(alpha = if (stem.mute) 0.18f else 0.06f))
                .border(1.dp, mc.copy(alpha = if (stem.mute) 0.7f else 0.3f), RoundedCornerShape(8.dp))
                .clickable(onClick = onMuteToggle)
                .padding(horizontal = 10.dp, vertical = 5.dp),
        ) {
            Icon(
                if (stem.mute) Icons.Default.Stop else Icons.Default.PlayArrow,
                contentDescription = if (stem.mute) "muted" else "mute",
                tint = mc, modifier = Modifier.size(13.dp),
            )
        }
        Spacer(Modifier.height(5.dp))
        Text(
            stem.name.removeSuffix(" (ref)"),
            fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 12.sp,
            color = TangerineColors.text, maxLines = 1,
        )
        if (stem.name == "Drums (ref)") {
            Text("ref", fontFamily = JetBrainsMono, fontSize = 9.sp, color = TangerineColors.textMuted)
        }
    }
}

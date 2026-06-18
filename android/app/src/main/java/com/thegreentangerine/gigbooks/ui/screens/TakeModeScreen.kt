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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.FiberManualRecord
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.SkipPrevious
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.IconButton
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.thegreentangerine.gigbooks.data.orchestrator.OrchestratorService
import com.thegreentangerine.gigbooks.data.orchestrator.TakeSong
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
        )
    } else {
        TakeSurface(
            song = sel,
            service = svc,
            onBack = { selectedSong = null },
        )
    }
}

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
) {
    Box(modifier = Modifier.fillMaxSize().background(TangerineColors.background)) {
        Column(modifier = Modifier.fillMaxSize()) {
            // ── Top bar: menu · title · host pill · refresh ──
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
) {
    val scope = rememberCoroutineScope()

    // Build/open the cover when this song loads into the surface (re-fires when the
    // browser swaps to a different song).
    LaunchedEffect(song.trackId) {
        service.gigCmd.takeLoad(song.trackId, song.title)
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
    var kitExpanded by remember { mutableStateOf(false) }          // collapsed by default (sidepanel-behavior)
    var mixExpanded by remember { mutableStateOf(false) }          // BACKING MIX collapsed by default
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

            // ── NOW LOADED (the browser selection) ──
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp)
                    .clip(RoundedCornerShape(18.dp))
                    .background(TangerineColors.surface)
                    .border(2.dp, TangerineColors.green.copy(alpha = 0.3f), RoundedCornerShape(18.dp))
                    .padding(horizontal = 18.dp, vertical = 18.dp),
            ) {
                Column {
                    Text(
                        "NOW LOADED",
                        fontFamily = JetBrainsMono, fontWeight = FontWeight.Bold,
                        fontSize = 10.sp, letterSpacing = 2.sp, color = TangerineColors.green,
                    )
                    Spacer(Modifier.height(6.dp))
                    Text(
                        song.title,
                        fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 24.sp,
                        color = TangerineColors.text, maxLines = 2,
                    )
                    if (song.artist.isNotBlank()) {
                        Text(
                            song.artist,
                            fontFamily = Karla, fontSize = 14.sp, color = TangerineColors.textMuted,
                        )
                    }
                }
            }

            // ── Transport · audition takes (S214) — between NOW LOADED and KIT SETUP ──
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

            // ── Kit setup (collapsible, collapsed by default) ──
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(TangerineColors.surface)
                    .border(1.dp, TangerineColors.textMuted.copy(alpha = 0.25f), RoundedCornerShape(16.dp))
                    .padding(horizontal = 16.dp, vertical = 14.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().clickable { kitExpanded = !kitExpanded },
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        "KIT SETUP",
                        fontFamily = JetBrainsMono, fontWeight = FontWeight.Bold,
                        fontSize = 11.sp, letterSpacing = 2.sp, color = TangerineColors.orange,
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        "$armedCount ch armed",
                        fontFamily = JetBrainsMono, fontSize = 10.sp, color = TangerineColors.textMuted,
                    )
                    Spacer(Modifier.weight(1f))
                    Icon(
                        if (kitExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                        contentDescription = if (kitExpanded) "Collapse kit setup" else "Expand kit setup",
                        tint = TangerineColors.textMuted,
                    )
                }
                if (kitExpanded) {
                    Spacer(Modifier.height(12.dp))
                    ChannelArmPresetSelector(
                        mode = ArmPresetMode.TAKE,
                        state = armState,
                        onState = { armState = it },
                    )
                }
            }

            // ── Backing mix (collapsible, collapsed by default) — S213 ──
            // Ride the guide stems from the throne: each stem a mute toggle + a dB fader.
            // Mute sends immediately; the fader sends only on finger-up (onValueChangeFinished)
            // so the file-drop backend isn't flooded (each message is a parsed+deleted file on a
            // 0.2 s loop). Default keeps Drums (ref) muted; this card is the override.
            val audibleStems = mix.count { !it.mute }
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(TangerineColors.surface)
                    .border(1.dp, TangerineColors.textMuted.copy(alpha = 0.25f), RoundedCornerShape(16.dp))
                    .padding(horizontal = 16.dp, vertical = 14.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().clickable { mixExpanded = !mixExpanded },
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        "BACKING MIX",
                        fontFamily = JetBrainsMono, fontWeight = FontWeight.Bold,
                        fontSize = 11.sp, letterSpacing = 2.sp, color = TangerineColors.orange,
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        "$audibleStems/${mix.size} audible",
                        fontFamily = JetBrainsMono, fontSize = 10.sp, color = TangerineColors.textMuted,
                    )
                    Spacer(Modifier.weight(1f))
                    Icon(
                        if (mixExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                        contentDescription = if (mixExpanded) "Collapse backing mix" else "Expand backing mix",
                        tint = TangerineColors.textMuted,
                    )
                }
                if (mixExpanded) {
                    Spacer(Modifier.height(8.dp))
                    mix.forEachIndexed { i, stem ->
                        BackingMixRow(
                            stem = stem,
                            onMuteToggle = {
                                val newMute = !stem.mute
                                mix = mix.mapIndexed { idx, s -> if (idx == i) s.copy(mute = newMute) else s }
                                scope.launch { service.gigCmd.takeMix(stem.name, newMute, stem.volDb.toDouble()) }
                            },
                            onVolChange = { v ->
                                mix = mix.mapIndexed { idx, s -> if (idx == i) s.copy(volDb = v) else s }
                            },
                            onVolChangeFinished = {
                                val cur = mix[i]
                                scope.launch { service.gigCmd.takeMix(cur.name, cur.mute, cur.volDb.toDouble()) }
                            },
                        )
                    }
                }
            }
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
            .padding(vertical = 7.dp),
        contentAlignment = Alignment.Center,
    ) {
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
 * Long-press a take pill → this chooser for take K. Top action (S219 ②·3a): a green ★ "Set as master"
 * / "Unset master" toggle — marks the KEPT take, independent of the record/settle guards (it never
 * touches the rig transport). Then "Record over take K" (records in place, keeping its backing clone),
 * and — only when more than one take exists — "Delete take K". Record-over is gated on [canRecordOver]
 * (the post-Stop settle / not-already-recording guard, same as Record); Delete routes through
 * [TakeDeleteConfirm] before anything is removed. Plain tap still previews.
 */
@Composable
private fun TakeActionSheet(
    take: TakeTakeInfo,
    isMaster: Boolean,
    canDelete: Boolean,
    canRecordOver: Boolean,
    onDismiss: () -> Unit,
    onSetMaster: () -> Unit,
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

/** One backing-stem row — name (+ a subtle "guide" tag for Drums (ref)) · dB/MUTE readout ·
 *  mute toggle · level fader. Mute fires immediately; the fader fires on finger-up only. The
 *  fader stays enabled while muted so a level can be pre-set before un-muting. */
@Composable
private fun BackingMixRow(
    stem: BackingStem,
    onMuteToggle: () -> Unit,
    onVolChange: (Float) -> Unit,
    onVolChangeFinished: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                stem.name,
                fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 14.sp,
                color = TangerineColors.text,
            )
            if (stem.name == "Drums (ref)") {
                Spacer(Modifier.width(6.dp))
                Text(
                    "guide",
                    fontFamily = JetBrainsMono, fontSize = 9.sp, color = TangerineColors.textMuted,
                )
            }
            Spacer(Modifier.weight(1f))
            Text(
                if (stem.mute) "MUTE" else "${stem.volDb.roundToInt()} dB",
                fontFamily = JetBrainsMono, fontSize = 12.sp,
                color = if (stem.mute) TangerineColors.danger else TangerineColors.text,
            )
            Spacer(Modifier.width(10.dp))
            // Mute toggle pill (hand-rolled to match the surface's button styling).
            val mc = if (stem.mute) TangerineColors.danger else TangerineColors.textMuted
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(mc.copy(alpha = if (stem.mute) 0.18f else 0.06f))
                    .border(1.dp, mc.copy(alpha = if (stem.mute) 0.7f else 0.3f), RoundedCornerShape(8.dp))
                    .clickable(onClick = onMuteToggle)
                    .padding(horizontal = 12.dp, vertical = 6.dp),
            ) {
                Text(
                    if (stem.mute) "muted" else "mute",
                    fontFamily = JetBrainsMono, fontWeight = FontWeight.Bold, fontSize = 11.sp, color = mc,
                )
            }
        }
        Slider(
            value = stem.volDb,
            onValueChange = onVolChange,
            onValueChangeFinished = onVolChangeFinished,
            valueRange = -40f..6f,
            colors = SliderDefaults.colors(
                thumbColor = TangerineColors.orange,
                activeTrackColor = TangerineColors.orange,
                inactiveTrackColor = TangerineColors.textMuted.copy(alpha = 0.3f),
            ),
        )
    }
}

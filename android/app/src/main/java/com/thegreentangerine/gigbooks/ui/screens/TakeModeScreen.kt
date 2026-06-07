package com.thegreentangerine.gigbooks.ui.screens

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Build
import android.os.IBinder
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.FiberManualRecord
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.thegreentangerine.gigbooks.data.orchestrator.OrchestratorService
import com.thegreentangerine.gigbooks.ui.components.ArmPresetMode
import com.thegreentangerine.gigbooks.ui.components.ArmPresetState
import com.thegreentangerine.gigbooks.ui.components.ChannelArmPresetSelector
import com.thegreentangerine.gigbooks.ui.components.computeArmedTracks
import com.thegreentangerine.gigbooks.ui.theme.JetBrainsMono
import com.thegreentangerine.gigbooks.ui.theme.Karla
import com.thegreentangerine.gigbooks.ui.theme.TangerineColors
import kotlinx.coroutines.launch

/**
 * S206 4b: how long Record stays disabled after Stop so the prior take's items
 * finalize on the rig before the next take-record fires (the rapid-retake race
 * from the S205 live-test). Generous + tunable; the robust fix is a rig->APK
 * "take committed" signal, scoped separately.
 */
private const val TAKE_SETTLE_MS = 5_000L

/**
 * S206 Slice 4b — Take Mode control surface.
 *
 * The drummer's home-studio cover surface: load a song's cover project on the
 * Reaper rig, set the kit, and record takes that stack down the timeline
 * (jump + gap + copy-stems-forward, server-side). Drives the proven take
 * backend — MS `/take/load` + `/take/record` (S206 4a) over the orchestrator's
 * configured GigCommandClient, and OSC `/stop` over ReaperOscClient to stop the
 * transport (the Lua's save-on-stop watcher then saves the take). Stop is OSC,
 * NOT a `/take/stop` endpoint — the listener's `stop` only saves, OSC `/stop`
 * is the proven transport stopper.
 *
 * 4b is the control surface + client wiring against a hardcoded default song;
 * Slice 4c adds the verified-beatmap song browser that replaces the default.
 */
@Composable
fun TakeModeScreen(onMenuClick: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

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

    // 4b stopgap — Slice 4c replaces this with the browser selection.
    val currentSong = remember {
        TakeSong(
            trackId = "19840216-1fc8-45ab-8078-c2aa58b79360",
            title = "Hotel California",
            artist = "Eagles",
        )
    }

    // Build/open the cover when the service binds (and again if the song changes
    // — relevant once 4c lets the browser swap currentSong).
    LaunchedEffect(service, currentSong.trackId) {
        service?.gigCmd?.takeLoad(currentSong.trackId, currentSong.title)
    }

    var armState by remember { mutableStateOf(ArmPresetState()) }  // Acoustic, overheads + full kit on
    var kitExpanded by remember { mutableStateOf(false) }          // collapsed by default (sidepanel-behavior)
    var takeCount by remember { mutableIntStateOf(0) }
    var isRecording by remember { mutableStateOf(false) }
    var recordReady by remember { mutableStateOf(true) }  // false during the post-Stop settle window

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

    val gigTarget = service?.gigCmd?.target?.collectAsState()?.value
    val gigLastOk = service?.gigCmd?.lastSendOk?.collectAsState()?.value

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
                    target = gigTarget?.let { "${it.host}:${it.port}" },
                    lastSendOk = gigLastOk,
                )
            }

            // ── Current song (4b: the hardcoded default; 4c: browser selection) ──
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
                        currentSong.title,
                        fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 24.sp,
                        color = TangerineColors.text, maxLines = 2,
                    )
                    if (!currentSong.artist.isNullOrBlank()) {
                        Text(
                            currentSong.artist,
                            fontFamily = Karla, fontSize = 14.sp, color = TangerineColors.textMuted,
                        )
                    }
                }
            }

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
                    Text(
                        if (takeCount == 0) "—" else takeCount.toString(),
                        fontFamily = JetBrainsMono, fontWeight = FontWeight.Bold,
                        fontSize = 44.sp, color = TangerineColors.text,
                    )
                }
                Spacer(Modifier.weight(1f))
                Column(horizontalAlignment = Alignment.End) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier.size(8.dp).clip(CircleShape).background(
                                if (isRecording) TangerineColors.orange else TangerineColors.textMuted,
                            ),
                        )
                        Spacer(Modifier.width(6.dp))
                        Text(
                            if (isRecording) "RECORDING" else "idle",
                            fontFamily = JetBrainsMono, fontSize = 11.sp,
                            color = if (isRecording) TangerineColors.orange else TangerineColors.textMuted,
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

            Spacer(Modifier.weight(1f))

            // ── Record / Stop ──
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                TakeRecordButton(
                    modifier = Modifier.weight(1f),
                    label = if (!recordReady && !isRecording) "Saving take…" else "Record Take",
                    enabled = service != null && !isRecording && recordReady,
                    onClick = {
                        service?.let { svc ->
                            scope.launch { svc.gigCmd.takeRecord(armedCsv) }
                            takeCount += 1
                            isRecording = true
                        }
                    },
                )
                TakeStopButton(
                    modifier = Modifier.weight(0.5f),
                    enabled = service != null && isRecording,
                    onClick = {
                        service?.let { svc -> scope.launch { svc.osc.sendStop() } }
                        isRecording = false
                        recordReady = false   // settle before the next take can fire
                    },
                )
            }
        }
    }
}

/** 4b stopgap song holder. Slice 4c's browser produces this from the MS library. */
private data class TakeSong(val trackId: String, val title: String, val artist: String?)

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
            "Record Take",
            fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 17.sp, color = tint,
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

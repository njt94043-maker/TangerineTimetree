package com.thegreentangerine.gigbooks.ui.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.SkipPrevious
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.thegreentangerine.gigbooks.ui.AppViewModel
import com.thegreentangerine.gigbooks.ui.components.ClickToggleButton
import com.thegreentangerine.gigbooks.ui.components.DisplayToggleRow
import com.thegreentangerine.gigbooks.ui.components.DrawerHandle
import com.thegreentangerine.gigbooks.ui.components.DrawerLabel
import com.thegreentangerine.gigbooks.ui.components.MixerChannel
import com.thegreentangerine.gigbooks.ui.components.MixerRow
import com.thegreentangerine.gigbooks.ui.components.NeuCard
import com.thegreentangerine.gigbooks.ui.components.PlayButton
import com.thegreentangerine.gigbooks.ui.components.PlayerHeader
import com.thegreentangerine.gigbooks.ui.components.SettingsPills
import com.thegreentangerine.gigbooks.ui.components.TextPanel
import com.thegreentangerine.gigbooks.ui.components.TextPanelToggles
import com.thegreentangerine.gigbooks.ui.components.TransportButton
import com.thegreentangerine.gigbooks.ui.components.VisualHero
import com.thegreentangerine.gigbooks.ui.theme.GigColors
import com.thegreentangerine.gigbooks.ui.theme.JetBrainsMono
import com.thegreentangerine.gigbooks.ui.theme.Karla
import kotlin.math.roundToInt

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PracticeScreen(vm: AppViewModel, onMenuClick: () -> Unit, onGoToLibrary: () -> Unit) {
    val song = vm.selectedSong

    // Display toggles (local state)
    var showVisuals by remember { mutableStateOf(true) }
    var showChords by remember { mutableStateOf(true) }
    var showLyrics by remember { mutableStateOf(true) }
    var showNotes by remember { mutableStateOf(true) }
    var showDrums by remember { mutableStateOf(true) }

    // Bottom sheet
    val sheetState = rememberModalBottomSheetState()
    var showSheet by remember { mutableStateOf(false) }

    Column(Modifier.fillMaxSize().background(GigColors.background)) {
        if (song == null) {
            // Simple header when no song
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(GigColors.background)
                    .padding(top = 48.dp, start = 8.dp, end = 16.dp, bottom = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = onMenuClick) {
                    Icon(Icons.Default.Close, contentDescription = "Menu", tint = GigColors.textDim, modifier = Modifier.size(22.dp))
                }
            }
            NoSongPlaceholder(
                accent = GigColors.purple,
                screenName = "Practice",
                onGoToLibrary = onGoToLibrary,
            )
        } else {
            // V4 Header
            PlayerHeader(
                songName = song.name,
                songArtist = song.artist,
                bpm = vm.effectiveBpm.toInt(),
                isLiveMode = false,
                onBackClick = onMenuClick,
            )

            // Scrollable content area
            Column(
                modifier = Modifier
                    .weight(1f)
                    .verticalScroll(rememberScrollState()),
            ) {
                // Visual Hero (shorter for practice)
                if (showVisuals) {
                    VisualHero(
                        heroHeight = 130.dp,
                        isPlaying = vm.isClickPlaying,
                        currentBeat = vm.currentBeat,
                        accent = GigColors.purple,
                    )
                }

                // Waveform (practice-specific)
                if (song.hasAudio && vm.trackLoaded) {
                    PracticeWaveform(vm)
                } else if (song.hasAudio && !vm.trackLoaded) {
                    // Load track prompt
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 8.dp, vertical = 5.dp)
                            .height(48.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(GigColors.surface)
                            .border(1.dp, Color.White.copy(alpha = 0.03f), RoundedCornerShape(8.dp))
                            .clickable(enabled = !vm.isLoadingTrack) { vm.loadTrack(song.audioUrl!!) },
                        contentAlignment = Alignment.Center,
                    ) {
                        if (vm.isLoadingTrack) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                CircularProgressIndicator(color = GigColors.green, strokeWidth = 2.dp, modifier = Modifier.size(14.dp))
                                Text("Loading…", fontFamily = Karla, fontSize = 11.sp, color = GigColors.green)
                            }
                        } else {
                            Text(
                                "Load Track",
                                fontFamily = JetBrainsMono, fontSize = 11.sp,
                                style = TextStyle(color = GigColors.green, shadow = Shadow(GigColors.green.copy(0.3f), Offset.Zero, 6f)),
                            )
                        }
                    }
                }

                // Text Panel (toggled via drawer)
                TextPanel(
                    chords = song.chords,
                    lyrics = song.lyrics,
                    notes = song.notes,
                    drums = song.drumNotation,
                    toggles = TextPanelToggles(
                        showChords = showChords,
                        showLyrics = showLyrics,
                        showNotes = showNotes,
                        showDrums = showDrums,
                    ),
                )

                // Processing status banner
                if (vm.loadedStems.isEmpty() && vm.processingStatus != null) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                            .background(GigColors.purple.copy(alpha = 0.06f), RoundedCornerShape(8.dp))
                            .border(1.dp, GigColors.purple.copy(alpha = 0.15f), RoundedCornerShape(8.dp))
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        CircularProgressIndicator(
                            color = GigColors.purple,
                            strokeWidth = 2.dp,
                            modifier = Modifier.size(14.dp),
                        )
                        Text(
                            text = when (vm.processingStatus) {
                                "pending" -> "Processing queued..."
                                "analysing" -> "Detecting beats..."
                                "separating" -> "Separating stems..."
                                else -> "Processing..."
                            },
                            fontFamily = Karla, fontSize = 12.sp, color = GigColors.purple,
                        )
                    }
                }

                // Beat alignment banner
                if (vm.showBeatBanner) {
                    BeatAlignBanner(
                        bpm = vm.detectedBpm,
                        offsetMs = vm.detectedOffsetMs,
                        onApply = { vm.applyDetectedBeat() },
                        onDismiss = { vm.dismissBeatBanner() },
                    )
                }
            }

            // Transport (stacked — speed row + main controls)
            PracticeTransport(vm)

            // A-B Loop buttons (below transport)
            if (vm.trackLoaded) {
                LoopRow(vm)
            }

            // Drawer preview (pull-up)
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        GigColors.surface,
                        RoundedCornerShape(topStart = 14.dp, topEnd = 14.dp),
                    )
                    .border(
                        1.dp,
                        Color.White.copy(alpha = 0.04f),
                        RoundedCornerShape(topStart = 14.dp, topEnd = 14.dp),
                    )
                    .clickable { showSheet = true }
                    .padding(10.dp, 10.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                DrawerHandle()
                Spacer(Modifier.height(8.dp))
                DrawerLabel("DISPLAY")
                Spacer(Modifier.height(6.dp))
                DisplayToggleRow(
                    showVisuals = showVisuals, onVisualsToggle = { showVisuals = !showVisuals },
                    showChords = showChords, onChordsToggle = { showChords = !showChords },
                    showLyrics = showLyrics, onLyricsToggle = { showLyrics = !showLyrics },
                    showNotes = showNotes, onNotesToggle = { showNotes = !showNotes },
                    showDrums = showDrums, onDrumsToggle = { showDrums = !showDrums },
                )
            }
        }
    }

    // Bottom sheet drawer (full settings + mixer)
    if (showSheet) {
        ModalBottomSheet(
            onDismissRequest = { showSheet = false },
            sheetState = sheetState,
            containerColor = GigColors.surface,
            scrimColor = Color.Black.copy(alpha = 0.5f),
        ) {
            Column(
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                DrawerLabel("DISPLAY")
                DisplayToggleRow(
                    showVisuals = showVisuals, onVisualsToggle = { showVisuals = !showVisuals },
                    showChords = showChords, onChordsToggle = { showChords = !showChords },
                    showLyrics = showLyrics, onLyricsToggle = { showLyrics = !showLyrics },
                    showNotes = showNotes, onNotesToggle = { showNotes = !showNotes },
                    showDrums = showDrums, onDrumsToggle = { showDrums = !showDrums },
                )

                // Mixer section
                if (vm.loadedStems.isNotEmpty() || vm.trackLoaded) {
                    Spacer(Modifier.height(4.dp))
                    DrawerLabel("MIXER")
                    PracticeMixer(vm)
                }

                Spacer(Modifier.height(4.dp))
                DrawerLabel("SETTINGS")
                SettingsPills(
                    subdivision = vm.subdivision,
                    onSubdivisionChange = { vm.applySubdivision(it) },
                    countInBars = vm.countInBars,
                    onCountInChange = { vm.setCountIn(it) },
                    nudgeOffsetMs = vm.nudgeOffsetMs,
                    onNudgeBack = { vm.nudge(-1) },
                    onNudgeForward = { vm.nudge(+1) },
                    onNudgeReset = { vm.resetNudge() },
                )

                Spacer(Modifier.height(16.dp))
            }
        }
    }
}

// ─── Practice Transport (stacked layout) ─────────────────────────────────────────

@Composable
private fun PracticeTransport(vm: AppViewModel) {
    val isPlaying = vm.isClickPlaying || vm.isTrackPlaying
    val speedPct = (vm.practiceSpeed * 100).roundToInt()

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 6.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        // Speed row
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            SpeedButton("-5") { vm.applySpeed((vm.practiceSpeed - 0.05f).coerceAtLeast(0.25f)) }
            Spacer(Modifier.width(6.dp))
            SpeedButton("-1") { vm.applySpeed((vm.practiceSpeed - 0.01f).coerceAtLeast(0.25f)) }
            Spacer(Modifier.width(8.dp))
            Text(
                "${speedPct}%",
                fontFamily = JetBrainsMono, fontSize = 11.sp,
                color = GigColors.purple,
                modifier = Modifier.width(36.dp),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
            Spacer(Modifier.width(8.dp))
            SpeedButton("+1") { vm.applySpeed((vm.practiceSpeed + 0.01f).coerceAtMost(1.5f)) }
            Spacer(Modifier.width(6.dp))
            SpeedButton("+5") { vm.applySpeed((vm.practiceSpeed + 0.05f).coerceAtMost(1.5f)) }
        }

        // Main transport row
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // Restart
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(GigColors.surfaceLight)
                    .border(1.dp, Color.White.copy(alpha = 0.06f), CircleShape)
                    .clickable(enabled = vm.engineAvailable && vm.trackLoaded) { vm.restart() },
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Default.SkipPrevious, contentDescription = "Restart", tint = GigColors.textMuted, modifier = Modifier.size(18.dp))
            }
            Spacer(Modifier.width(8.dp))
            // Play
            PlayButton(
                isPlaying = isPlaying,
                accent = GigColors.purple,
                onClick = { if (isPlaying) vm.pause() else vm.play() },
                enabled = vm.engineAvailable,
            )
            Spacer(Modifier.width(8.dp))
            // Stop
            TransportButton(icon = "■", color = GigColors.danger, onClick = { vm.stop() })
            Spacer(Modifier.width(16.dp))
            // Click toggle
            ClickToggleButton(isClickMuted = vm.isClickMuted, onClick = { vm.toggleClickMute() })
        }
    }
}

@Composable
private fun SpeedButton(label: String, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .size(24.dp)
            .clip(CircleShape)
            .background(GigColors.surfaceLight)
            .border(1.dp, Color.White.copy(alpha = 0.06f), CircleShape)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, fontFamily = JetBrainsMono, fontSize = 8.sp, color = GigColors.textMuted)
    }
}

// ─── A-B Loop Row ────────────────────────────────────────────────────────────────

@Composable
private fun LoopRow(vm: AppViewModel) {
    val hasA = vm.loopAFrame != null
    val hasB = vm.loopBFrame != null
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        LoopPill("SET A", active = hasA, color = GigColors.orange, modifier = Modifier.weight(1f)) { vm.setLoopA() }
        LoopPill("SET B", active = hasB, color = GigColors.orange, modifier = Modifier.weight(1f)) { vm.setLoopB() }
        LoopPill("CLEAR", active = hasA || hasB, color = GigColors.textMuted, modifier = Modifier.weight(1f), enabled = hasA || hasB) { vm.clearLoop() }
    }
}

@Composable
private fun LoopPill(label: String, active: Boolean, color: Color, modifier: Modifier, enabled: Boolean = true, onClick: () -> Unit) {
    Box(
        modifier = modifier
            .height(28.dp)
            .background(
                if (active) GigColors.orange.copy(alpha = 0.06f) else Color.Transparent,
                RoundedCornerShape(8.dp),
            )
            .border(
                1.dp,
                if (active) GigColors.orange.copy(alpha = 0.3f) else Color.White.copy(alpha = 0.06f),
                RoundedCornerShape(8.dp),
            )
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            fontFamily = JetBrainsMono, fontSize = 9.sp,
            color = if (active) GigColors.orange else GigColors.textMuted,
        )
    }
}

// ─── Practice Waveform ───────────────────────────────────────────────────────────

@Composable
private fun PracticeWaveform(vm: AppViewModel) {
    val positionFraction = if (vm.trackTotalFr > 0) vm.trackPositionFr.toFloat() / vm.trackTotalFr else 0f
    val positionStr = formatFrames(vm.trackPositionFr, vm.trackSampleRate)
    val totalStr = formatFrames(vm.trackTotalFr, vm.trackSampleRate)
    val speedPct = (vm.practiceSpeed * 100).roundToInt()

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp, vertical = 5.dp)
            .height(48.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(GigColors.surface)
            .border(1.dp, Color.White.copy(alpha = 0.03f), RoundedCornerShape(8.dp))
            .pointerInput(Unit) {
                detectTapGestures { offset ->
                    vm.seekTrackFraction((offset.x / size.width).coerceIn(0f, 1f))
                }
            },
    ) {
        Canvas(modifier = Modifier.fillMaxSize().padding(horizontal = 6.dp, vertical = 8.dp)) {
            val w = size.width
            val h = size.height
            val midY = h / 2f

            // Loop region
            val loopA = vm.loopAFrame?.let { it.toFloat() / vm.trackTotalFr.coerceAtLeast(1) }
            val loopB = vm.loopBFrame?.let { it.toFloat() / vm.trackTotalFr.coerceAtLeast(1) }
            if (loopA != null && loopB != null) {
                val lx = minOf(loopA, loopB) * w
                val rx = maxOf(loopA, loopB) * w
                drawRect(
                    color = GigColors.orange.copy(alpha = 0.04f),
                    topLeft = Offset(lx, 0f),
                    size = Size(rx - lx, h),
                )
                for (x in listOf(lx, rx)) {
                    drawLine(GigColors.orange.copy(alpha = 0.35f), Offset(x, 0f), Offset(x, h), strokeWidth = 1.5f)
                }
            }

            // Waveform bars
            val envelope = vm.waveformEnvelope
            if (envelope.isNotEmpty()) {
                val barW = (w / envelope.size).coerceAtLeast(1f)
                val playX = positionFraction * w
                envelope.forEachIndexed { i, amp ->
                    val x = i * barW + barW / 2f
                    val barH = amp * midY * 0.9f
                    val color = if (x < playX) GigColors.green.copy(alpha = 0.7f) else GigColors.green.copy(alpha = 0.12f)
                    drawLine(color, Offset(x, midY - barH), Offset(x, midY + barH), strokeWidth = barW * 0.72f)
                }
            } else {
                drawLine(GigColors.textMuted.copy(alpha = 0.2f), Offset(0f, midY), Offset(w, midY), strokeWidth = 1f)
            }

            // Playhead
            val px = (positionFraction * w).coerceIn(0f, w)
            drawLine(Color.White, Offset(px, 0f), Offset(px, h), strokeWidth = 2f)
        }

        // Time overlay
        Row(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(start = 8.dp, bottom = 2.dp),
        ) {
            Text(positionStr, fontFamily = JetBrainsMono, fontSize = 9.sp, color = GigColors.textDim)
            Text(" / $totalStr", fontFamily = JetBrainsMono, fontSize = 9.sp, color = GigColors.textMuted)
        }

        // Speed overlay
        Text(
            "${speedPct}%",
            fontFamily = JetBrainsMono, fontSize = 9.sp, color = GigColors.purple,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 8.dp, bottom = 2.dp),
        )
    }
}

// ─── Practice Mixer (drawer) ─────────────────────────────────────────────────────

@Composable
private fun PracticeMixer(vm: AppViewModel) {
    val channels = mutableListOf<MixerChannel>()

    // Click channel
    channels.add(
        MixerChannel(
            label = "CLK",
            color = GigColors.purple,
            value = (vm.clickGain / 2f).coerceIn(0f, 1f),
            onValueChange = { vm.changeClickGain(it * 2f) },
            isMuted = vm.isClickMuted,
            onMuteToggle = { vm.toggleClickMute() },
        )
    )

    // Track channel
    if (vm.trackLoaded) {
        channels.add(
            MixerChannel(
                label = "TRK",
                color = GigColors.green,
                value = vm.trackGain,
                onValueChange = { vm.changeTrackGain(it) },
            )
        )
    }

    // Stem channels
    vm.loadedStems.forEach { (idx, stem) ->
        val stemColor = when (stem.label.uppercase()) {
            "DRUMS" -> GigColors.orange
            "BASS" -> GigColors.cyan
            "VOCALS" -> GigColors.pink
            else -> GigColors.slate
        }
        channels.add(
            MixerChannel(
                label = stem.label.take(3).uppercase(),
                color = stemColor,
                value = vm.stemGains[idx] ?: 1f,
                onValueChange = { vm.setStemGain(idx, it) },
            )
        )
    }

    MixerRow(channels)
}

// ─── Beat Align Banner ───────────────────────────────────────────────────────────

@Composable
private fun BeatAlignBanner(
    bpm: Float,
    offsetMs: Int,
    onApply: () -> Unit,
    onDismiss: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp, vertical = 4.dp)
            .background(GigColors.teal.copy(alpha = 0.08f), RoundedCornerShape(8.dp))
            .border(0.5.dp, GigColors.teal.copy(alpha = 0.25f), RoundedCornerShape(8.dp))
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                "Beat detected",
                fontFamily = Karla, fontWeight = FontWeight.SemiBold, fontSize = 12.sp,
                style = TextStyle(color = GigColors.teal, shadow = Shadow(GigColors.teal.copy(0.3f), Offset.Zero, 6f)),
            )
            Text(
                "${bpm.roundToInt()} BPM · +${offsetMs}ms offset",
                fontFamily = JetBrainsMono, fontSize = 11.sp, color = GigColors.textDim,
            )
        }
        Box(
            modifier = Modifier
                .height(30.dp)
                .background(GigColors.teal.copy(alpha = 0.15f), RoundedCornerShape(6.dp))
                .border(0.5.dp, GigColors.teal.copy(alpha = 0.4f), RoundedCornerShape(6.dp))
                .clickable(onClick = onApply)
                .padding(horizontal = 12.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                "Save", fontFamily = Karla, fontWeight = FontWeight.SemiBold,
                fontSize = 11.sp,
                style = TextStyle(color = GigColors.teal, shadow = Shadow(GigColors.teal.copy(0.3f), Offset.Zero, 4f)),
            )
        }
        Box(
            modifier = Modifier
                .height(30.dp)
                .background(GigColors.textMuted.copy(alpha = 0.05f), RoundedCornerShape(6.dp))
                .border(0.5.dp, GigColors.textMuted.copy(alpha = 0.15f), RoundedCornerShape(6.dp))
                .clickable(onClick = onDismiss)
                .padding(horizontal = 10.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text("✕", fontFamily = JetBrainsMono, fontSize = 11.sp, color = GigColors.textMuted)
        }
    }
}

private fun formatFrames(frames: Long, sampleRate: Int): String {
    val secs = (frames / sampleRate.coerceAtLeast(1)).toInt()
    return "%d:%02d".format(secs / 60, secs % 60)
}

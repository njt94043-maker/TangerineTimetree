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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.SkipPrevious
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
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
import com.thegreentangerine.gigbooks.ui.components.DisplayToggleRow
import com.thegreentangerine.gigbooks.ui.components.DrawerHandle
import com.thegreentangerine.gigbooks.ui.components.DrawerLabel
import com.thegreentangerine.gigbooks.ui.components.FullscreenBeatGlow
import com.thegreentangerine.gigbooks.ui.components.MixerChannel
import com.thegreentangerine.gigbooks.ui.components.MixerRow
import com.thegreentangerine.gigbooks.ui.components.NeuCard
import com.thegreentangerine.gigbooks.ui.components.PlayButton
import com.thegreentangerine.gigbooks.ui.components.PlayerHeader
import com.thegreentangerine.gigbooks.ui.components.PlayerNavRow
import com.thegreentangerine.gigbooks.ui.components.TakeItem
import com.thegreentangerine.gigbooks.ui.components.TakesSection
import com.thegreentangerine.gigbooks.ui.components.SettingsPills
import com.thegreentangerine.gigbooks.ui.components.TextPanel
import com.thegreentangerine.gigbooks.ui.components.TextPanelToggles
import com.thegreentangerine.gigbooks.ui.components.TransportButton
import com.thegreentangerine.gigbooks.ui.components.VisType
import com.thegreentangerine.gigbooks.ui.components.VisualHero
import com.thegreentangerine.gigbooks.ui.theme.GigColors
import com.thegreentangerine.gigbooks.ui.theme.JetBrainsMono
import com.thegreentangerine.gigbooks.ui.theme.Karla
import kotlin.math.roundToInt

@Composable
fun PracticeScreen(vm: AppViewModel, onMenuClick: () -> Unit, onGoToLibrary: () -> Unit, onClose: () -> Unit = {}, onSwitchMode: (String) -> Unit = {}) {
    val song = vm.selectedSong

    // Display toggles (local state)
    var showVisuals by remember { mutableStateOf(true) }
    var showChords by remember { mutableStateOf(true) }
    var showLyrics by remember { mutableStateOf(true) }
    var showNotes by remember { mutableStateOf(true) }
    var showDrums by remember { mutableStateOf(true) }
    var glowFullscreen by remember { mutableStateOf(false) }
    var selectedVis by remember { mutableStateOf(VisType.Spectrum) }
    var showQueue by remember { mutableStateOf(false) }

    // Load takes when song changes
    LaunchedEffect(song?.id) {
        song?.id?.let { vm.loadTakes(it) }
    }

    // Merge cloud + local takes into TakeItem list
    val takeItems by remember {
        derivedStateOf {
            val cloud = vm.cloudTakes.map { stem ->
                TakeItem(
                    id = stem.id,
                    label = stem.label,
                    isBest = stem.isBestTake,
                    isCloud = true,
                    date = stem.createdAt.take(10),
                    takeNumber = stem.label.removePrefix("Take ").toIntOrNull() ?: 0,
                    durationFormatted = stem.durationSeconds?.let {
                        val s = it.toInt(); "%d:%02d".format(s / 60, s % 60)
                    } ?: "",
                )
            }
            val local = vm.localTakes.map { take ->
                TakeItem(
                    id = take.id,
                    label = take.label,
                    isBest = false,
                    isCloud = false,
                    date = take.createdAt.take(10),
                    takeNumber = take.takeNumber,
                    durationFormatted = take.durationSeconds.let {
                        val s = it.toInt(); "%d:%02d".format(s / 60, s % 60)
                    },
                )
            }
            (cloud + local).sortedBy { it.takeNumber }
        }
    }

    // Inline drawer
    var drawerOpen by remember { mutableStateOf(false) }

    Box(Modifier.fillMaxSize()) {
    Column(Modifier.fillMaxSize().background(GigColors.background)) {
        if (song == null) {
            // Simple header when no song
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(GigColors.background)
                    .padding(start = 8.dp, end = 16.dp, bottom = 12.dp),
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
                onClose = onClose,
                onSwitchMode = { mode -> vm.stop(); onSwitchMode(mode) },
                currentMode = "practice",
            )

            // Content area — hero + text fill available space (no scroll)
            val hasTextContent = (showChords && !song.chords.isNullOrBlank()) ||
                (showLyrics && !song.lyrics.isNullOrBlank()) ||
                (showNotes && !song.notes.isNullOrBlank()) ||
                (showDrums && !song.drumNotation.isNullOrBlank())
            val bothVisible = showVisuals && hasTextContent

            Column(
                modifier = Modifier.weight(1f),
            ) {
                // Visual Hero — fills space, splits with text when both visible
                if (showVisuals) {
                    VisualHero(
                        isPlaying = vm.isClickPlaying,
                        currentBeat = vm.currentBeat,
                        accent = GigColors.purple,
                        modifier = Modifier.weight(if (bothVisible) 0.55f else 1f),
                        suppressBeatGlow = glowFullscreen,
                        selectedVis = selectedVis,
                        onVisChange = { selectedVis = it },
                    )
                }

                // Waveform (practice-specific, fixed height)
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

                // Text Panel — fills space when hero hidden, splits when both visible
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
                    modifier = if (hasTextContent && !showVisuals) Modifier.weight(1f) else Modifier,
                )

                // Takes section (S41)
                if (takeItems.isNotEmpty() || vm.takesLoading) {
                    Box(Modifier.padding(horizontal = 8.dp, vertical = 4.dp)) {
                        TakesSection(
                            takes = takeItems,
                            onSetBest = { id -> song?.id?.let { vm.setBestTake(id, it) } },
                            onClearBest = { id -> song?.id?.let { vm.clearBestTake(id, it) } },
                            onDelete = { id ->
                                val take = takeItems.firstOrNull { it.id == id }
                                if (take != null) {
                                    if (take.isCloud) vm.deleteCloudTake(id, song.id)
                                    else vm.deleteLocalTake(id, song.id)
                                }
                            },
                            onPlay = { id ->
                                if (vm.playingTakeId == id) vm.stopTakePlayback() else vm.playTake(id)
                            },
                            isLoading = vm.takesLoading,
                            playingTakeId = vm.playingTakeId,
                        )
                    }
                }

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

            // Recording status banner (S41)
            if (vm.recState == AppViewModel.RecState.COUNT_IN || vm.recState == AppViewModel.RecState.RECORDING) {
                RecordingBanner(vm)
            }

            // Nav Row (prev/next song) — all modes (D-168: uses generalized queue)
            run {
                val queue = vm.queueSongs
                if (queue.size > 1) {
                    val prevName = queue.getOrNull(vm.queueIdx - 1)?.name
                    val nextName = queue.getOrNull(vm.queueIdx + 1)?.name

                    PlayerNavRow(
                        prevSongName = prevName,
                        nextSongName = nextName,
                        queueLabel = "${vm.queueIdx + 1}/${queue.size}",
                        onPrev = { vm.prevSong() },
                        onNext = { vm.nextSong() },
                        onQueue = { showQueue = true },
                    )
                } else {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp),
                        horizontalArrangement = Arrangement.Center,
                    ) {
                        Box(
                            modifier = Modifier
                                .background(GigColors.surface, RoundedCornerShape(10.dp))
                                .border(1.dp, Color.White.copy(alpha = 0.06f), RoundedCornerShape(10.dp))
                                .clickable(onClick = { showQueue = true })
                                .padding(horizontal = 14.dp, vertical = 5.dp),
                        ) {
                            Text(
                                "Browse Songs",
                                fontFamily = JetBrainsMono, fontSize = 10.sp, color = GigColors.textMuted,
                            )
                        }
                    }
                }
            }

            // Transport (2-tier: speed+loop top row, main controls bottom row)
            PracticeTransport(vm)

            // Inline drawer — handle + expandable settings
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
                    ),
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { drawerOpen = !drawerOpen }
                        .padding(10.dp, 8.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    DrawerHandle()
                }

                AnimatedVisibility(
                    visible = drawerOpen,
                    enter = expandVertically(),
                    exit = shrinkVertically(),
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
                            glowFullscreen = glowFullscreen, onGlowToggle = { glowFullscreen = !glowFullscreen },
                        )

                        // Mixer section — always visible (click is always a channel)
                        Spacer(Modifier.height(4.dp))
                        DrawerLabel("MIXER")
                        PracticeMixer(vm)

                        // Record button (D-150) — in drawer
                        if (vm.recState == AppViewModel.RecState.RECORDING) {
                            Box(
                                modifier = Modifier
                                    .size(48.dp)
                                    .clip(CircleShape)
                                    .background(GigColors.danger)
                                    .clickable { vm.stopRecording() }
                                    .align(Alignment.CenterHorizontally),
                                contentAlignment = Alignment.Center,
                            ) {
                                Icon(Icons.Default.Stop, contentDescription = "Stop Recording", tint = Color.White, modifier = Modifier.size(22.dp))
                            }
                        } else if (vm.recState == AppViewModel.RecState.IDLE) {
                            Box(
                                modifier = Modifier
                                    .size(48.dp)
                                    .clip(CircleShape)
                                    .background(GigColors.danger.copy(alpha = 0.15f))
                                    .border(1.dp, GigColors.danger.copy(alpha = 0.4f), CircleShape)
                                    .clickable { vm.startRecording() }
                                    .align(Alignment.CenterHorizontally),
                                contentAlignment = Alignment.Center,
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(16.dp)
                                        .clip(CircleShape)
                                        .background(GigColors.danger)
                                )
                            }
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

                        Spacer(Modifier.height(12.dp))
                    }
                }
            }
        }
    }

    // Fullscreen beat glow overlay
    if (glowFullscreen) {
        FullscreenBeatGlow(
            isPlaying = vm.isClickPlaying,
            currentBeat = vm.currentBeat,
            accent = GigColors.purple,
        )
    }

    // Queue overlay (tabs: Queue / Songs / Setlists)
    if (showQueue) {
        QueueOverlay(vm = vm, onDismiss = { showQueue = false })
    }
    } // Box

    // Post-recording dialog (D-139)
    if (vm.recState == AppViewModel.RecState.DONE) {
        PostRecordingDialog(vm)
    }
}

// ─── Practice Transport (2-tier: speed+loop top, main bottom) ────────────────────

@Composable
private fun PracticeTransport(vm: AppViewModel) {
    val isPlaying = vm.isClickPlaying || vm.isTrackPlaying
    val speedPct = (vm.practiceSpeed * 100).roundToInt()
    val hasA = vm.loopAFrame != null
    val hasB = vm.loopBFrame != null

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 6.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        // Top row: speed (left) + A-B loop (right)
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // Speed controls (left)
            Row(verticalAlignment = Alignment.CenterVertically) {
                SpeedButton("-5") { vm.applySpeed((vm.practiceSpeed - 0.05f).coerceAtLeast(0.25f)) }
                Spacer(Modifier.width(6.dp))
                Text(
                    "${speedPct}%",
                    fontFamily = JetBrainsMono, fontSize = 11.sp,
                    color = GigColors.purple,
                    modifier = Modifier.width(36.dp),
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )
                Spacer(Modifier.width(6.dp))
                SpeedButton("+5") { vm.applySpeed((vm.practiceSpeed + 0.05f).coerceAtMost(1.5f)) }
            }

            // A-B loop controls (right) — only when track loaded
            if (vm.trackLoaded) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    LoopPill("A", active = hasA, color = GigColors.orange) { vm.setLoopA() }
                    LoopPill("B", active = hasB, color = GigColors.orange) { vm.setLoopB() }
                    LoopPill("Clear", active = hasA || hasB, color = GigColors.textMuted, enabled = hasA || hasB) { vm.clearLoop() }
                }
            }
        }

        // Bottom row: restart / play / stop
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

@Composable
private fun LoopPill(label: String, active: Boolean, color: Color, enabled: Boolean = true, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .height(28.dp)
            .background(
                if (active) color.copy(alpha = 0.08f) else Color.Transparent,
                RoundedCornerShape(12.dp),
            )
            .border(
                1.dp,
                if (active) color.copy(alpha = 0.4f) else Color.White.copy(alpha = 0.06f),
                RoundedCornerShape(12.dp),
            )
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 10.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            fontFamily = JetBrainsMono, fontSize = 9.sp,
            color = if (active) color else GigColors.textMuted,
        )
    }
}

// ─── Practice Waveform ───────────────────────────────────────────────────────────

@Composable
internal fun PracticeWaveform(vm: AppViewModel) {
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
                isMuted = vm.isTrackMuted,
                onMuteToggle = { vm.toggleTrackMute() },
            )
        )
    }

    // Stem channels
    vm.loadedStems.forEach { (idx, stem) ->
        val stemColor = when (stem.label.uppercase()) {
            "DRUMS" -> GigColors.orange
            "BASS" -> GigColors.cyan
            "VOCALS" -> GigColors.pink
            "GUITAR", "GTR" -> GigColors.green
            "KEYS", "KEY" -> GigColors.teal
            else -> GigColors.slate
        }
        channels.add(
            MixerChannel(
                label = stem.label.take(3).uppercase(),
                color = stemColor,
                value = vm.stemGains[idx] ?: 1f,
                onValueChange = { vm.setStemGain(idx, it) },
                isMuted = vm.stemMutes[idx] == true,
                onMuteToggle = { vm.toggleStemMute(idx) },
            )
        )
    }

    // Loading indicator
    if (vm.stemsLoading) {
        Text(
            "Loading stems...",
            fontFamily = JetBrainsMono, fontSize = 9.sp,
            color = GigColors.teal, modifier = Modifier.padding(top = 4.dp),
        )
    } else if (vm.processingStatus != null) {
        Text(
            "Server: ${vm.processingStatus}...",
            fontFamily = JetBrainsMono, fontSize = 9.sp,
            color = GigColors.orange, modifier = Modifier.padding(top = 4.dp),
        )
    } else if (vm.loadedStems.isEmpty() && vm.trackLoaded && vm.stemErrors.isEmpty()) {
        Text(
            "No stems — process track for multitrack",
            fontFamily = JetBrainsMono, fontSize = 8.sp,
            color = GigColors.textMuted, modifier = Modifier.padding(top = 4.dp),
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

// ─── Recording Banner ────────────────────────────────────────────────────────────

@Composable
internal fun RecordingBanner(vm: AppViewModel) {
    val isCountIn = vm.recState == AppViewModel.RecState.COUNT_IN
    val mins = vm.recElapsedSec / 60
    val secs = vm.recElapsedSec % 60
    val levelWidth = vm.recInputLevel.coerceIn(0f, 1f)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp, vertical = 4.dp)
            .background(GigColors.danger.copy(alpha = 0.08f), RoundedCornerShape(8.dp))
            .border(1.dp, GigColors.danger.copy(alpha = 0.2f), RoundedCornerShape(8.dp))
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        // Red dot
        Box(
            modifier = Modifier
                .size(8.dp)
                .clip(CircleShape)
                .background(GigColors.danger)
        )

        // State label
        Text(
            if (isCountIn) "COUNT IN" else "REC",
            fontFamily = JetBrainsMono, fontWeight = FontWeight.Bold,
            fontSize = 11.sp, color = GigColors.danger,
        )

        // Take number
        Text(
            "Take ${vm.recTakeNumber}",
            fontFamily = Karla, fontSize = 11.sp, color = GigColors.textMuted,
        )

        Spacer(Modifier.weight(1f))

        // Timer
        if (!isCountIn) {
            Text(
                "%d:%02d".format(mins, secs),
                fontFamily = JetBrainsMono, fontSize = 13.sp, color = GigColors.danger,
            )
        }

        // Level bar
        if (!isCountIn) {
            Box(
                modifier = Modifier
                    .width(40.dp)
                    .height(6.dp)
                    .clip(RoundedCornerShape(3.dp))
                    .background(GigColors.surfaceLight),
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(levelWidth)
                        .height(6.dp)
                        .clip(RoundedCornerShape(3.dp))
                        .background(GigColors.green)
                )
            }
        }
    }
}

// ─── Post-Recording Dialog (D-139) ───────────────────────────────────────────────

@Composable
internal fun PostRecordingDialog(vm: AppViewModel) {
    var markAsBest by remember { mutableStateOf(false) }
    val durationSec = vm.recDuration.toInt()
    val durationStr = "%d:%02d".format(durationSec / 60, durationSec % 60)

    androidx.compose.material3.AlertDialog(
        onDismissRequest = { /* can't dismiss without choosing */ },
        containerColor = GigColors.surface,
        title = {
            Text(
                "Take ${vm.recTakeNumber} · $durationStr",
                fontFamily = Karla, fontWeight = FontWeight.Bold,
                fontSize = 16.sp, color = GigColors.text,
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                // Best take toggle
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(
                            if (markAsBest) GigColors.orange.copy(alpha = 0.08f) else Color.Transparent,
                            RoundedCornerShape(8.dp),
                        )
                        .border(
                            1.dp,
                            if (markAsBest) GigColors.orange.copy(alpha = 0.3f) else Color.White.copy(alpha = 0.06f),
                            RoundedCornerShape(8.dp),
                        )
                        .clickable { markAsBest = !markAsBest }
                        .padding(12.dp),
                ) {
                    Text(
                        if (markAsBest) "★" else "☆",
                        fontSize = 16.sp, color = GigColors.orange,
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        "Mark as Best Take",
                        fontFamily = Karla, fontSize = 13.sp,
                        color = if (markAsBest) GigColors.orange else GigColors.textMuted,
                    )
                }

                Spacer(Modifier.height(4.dp))

                // 4 action buttons (D-139)
                PostRecButton("Discard & Re-take", GigColors.danger) { vm.discardRecording(retake = true) }
                PostRecButton("Save & Re-take", GigColors.purple) { vm.saveRecording(asBest = markAsBest, retake = true) }
                PostRecButton("Save as Take", GigColors.green) { vm.saveRecording(asBest = markAsBest) }
                PostRecButton("Save & Preview", GigColors.teal) { vm.saveRecording(asBest = markAsBest, preview = true) }
            }
        },
        confirmButton = {},
    )
}

@Composable
internal fun PostRecButton(label: String, color: Color, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(40.dp)
            .background(color.copy(alpha = 0.06f), RoundedCornerShape(8.dp))
            .border(1.dp, color.copy(alpha = 0.25f), RoundedCornerShape(8.dp))
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, fontFamily = Karla, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = color)
    }
}

internal fun formatFrames(frames: Long, sampleRate: Int): String {
    val secs = (frames / sampleRate.coerceAtLeast(1)).toInt()
    return "%d:%02d".format(secs / 60, secs % 60)
}

package com.thegreentangerine.gigbooks.ui.screens

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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.thegreentangerine.gigbooks.ui.AppViewModel
import com.thegreentangerine.gigbooks.ui.components.DisplayToggleRow
import com.thegreentangerine.gigbooks.ui.components.DrawerHandle
import com.thegreentangerine.gigbooks.ui.components.DrawerLabel
import com.thegreentangerine.gigbooks.ui.components.FullscreenBeatGlow
import com.thegreentangerine.gigbooks.ui.components.MixerChannel
import com.thegreentangerine.gigbooks.ui.components.MixerRow
import com.thegreentangerine.gigbooks.ui.components.PlayButton
import com.thegreentangerine.gigbooks.ui.components.PlayerHeader
import com.thegreentangerine.gigbooks.ui.components.PlayerNavRow
import com.thegreentangerine.gigbooks.ui.components.SettingsPills
import com.thegreentangerine.gigbooks.ui.components.TakeItem
import com.thegreentangerine.gigbooks.ui.components.TakesSection
import com.thegreentangerine.gigbooks.ui.components.TextPanel
import com.thegreentangerine.gigbooks.ui.components.TextPanelToggles
import com.thegreentangerine.gigbooks.ui.components.TransportButton
import com.thegreentangerine.gigbooks.ui.components.VisualHero
import com.thegreentangerine.gigbooks.ui.theme.TangerineColors
import com.thegreentangerine.gigbooks.ui.theme.JetBrainsMono
import com.thegreentangerine.gigbooks.ui.theme.Karla
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * ViewScreen — S42, D-137, D-144, D-146.
 *
 * 3rd player mode: View Mode. Plays user's local best-take video in the hero area
 * (16:9) + all audio stems from Supabase. Stem mixer in drawer.
 * No-video fallback: neumorphic visualiser in hero (D-146).
 * Record button for layering (D-144).
 */
@Composable
fun ViewScreen(vm: AppViewModel, onMenuClick: () -> Unit, onGoToLibrary: () -> Unit, onClose: () -> Unit = {}, onSwitchMode: (String) -> Unit = {}) {
    val song = vm.selectedSong

    // Display toggles (local state)
    var showVisuals by remember { mutableStateOf(true) }
    var showChords by remember { mutableStateOf(true) }
    var showLyrics by remember { mutableStateOf(true) }
    var showNotes by remember { mutableStateOf(true) }
    var showDrums by remember { mutableStateOf(true) }
    var glowFullscreen by remember { mutableStateOf(false) }
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
    Column(Modifier.fillMaxSize().background(TangerineColors.background)) {
        if (song == null) {
            // Simple header when no song
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(TangerineColors.background)
                    .padding(start = 8.dp, end = 16.dp, bottom = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = onMenuClick) {
                    Icon(Icons.Default.Close, contentDescription = "Menu", tint = TangerineColors.textDim, modifier = Modifier.size(22.dp))
                }
            }
            NoSongPlaceholder(
                accent = TangerineColors.teal,
                screenName = "View",
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
                currentMode = "view",
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
                // View Mode Hero — visualiser fallback (D-146)
                // TODO: ExoPlayer/SurfaceView for video when local video exists
                if (showVisuals) {
                    ViewHero(
                        isPlaying = vm.isClickPlaying || vm.isTrackPlaying,
                        modifier = Modifier.weight(if (bothVisible) 0.55f else 1f),
                    )
                }

                // Waveform (same as practice, for track seeking)
                if (song.hasAudio && vm.trackLoaded) {
                    PracticeWaveform(vm)
                } else if (song.hasAudio && !vm.trackLoaded) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 8.dp, vertical = 5.dp)
                            .height(48.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(TangerineColors.surface)
                            .border(1.dp, Color.White.copy(alpha = 0.03f), RoundedCornerShape(8.dp))
                            .clickable(enabled = !vm.isLoadingTrack) { vm.loadTrack(song.audioUrl!!) },
                        contentAlignment = Alignment.Center,
                    ) {
                        if (vm.isLoadingTrack) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                CircularProgressIndicator(color = TangerineColors.teal, strokeWidth = 2.dp, modifier = Modifier.size(14.dp))
                                Text("Loading…", fontFamily = Karla, fontSize = 11.sp, color = TangerineColors.teal)
                            }
                        } else {
                            Text(
                                "Load Track",
                                fontFamily = JetBrainsMono, fontSize = 11.sp,
                                style = TextStyle(color = TangerineColors.teal, shadow = Shadow(TangerineColors.teal.copy(0.3f), Offset.Zero, 6f)),
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
                    modifier = if (hasTextContent) Modifier.weight(if (bothVisible) 0.45f else 1f) else Modifier,
                )

                // Takes section (S41)
                if (takeItems.isNotEmpty() || vm.takesLoading) {
                    Box(Modifier.padding(horizontal = 8.dp, vertical = 4.dp)) {
                        TakesSection(
                            takes = takeItems,
                            onSetBest = { id -> song.id.let { vm.setBestTake(id, it) } },
                            onClearBest = { id -> song.id.let { vm.clearBestTake(id, it) } },
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
                            .background(TangerineColors.teal.copy(alpha = 0.06f), RoundedCornerShape(8.dp))
                            .border(1.dp, TangerineColors.teal.copy(alpha = 0.15f), RoundedCornerShape(8.dp))
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        CircularProgressIndicator(
                            color = TangerineColors.teal,
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
                            fontFamily = Karla, fontSize = 12.sp, color = TangerineColors.teal,
                        )
                    }
                }
            }

            // Recording status banner (S41)
            if (vm.recState == AppViewModel.RecState.COUNT_IN || vm.recState == AppViewModel.RecState.RECORDING) {
                RecordingBanner(vm)
            }

            // Nav Row (prev/next song) — all modes (D-168: generalized queue)
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
                                .background(TangerineColors.surface, RoundedCornerShape(10.dp))
                                .border(1.dp, Color.White.copy(alpha = 0.06f), RoundedCornerShape(10.dp))
                                .clickable(onClick = { showQueue = true })
                                .padding(horizontal = 14.dp, vertical = 5.dp),
                        ) {
                            Text(
                                "Browse Songs",
                                fontFamily = JetBrainsMono, fontSize = 10.sp, color = TangerineColors.textMuted,
                            )
                        }
                    }
                }
            }

            // Transport (same stacked layout as practice)
            ViewTransport(vm)

            // Inline drawer — handle + expandable settings
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        TangerineColors.surface,
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
                        ViewMixer(vm)

                        // Record button (D-144) — in drawer
                        if (vm.recState == AppViewModel.RecState.RECORDING) {
                            Box(
                                modifier = Modifier
                                    .size(48.dp)
                                    .clip(CircleShape)
                                    .background(TangerineColors.danger)
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
                                    .background(TangerineColors.danger.copy(alpha = 0.15f))
                                    .border(1.dp, TangerineColors.danger.copy(alpha = 0.4f), CircleShape)
                                    .clickable { vm.startRecording() }
                                    .align(Alignment.CenterHorizontally),
                                contentAlignment = Alignment.Center,
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(16.dp)
                                        .clip(CircleShape)
                                        .background(TangerineColors.danger)
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
            isPlaying = vm.isClickPlaying || vm.isTrackPlaying,
            currentBeat = vm.currentBeat,
            accent = TangerineColors.teal,
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

// ─── View Mode Hero (D-146) ─────────────────────────────────────────────────────

@Composable
private fun ViewHero(isPlaying: Boolean, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp, vertical = 5.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(
                brush = androidx.compose.ui.graphics.Brush.linearGradient(
                    colors = listOf(
                        Color(0xFF0A0A14),
                        Color(0xFF141420),
                        Color(0xFF0A0A14),
                    ),
                ),
            )
            .border(1.dp, Color.White.copy(alpha = 0.03f), RoundedCornerShape(12.dp)),
        contentAlignment = Alignment.Center,
    ) {
        // Visualiser bars (teal, D-146 fallback)
        Row(
            horizontalArrangement = Arrangement.spacedBy(3.dp),
            verticalAlignment = Alignment.Bottom,
            modifier = Modifier.padding(horizontal = 20.dp, vertical = 16.dp),
        ) {
            for (i in 0 until 21) {
                val fraction = if (isPlaying) {
                    val base = 0.3f + sin(i * 0.5f + System.currentTimeMillis() / 300f).toFloat() * 0.25f
                    base.coerceIn(0.08f, 0.8f)
                } else {
                    (0.08f + sin(i * 0.3f).toFloat() * 0.04f).coerceIn(0.04f, 0.2f)
                }
                Box(
                    modifier = Modifier
                        .width(6.dp)
                        .height((fraction * 80).dp)
                        .clip(RoundedCornerShape(3.dp))
                        .background(TangerineColors.teal.copy(alpha = if (isPlaying) 0.7f else 0.3f))
                )
            }
        }
    }
}

// ─── View Transport (2-tier: speed+loop top, main bottom, teal accent) ───────────

@Composable
private fun ViewTransport(vm: AppViewModel) {
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
                ViewSpeedButton("-5") { vm.applySpeed((vm.practiceSpeed - 0.05f).coerceAtLeast(0.25f)) }
                Spacer(Modifier.width(6.dp))
                Text(
                    "${speedPct}%",
                    fontFamily = JetBrainsMono, fontSize = 11.sp,
                    color = TangerineColors.teal,
                    modifier = Modifier.width(36.dp),
                    textAlign = TextAlign.Center,
                )
                Spacer(Modifier.width(6.dp))
                ViewSpeedButton("+5") { vm.applySpeed((vm.practiceSpeed + 0.05f).coerceAtMost(1.5f)) }
            }

            // A-B loop controls (right) — only when track loaded
            if (vm.trackLoaded) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    ViewLoopPill("A", active = hasA, color = TangerineColors.orange) { vm.setLoopA() }
                    ViewLoopPill("B", active = hasB, color = TangerineColors.orange) { vm.setLoopB() }
                    ViewLoopPill("Clear", active = hasA || hasB, color = TangerineColors.textMuted, enabled = hasA || hasB) { vm.clearLoop() }
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
                    .background(TangerineColors.surfaceLight)
                    .border(1.dp, Color.White.copy(alpha = 0.06f), CircleShape)
                    .clickable(enabled = vm.engineAvailable && vm.trackLoaded) { vm.restart() },
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Default.SkipPrevious, contentDescription = "Restart", tint = TangerineColors.textMuted, modifier = Modifier.size(18.dp))
            }
            Spacer(Modifier.width(8.dp))
            // Play (teal accent)
            PlayButton(
                isPlaying = isPlaying,
                accent = TangerineColors.teal,
                onClick = { if (isPlaying) vm.pause() else vm.play() },
                enabled = vm.engineAvailable,
            )
            Spacer(Modifier.width(8.dp))
            // Stop
            TransportButton(icon = "■", color = TangerineColors.danger, onClick = { vm.stop() })
        }
    }
}

@Composable
private fun ViewSpeedButton(label: String, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .size(24.dp)
            .clip(CircleShape)
            .background(TangerineColors.surfaceLight)
            .border(1.dp, Color.White.copy(alpha = 0.06f), CircleShape)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, fontFamily = JetBrainsMono, fontSize = 8.sp, color = TangerineColors.textMuted)
    }
}

@Composable
private fun ViewLoopPill(label: String, active: Boolean, color: Color, enabled: Boolean = true, onClick: () -> Unit) {
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
            color = if (active) color else TangerineColors.textMuted,
        )
    }
}

// ─── View Mixer (drawer) ─────────────────────────────────────────────────────────

@Composable
private fun ViewMixer(vm: AppViewModel) {
    val channels = mutableListOf<MixerChannel>()

    // Click channel
    channels.add(
        MixerChannel(
            label = "CLK",
            color = TangerineColors.teal,
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
                color = TangerineColors.green,
                value = vm.trackGain,
                onValueChange = { vm.changeTrackGain(it) },
            )
        )
    }

    // Stem channels
    vm.loadedStems.forEach { (idx, stem) ->
        val stemColor = when (stem.label.uppercase()) {
            "DRUMS" -> TangerineColors.orange
            "BASS" -> TangerineColors.cyan
            "VOCALS" -> TangerineColors.pink
            else -> TangerineColors.slate
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

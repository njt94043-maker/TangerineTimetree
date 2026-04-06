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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Celebration
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.Composable
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
import com.thegreentangerine.gigbooks.data.supabase.models.Song
import com.thegreentangerine.gigbooks.data.xr18.ConnectionState
import com.thegreentangerine.gigbooks.ui.AppViewModel
import com.thegreentangerine.gigbooks.ui.components.DisplayToggleRow
import com.thegreentangerine.gigbooks.ui.components.DrawerHandle
import com.thegreentangerine.gigbooks.ui.components.DrawerLabel
import com.thegreentangerine.gigbooks.ui.components.FullscreenBeatGlow
import com.thegreentangerine.gigbooks.ui.components.LiveTransport
import com.thegreentangerine.gigbooks.ui.components.MixerChannel
import com.thegreentangerine.gigbooks.ui.components.MixerRow
import com.thegreentangerine.gigbooks.ui.components.NeuCard
import com.thegreentangerine.gigbooks.ui.components.NeuWell
import com.thegreentangerine.gigbooks.ui.components.PlayerHeader
import com.thegreentangerine.gigbooks.ui.components.PlayerNavRow
import com.thegreentangerine.gigbooks.ui.components.SettingsPills
import com.thegreentangerine.gigbooks.ui.components.TextPanel
import com.thegreentangerine.gigbooks.ui.components.TextPanelToggles
import com.thegreentangerine.gigbooks.ui.components.VisType
import com.thegreentangerine.gigbooks.ui.components.VisualHero
import com.thegreentangerine.gigbooks.ui.theme.TangerineColors
import com.thegreentangerine.gigbooks.ui.theme.JetBrainsMono
import com.thegreentangerine.gigbooks.ui.theme.Karla

@Composable
fun LiveScreen(vm: AppViewModel, onMenuClick: () -> Unit, onGoToLibrary: () -> Unit, onClose: () -> Unit = {}, onSwitchMode: (String) -> Unit = {}, onNavigateToCamera: () -> Unit = {}) {
    val song = vm.selectedSong
    var showQueue by remember { mutableStateOf(false) }
    var showSpeedConfirm by remember { mutableStateOf(false) }
    var pendingBpmDelta by remember { mutableStateOf(0f) }

    // Display toggles (local state — will wire to user_settings later)
    var showVisuals by remember { mutableStateOf(true) }
    var showChords by remember { mutableStateOf(true) }
    var showLyrics by remember { mutableStateOf(true) }
    var showNotes by remember { mutableStateOf(true) }
    var showDrums by remember { mutableStateOf(true) }
    var glowFullscreen by remember { mutableStateOf(false) }
    var selectedVis by remember { mutableStateOf(VisType.Spectrum) }

    // Inline drawer (expands in-place, shrinks hero)
    var drawerOpen by remember { mutableStateOf(false) }

    // Set complete overlay
    if (vm.isSetComplete && vm.queueSongs.isNotEmpty()) {
        SetCompleteScreen(
            setlistName = vm.queueLabel,
            songCount = vm.queueSongs.size,
            onRestart = { vm.restartSetlist() },
            onGoToLibrary = { vm.dismissSetComplete(); onGoToLibrary() },
        )
        return
    }

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
                    accent = TangerineColors.green,
                    screenName = "Live Mode",
                    onGoToLibrary = onGoToLibrary,
                )
            } else {
                val queue = vm.queueSongs
                val setlistPos = if (queue.size > 1) "${vm.queueIdx + 1} of ${queue.size}" else null

                // V4 Header
                PlayerHeader(
                    songName = song.name,
                    songArtist = song.artist,
                    bpm = vm.effectiveBpm.toInt(),
                    isLiveMode = true,
                    setlistName = if (queue.size > 1) vm.queueLabel else null,
                    setlistPosition = setlistPos,
                    onBackClick = onMenuClick,
                    onClose = onClose,
                    onSwitchMode = { mode -> vm.stopClick(); onSwitchMode(mode) },
                    currentMode = "live",
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
                    // Visual Hero — fills available space when solo, splits with text
                    if (showVisuals) {
                        val heroMod = when {
                            bothVisible -> Modifier.weight(0.55f)
                            !hasTextContent -> Modifier.weight(1f)  // fill screen when no text
                            else -> Modifier.height(180.dp)
                        }
                        VisualHero(
                            isPlaying = vm.isClickPlaying,
                            currentBeat = vm.currentBeat,
                            accent = TangerineColors.green,
                            modifier = heroMod,
                            suppressBeatGlow = glowFullscreen,
                            selectedVis = selectedVis,
                            onVisChange = { selectedVis = it },
                            visBands = vm.visBands,
                        )
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
                }

                // Nav Row (prev/next song) — above transport (D-168: generalized queue)
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
                    // Standalone queue/browse button when no setlist is active
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

                // Transport (restart / play-pause / stop) + record button
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    // Record button — only when camera is connected
                    if (vm.cameraInitialised) {
                        val camState by vm.phoneCompanion.state.collectAsState()
                        val camRecording by vm.cameraRecording.isRecording.collectAsState()
                        if (camState == ConnectionState.Connected || camState == ConnectionState.Recording) {
                            Box(
                                modifier = Modifier
                                    .padding(start = 8.dp)
                                    .size(40.dp)
                                    .background(
                                        if (camRecording) Color.Red else Color.Red.copy(alpha = 0.15f),
                                        CircleShape,
                                    )
                                    .border(
                                        1.dp,
                                        if (camRecording) Color.Red else Color.Red.copy(alpha = 0.4f),
                                        CircleShape,
                                    )
                                    .clickable {
                                        if (camRecording) vm.requestStudioStopRecording()
                                        else vm.requestStudioRecording()
                                    },
                                contentAlignment = Alignment.Center,
                            ) {
                                if (camRecording) {
                                    // Stop icon (square)
                                    Box(Modifier.size(14.dp).background(Color.White, RoundedCornerShape(2.dp)))
                                } else {
                                    // Record dot
                                    Box(Modifier.size(16.dp).clip(CircleShape).background(Color.Red))
                                }
                            }
                        }
                    }

                    Box(modifier = Modifier.weight(1f)) {
                        LiveTransport(
                            isPlaying = vm.isClickPlaying,
                            onPlayStop = { vm.toggleClick() },
                            onStop = { vm.stopClick() },
                            onRestart = { vm.stopClick(); vm.toggleClick() },
                            enabled = vm.engineAvailable,
                        )
                    }
                }

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
                    // Pull handle
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { drawerOpen = !drawerOpen }
                            .padding(10.dp, 8.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        DrawerHandle()
                    }

                    // Expandable drawer content (inline, pushes hero up)
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

                            Spacer(Modifier.height(4.dp))
                            DrawerLabel("MIXER")
                            LiveMixer(vm)

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

                            // Camera section — only show if managers have been initialised
                            if (vm.cameraInitialised) {
                                Spacer(Modifier.height(4.dp))
                                DrawerLabel("CAMERA")
                                CameraDrawerSection(vm, onNavigateToCamera)
                            }

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
                accent = TangerineColors.green,
            )
        }

        // Queue overlay (tabs: Queue / Songs / Setlists)
        if (showQueue) {
            QueueOverlay(
                vm = vm,
                onDismiss = { showQueue = false },
            )
        }

        // Speed safety confirm
        if (showSpeedConfirm) {
            SpeedSafetyModal(
                delta = pendingBpmDelta,
                currentBpm = vm.effectiveBpm,
                onConfirm = {
                    vm.adjustBpm(pendingBpmDelta)
                    showSpeedConfirm = false
                },
                onCancel = { showSpeedConfirm = false },
            )
        }
    }
}

// ─── Live Mixer (drawer) ────────────────────────────────────────────────────────

@Composable
private fun LiveMixer(vm: AppViewModel) {
    val channels = mutableListOf<MixerChannel>()

    // Click channel — always present
    channels.add(
        MixerChannel(
            label = "CLK",
            color = TangerineColors.purple,
            value = (vm.clickGain / 2f).coerceIn(0f, 1f),
            onValueChange = { vm.changeClickGain(it * 2f) },
            isMuted = vm.isClickMuted,
            onMuteToggle = { vm.toggleClickMute() },
        )
    )

    MixerRow(channels)
}

// ─── Queue Overlay (with tabs: Queue / Songs / Setlists) ────────────────────

@Composable
fun QueueOverlay(vm: AppViewModel, onDismiss: () -> Unit) {
    var activeTab by remember { mutableStateOf(0) } // 0=Queue, 1=Songs, 2=Setlists

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(TangerineColors.background.copy(alpha = 0.95f))
            .clickable(onClick = onDismiss),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .clickable(enabled = false, onClick = {})
                .padding(top = 60.dp, start = 16.dp, end = 16.dp, bottom = 16.dp),
        ) {
            // Header with close button
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    when (activeTab) { 0 -> "Queue"; 1 -> "Songs"; else -> "Setlists" },
                    fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 18.sp,
                    style = TextStyle(color = TangerineColors.teal, shadow = Shadow(TangerineColors.teal.copy(0.4f), Offset.Zero, 12f)),
                    modifier = Modifier.weight(1f),
                )
                IconButton(onClick = onDismiss, modifier = Modifier.size(32.dp)) {
                    Icon(Icons.Default.Close, contentDescription = "Close", tint = TangerineColors.textDim, modifier = Modifier.size(20.dp))
                }
            }

            Spacer(Modifier.height(8.dp))

            // Tab row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                QueueTab("Queue", 0, activeTab) { activeTab = 0 }
                QueueTab("Songs", 1, activeTab) { activeTab = 1 }
                QueueTab("Setlists", 2, activeTab) { activeTab = 2 }
            }

            Spacer(Modifier.height(12.dp))

            // Tab content
            when (activeTab) {
                0 -> QueueTabContent(vm, onDismiss)
                1 -> SongsTabContent(vm, onDismiss)
                2 -> SetlistsTabContent(vm, onDismiss)
            }
        }
    }
}

@Composable
private fun QueueTab(label: String, idx: Int, activeTab: Int, onClick: () -> Unit) {
    val isActive = idx == activeTab
    Box(
        modifier = Modifier
            .background(
                if (isActive) TangerineColors.teal.copy(alpha = 0.1f) else Color.Transparent,
                RoundedCornerShape(8.dp),
            )
            .border(
                1.dp,
                if (isActive) TangerineColors.teal.copy(alpha = 0.35f) else Color.White.copy(alpha = 0.06f),
                RoundedCornerShape(8.dp),
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 6.dp),
    ) {
        Text(
            label,
            fontFamily = JetBrainsMono, fontWeight = if (isActive) FontWeight.Bold else FontWeight.Normal,
            fontSize = 11.sp, color = if (isActive) TangerineColors.teal else TangerineColors.textMuted,
        )
    }
}

@Composable
private fun QueueTabContent(vm: AppViewModel, onDismiss: () -> Unit) {
    val queue = vm.queueSongs
    if (queue.isEmpty()) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("No active queue", fontFamily = Karla, fontSize = 13.sp, color = TangerineColors.textMuted)
        }
        return
    }
    val currentIdx = vm.queueIdx

    // Queue label subtitle (D-168)
    Text(vm.queueLabel, fontFamily = Karla, fontSize = 12.sp, color = TangerineColors.textMuted)
    Spacer(Modifier.height(8.dp))

    LazyColumn(modifier = Modifier.fillMaxSize()) {
        itemsIndexed(queue, key = { _, s -> s.id }) { idx, song ->
            val isCurrent = idx == currentIdx
            val isPlayed = idx < currentIdx

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .then(
                        if (isCurrent) Modifier
                            .background(TangerineColors.green.copy(alpha = 0.06f), RoundedCornerShape(8.dp))
                            .border(0.5.dp, TangerineColors.green.copy(alpha = 0.25f), RoundedCornerShape(8.dp))
                        else Modifier
                    )
                    .clickable { vm.jumpToSong(idx); onDismiss() }
                    .padding(horizontal = 12.dp, vertical = 8.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        "${idx + 1}",
                        fontFamily = JetBrainsMono, fontSize = 13.sp,
                        color = when {
                            isCurrent -> TangerineColors.green
                            isPlayed -> TangerineColors.textMuted
                            else -> TangerineColors.textDim
                        },
                        modifier = Modifier.width(24.dp),
                    )

                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            song.name,
                            fontFamily = Karla,
                            fontWeight = if (isCurrent) FontWeight.Bold else FontWeight.Medium,
                            fontSize = 14.sp,
                            color = when {
                                isCurrent -> TangerineColors.text
                                isPlayed -> TangerineColors.textMuted
                                else -> TangerineColors.textDim
                            },
                        )
                        if (song.artist.isNotBlank()) {
                            Text(
                                song.artist,
                                fontFamily = Karla, fontSize = 11.sp,
                                color = if (isPlayed) TangerineColors.textMuted.copy(alpha = 0.5f) else TangerineColors.textMuted,
                            )
                        }
                    }

                    Text(
                        "${song.bpm.toInt()}",
                        fontFamily = JetBrainsMono, fontSize = 12.sp,
                        color = if (isCurrent) TangerineColors.orange else TangerineColors.textMuted,
                    )

                    Spacer(Modifier.width(4.dp))
                    Column {
                        IconButton(
                            onClick = { vm.reorderSetlistSong(idx, idx - 1) },
                            enabled = idx > 0,
                            modifier = Modifier.size(24.dp),
                        ) {
                            Icon(
                                Icons.Default.KeyboardArrowUp,
                                contentDescription = "Move up",
                                tint = if (idx > 0) TangerineColors.textDim else TangerineColors.textMuted.copy(alpha = 0.3f),
                                modifier = Modifier.size(16.dp),
                            )
                        }
                        IconButton(
                            onClick = { vm.reorderSetlistSong(idx, idx + 1) },
                            enabled = idx < queue.size - 1,
                            modifier = Modifier.size(24.dp),
                        ) {
                            Icon(
                                Icons.Default.KeyboardArrowDown,
                                contentDescription = "Move down",
                                tint = if (idx < queue.size - 1) TangerineColors.textDim else TangerineColors.textMuted.copy(alpha = 0.3f),
                                modifier = Modifier.size(16.dp),
                            )
                        }
                    }
                }

                if (isCurrent) {
                    Text(
                        "NOW PLAYING",
                        fontFamily = JetBrainsMono, fontSize = 9.sp, letterSpacing = 1.sp,
                        style = TextStyle(color = TangerineColors.green, shadow = Shadow(TangerineColors.green.copy(0.4f), Offset.Zero, 6f)),
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
            }
            if (!isCurrent && idx < queue.size - 1) {
                androidx.compose.material3.HorizontalDivider(
                    color = TangerineColors.textMuted.copy(alpha = 0.1f),
                    modifier = Modifier.padding(horizontal = 4.dp),
                )
            }
        }
    }
}

@Composable
private fun SongsTabContent(vm: AppViewModel, onDismiss: () -> Unit) {
    val songs = vm.songs
    val currentSongId = vm.selectedSong?.id

    if (songs.isEmpty()) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("No songs loaded", fontFamily = Karla, fontSize = 13.sp, color = TangerineColors.textMuted)
        }
        return
    }

    // Tag filter state — all ON by default so full master list is visible
    var stapleOn by remember { mutableStateOf(true) }
    var partyOn by remember { mutableStateOf(true) }
    var rockOn by remember { mutableStateOf(true) }

    // Filter tgt_cover songs by active tags, sort by bucket then position
    val bucketOrder = mapOf("opener" to 0, "middle" to 1, "closer" to 2)
    val tgtCovers = songs
        .filter { it.category == "tgt_cover" }
        .filter { song ->
            val tag = song.performanceTag
            when (tag) {
                "staple" -> stapleOn
                "party"  -> partyOn
                "rock"   -> rockOn
                else     -> true  // untagged songs always visible
            }
        }
        .sortedWith(compareBy<Song> { bucketOrder[it.setBucket] ?: 99 }.thenBy { it.bucketPosition ?: Int.MAX_VALUE })

    // Tag toggle buttons
    Row(
        modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        TagToggle("Staple", stapleOn, TangerineColors.teal) { stapleOn = it }
        TagToggle("Party", partyOn, TangerineColors.orange) { partyOn = it }
        TagToggle("Rock", rockOn, TangerineColors.purple) { rockOn = it }
    }

    Text("${tgtCovers.size} songs", fontFamily = Karla, fontSize = 12.sp, color = TangerineColors.textMuted)
    Spacer(Modifier.height(8.dp))

    LazyColumn(modifier = Modifier.fillMaxSize()) {
        itemsIndexed(tgtCovers, key = { _, song -> song.id }) { _, song ->
            val isCurrent = song.id == currentSongId

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .then(
                        if (isCurrent) Modifier
                            .background(TangerineColors.teal.copy(alpha = 0.06f), RoundedCornerShape(8.dp))
                            .border(0.5.dp, TangerineColors.teal.copy(alpha = 0.25f), RoundedCornerShape(8.dp))
                        else Modifier
                    )
                    .clickable {
                        vm.setQueue(tgtCovers, song, "TGT Covers")
                        vm.selectSong(song)
                        onDismiss()
                    }
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        song.name,
                        fontFamily = Karla,
                        fontWeight = if (isCurrent) FontWeight.Bold else FontWeight.Medium,
                        fontSize = 14.sp,
                        color = if (isCurrent) TangerineColors.text else TangerineColors.textDim,
                    )
                    if (song.artist.isNotBlank()) {
                        Text(
                            song.artist,
                            fontFamily = Karla, fontSize = 11.sp, color = TangerineColors.textMuted,
                        )
                    }
                }
                Text(
                    "${song.bpm.toInt()}",
                    fontFamily = JetBrainsMono, fontSize = 12.sp,
                    color = if (isCurrent) TangerineColors.orange else TangerineColors.textMuted,
                )
                if (isCurrent) {
                    Spacer(Modifier.width(6.dp))
                    Text(
                        "NOW",
                        fontFamily = JetBrainsMono, fontSize = 8.sp, letterSpacing = 1.sp,
                        style = TextStyle(color = TangerineColors.teal, shadow = Shadow(TangerineColors.teal.copy(0.3f), Offset.Zero, 6f)),
                    )
                }
            }
            if (!isCurrent) {
                androidx.compose.material3.HorizontalDivider(
                    color = TangerineColors.textMuted.copy(alpha = 0.1f),
                    modifier = Modifier.padding(horizontal = 4.dp),
                )
            }
        }
    }
}

@Composable
private fun TagToggle(label: String, isOn: Boolean, color: Color, onToggle: (Boolean) -> Unit) {
    val bg = if (isOn) color.copy(alpha = 0.15f) else TangerineColors.surface
    val border = if (isOn) color.copy(alpha = 0.4f) else TangerineColors.textMuted.copy(alpha = 0.2f)
    val textColor = if (isOn) color else TangerineColors.textMuted

    Text(
        text = label,
        fontFamily = Karla,
        fontSize = 12.sp,
        fontWeight = FontWeight.SemiBold,
        color = textColor,
        modifier = Modifier
            .background(bg, RoundedCornerShape(16.dp))
            .border(0.5.dp, border, RoundedCornerShape(16.dp))
            .clickable { onToggle(!isOn) }
            .padding(horizontal = 14.dp, vertical = 6.dp),
    )
}

@Composable
private fun SetlistsTabContent(vm: AppViewModel, onDismiss: () -> Unit) {
    val setlists = vm.setlists
    val activeSetlistId = vm.activeSetlist?.setlist?.id

    if (setlists.isEmpty()) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("No setlists loaded", fontFamily = Karla, fontSize = 13.sp, color = TangerineColors.textMuted)
        }
        return
    }

    Text("${setlists.size} setlists", fontFamily = Karla, fontSize = 12.sp, color = TangerineColors.textMuted)
    Spacer(Modifier.height(8.dp))

    LazyColumn(modifier = Modifier.fillMaxSize()) {
        itemsIndexed(setlists, key = { _, sl -> sl.setlist.id }) { _, sl ->
            val isCurrent = sl.setlist.id == activeSetlistId

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .then(
                        if (isCurrent) Modifier
                            .background(TangerineColors.teal.copy(alpha = 0.06f), RoundedCornerShape(8.dp))
                            .border(0.5.dp, TangerineColors.teal.copy(alpha = 0.25f), RoundedCornerShape(8.dp))
                        else Modifier
                    )
                    .clickable {
                        vm.selectSetlist(sl)
                        onDismiss()
                    }
                    .padding(horizontal = 12.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        sl.setlist.name,
                        fontFamily = Karla,
                        fontWeight = if (isCurrent) FontWeight.Bold else FontWeight.Medium,
                        fontSize = 14.sp,
                        color = if (isCurrent) TangerineColors.text else TangerineColors.textDim,
                    )
                    Text(
                        "${sl.songCount} songs",
                        fontFamily = Karla, fontSize = 11.sp, color = TangerineColors.textMuted,
                    )
                }
                if (isCurrent) {
                    Text(
                        "ACTIVE",
                        fontFamily = JetBrainsMono, fontSize = 8.sp, letterSpacing = 1.sp,
                        style = TextStyle(color = TangerineColors.teal, shadow = Shadow(TangerineColors.teal.copy(0.3f), Offset.Zero, 6f)),
                    )
                }
            }
            if (!isCurrent) {
                androidx.compose.material3.HorizontalDivider(
                    color = TangerineColors.textMuted.copy(alpha = 0.1f),
                    modifier = Modifier.padding(horizontal = 4.dp),
                )
            }
        }
    }
}

// ─── Set Complete Screen ─────────────────────────────────────────────────────────

@Composable
private fun SetCompleteScreen(
    setlistName: String,
    songCount: Int,
    onRestart: () -> Unit,
    onGoToLibrary: () -> Unit,
) {
    Box(
        modifier = Modifier.fillMaxSize().background(TangerineColors.background),
        contentAlignment = Alignment.Center,
    ) {
        NeuWell(modifier = Modifier.padding(32.dp)) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(8.dp),
            ) {
                Icon(
                    Icons.Default.Celebration,
                    contentDescription = null,
                    tint = TangerineColors.orange,
                    modifier = Modifier.size(48.dp),
                )
                Spacer(Modifier.height(16.dp))
                Text(
                    "Set Complete!",
                    fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 22.sp,
                    style = TextStyle(
                        color = TangerineColors.orange,
                        shadow = Shadow(TangerineColors.orange.copy(0.5f), Offset.Zero, 16f),
                    ),
                    textAlign = TextAlign.Center,
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    setlistName,
                    fontFamily = Karla, fontWeight = FontWeight.SemiBold, fontSize = 16.sp,
                    color = TangerineColors.text, textAlign = TextAlign.Center,
                )
                Text(
                    "$songCount songs performed",
                    fontFamily = Karla, fontSize = 13.sp,
                    color = TangerineColors.textDim, textAlign = TextAlign.Center,
                )

                Spacer(Modifier.height(24.dp))

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(44.dp)
                        .background(TangerineColors.green.copy(alpha = 0.1f), RoundedCornerShape(10.dp))
                        .border(0.5.dp, TangerineColors.green.copy(alpha = 0.3f), RoundedCornerShape(10.dp))
                        .clickable(onClick = onRestart),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        "Restart Set",
                        fontFamily = Karla, fontWeight = FontWeight.SemiBold, fontSize = 14.sp,
                        style = TextStyle(color = TangerineColors.green, shadow = Shadow(TangerineColors.green.copy(0.35f), Offset.Zero, 8f)),
                    )
                }

                Spacer(Modifier.height(10.dp))

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(44.dp)
                        .background(TangerineColors.teal.copy(alpha = 0.08f), RoundedCornerShape(10.dp))
                        .border(0.5.dp, TangerineColors.teal.copy(alpha = 0.25f), RoundedCornerShape(10.dp))
                        .clickable(onClick = onGoToLibrary),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        "Back to Library",
                        fontFamily = Karla, fontWeight = FontWeight.SemiBold, fontSize = 14.sp,
                        style = TextStyle(color = TangerineColors.teal, shadow = Shadow(TangerineColors.teal.copy(0.35f), Offset.Zero, 8f)),
                    )
                }
            }
        }
    }
}

// ─── Speed Safety Modal ──────────────────────────────────────────────────────────

@Composable
private fun SpeedSafetyModal(
    delta: Float,
    currentBpm: Float,
    onConfirm: () -> Unit,
    onCancel: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.7f))
            .clickable(onClick = onCancel),
        contentAlignment = Alignment.Center,
    ) {
        NeuCard(
            modifier = Modifier
                .padding(32.dp)
                .clickable(enabled = false, onClick = {}),
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(8.dp),
            ) {
                Text(
                    "Speed Change",
                    fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 16.sp,
                    style = TextStyle(color = TangerineColors.orange, shadow = Shadow(TangerineColors.orange.copy(0.4f), Offset.Zero, 10f)),
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    "Change BPM by ${if (delta > 0) "+" else ""}${delta.toInt()} while playing?",
                    fontFamily = Karla, fontSize = 13.sp,
                    color = TangerineColors.textDim, textAlign = TextAlign.Center,
                )
                Text(
                    "${currentBpm.toInt()} \u2192 ${(currentBpm + delta).toInt()} BPM",
                    fontFamily = JetBrainsMono, fontSize = 14.sp,
                    color = TangerineColors.text,
                )
                Spacer(Modifier.height(16.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Box(
                        modifier = Modifier
                            .weight(1f).height(40.dp)
                            .background(TangerineColors.textMuted.copy(alpha = 0.08f), RoundedCornerShape(8.dp))
                            .border(0.5.dp, TangerineColors.textMuted.copy(alpha = 0.2f), RoundedCornerShape(8.dp))
                            .clickable(onClick = onCancel),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text("Cancel", fontFamily = Karla, fontSize = 13.sp, color = TangerineColors.textDim)
                    }
                    Box(
                        modifier = Modifier
                            .weight(1f).height(40.dp)
                            .background(TangerineColors.orange.copy(alpha = 0.12f), RoundedCornerShape(8.dp))
                            .border(0.5.dp, TangerineColors.orange.copy(alpha = 0.35f), RoundedCornerShape(8.dp))
                            .clickable(onClick = onConfirm),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            "Confirm",
                            fontFamily = Karla, fontWeight = FontWeight.SemiBold, fontSize = 13.sp,
                            style = TextStyle(color = TangerineColors.orange, shadow = Shadow(TangerineColors.orange.copy(0.3f), Offset.Zero, 6f)),
                        )
                    }
                }
            }
        }
    }
}

// ─── No song placeholder ────────────────────────────────────────────────────────

@Composable
fun NoSongPlaceholder(accent: Color, screenName: String, onGoToLibrary: () -> Unit) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        NeuWell(modifier = Modifier.padding(32.dp)) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = screenName,
                    fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 18.sp,
                    style = TextStyle(color = accent, shadow = Shadow(accent.copy(alpha = 0.4f), Offset.Zero, 12f)),
                    textAlign = TextAlign.Center,
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    "No song selected. Go to Library to pick a song.",
                    fontFamily = Karla, fontSize = 13.sp,
                    color = TangerineColors.textDim, textAlign = TextAlign.Center,
                )
                Spacer(Modifier.height(16.dp))
                Box(
                    modifier = Modifier
                        .background(accent.copy(alpha = 0.1f), RoundedCornerShape(10.dp))
                        .border(0.5.dp, accent.copy(alpha = 0.3f), RoundedCornerShape(10.dp))
                        .clickable { onGoToLibrary() }
                        .padding(horizontal = 20.dp, vertical = 10.dp),
                ) {
                    Text(
                        "Go to Library",
                        fontFamily = Karla, fontWeight = FontWeight.SemiBold, fontSize = 13.sp,
                        style = TextStyle(color = accent, shadow = Shadow(accent.copy(alpha = 0.4f), Offset.Zero, 8f)),
                    )
                }
            }
        }
    }
}

// ─── Shared small chip ───────────────────────────────────────────────────────────

// ─── Camera drawer section ──────────────────────────────────────────────────────

@Composable
private fun CameraDrawerSection(vm: AppViewModel, onNavigateToCamera: () -> Unit) {
    val connectionState by vm.phoneCompanion.state.collectAsState()
    val isRecording by vm.cameraRecording.isRecording.collectAsState()

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(TangerineColors.surface, RoundedCornerShape(8.dp))
            .border(0.5.dp, Color.White.copy(alpha = 0.06f), RoundedCornerShape(8.dp))
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Status dot
        val dotColor = when (connectionState) {
            ConnectionState.Connected -> TangerineColors.green
            ConnectionState.Recording -> Color.Red
            ConnectionState.Connecting, ConnectionState.Pairing -> TangerineColors.orange
            ConnectionState.Disconnected, ConnectionState.Error -> TangerineColors.textMuted
        }
        Box(Modifier.size(8.dp).clip(CircleShape).background(dotColor))
        Spacer(Modifier.width(8.dp))

        Column(modifier = Modifier.weight(1f)) {
            val statusText = when (connectionState) {
                ConnectionState.Connected -> "Camera Connected"
                ConnectionState.Recording -> if (isRecording) "Recording" else "Camera Connected"
                ConnectionState.Connecting -> "Connecting..."
                ConnectionState.Pairing -> "Pairing..."
                ConnectionState.Error -> "Connection Error"
                ConnectionState.Disconnected -> "Camera Not Connected"
            }
            Text(statusText, fontFamily = Karla, fontSize = 13.sp, color = TangerineColors.text)
        }

        if (connectionState == ConnectionState.Disconnected || connectionState == ConnectionState.Error) {
            Box(
                modifier = Modifier
                    .background(TangerineColors.orange.copy(alpha = 0.1f), RoundedCornerShape(6.dp))
                    .border(0.5.dp, TangerineColors.orange.copy(alpha = 0.3f), RoundedCornerShape(6.dp))
                    .clickable(onClick = onNavigateToCamera)
                    .padding(horizontal = 10.dp, vertical = 5.dp),
            ) {
                Text("Connect", fontFamily = Karla, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = TangerineColors.orange)
            }
        } else if (connectionState == ConnectionState.Connected || connectionState == ConnectionState.Recording) {
            Box(
                modifier = Modifier
                    .background(Color.Red.copy(alpha = 0.08f), RoundedCornerShape(6.dp))
                    .border(0.5.dp, Color.Red.copy(alpha = 0.25f), RoundedCornerShape(6.dp))
                    .clickable(onClick = { vm.disconnectCamera() })
                    .padding(horizontal = 10.dp, vertical = 5.dp),
            ) {
                Text("Disconnect", fontFamily = Karla, fontSize = 11.sp, color = Color.Red.copy(alpha = 0.8f))
            }
        }
    }
}

// ─── Shared small chip ───────────────────────────────────────────────────────────

@Composable
fun LiveChip(text: String, color: Color) {
    Box(
        modifier = Modifier
            .background(color.copy(alpha = 0.1f), RoundedCornerShape(4.dp))
            .border(0.5.dp, color.copy(alpha = 0.3f), RoundedCornerShape(4.dp))
            .padding(horizontal = 5.dp, vertical = 2.dp),
    ) {
        Text(text, fontFamily = JetBrainsMono, fontSize = 10.sp, color = color)
    }
}

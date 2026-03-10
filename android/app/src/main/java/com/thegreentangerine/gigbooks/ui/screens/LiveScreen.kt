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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Celebration
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
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
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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
import com.thegreentangerine.gigbooks.ui.components.LiveTransport
import com.thegreentangerine.gigbooks.ui.components.NeuCard
import com.thegreentangerine.gigbooks.ui.components.NeuWell
import com.thegreentangerine.gigbooks.ui.components.PlayerHeader
import com.thegreentangerine.gigbooks.ui.components.PlayerNavRow
import com.thegreentangerine.gigbooks.ui.components.SettingsPills
import com.thegreentangerine.gigbooks.ui.components.TextPanel
import com.thegreentangerine.gigbooks.ui.components.TextPanelToggles
import com.thegreentangerine.gigbooks.ui.components.VisualHero
import com.thegreentangerine.gigbooks.ui.theme.GigColors
import com.thegreentangerine.gigbooks.ui.theme.JetBrainsMono
import com.thegreentangerine.gigbooks.ui.theme.Karla
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LiveScreen(vm: AppViewModel, onMenuClick: () -> Unit, onGoToLibrary: () -> Unit) {
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

    // Bottom sheet
    val sheetState = rememberModalBottomSheetState()
    var showSheet by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    // Set complete overlay
    if (vm.isSetComplete && vm.activeSetlist != null) {
        SetCompleteScreen(
            setlistName = vm.activeSetlist!!.setlist.name,
            songCount = vm.activeSetlist!!.songs.size,
            onRestart = { vm.restartSetlist() },
            onGoToLibrary = { vm.dismissSetComplete(); onGoToLibrary() },
        )
        return
    }

    Box(Modifier.fillMaxSize()) {
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
                    accent = GigColors.green,
                    screenName = "Live Mode",
                    onGoToLibrary = onGoToLibrary,
                )
            } else {
                val setlist = vm.activeSetlist
                val setlistPos = if (setlist != null) "${vm.activeSetlistIdx + 1} of ${setlist.songs.size}" else null

                // V4 Header
                PlayerHeader(
                    songName = song.name,
                    songArtist = song.artist,
                    bpm = vm.effectiveBpm.toInt(),
                    isLiveMode = true,
                    setlistName = setlist?.setlist?.name,
                    setlistPosition = setlistPos,
                    onBackClick = onMenuClick,
                )

                // Scrollable content area
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState()),
                ) {
                    // Visual Hero
                    if (showVisuals) {
                        VisualHero(
                            heroHeight = 160.dp,
                            isPlaying = vm.isClickPlaying,
                            currentBeat = vm.currentBeat,
                            accent = GigColors.green,
                        )
                    }

                    // Text Panel (scrollable lyrics/chords/notes/drums)
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
                }

                // Transport
                LiveTransport(
                    isPlaying = vm.isClickPlaying,
                    onPlayStop = { vm.toggleClick() },
                    onStop = { vm.toggleClick() },
                    onClickToggle = { vm.toggleClickMute() },
                    isClickMuted = vm.isClickMuted,
                    enabled = vm.engineAvailable,
                )

                // Nav Row (prev/next song)
                if (setlist != null) {
                    val prevName = if (vm.activeSetlistIdx > 0) {
                        setlist.songs.getOrNull(vm.activeSetlistIdx - 1)?.songs?.name
                    } else null
                    val nextName = if (vm.activeSetlistIdx < setlist.songs.size - 1) {
                        setlist.songs.getOrNull(vm.activeSetlistIdx + 1)?.songs?.name
                    } else null

                    PlayerNavRow(
                        prevSongName = prevName,
                        nextSongName = nextName,
                        queueLabel = "${vm.activeSetlistIdx + 1}/${setlist.songs.size}",
                        onPrev = { vm.prevSong() },
                        onNext = { vm.nextSong() },
                        onQueue = { showQueue = true },
                    )
                }

                // Drawer preview (pull-up handle + display toggles)
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
                        .clickable {
                            showSheet = true
                        }
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

        // Bottom sheet drawer (full settings)
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

        // Queue overlay
        if (showQueue && vm.activeSetlist != null) {
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

// ─── Queue Overlay ──────────────────────────────────────────────────────────────

@Composable
private fun QueueOverlay(vm: AppViewModel, onDismiss: () -> Unit) {
    val setlist = vm.activeSetlist ?: return
    val currentIdx = vm.activeSetlistIdx

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(GigColors.background.copy(alpha = 0.92f))
            .clickable(onClick = onDismiss),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .clickable(enabled = false, onClick = {})
                .padding(top = 60.dp, start = 16.dp, end = 16.dp, bottom = 16.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "Queue",
                    fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 18.sp,
                    style = TextStyle(color = GigColors.teal, shadow = Shadow(GigColors.teal.copy(0.4f), Offset.Zero, 12f)),
                    modifier = Modifier.weight(1f),
                )
                Text(
                    setlist.setlist.name,
                    fontFamily = Karla, fontSize = 12.sp, color = GigColors.textMuted,
                )
                Spacer(Modifier.width(8.dp))
                IconButton(onClick = onDismiss, modifier = Modifier.size(32.dp)) {
                    Icon(Icons.Default.Close, contentDescription = "Close", tint = GigColors.textDim, modifier = Modifier.size(20.dp))
                }
            }

            Spacer(Modifier.height(12.dp))

            LazyColumn(modifier = Modifier.fillMaxSize()) {
                itemsIndexed(setlist.songs, key = { _, row -> row.id }) { idx, row ->
                    val isCurrent = idx == currentIdx
                    val isPlayed = idx < currentIdx
                    val song = row.songs

                    NeuCard(
                        modifier = Modifier
                            .padding(vertical = 3.dp)
                            .then(
                                if (isCurrent) Modifier.border(1.dp, GigColors.green.copy(alpha = 0.4f), RoundedCornerShape(12.dp))
                                else Modifier
                            )
                            .clickable { vm.jumpToSong(idx); onDismiss() },
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                "${idx + 1}",
                                fontFamily = JetBrainsMono, fontSize = 13.sp,
                                color = when {
                                    isCurrent -> GigColors.green
                                    isPlayed -> GigColors.textMuted
                                    else -> GigColors.textDim
                                },
                                modifier = Modifier.width(24.dp),
                            )

                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    song?.name ?: "",
                                    fontFamily = Karla,
                                    fontWeight = if (isCurrent) FontWeight.Bold else FontWeight.Medium,
                                    fontSize = 14.sp,
                                    color = when {
                                        isCurrent -> GigColors.text
                                        isPlayed -> GigColors.textMuted
                                        else -> GigColors.textDim
                                    },
                                )
                                if (song != null && song.artist.isNotBlank()) {
                                    Text(
                                        song.artist,
                                        fontFamily = Karla, fontSize = 11.sp,
                                        color = if (isPlayed) GigColors.textMuted.copy(alpha = 0.5f) else GigColors.textMuted,
                                    )
                                }
                            }

                            Text(
                                "${song?.bpm?.toInt() ?: ""}",
                                fontFamily = JetBrainsMono, fontSize = 12.sp,
                                color = if (isCurrent) GigColors.orange else GigColors.textMuted,
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
                                        tint = if (idx > 0) GigColors.textDim else GigColors.textMuted.copy(alpha = 0.3f),
                                        modifier = Modifier.size(16.dp),
                                    )
                                }
                                IconButton(
                                    onClick = { vm.reorderSetlistSong(idx, idx + 1) },
                                    enabled = idx < setlist.songs.size - 1,
                                    modifier = Modifier.size(24.dp),
                                ) {
                                    Icon(
                                        Icons.Default.KeyboardArrowDown,
                                        contentDescription = "Move down",
                                        tint = if (idx < setlist.songs.size - 1) GigColors.textDim else GigColors.textMuted.copy(alpha = 0.3f),
                                        modifier = Modifier.size(16.dp),
                                    )
                                }
                            }
                        }

                        if (isCurrent) {
                            Text(
                                "NOW PLAYING",
                                fontFamily = JetBrainsMono, fontSize = 9.sp, letterSpacing = 1.sp,
                                style = TextStyle(color = GigColors.green, shadow = Shadow(GigColors.green.copy(0.4f), Offset.Zero, 6f)),
                                modifier = Modifier.padding(top = 4.dp),
                            )
                        }
                    }
                }
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
        modifier = Modifier.fillMaxSize().background(GigColors.background),
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
                    tint = GigColors.orange,
                    modifier = Modifier.size(48.dp),
                )
                Spacer(Modifier.height(16.dp))
                Text(
                    "Set Complete!",
                    fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 22.sp,
                    style = TextStyle(
                        color = GigColors.orange,
                        shadow = Shadow(GigColors.orange.copy(0.5f), Offset.Zero, 16f),
                    ),
                    textAlign = TextAlign.Center,
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    setlistName,
                    fontFamily = Karla, fontWeight = FontWeight.SemiBold, fontSize = 16.sp,
                    color = GigColors.text, textAlign = TextAlign.Center,
                )
                Text(
                    "$songCount songs performed",
                    fontFamily = Karla, fontSize = 13.sp,
                    color = GigColors.textDim, textAlign = TextAlign.Center,
                )

                Spacer(Modifier.height(24.dp))

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(44.dp)
                        .background(GigColors.green.copy(alpha = 0.1f), RoundedCornerShape(10.dp))
                        .border(0.5.dp, GigColors.green.copy(alpha = 0.3f), RoundedCornerShape(10.dp))
                        .clickable(onClick = onRestart),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        "Restart Set",
                        fontFamily = Karla, fontWeight = FontWeight.SemiBold, fontSize = 14.sp,
                        style = TextStyle(color = GigColors.green, shadow = Shadow(GigColors.green.copy(0.35f), Offset.Zero, 8f)),
                    )
                }

                Spacer(Modifier.height(10.dp))

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(44.dp)
                        .background(GigColors.teal.copy(alpha = 0.08f), RoundedCornerShape(10.dp))
                        .border(0.5.dp, GigColors.teal.copy(alpha = 0.25f), RoundedCornerShape(10.dp))
                        .clickable(onClick = onGoToLibrary),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        "Back to Library",
                        fontFamily = Karla, fontWeight = FontWeight.SemiBold, fontSize = 14.sp,
                        style = TextStyle(color = GigColors.teal, shadow = Shadow(GigColors.teal.copy(0.35f), Offset.Zero, 8f)),
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
                    style = TextStyle(color = GigColors.orange, shadow = Shadow(GigColors.orange.copy(0.4f), Offset.Zero, 10f)),
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    "Change BPM by ${if (delta > 0) "+" else ""}${delta.toInt()} while playing?",
                    fontFamily = Karla, fontSize = 13.sp,
                    color = GigColors.textDim, textAlign = TextAlign.Center,
                )
                Text(
                    "${currentBpm.toInt()} \u2192 ${(currentBpm + delta).toInt()} BPM",
                    fontFamily = JetBrainsMono, fontSize = 14.sp,
                    color = GigColors.text,
                )
                Spacer(Modifier.height(16.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Box(
                        modifier = Modifier
                            .weight(1f).height(40.dp)
                            .background(GigColors.textMuted.copy(alpha = 0.08f), RoundedCornerShape(8.dp))
                            .border(0.5.dp, GigColors.textMuted.copy(alpha = 0.2f), RoundedCornerShape(8.dp))
                            .clickable(onClick = onCancel),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text("Cancel", fontFamily = Karla, fontSize = 13.sp, color = GigColors.textDim)
                    }
                    Box(
                        modifier = Modifier
                            .weight(1f).height(40.dp)
                            .background(GigColors.orange.copy(alpha = 0.12f), RoundedCornerShape(8.dp))
                            .border(0.5.dp, GigColors.orange.copy(alpha = 0.35f), RoundedCornerShape(8.dp))
                            .clickable(onClick = onConfirm),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            "Confirm",
                            fontFamily = Karla, fontWeight = FontWeight.SemiBold, fontSize = 13.sp,
                            style = TextStyle(color = GigColors.orange, shadow = Shadow(GigColors.orange.copy(0.3f), Offset.Zero, 6f)),
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
                    color = GigColors.textDim, textAlign = TextAlign.Center,
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

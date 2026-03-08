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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
import com.thegreentangerine.gigbooks.ui.components.BeatDisplay
import com.thegreentangerine.gigbooks.ui.components.NeuCard
import com.thegreentangerine.gigbooks.ui.components.NeuWell
import com.thegreentangerine.gigbooks.ui.components.PlayStopButton
import com.thegreentangerine.gigbooks.ui.theme.GigColors
import com.thegreentangerine.gigbooks.ui.theme.JetBrainsMono
import com.thegreentangerine.gigbooks.ui.theme.Karla

@Composable
fun LiveScreen(vm: AppViewModel, onMenuClick: () -> Unit, onGoToLibrary: () -> Unit) {
    val song = vm.selectedSong

    Column(Modifier.fillMaxSize().background(GigColors.background)) {
        LiveHeader(onMenuClick)

        if (song == null) {
            NoSongPlaceholder(
                accent     = GigColors.green,
                screenName = "Live Mode",
                onGoToLibrary = onGoToLibrary,
            )
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Spacer(Modifier.height(4.dp))

                // Song info + setlist nav
                LiveSongCard(vm)

                // Beat display
                NeuCard {
                    BeatDisplay(
                        beatsPerBar = song.timeSignatureTop.toInt(),
                        currentBeat = vm.currentBeat,
                        currentBar  = vm.currentBar,
                        isPlaying   = vm.isClickPlaying,
                        accent      = GigColors.green,
                        modifier    = Modifier.padding(vertical = 14.dp),
                    )
                }

                // Play/Stop
                PlayStopButton(
                    isPlaying = vm.isClickPlaying,
                    accent    = GigColors.green,
                    onClick   = { vm.toggleClick() },
                    enabled   = vm.engineAvailable,
                )

                if (!vm.engineAvailable) {
                    Text(
                        "Audio engine unavailable on this device",
                        fontFamily = Karla, fontSize = 12.sp,
                        color = GigColors.danger, textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }

                // BPM control
                LiveBpmCard(vm)

                // Count-in
                CountInCard(vm)

                Spacer(Modifier.height(20.dp))
            }
        }
    }
}

// ─── Header ──────────────────────────────────────────────────────────────────

@Composable
private fun LiveHeader(onMenuClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(GigColors.surface)
            .padding(top = 48.dp, start = 8.dp, end = 16.dp, bottom = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconButton(onClick = onMenuClick) {
            Icon(Icons.Default.Menu, contentDescription = "Menu", tint = GigColors.textDim, modifier = Modifier.size(22.dp))
        }
        Text(
            text = "Live Mode",
            fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 18.sp,
            style = TextStyle(color = GigColors.green, shadow = Shadow(GigColors.green.copy(alpha = 0.45f), Offset.Zero, 14f)),
        )
    }
}

// ─── Song card ───────────────────────────────────────────────────────────────

@Composable
private fun LiveSongCard(vm: AppViewModel) {
    val song    = vm.selectedSong ?: return
    val setlist = vm.activeSetlist

    NeuCard {
        if (setlist != null) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(
                    onClick = { vm.prevSong() },
                    enabled = vm.activeSetlistIdx > 0,
                ) {
                    Icon(
                        Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Previous",
                        tint = if (vm.activeSetlistIdx > 0) GigColors.green else GigColors.textMuted,
                        modifier = Modifier.size(20.dp),
                    )
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = setlist.setlist.name,
                        fontFamily = Karla, fontSize = 10.sp, color = GigColors.textMuted, letterSpacing = 0.5.sp,
                    )
                    Text(
                        text = "${vm.activeSetlistIdx + 1} / ${setlist.songs.size}",
                        fontFamily = JetBrainsMono, fontSize = 11.sp, color = GigColors.textDim,
                    )
                }
                IconButton(
                    onClick = { vm.nextSong() },
                    enabled = vm.activeSetlistIdx < setlist.songs.size - 1,
                ) {
                    Icon(
                        Icons.AutoMirrored.Filled.ArrowForward,
                        contentDescription = "Next",
                        tint = if (vm.activeSetlistIdx < setlist.songs.size - 1) GigColors.green else GigColors.textMuted,
                        modifier = Modifier.size(20.dp),
                    )
                }
            }
            HorizontalDivider(color = GigColors.textMuted.copy(alpha = 0.1f), modifier = Modifier.padding(vertical = 6.dp))
        }

        Text(
            text = song.name,
            fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 22.sp,
            style = TextStyle(color = GigColors.text, shadow = Shadow(GigColors.text.copy(alpha = 0.1f), Offset.Zero, 4f)),
        )
        if (song.artist.isNotBlank()) {
            Text(text = song.artist, fontFamily = Karla, fontSize = 13.sp, color = GigColors.textDim)
        }
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            LiveChip(text = "${song.bpm.toInt()} BPM", color = GigColors.orange)
            if (song.key.isNotBlank()) LiveChip(text = song.key, color = GigColors.teal)
            LiveChip(text = song.timeSig, color = GigColors.textMuted)
        }
    }
}

// ─── BPM control ─────────────────────────────────────────────────────────────

@Composable
private fun LiveBpmCard(vm: AppViewModel) {
    val song = vm.selectedSong ?: return
    val isModified = vm.bpmOffset != 0f

    NeuCard {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = "BPM",
                fontFamily = Karla, fontWeight = FontWeight.SemiBold, fontSize = 13.sp,
                color = GigColors.textDim, modifier = Modifier.weight(1f),
            )
            Text(
                text = "${vm.effectiveBpm.toInt()}",
                fontFamily = JetBrainsMono, fontSize = 28.sp,
                style = TextStyle(
                    color      = if (isModified) GigColors.orange else GigColors.text,
                    shadow     = if (isModified) Shadow(GigColors.orange.copy(alpha = 0.5f), Offset.Zero, 12f) else null,
                ),
            )
            if (isModified) {
                Text(
                    text  = " (${song.bpm.toInt()})",
                    fontFamily = JetBrainsMono, fontSize = 12.sp, color = GigColors.textMuted,
                )
            }
        }
        Spacer(Modifier.height(10.dp))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            BpmButton("−5",  GigColors.danger.copy(alpha = 0.7f),  Modifier.weight(1f)) { vm.adjustBpm(-5f) }
            BpmButton("−1",  GigColors.textDim,                    Modifier.weight(1f)) { vm.adjustBpm(-1f) }
            BpmButton("RESET", if (isModified) GigColors.orange else GigColors.textMuted,
                Modifier.weight(1.5f), enabled = isModified)                              { vm.resetBpmOffset() }
            BpmButton("+1",  GigColors.textDim,                    Modifier.weight(1f)) { vm.adjustBpm(+1f) }
            BpmButton("+5",  GigColors.green.copy(alpha = 0.7f),   Modifier.weight(1f)) { vm.adjustBpm(+5f) }
        }
    }
}

@Composable
private fun BpmButton(label: String, color: Color, modifier: Modifier, enabled: Boolean = true, onClick: () -> Unit) {
    Box(
        modifier = modifier
            .height(36.dp)
            .background(color.copy(alpha = if (enabled) 0.08f else 0.03f), RoundedCornerShape(8.dp))
            .border(0.5.dp, color.copy(alpha = if (enabled) 0.25f else 0.1f), RoundedCornerShape(8.dp))
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, fontFamily = JetBrainsMono, fontSize = 11.sp, color = if (enabled) color else GigColors.textMuted)
    }
}

// ─── Count-in ────────────────────────────────────────────────────────────────

@Composable
private fun CountInCard(vm: AppViewModel) {
    NeuCard {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = "Count-in",
                fontFamily = Karla, fontWeight = FontWeight.SemiBold, fontSize = 13.sp,
                color = GigColors.textDim, modifier = Modifier.weight(1f),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf(0 to "OFF", 1 to "1 bar", 2 to "2 bars").forEach { (n, label) ->
                    val selected = vm.countInBars == n
                    Box(
                        modifier = Modifier
                            .background(
                                if (selected) GigColors.green.copy(alpha = 0.15f) else Color.Transparent,
                                RoundedCornerShape(8.dp),
                            )
                            .border(
                                0.5.dp,
                                if (selected) GigColors.green.copy(alpha = 0.4f) else GigColors.textMuted.copy(alpha = 0.2f),
                                RoundedCornerShape(8.dp),
                            )
                            .clickable { vm.setCountIn(n) }
                            .padding(horizontal = 10.dp, vertical = 6.dp),
                    ) {
                        Text(
                            label, fontFamily = Karla, fontSize = 12.sp,
                            style = TextStyle(
                                color  = if (selected) GigColors.green else GigColors.textMuted,
                                shadow = if (selected) Shadow(GigColors.green.copy(alpha = 0.4f), Offset.Zero, 6f) else null,
                            ),
                        )
                    }
                }
            }
        }
    }
}

// ─── No song placeholder ──────────────────────────────────────────────────────

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

// ─── Shared small chip ────────────────────────────────────────────────────────

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

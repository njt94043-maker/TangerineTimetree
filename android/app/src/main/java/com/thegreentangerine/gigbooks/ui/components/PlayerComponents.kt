package com.thegreentangerine.gigbooks.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.SkipPrevious
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.thegreentangerine.gigbooks.ui.theme.GigColors
import com.thegreentangerine.gigbooks.ui.theme.JetBrainsMono
import com.thegreentangerine.gigbooks.ui.theme.Karla

// ─── V4 Player Header ──────────────────────────────────────────────────────────

@Composable
fun PlayerHeader(
    songName: String,
    songArtist: String,
    bpm: Int,
    isLiveMode: Boolean,
    setlistName: String? = null,
    setlistPosition: String? = null,
    onBackClick: () -> Unit,
) {
    val accent = if (isLiveMode) GigColors.green else GigColors.purple
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(GigColors.background)
            .padding(top = 48.dp, start = 8.dp, end = 14.dp, bottom = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Back / menu button
        IconButton(onClick = onBackClick, modifier = Modifier.size(36.dp)) {
            Icon(
                if (isLiveMode) Icons.AutoMirrored.Filled.ArrowBack else Icons.Default.Menu,
                contentDescription = if (isLiveMode) "Back" else "Menu",
                tint = GigColors.textDim,
                modifier = Modifier.size(20.dp),
            )
        }

        // Song info (center)
        Column(
            modifier = Modifier.weight(1f).padding(horizontal = 6.dp),
        ) {
            Text(
                text = songName,
                fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 15.sp,
                color = GigColors.text,
                maxLines = 1, overflow = TextOverflow.Ellipsis,
            )
            if (songArtist.isNotBlank()) {
                Text(
                    text = songArtist,
                    fontFamily = Karla, fontSize = 11.sp, color = GigColors.textDim,
                    maxLines = 1, overflow = TextOverflow.Ellipsis,
                )
            }
            if (setlistPosition != null && setlistName != null) {
                Text(
                    text = "$setlistPosition — $setlistName",
                    fontFamily = Karla, fontSize = 9.sp, color = GigColors.textMuted,
                    maxLines = 1, overflow = TextOverflow.Ellipsis,
                )
            }
        }

        // Mode badge + BPM block
        Column(horizontalAlignment = Alignment.End) {
            ModeBadge(isLive = isLiveMode)
            Text(
                text = "$bpm",
                fontFamily = JetBrainsMono, fontWeight = FontWeight.Bold, fontSize = 24.sp,
                color = GigColors.green,
                style = TextStyle(shadow = Shadow(GigColors.green.copy(alpha = 0.3f), Offset.Zero, 12f)),
                lineHeight = 26.sp,
            )
            Text(
                text = "BPM",
                fontFamily = JetBrainsMono, fontSize = 8.sp, letterSpacing = 1.sp,
                color = GigColors.green.copy(alpha = 0.4f),
            )
        }
    }
}

@Composable
fun ModeBadge(isLive: Boolean) {
    val color = if (isLive) GigColors.green else GigColors.purple
    val label = if (isLive) "LIVE" else "PRACTICE"
    Box(
        modifier = Modifier
            .background(color.copy(alpha = 0.05f), RoundedCornerShape(5.dp))
            .border(1.dp, color.copy(alpha = 0.2f), RoundedCornerShape(5.dp))
            .padding(horizontal = 7.dp, vertical = 2.dp),
    ) {
        Text(
            text = label,
            fontFamily = JetBrainsMono, fontWeight = FontWeight.Bold, fontSize = 7.sp,
            letterSpacing = 2.sp, color = color,
        )
    }
}

// ─── V4 Visual Hero ─────────────────────────────────────────────────────────────

@Composable
fun VisualHero(
    heroHeight: Dp = 160.dp,
    isPlaying: Boolean,
    currentBeat: Int,
    accent: Color,
    modifier: Modifier = Modifier,
) {
    val beatGlowAlpha = remember { Animatable(0f) }
    LaunchedEffect(currentBeat, isPlaying) {
        if (isPlaying && currentBeat > 0) {
            beatGlowAlpha.snapTo(0.7f)
            beatGlowAlpha.animateTo(0f, animationSpec = tween(200))
        }
    }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp, vertical = 5.dp)
            .height(heroHeight)
            .clip(RoundedCornerShape(12.dp))
            .background(GigColors.surfaceInset)
            .border(1.dp, Color.White.copy(alpha = 0.03f), RoundedCornerShape(12.dp)),
        contentAlignment = Alignment.Center,
    ) {
        // Placeholder spectrum bars (static visual)
        Row(
            modifier = Modifier.padding(horizontal = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(2.dp),
            verticalAlignment = Alignment.Bottom,
        ) {
            val barHeights = listOf(0.3f, 0.5f, 0.7f, 0.9f, 1.0f, 0.85f, 0.65f, 0.8f, 0.95f, 0.7f, 0.55f, 0.4f, 0.6f, 0.75f, 0.5f, 0.35f)
            barHeights.forEach { h ->
                Box(
                    modifier = Modifier
                        .width(4.dp)
                        .height((h * 50).dp)
                        .clip(RoundedCornerShape(2.dp))
                        .background(
                            Brush.verticalGradient(
                                colors = listOf(accent, accent.copy(alpha = 0.3f)),
                            )
                        ),
                )
            }
        }

        // Vis switcher (top-left)
        Row(
            modifier = Modifier
                .align(Alignment.TopStart)
                .padding(8.dp),
            horizontalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            VisSwitcherButton("Bars", selected = true, accent = accent)
            VisSwitcherButton("Rings", selected = false, accent = accent)
        }

        // Beat glow overlay
        if (beatGlowAlpha.value > 0f) {
            Box(
                modifier = Modifier
                    .matchParentSize()
                    .clip(RoundedCornerShape(12.dp))
                    .background(accent.copy(alpha = beatGlowAlpha.value * 0.15f))
                    .border(
                        1.5.dp,
                        accent.copy(alpha = beatGlowAlpha.value * 0.3f),
                        RoundedCornerShape(12.dp),
                    ),
            )
        }
    }
}

@Composable
private fun VisSwitcherButton(label: String, selected: Boolean, accent: Color) {
    Box(
        modifier = Modifier
            .background(
                if (selected) accent.copy(alpha = 0.06f) else GigColors.surface,
                RoundedCornerShape(8.dp),
            )
            .border(
                1.dp,
                if (selected) accent.copy(alpha = 0.3f) else Color.White.copy(alpha = 0.06f),
                RoundedCornerShape(8.dp),
            )
            .padding(horizontal = 8.dp, vertical = 2.dp),
    ) {
        Text(
            label,
            fontFamily = JetBrainsMono, fontSize = 8.sp,
            color = if (selected) accent else GigColors.textMuted,
        )
    }
}

// ─── V4 Text Panel ──────────────────────────────────────────────────────────────

data class TextPanelToggles(
    val showChords: Boolean = true,
    val showLyrics: Boolean = true,
    val showNotes: Boolean = true,
    val showDrums: Boolean = true,
)

@Composable
fun TextPanel(
    chords: String?,
    lyrics: String?,
    notes: String?,
    drums: String?,
    toggles: TextPanelToggles,
    modifier: Modifier = Modifier,
) {
    val hasContent = (toggles.showChords && !chords.isNullOrBlank()) ||
            (toggles.showLyrics && !lyrics.isNullOrBlank()) ||
            (toggles.showNotes && !notes.isNullOrBlank()) ||
            (toggles.showDrums && !drums.isNullOrBlank())

    if (!hasContent) return

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(GigColors.surfaceInset)
            .border(1.dp, Color.White.copy(alpha = 0.03f), RoundedCornerShape(12.dp))
            .padding(10.dp, 10.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        if (toggles.showChords && !chords.isNullOrBlank()) {
            TextPanelLabel("CHORDS", GigColors.orange)
            Text(
                text = chords,
                fontFamily = JetBrainsMono, fontSize = 12.sp, lineHeight = 19.sp,
                color = GigColors.orange,
            )
        }
        if (toggles.showLyrics && !lyrics.isNullOrBlank()) {
            TextPanelLabel("LYRICS", GigColors.text)
            Text(
                text = lyrics,
                fontFamily = Karla, fontSize = 13.sp, lineHeight = 21.sp,
                color = GigColors.text,
            )
        }
        if (toggles.showNotes && !notes.isNullOrBlank()) {
            TextPanelLabel("NOTES", GigColors.cyan)
            Text(
                text = notes,
                fontFamily = Karla, fontSize = 11.sp, lineHeight = 17.sp,
                color = GigColors.cyan,
                fontStyle = FontStyle.Italic,
            )
        }
        if (toggles.showDrums && !drums.isNullOrBlank()) {
            TextPanelLabel("DRUMS", GigColors.pink)
            Text(
                text = drums,
                fontFamily = JetBrainsMono, fontSize = 10.sp, lineHeight = 16.sp,
                color = GigColors.pink,
            )
        }
    }
}

@Composable
private fun TextPanelLabel(label: String, color: Color) {
    Text(
        text = label,
        fontFamily = JetBrainsMono, fontSize = 8.sp, letterSpacing = 2.sp,
        color = color.copy(alpha = 0.5f),
    )
}

// ─── V4 Transport (Live) ────────────────────────────────────────────────────────

@Composable
fun LiveTransport(
    isPlaying: Boolean,
    onPlayStop: () -> Unit,
    onStop: () -> Unit,
    onClickToggle: () -> Unit,
    isClickMuted: Boolean,
    enabled: Boolean = true,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Stop
        TransportButton(
            icon = "■",
            color = GigColors.danger,
            onClick = onStop,
            size = 36.dp,
        )
        Spacer(Modifier.width(8.dp))
        // Play/Stop (primary)
        PlayButton(
            isPlaying = isPlaying,
            accent = GigColors.green,
            onClick = onPlayStop,
            enabled = enabled,
        )
        Spacer(Modifier.width(8.dp))
        // Click toggle
        ClickToggleButton(
            isClickMuted = isClickMuted,
            onClick = onClickToggle,
        )
    }
}

@Composable
fun PlayButton(
    isPlaying: Boolean,
    accent: Color,
    onClick: () -> Unit,
    enabled: Boolean = true,
) {
    val bgBrush = Brush.linearGradient(
        colors = if (isPlaying) listOf(accent.copy(alpha = 0.12f), accent.copy(alpha = 0.08f))
        else listOf(accent, GigColors.greenDark),
    )
    Box(
        modifier = Modifier
            .size(48.dp)
            .clip(CircleShape)
            .background(bgBrush)
            .then(
                if (isPlaying) Modifier.glowBehind(accent, 32.dp, 0.2f)
                else Modifier
            )
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        if (isPlaying) {
            Text("■", fontSize = 18.sp, color = accent, textAlign = TextAlign.Center)
        } else {
            Icon(
                Icons.Default.PlayArrow,
                contentDescription = "Play",
                tint = GigColors.background,
                modifier = Modifier.size(24.dp),
            )
        }
    }
}

@Composable
fun TransportButton(
    icon: String,
    color: Color,
    onClick: () -> Unit,
    size: Dp = 36.dp,
) {
    Box(
        modifier = Modifier
            .size(size)
            .clip(CircleShape)
            .background(GigColors.surfaceLight)
            .border(1.dp, Color.White.copy(alpha = 0.06f), CircleShape)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(icon, fontSize = 14.sp, color = color, textAlign = TextAlign.Center)
    }
}

@Composable
fun ClickToggleButton(isClickMuted: Boolean, onClick: () -> Unit) {
    val color = GigColors.purple
    Box(
        modifier = Modifier
            .height(32.dp)
            .background(Color.Transparent, RoundedCornerShape(20.dp))
            .border(
                1.dp,
                if (isClickMuted) GigColors.textMuted.copy(alpha = 0.2f) else color.copy(alpha = 0.25f),
                RoundedCornerShape(20.dp),
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = if (isClickMuted) "CLICK OFF" else "CLICK",
            fontFamily = JetBrainsMono, fontWeight = FontWeight.Bold, fontSize = 9.sp,
            color = if (isClickMuted) GigColors.textMuted else color,
        )
    }
}

// ─── V4 Nav Row ─────────────────────────────────────────────────────────────────

@Composable
fun PlayerNavRow(
    prevSongName: String?,
    nextSongName: String?,
    queueLabel: String?,
    onPrev: () -> Unit,
    onNext: () -> Unit,
    onQueue: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Prev song
        NavSongButton(
            label = prevSongName,
            icon = "←",
            onClick = onPrev,
            enabled = prevSongName != null,
        )

        // Queue button
        if (queueLabel != null) {
            Box(
                modifier = Modifier
                    .background(GigColors.surface, RoundedCornerShape(10.dp))
                    .border(1.dp, Color.White.copy(alpha = 0.06f), RoundedCornerShape(10.dp))
                    .clickable(onClick = onQueue)
                    .padding(horizontal = 12.dp, vertical = 4.dp),
            ) {
                Text(
                    text = queueLabel,
                    fontFamily = JetBrainsMono, fontSize = 10.sp,
                    color = GigColors.textMuted,
                )
            }
        }

        // Next song
        NavSongButton(
            label = nextSongName,
            icon = "→",
            onClick = onNext,
            enabled = nextSongName != null,
            isNext = true,
        )
    }
}

@Composable
private fun NavSongButton(
    label: String?,
    icon: String,
    onClick: () -> Unit,
    enabled: Boolean,
    isNext: Boolean = false,
) {
    Box(
        modifier = Modifier
            .background(GigColors.surface, RoundedCornerShape(10.dp))
            .border(1.dp, Color.White.copy(alpha = 0.06f), RoundedCornerShape(10.dp))
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 4.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            if (!isNext) {
                Text(icon, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = if (enabled) GigColors.textDim else GigColors.textMuted)
            }
            Text(
                text = label ?: "—",
                fontFamily = Karla, fontSize = 9.sp,
                color = if (enabled) GigColors.textMuted else GigColors.textMuted.copy(alpha = 0.4f),
                maxLines = 1, overflow = TextOverflow.Ellipsis,
                modifier = Modifier.width(80.dp),
            )
            if (isNext) {
                Text(icon, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = if (enabled) GigColors.textDim else GigColors.textMuted)
            }
        }
    }
}

// ─── V4 Drawer Components ───────────────────────────────────────────────────────

@Composable
fun DrawerHandle() {
    Box(
        modifier = Modifier
            .width(30.dp)
            .height(3.dp)
            .clip(RoundedCornerShape(2.dp))
            .background(GigColors.green),
    )
}

@Composable
fun DrawerLabel(text: String) {
    Text(
        text = text,
        fontFamily = JetBrainsMono, fontSize = 9.sp, letterSpacing = 1.sp,
        color = GigColors.textMuted,
    )
}

@Composable
fun DisplayToggleRow(
    showVisuals: Boolean, onVisualsToggle: () -> Unit,
    showChords: Boolean, onChordsToggle: () -> Unit,
    showLyrics: Boolean, onLyricsToggle: () -> Unit,
    showNotes: Boolean, onNotesToggle: () -> Unit,
    showDrums: Boolean, onDrumsToggle: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        TogglePill("Visuals", showVisuals, GigColors.green, onVisualsToggle)
        TogglePill("Chords", showChords, GigColors.orange, onChordsToggle)
        TogglePill("Lyrics", showLyrics, GigColors.text, onLyricsToggle)
        TogglePill("Notes", showNotes, GigColors.cyan, onNotesToggle)
        TogglePill("Drums", showDrums, GigColors.pink, onDrumsToggle)
    }
}

@Composable
private fun TogglePill(label: String, active: Boolean, color: Color, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .background(
                if (active) color.copy(alpha = 0.08f) else Color.Transparent,
                RoundedCornerShape(12.dp),
            )
            .border(
                1.dp,
                if (active) color.copy(alpha = 0.4f) else Color.White.copy(alpha = 0.06f),
                RoundedCornerShape(12.dp),
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 4.dp),
    ) {
        Text(
            label,
            fontFamily = JetBrainsMono, fontSize = 9.sp,
            color = if (active) color else GigColors.textMuted,
        )
    }
}

@Composable
fun SettingsPills(
    subdivision: Int,
    onSubdivisionChange: (Int) -> Unit,
    countInBars: Int,
    onCountInChange: (Int) -> Unit,
    nudgeOffsetMs: Float,
    onNudgeBack: () -> Unit,
    onNudgeForward: () -> Unit,
    onNudgeReset: () -> Unit,
) {
    // Subdivision
    SettingsRow("Subdiv") {
        listOf(1 to "Off", 2 to "8th", 3 to "Trip", 4 to "16th").forEach { (value, label) ->
            SettingPill(label, selected = subdivision == value, onClick = { onSubdivisionChange(value) })
        }
    }

    // Count-in
    SettingsRow("Count-in") {
        listOf(0 to "Off", 1 to "1", 2 to "2", 4 to "4").forEach { (value, label) ->
            SettingPill(label, selected = countInBars == value, onClick = { onCountInChange(value) })
        }
    }

    // Nudge
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(
            "Nudge", fontFamily = JetBrainsMono, fontSize = 9.sp,
            color = GigColors.textMuted,
            modifier = Modifier.width(55.dp),
        )
        NudgePill("<<", onClick = onNudgeBack)
        Text(
            text = if (nudgeOffsetMs != 0f) "${if (nudgeOffsetMs > 0) "+" else ""}${nudgeOffsetMs.toInt()}ms" else "+0ms",
            fontFamily = JetBrainsMono, fontSize = 10.sp,
            color = GigColors.green,
            textAlign = TextAlign.Center,
            modifier = Modifier.weight(1f),
        )
        NudgePill(">>", onClick = onNudgeForward)
    }
}

@Composable
private fun SettingsRow(label: String, content: @Composable () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(
            label, fontFamily = JetBrainsMono, fontSize = 9.sp,
            color = GigColors.textMuted,
            modifier = Modifier.width(55.dp),
        )
        Row(horizontalArrangement = Arrangement.spacedBy(3.dp)) {
            content()
        }
    }
}

@Composable
private fun SettingPill(label: String, selected: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .background(
                if (selected) GigColors.purple.copy(alpha = 0.12f) else Color.Transparent,
                RoundedCornerShape(10.dp),
            )
            .border(
                1.dp,
                if (selected) GigColors.purple.copy(alpha = 0.35f) else Color.White.copy(alpha = 0.06f),
                RoundedCornerShape(10.dp),
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 8.dp, vertical = 3.dp),
    ) {
        Text(
            label,
            fontFamily = JetBrainsMono, fontSize = 8.sp,
            color = if (selected) GigColors.purple else GigColors.textMuted,
        )
    }
}

@Composable
private fun NudgePill(label: String, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .background(Color.Transparent, RoundedCornerShape(8.dp))
            .border(1.dp, Color.White.copy(alpha = 0.06f), RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 8.dp, vertical = 3.dp),
    ) {
        Text(label, fontFamily = JetBrainsMono, fontSize = 10.sp, color = GigColors.textMuted)
    }
}

// ─── V4 Mixer (Practice drawer) ─────────────────────────────────────────────────

data class MixerChannel(
    val label: String,
    val color: Color,
    val value: Float, // 0..1
    val onValueChange: (Float) -> Unit,
    val isMuted: Boolean = false,
    val onMuteToggle: () -> Unit = {},
)

@Composable
fun MixerRow(channels: List<MixerChannel>) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.Center,
    ) {
        channels.forEach { ch ->
            Column(
                modifier = Modifier.width(40.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(3.dp),
            ) {
                // Label
                Text(
                    ch.label,
                    fontFamily = JetBrainsMono, fontWeight = FontWeight.Bold,
                    fontSize = 7.sp, color = ch.color,
                )
                // Track (vertical bar)
                Box(
                    modifier = Modifier
                        .width(4.dp)
                        .height(60.dp)
                        .clip(RoundedCornerShape(2.dp))
                        .background(Color.White.copy(alpha = 0.04f)),
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height((ch.value * 60).dp)
                            .align(Alignment.BottomCenter)
                            .clip(RoundedCornerShape(2.dp))
                            .background(ch.color),
                    )
                }
                // Value
                Text(
                    "${(ch.value * 100).toInt()}",
                    fontFamily = JetBrainsMono, fontSize = 7.sp, color = GigColors.textMuted,
                )
                // Mute button
                Box(
                    modifier = Modifier
                        .size(width = 16.dp, height = 12.dp)
                        .clip(RoundedCornerShape(2.dp))
                        .background(if (ch.isMuted) ch.color.copy(alpha = 0.2f) else GigColors.surfaceLight)
                        .border(1.dp, Color.White.copy(alpha = 0.06f), RoundedCornerShape(2.dp))
                        .clickable(onClick = ch.onMuteToggle),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        "M",
                        fontFamily = JetBrainsMono, fontWeight = FontWeight.Bold,
                        fontSize = 6.sp, color = if (ch.isMuted) ch.color else GigColors.textMuted,
                    )
                }
            }
        }
    }
}

// ── Takes Section (S41) ─────────────────────────────────────────────────────

data class TakeItem(
    val id: String,
    val label: String,
    val isBest: Boolean,
    val isCloud: Boolean,
    val date: String,
    val takeNumber: Int,
    val durationFormatted: String,
)

@Composable
fun TakesSection(
    takes: List<TakeItem>,
    onSetBest: (String) -> Unit,
    onClearBest: (String) -> Unit,
    onDelete: (String) -> Unit,
    onPlay: (String) -> Unit,
    isLoading: Boolean,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            "MY TAKES",
            fontFamily = JetBrainsMono, fontWeight = FontWeight.Bold,
            fontSize = 9.sp, color = GigColors.textMuted,
            letterSpacing = 1.sp,
        )
        Spacer(Modifier.height(8.dp))

        if (takes.isEmpty()) {
            Text(
                "No takes yet. Record in the player to add takes.",
                fontSize = 12.sp, color = GigColors.textMuted,
                fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
            )
        }

        takes.forEach { take ->
            val borderColor = if (take.isBest) GigColors.green.copy(alpha = 0.3f) else Color.White.copy(alpha = 0.07f)
            val bgColor = if (take.isBest) GigColors.green.copy(alpha = 0.03f) else Color.White.copy(alpha = 0.03f)

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 3.dp)
                    .background(bgColor, RoundedCornerShape(8.dp))
                    .border(0.5.dp, borderColor, RoundedCornerShape(8.dp))
                    .padding(horizontal = 10.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                // Take number badge
                Box(
                    modifier = Modifier
                        .size(24.dp)
                        .background(
                            if (take.isBest) GigColors.green.copy(alpha = 0.15f) else GigColors.background,
                            CircleShape
                        ),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        "${take.takeNumber}",
                        fontSize = 10.sp, fontWeight = FontWeight.Bold,
                        color = if (take.isBest) GigColors.green else GigColors.textMuted,
                    )
                }

                // Take info
                Column(modifier = Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            "Take #${take.takeNumber}",
                            fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
                            color = if (take.isBest) GigColors.green else GigColors.text,
                        )
                        if (take.isBest) {
                            Spacer(Modifier.width(6.dp))
                            Text(
                                "BEST",
                                fontSize = 9.sp, fontWeight = FontWeight.Bold,
                                color = GigColors.green,
                                modifier = Modifier
                                    .background(GigColors.green.copy(alpha = 0.15f), RoundedCornerShape(12.dp))
                                    .border(1.dp, GigColors.green.copy(alpha = 0.3f), RoundedCornerShape(12.dp))
                                    .padding(horizontal = 6.dp, vertical = 1.dp),
                            )
                        }
                    }
                    Text(
                        "${take.durationFormatted} · ${take.date}${if (take.isCloud) " · cloud" else ""}",
                        fontSize = 11.sp, color = GigColors.textMuted,
                    )
                }

                // Play button
                Box(
                    modifier = Modifier
                        .size(28.dp)
                        .background(Color.White.copy(alpha = 0.03f), CircleShape)
                        .border(1.dp, borderColor, CircleShape)
                        .clickable { onPlay(take.id) },
                    contentAlignment = Alignment.Center,
                ) {
                    Text("▶", fontSize = 11.sp, color = if (take.isBest) GigColors.green else GigColors.textMuted)
                }

                // Best/Unbest button
                if (take.isCloud) {
                    Box(
                        modifier = Modifier
                            .background(Color.White.copy(alpha = 0.03f), RoundedCornerShape(12.dp))
                            .border(1.dp, Color.White.copy(alpha = 0.06f), RoundedCornerShape(12.dp))
                            .clickable(enabled = !isLoading) {
                                if (take.isBest) onClearBest(take.id) else onSetBest(take.id)
                            }
                            .padding(horizontal = 10.dp, vertical = 3.dp),
                    ) {
                        Text(
                            if (take.isBest) "Unset" else "Set Best",
                            fontSize = 11.sp, color = if (take.isBest) GigColors.green else GigColors.textMuted,
                        )
                    }
                }

                // Delete button
                Box(
                    modifier = Modifier
                        .background(GigColors.danger.copy(alpha = 0.08f), RoundedCornerShape(12.dp))
                        .border(1.dp, GigColors.danger.copy(alpha = 0.2f), RoundedCornerShape(12.dp))
                        .clickable { onDelete(take.id) }
                        .padding(horizontal = 8.dp, vertical = 3.dp),
                ) {
                    Text("Del", fontSize = 11.sp, color = GigColors.danger)
                }
            }
        }
    }
}

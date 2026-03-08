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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AudioFile
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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
import com.thegreentangerine.gigbooks.ui.components.BeatDisplay
import com.thegreentangerine.gigbooks.ui.components.NeuCard
import com.thegreentangerine.gigbooks.ui.components.PlayStopButton
import com.thegreentangerine.gigbooks.ui.theme.GigColors
import com.thegreentangerine.gigbooks.ui.theme.JetBrainsMono
import com.thegreentangerine.gigbooks.ui.theme.Karla
import kotlin.math.roundToInt

@Composable
fun PracticeScreen(vm: AppViewModel, onMenuClick: () -> Unit, onGoToLibrary: () -> Unit) {
    val song = vm.selectedSong

    Column(Modifier.fillMaxSize().background(GigColors.background)) {
        PracticeHeader(onMenuClick)

        if (song == null) {
            NoSongPlaceholder(
                accent        = GigColors.purple,
                screenName    = "Practice",
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

                // Song info
                PracticeSongCard(song.name, song.artist, song.bpm.toInt(), song.key, song.timeSig)

                // Beat display
                NeuCard {
                    BeatDisplay(
                        beatsPerBar = song.timeSignatureTop.toInt(),
                        currentBeat = vm.currentBeat,
                        currentBar  = vm.currentBar,
                        isPlaying   = vm.isClickPlaying,
                        accent      = GigColors.purple,
                        modifier    = Modifier.padding(vertical = 14.dp),
                    )
                }

                // Play/Stop click
                PlayStopButton(
                    isPlaying = vm.isClickPlaying,
                    accent    = GigColors.purple,
                    onClick   = { vm.toggleClick() },
                    enabled   = vm.engineAvailable,
                )

                // Speed control
                SpeedCard(vm)

                // Beat nudge
                NudgeCard(vm)

                // Subdivision
                SubdivisionCard(vm)

                // Track section (if audio available)
                if (song.hasAudio && !song.audioUrl.isNullOrBlank()) {
                    TrackSection(vm, audioUrl = song.audioUrl)
                }

                // Stem volume sliders (shown once stems are loaded)
                if (vm.loadedStems.isNotEmpty()) {
                    StemsCard(vm)
                }

                Spacer(Modifier.height(20.dp))
            }
        }
    }
}

// ─── Header ──────────────────────────────────────────────────────────────────

@Composable
private fun PracticeHeader(onMenuClick: () -> Unit) {
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
            text = "Practice",
            fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 18.sp,
            style = TextStyle(color = GigColors.purple, shadow = Shadow(GigColors.purple.copy(alpha = 0.45f), Offset.Zero, 14f)),
        )
    }
}

// ─── Song card ───────────────────────────────────────────────────────────────

@Composable
private fun PracticeSongCard(name: String, artist: String, bpm: Int, key: String, timeSig: String) {
    NeuCard {
        Text(
            text = name,
            fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 20.sp, color = GigColors.text,
        )
        if (artist.isNotBlank()) {
            Text(text = artist, fontFamily = Karla, fontSize = 13.sp, color = GigColors.textDim)
        }
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            LiveChip(text = "$bpm BPM",  color = GigColors.orange)
            if (key.isNotBlank()) LiveChip(text = key, color = GigColors.teal)
            LiveChip(text = timeSig, color = GigColors.textMuted)
        }
    }
}

// ─── Speed control ───────────────────────────────────────────────────────────

@Composable
private fun SpeedCard(vm: AppViewModel) {
    val song      = vm.selectedSong ?: return
    val speedPct  = (vm.practiceSpeed * 100).roundToInt()
    val resultBpm = vm.effectiveBpm.roundToInt()

    NeuCard {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(
                "Speed", fontFamily = Karla, fontWeight = FontWeight.SemiBold, fontSize = 13.sp,
                color = GigColors.textDim, modifier = Modifier.weight(1f),
            )
            Text(
                "$speedPct%",
                fontFamily = JetBrainsMono, fontSize = 22.sp,
                style = TextStyle(
                    color  = if (vm.practiceSpeed < 1f) GigColors.purple else GigColors.text,
                    shadow = if (vm.practiceSpeed < 1f) Shadow(GigColors.purple.copy(0.45f), Offset.Zero, 10f) else null,
                ),
            )
        }
        Slider(
            value    = vm.practiceSpeed,
            onValueChange = { vm.applySpeed(it) },
            valueRange = 0.25f..1.5f,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 0.dp),
            colors   = SliderDefaults.colors(
                thumbColor        = GigColors.purple,
                activeTrackColor  = GigColors.purple,
                inactiveTrackColor = GigColors.textMuted.copy(alpha = 0.25f),
            ),
        )
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("25%",  fontFamily = JetBrainsMono, fontSize = 10.sp, color = GigColors.textMuted)
            Text(
                "${song.bpm.toInt()} × ${vm.practiceSpeed.let { "%.2f".format(it) }} = $resultBpm BPM",
                fontFamily = JetBrainsMono, fontSize = 10.sp, color = GigColors.textDim,
            )
            Text("150%", fontFamily = JetBrainsMono, fontSize = 10.sp, color = GigColors.textMuted)
        }
    }
}

// ─── Beat nudge ──────────────────────────────────────────────────────────────

@Composable
private fun NudgeCard(vm: AppViewModel) {
    val offsetMs = vm.nudgeOffsetMs
    NeuCard {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(
                "Beat Nudge", fontFamily = Karla, fontWeight = FontWeight.SemiBold, fontSize = 13.sp,
                color = GigColors.textDim, modifier = Modifier.weight(1f),
            )
            if (offsetMs != 0f) {
                Text(
                    text = "${if (offsetMs > 0) "+" else ""}${offsetMs.toInt()} ms",
                    fontFamily = JetBrainsMono, fontSize = 12.sp,
                    color = if (offsetMs > 0) GigColors.teal else GigColors.orange,
                )
            }
        }
        Spacer(Modifier.height(8.dp))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            NudgeButton("◀◀  Back", GigColors.orange, Modifier.weight(1f)) { vm.nudge(-1) }
            if (offsetMs != 0f) {
                NudgeButton("Reset", GigColors.textMuted, Modifier.weight(0.8f)) { vm.resetNudge() }
            }
            NudgeButton("Fwd  ▶▶", GigColors.teal, Modifier.weight(1f)) { vm.nudge(+1) }
        }
    }
}

@Composable
private fun NudgeButton(label: String, color: Color, modifier: Modifier, onClick: () -> Unit) {
    Box(
        modifier = modifier
            .height(40.dp)
            .background(color.copy(alpha = 0.08f), RoundedCornerShape(10.dp))
            .border(0.5.dp, color.copy(alpha = 0.25f), RoundedCornerShape(10.dp))
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, fontFamily = Karla, fontWeight = FontWeight.Medium, fontSize = 13.sp, color = color)
    }
}

// ─── Subdivision ─────────────────────────────────────────────────────────────

private val SUBDIVISIONS = listOf(1 to "Off", 2 to "8th", 3 to "Triplet", 4 to "16th")

@Composable
private fun SubdivisionCard(vm: AppViewModel) {
    NeuCard {
        Text(
            "Subdivision", fontFamily = Karla, fontWeight = FontWeight.SemiBold,
            fontSize = 13.sp, color = GigColors.textDim,
        )
        Spacer(Modifier.height(8.dp))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            SUBDIVISIONS.forEach { (value, label) ->
                val selected = vm.subdivision == value
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(36.dp)
                        .background(
                            if (selected) GigColors.purple.copy(alpha = 0.15f) else Color.Transparent,
                            RoundedCornerShape(8.dp),
                        )
                        .border(
                            0.5.dp,
                            if (selected) GigColors.purple.copy(alpha = 0.4f) else GigColors.textMuted.copy(alpha = 0.2f),
                            RoundedCornerShape(8.dp),
                        )
                        .clickable { vm.applySubdivision(value) },
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        label, fontFamily = Karla, fontSize = 12.sp,
                        style = TextStyle(
                            color  = if (selected) GigColors.purple else GigColors.textMuted,
                            shadow = if (selected) Shadow(GigColors.purple.copy(0.4f), Offset.Zero, 6f) else null,
                        ),
                    )
                }
            }
        }
    }
}

// ─── Track section ───────────────────────────────────────────────────────────

@Composable
private fun TrackSection(vm: AppViewModel, audioUrl: String) {
    NeuCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.AudioFile, contentDescription = null, tint = GigColors.green, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
            Text(
                "Backing Track", fontFamily = Karla, fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp,
                style = TextStyle(color = GigColors.green, shadow = Shadow(GigColors.green.copy(0.35f), Offset.Zero, 8f)),
                modifier = Modifier.weight(1f),
            )
            when {
                vm.trackError != null ->
                    Text("Error", fontFamily = Karla, fontSize = 11.sp, color = GigColors.danger)
                vm.isAnalysing ->
                    CircularProgressIndicator(color = GigColors.teal, strokeWidth = 2.dp, modifier = Modifier.size(14.dp))
                vm.appliedBeatOffsetMs > 0 ->
                    Text(
                        "+${vm.appliedBeatOffsetMs}ms",
                        fontFamily = JetBrainsMono, fontSize = 10.sp,
                        style = TextStyle(color = GigColors.teal, shadow = Shadow(GigColors.teal.copy(0.3f), Offset.Zero, 6f)),
                    )
            }
        }

        if (vm.trackError != null) {
            Spacer(Modifier.height(4.dp))
            Text(vm.trackError!!, fontFamily = Karla, fontSize = 11.sp, color = GigColors.danger)
        }

        Spacer(Modifier.height(10.dp))
        HorizontalDivider(color = GigColors.textMuted.copy(alpha = 0.1f))
        Spacer(Modifier.height(10.dp))

        if (!vm.trackLoaded) {
            // Load button
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(44.dp)
                    .background(GigColors.green.copy(alpha = 0.08f), RoundedCornerShape(10.dp))
                    .border(0.5.dp, GigColors.green.copy(alpha = 0.25f), RoundedCornerShape(10.dp))
                    .clickable(enabled = !vm.isLoadingTrack) { vm.loadTrack(audioUrl) },
                contentAlignment = Alignment.Center,
            ) {
                if (vm.isLoadingTrack) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        CircularProgressIndicator(color = GigColors.green, strokeWidth = 2.dp, modifier = Modifier.size(16.dp))
                        Text("Loading…", fontFamily = Karla, fontSize = 13.sp, color = GigColors.green)
                    }
                } else {
                    Text("Load Track", fontFamily = Karla, fontWeight = FontWeight.SemiBold, fontSize = 13.sp,
                        style = TextStyle(color = GigColors.green, shadow = Shadow(GigColors.green.copy(0.35f), Offset.Zero, 6f)))
                }
            }
        } else {
            // Playback controls
            val positionFraction = if (vm.trackTotalFr > 0) vm.trackPositionFr.toFloat() / vm.trackTotalFr else 0f
            val positionStr = formatFrames(vm.trackPositionFr, vm.trackSampleRate)
            val totalStr    = formatFrames(vm.trackTotalFr,    vm.trackSampleRate)

            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                IconButton(
                    onClick = { if (vm.isTrackPlaying) vm.pauseTrack() else vm.playTrack() },
                    modifier = Modifier.size(44.dp),
                ) {
                    Icon(
                        if (vm.isTrackPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                        contentDescription = null, tint = GigColors.green, modifier = Modifier.size(26.dp),
                    )
                }
                IconButton(onClick = { vm.stopTrack() }, modifier = Modifier.size(36.dp)) {
                    Icon(Icons.Default.Stop, contentDescription = "Stop", tint = GigColors.textDim, modifier = Modifier.size(20.dp))
                }
                Spacer(Modifier.width(4.dp))
                Text("$positionStr / $totalStr", fontFamily = JetBrainsMono, fontSize = 11.sp, color = GigColors.textDim)
            }

            WaveformSeekBar(
                envelope        = vm.waveformEnvelope,
                positionFraction = positionFraction,
                loopAFraction   = vm.loopAFrame?.let { it.toFloat() / vm.trackTotalFr.coerceAtLeast(1) },
                loopBFraction   = vm.loopBFrame?.let { it.toFloat() / vm.trackTotalFr.coerceAtLeast(1) },
                onSeek          = { vm.seekTrackFraction(it) },
                modifier        = Modifier.fillMaxWidth().height(64.dp),
            )

            Spacer(Modifier.height(4.dp))

            // Beat alignment banner
            if (vm.showBeatBanner) {
                BeatAlignBanner(
                    bpm      = vm.detectedBpm,
                    offsetMs = vm.detectedOffsetMs,
                    onApply  = { vm.applyDetectedBeat() },
                    onDismiss = { vm.dismissBeatBanner() },
                )
                Spacer(Modifier.height(4.dp))
            }

            // A-B loop
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                val hasA = vm.loopAFrame != null
                val hasB = vm.loopBFrame != null
                LoopButton("A",     if (hasA) GigColors.orange else GigColors.textMuted, Modifier.weight(1f)) { vm.setLoopA() }
                LoopButton("B",     if (hasB) GigColors.orange else GigColors.textMuted, Modifier.weight(1f)) { vm.setLoopB() }
                LoopButton("Clear", if (hasA || hasB) GigColors.danger else GigColors.textMuted, Modifier.weight(1f), enabled = hasA || hasB) { vm.clearLoop() }
            }
        }
    }
}

@Composable
private fun LoopButton(label: String, color: Color, modifier: Modifier, enabled: Boolean = true, onClick: () -> Unit) {
    Box(
        modifier = modifier
            .height(34.dp)
            .background(color.copy(alpha = if (enabled) 0.08f else 0.03f), RoundedCornerShape(8.dp))
            .border(0.5.dp, color.copy(alpha = if (enabled) 0.25f else 0.1f), RoundedCornerShape(8.dp))
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, fontFamily = JetBrainsMono, fontSize = 11.sp, color = if (enabled) color else GigColors.textMuted)
    }
}

// ─── Beat align banner ───────────────────────────────────────────────────────

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
                "Apply & Save", fontFamily = Karla, fontWeight = FontWeight.SemiBold,
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

// ─── Waveform seek bar ───────────────────────────────────────────────────────

@Composable
private fun WaveformSeekBar(
    envelope: FloatArray,
    positionFraction: Float,
    loopAFraction: Float?,
    loopBFraction: Float?,
    onSeek: (Float) -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .background(GigColors.surface.copy(alpha = 0.4f), RoundedCornerShape(8.dp))
            .border(0.5.dp, GigColors.textMuted.copy(alpha = 0.15f), RoundedCornerShape(8.dp))
            .pointerInput(Unit) {
                detectTapGestures { offset ->
                    onSeek((offset.x / size.width).coerceIn(0f, 1f))
                }
            },
    ) {
        Canvas(modifier = Modifier.fillMaxSize().padding(horizontal = 4.dp, vertical = 6.dp)) {
            val w = size.width
            val h = size.height
            val midY = h / 2f

            // ── Loop region highlight ────────────────────────────────────────
            val loopA = loopAFraction
            val loopB = loopBFraction
            if (loopA != null && loopB != null) {
                val lx = minOf(loopA, loopB) * w
                val rx = maxOf(loopA, loopB) * w
                drawRect(
                    color    = GigColors.orange.copy(alpha = 0.15f),
                    topLeft  = Offset(lx, 0f),
                    size     = Size(rx - lx, h),
                )
                // Loop boundary lines
                for (x in listOf(lx, rx)) {
                    drawLine(GigColors.orange.copy(alpha = 0.5f), Offset(x, 0f), Offset(x, h), strokeWidth = 1.5f)
                }
            } else {
                // Show single marker for whichever is set
                loopA?.let {
                    drawLine(GigColors.orange.copy(alpha = 0.4f), Offset(it * w, 0f), Offset(it * w, h), strokeWidth = 1.5f)
                }
                loopB?.let {
                    drawLine(GigColors.orange.copy(alpha = 0.4f), Offset(it * w, 0f), Offset(it * w, h), strokeWidth = 1.5f)
                }
            }

            // ── Waveform bars ────────────────────────────────────────────────
            if (envelope.isNotEmpty()) {
                val barW  = (w / envelope.size).coerceAtLeast(1f)
                val playX = positionFraction * w
                envelope.forEachIndexed { i, amp ->
                    val x     = i * barW + barW / 2f
                    val barH  = amp * midY * 0.9f
                    val color = if (x < playX) GigColors.green else GigColors.green.copy(alpha = 0.28f)
                    drawLine(color, Offset(x, midY - barH), Offset(x, midY + barH), strokeWidth = barW * 0.72f)
                }
            } else {
                // Flat centre line while track not yet loaded
                drawLine(GigColors.textMuted.copy(alpha = 0.2f), Offset(0f, midY), Offset(w, midY), strokeWidth = 1f)
            }

            // ── Playhead ─────────────────────────────────────────────────────
            val px = (positionFraction * w).coerceIn(0f, w)
            drawLine(GigColors.green, Offset(px, 0f), Offset(px, h), strokeWidth = 2f)
            // Thumb circle
            drawCircle(GigColors.green, radius = 5f, center = Offset(px, midY))
        }
    }
}

// ─── Stem volume sliders ─────────────────────────────────────────────────────

@Composable
private fun StemsCard(vm: AppViewModel) {
    NeuCard {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(
                "Stems", fontFamily = Karla, fontWeight = FontWeight.SemiBold,
                fontSize = 13.sp, color = GigColors.textDim, modifier = Modifier.weight(1f),
            )
            if (vm.stemsLoading) {
                CircularProgressIndicator(color = GigColors.purple, strokeWidth = 2.dp, modifier = Modifier.size(14.dp))
            }
        }

        Spacer(Modifier.height(6.dp))

        vm.loadedStems.forEach { (idx, stem) ->
            StemSliderRow(
                label   = stem.label.uppercase(),
                gain    = vm.stemGains[idx] ?: 1f,
                onGainChange = { vm.setStemGain(idx, it) },
            )
        }

        // Show any load errors in a small note
        vm.stemErrors.entries.forEach { (label, err) ->
            Text(
                "⚠ $label: $err",
                fontFamily = Karla, fontSize = 10.sp, color = GigColors.danger,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
    }
}

@Composable
private fun StemSliderRow(label: String, gain: Float, onGainChange: (Float) -> Unit) {
    // Label colour per stem type
    val color = when (label) {
        "DRUMS"   -> GigColors.orange
        "BASS"    -> GigColors.teal
        "GUITAR"  -> GigColors.green
        "KEYS"    -> GigColors.purple
        "VOCALS"  -> Color(0xFFE879F9)   // fuchsia
        "BACKING" -> Color(0xFFFC8181)   // rose
        else      -> GigColors.textDim
    }
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text     = label,
            fontFamily = JetBrainsMono, fontSize = 10.sp,
            color    = color,
            modifier = Modifier.width(56.dp),
        )
        Slider(
            value         = gain,
            onValueChange = onGainChange,
            valueRange    = 0f..1f,
            modifier      = Modifier.weight(1f),
            colors        = SliderDefaults.colors(
                thumbColor         = color,
                activeTrackColor   = color,
                inactiveTrackColor = GigColors.textMuted.copy(alpha = 0.2f),
            ),
        )
        Text(
            text       = "${(gain * 100).roundToInt()}%",
            fontFamily = JetBrainsMono, fontSize = 10.sp, color = GigColors.textMuted,
            modifier   = Modifier.width(36.dp).padding(start = 4.dp),
        )
    }
}

private fun formatFrames(frames: Long, sampleRate: Int): String {
    val secs = (frames / sampleRate.coerceAtLeast(1)).toInt()
    return "%d:%02d".format(secs / 60, secs % 60)
}

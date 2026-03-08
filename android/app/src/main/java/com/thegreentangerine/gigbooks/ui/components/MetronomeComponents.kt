package com.thegreentangerine.gigbooks.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.thegreentangerine.gigbooks.ui.theme.GigColors
import com.thegreentangerine.gigbooks.ui.theme.JetBrainsMono
import com.thegreentangerine.gigbooks.ui.theme.Karla

@Composable
fun BeatDisplay(
    beatsPerBar: Int,
    currentBeat: Int,   // 1-indexed; 0 = idle
    currentBar: Int,
    isPlaying: Boolean,
    accent: Color,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = if (isPlaying) "BAR  ${currentBar + 1}" else "—",
            fontFamily = JetBrainsMono,
            fontSize = 12.sp,
            color = GigColors.textMuted,
            letterSpacing = 2.sp,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(18.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            val count = beatsPerBar.coerceIn(1, 8)
            for (i in 0 until count) {
                BeatDot(
                    beatIndex   = i,
                    currentBeat = currentBeat,
                    isPlaying   = isPlaying,
                    accent      = if (i == 0) GigColors.orange else accent,
                    isDownbeat  = i == 0,
                )
            }
        }
    }
}

@Composable
private fun BeatDot(
    beatIndex: Int,
    currentBeat: Int,
    isPlaying: Boolean,
    accent: Color,
    isDownbeat: Boolean,
) {
    val isActive = isPlaying && (currentBeat - 1) == beatIndex
    val scale    = remember { Animatable(1f) }

    LaunchedEffect(currentBeat, isPlaying) {
        if (isActive) {
            scale.snapTo(if (isDownbeat) 1.55f else 1.4f)
            scale.animateTo(
                1f,
                spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessMedium),
            )
        } else if (!isPlaying) {
            scale.animateTo(1f, spring())
        }
    }

    val dotSize = if (isDownbeat) 38.dp else 30.dp
    Box(
        modifier = Modifier
            .scale(scale.value)
            .size(dotSize)
            .then(if (isActive) Modifier.glowBehind(accent, radius = 30.dp, alpha = 0.55f) else Modifier)
            .clip(CircleShape)
            .background(if (isActive) accent else accent.copy(alpha = 0.10f)),
    )
}

@Composable
fun PlayStopButton(
    isPlaying: Boolean,
    accent: Color,
    onClick: () -> Unit,
    enabled: Boolean = true,
    modifier: Modifier = Modifier,
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier
            .fillMaxWidth()
            .height(58.dp)
            .then(if (isPlaying) Modifier.glowBehind(accent, 64.dp, 0.18f) else Modifier),
        shape = RoundedCornerShape(14.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor         = if (isPlaying) accent.copy(alpha = 0.12f) else accent,
            contentColor           = if (isPlaying) accent else Color.Black,
            disabledContainerColor = GigColors.surfaceInset,
            disabledContentColor   = GigColors.textMuted,
        ),
    ) {
        Text(
            text = if (isPlaying) "■   STOP" else "▶   START",
            fontFamily = Karla,
            fontWeight = FontWeight.Bold,
            fontSize = 16.sp,
            style = TextStyle(
                shadow = if (isPlaying) Shadow(accent.copy(alpha = 0.7f), Offset.Zero, 14f) else null,
            ),
        )
    }
}

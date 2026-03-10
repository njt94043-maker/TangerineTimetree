package com.thegreentangerine.gigbooks.ui.screens

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.thegreentangerine.gigbooks.R
import com.thegreentangerine.gigbooks.ui.theme.GigColors
import com.thegreentangerine.gigbooks.ui.theme.Karla
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun SplashScreen(onFinished: () -> Unit) {
    // ── Animation state ──
    // Logo: drop-in with bounce
    val logoAlpha = remember { Animatable(0f) }
    val logoScale = remember { Animatable(0.5f) }
    val logoOffsetY = remember { Animatable(-120f) }

    // Warm glow behind logo
    val glowAlpha = remember { Animatable(0f) }
    val glowScale = remember { Animatable(0.5f) }

    // Band name words: "The" / "Green" / "Tangerine"
    val theAlpha = remember { Animatable(0f) }
    val theOffsetY = remember { Animatable(40f) }
    val greenAlpha = remember { Animatable(0f) }
    val greenOffsetY = remember { Animatable(40f) }
    val tangerineAlpha = remember { Animatable(0f) }
    val tangerineOffsetY = remember { Animatable(40f) }

    // App name tagline + lines
    val taglineAlpha = remember { Animatable(0f) }
    val lineWidth = remember { Animatable(0f) }

    // Loading dots
    val dotsAlpha = remember { Animatable(0f) }
    val dot1Alpha = remember { Animatable(0.2f) }
    val dot2Alpha = remember { Animatable(0.2f) }
    val dot3Alpha = remember { Animatable(0.2f) }

    LaunchedEffect(Unit) {
        // Logo drop-in (0ms – 700ms)
        launch {
            logoAlpha.animateTo(1f, tween(400, easing = FastOutSlowInEasing))
        }
        launch {
            logoOffsetY.animateTo(8f, tween(420, easing = FastOutSlowInEasing))
            logoOffsetY.animateTo(-3f, tween(140))
            logoOffsetY.animateTo(0f, tween(140))
        }
        launch {
            logoScale.animateTo(1.05f, tween(420, easing = FastOutSlowInEasing))
            logoScale.animateTo(0.98f, tween(140))
            logoScale.animateTo(1f, tween(140))
        }

        // Glow (800ms)
        launch {
            delay(800)
            launch { glowAlpha.animateTo(1f, tween(1000)) }
            launch { glowScale.animateTo(1.3f, tween(1000)) }
        }

        // Word reveals (staggered 1000ms, 1150ms, 1300ms)
        launch {
            delay(1000)
            launch { theAlpha.animateTo(1f, tween(400, easing = FastOutSlowInEasing)) }
            launch { theOffsetY.animateTo(0f, tween(400, easing = FastOutSlowInEasing)) }
        }
        launch {
            delay(1150)
            launch { greenAlpha.animateTo(1f, tween(400, easing = FastOutSlowInEasing)) }
            launch { greenOffsetY.animateTo(0f, tween(400, easing = FastOutSlowInEasing)) }
        }
        launch {
            delay(1300)
            launch { tangerineAlpha.animateTo(1f, tween(400, easing = FastOutSlowInEasing)) }
            launch { tangerineOffsetY.animateTo(0f, tween(400, easing = FastOutSlowInEasing)) }
        }

        // Tagline + lines (1600ms)
        launch {
            delay(1600)
            taglineAlpha.animateTo(1f, tween(400))
        }
        launch {
            delay(1800)
            lineWidth.animateTo(40f, tween(800))
        }

        // Loading dots (2000ms)
        launch {
            delay(2000)
            dotsAlpha.animateTo(1f, tween(300))
        }
        // Dot pulse animations
        launch {
            delay(2000)
            dot1Alpha.animateTo(1f, infiniteRepeatable(tween(600, easing = LinearEasing), RepeatMode.Reverse))
        }
        launch {
            delay(2200)
            dot2Alpha.animateTo(1f, infiniteRepeatable(tween(600, easing = LinearEasing), RepeatMode.Reverse))
        }
        launch {
            delay(2400)
            dot3Alpha.animateTo(1f, infiniteRepeatable(tween(600, easing = LinearEasing), RepeatMode.Reverse))
        }

        // Navigate away
        delay(2800)
        onFinished()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(GigColors.background),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // ── Logo with radial glow + drop-in ──
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(180.dp)
                    .drawBehind {
                        drawCircle(
                            brush = Brush.radialGradient(
                                colors = listOf(
                                    GigColors.orange.copy(alpha = 0.12f),
                                    GigColors.green.copy(alpha = 0.05f),
                                    Color.Transparent,
                                ),
                                center = center,
                                radius = size.minDimension * 1.4f,
                            ),
                            alpha = glowAlpha.value,
                        )
                    }
                    .scale(glowScale.value),
            ) {
                Image(
                    painter = painterResource(R.mipmap.ic_launcher),
                    contentDescription = "GigBooks",
                    modifier = Modifier
                        .size(150.dp)
                        .clip(CircleShape)
                        .graphicsLayer {
                            alpha = logoAlpha.value
                            scaleX = logoScale.value
                            scaleY = logoScale.value
                            translationY = logoOffsetY.value
                        },
                )
            }

            Spacer(Modifier.height(32.dp))

            // ── Band name: "The  Green  Tangerine" ──
            Row(
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.Bottom,
            ) {
                Text(
                    text = "The",
                    fontFamily = Karla,
                    fontWeight = FontWeight.Normal,
                    fontSize = 16.sp,
                    color = GigColors.textMuted,
                    modifier = Modifier
                        .alpha(theAlpha.value)
                        .graphicsLayer { translationY = theOffsetY.value },
                )
                Spacer(Modifier.width(10.dp))
                Text(
                    text = "Green",
                    fontFamily = Karla,
                    fontWeight = FontWeight.Bold,
                    fontSize = 30.sp,
                    style = TextStyle(
                        color = GigColors.green,
                        shadow = Shadow(
                            color = GigColors.green.copy(alpha = 0.3f),
                            offset = Offset.Zero,
                            blurRadius = 30f,
                        ),
                    ),
                    modifier = Modifier
                        .alpha(greenAlpha.value)
                        .graphicsLayer { translationY = greenOffsetY.value },
                )
                Spacer(Modifier.width(10.dp))
                Text(
                    text = "Tangerine",
                    fontFamily = Karla,
                    fontWeight = FontWeight.Bold,
                    fontSize = 30.sp,
                    style = TextStyle(
                        color = GigColors.orange,
                        shadow = Shadow(
                            color = GigColors.orange.copy(alpha = 0.3f),
                            offset = Offset.Zero,
                            blurRadius = 30f,
                        ),
                    ),
                    modifier = Modifier
                        .alpha(tangerineAlpha.value)
                        .graphicsLayer { translationY = tangerineOffsetY.value },
                )
            }

            Spacer(Modifier.height(12.dp))

            // ── App tagline: ── GigBooks ── ──
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
                modifier = Modifier.alpha(taglineAlpha.value),
            ) {
                Box(
                    modifier = Modifier
                        .height(1.dp)
                        .width(lineWidth.value.dp)
                        .background(
                            Brush.horizontalGradient(
                                colors = listOf(Color.Transparent, GigColors.orange, Color.Transparent),
                            ),
                        ),
                )
                Spacer(Modifier.width(12.dp))
                Text(
                    text = "GIGBOOKS",
                    fontFamily = Karla,
                    fontWeight = FontWeight.Normal,
                    fontSize = 11.sp,
                    color = GigColors.textMuted,
                    letterSpacing = 5.sp,
                )
                Spacer(Modifier.width(12.dp))
                Box(
                    modifier = Modifier
                        .height(1.dp)
                        .width(lineWidth.value.dp)
                        .background(
                            Brush.horizontalGradient(
                                colors = listOf(Color.Transparent, GigColors.orange, Color.Transparent),
                            ),
                        ),
                )
            }

            Spacer(Modifier.height(32.dp))

            // ── Loading dots ──
            Row(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                modifier = Modifier.alpha(dotsAlpha.value),
            ) {
                Box(
                    Modifier
                        .size(4.dp)
                        .alpha(dot1Alpha.value)
                        .clip(CircleShape)
                        .background(GigColors.orange),
                )
                Box(
                    Modifier
                        .size(4.dp)
                        .alpha(dot2Alpha.value)
                        .clip(CircleShape)
                        .background(GigColors.orange),
                )
                Box(
                    Modifier
                        .size(4.dp)
                        .alpha(dot3Alpha.value)
                        .clip(CircleShape)
                        .background(GigColors.orange),
                )
            }
        }
    }
}

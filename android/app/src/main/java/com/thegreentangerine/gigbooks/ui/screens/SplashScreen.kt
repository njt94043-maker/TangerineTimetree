package com.thegreentangerine.gigbooks.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.thegreentangerine.gigbooks.ui.theme.GigColors
import com.thegreentangerine.gigbooks.ui.theme.Karla
import kotlinx.coroutines.delay

@Composable
fun SplashScreen(onFinished: () -> Unit) {
    // Auto-navigate after 1.5 seconds
    LaunchedEffect(Unit) {
        delay(1500L)
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
            // Logo: tangerine circle with "T" and radial glow behind it
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(120.dp)
                    .drawBehind {
                        // Radial glow: tangerine + green, low opacity
                        drawCircle(
                            brush = Brush.radialGradient(
                                colors = listOf(
                                    GigColors.orange.copy(alpha = 0.25f),
                                    GigColors.green.copy(alpha = 0.10f),
                                    Color.Transparent,
                                ),
                                center = center,
                                radius = size.minDimension * 1.4f,
                            ),
                        )
                    },
            ) {
                Box(
                    modifier = Modifier
                        .size(96.dp)
                        .clip(CircleShape)
                        .background(GigColors.orange.copy(alpha = 0.12f))
                        .border(2.dp, GigColors.orange.copy(alpha = 0.6f), CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = "T",
                        fontFamily = Karla,
                        fontWeight = FontWeight.Bold,
                        fontSize = 48.sp,
                        textAlign = TextAlign.Center,
                        style = TextStyle(
                            color = GigColors.orange,
                            shadow = Shadow(
                                color = GigColors.orange.copy(alpha = 0.7f),
                                offset = Offset.Zero,
                                blurRadius = 20f,
                            ),
                        ),
                    )
                }
            }

            Spacer(Modifier.height(24.dp))

            // "GigBooks" — tangerine + green split
            Text(
                text = "GigBooks",
                fontFamily = Karla,
                fontWeight = FontWeight.Bold,
                fontSize = 32.sp,
                style = TextStyle(
                    color = GigColors.orange,
                    shadow = Shadow(
                        color = GigColors.orange.copy(alpha = 0.5f),
                        offset = Offset.Zero,
                        blurRadius = 16f,
                    ),
                ),
            )

            Spacer(Modifier.height(8.dp))

            // "The Green Tangerine" subtitle
            Text(
                text = "The Green Tangerine",
                fontFamily = Karla,
                fontWeight = FontWeight.Normal,
                fontSize = 14.sp,
                color = GigColors.textDim,
                letterSpacing = 1.sp,
            )
        }
    }
}

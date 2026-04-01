package com.thegreentangerine.gigbooks.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Paint
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.thegreentangerine.gigbooks.ui.theme.TangerineColors

/**
 * Neumorphic raised card — matches web .neu-card.
 * Uses layered Canvas draws with BlurMaskFilter for the multi-shadow effect.
 */
@Composable
fun NeuCard(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    val shape = RoundedCornerShape(16.dp)
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(bottom = 12.dp)
            .neuShadow(cornerRadius = 16.dp)
            .clip(shape)
            .background(TangerineColors.surface)
            .border(1.dp, TangerineColors.neuBorder, shape)
            .padding(16.dp),
        content = content,
    )
}

/**
 * Neumorphic inset well — matches web .neu-inset.
 */
@Composable
fun NeuWell(
    modifier: Modifier = Modifier,
    content: @Composable BoxScope.() -> Unit,
) {
    val shape = RoundedCornerShape(12.dp)
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(shape)
            .background(TangerineColors.surfaceInset)
            .border(1.dp, TangerineColors.neuInsetBorder, shape)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        content = content,
    )
}

/**
 * Neumorphic double-shadow using BlurMaskFilter on Canvas.
 * Draws a dark shadow (bottom-right) + subtle light shadow (top-left).
 */
fun Modifier.neuShadow(
    cornerRadius: Dp = 16.dp,
    darkShadowColor: Color = Color(0xCC000000),  // rgba(0,0,0,0.8) — canonical raised
    lightShadowColor: Color = Color(0x1F28283C), // rgba(40,40,60,0.12) — canonical raised
): Modifier = this.drawBehind {
    val cr = cornerRadius.toPx()

    drawIntoCanvas { canvas ->
        // Canonical raised: 4px 4px 12px rgba(0,0,0,0.8)
        val darkPaint = Paint().also {
            it.asFrameworkPaint().apply {
                isAntiAlias = true
                color = android.graphics.Color.TRANSPARENT
                setShadowLayer(12f, 4f, 4f, darkShadowColor.toArgb())
            }
        }
        // Canonical raised: -1px -1px 1px rgba(40,40,60,0.12)
        val lightPaint = Paint().also {
            it.asFrameworkPaint().apply {
                isAntiAlias = true
                color = android.graphics.Color.TRANSPARENT
                setShadowLayer(1f, -1f, -1f, lightShadowColor.toArgb())
            }
        }
        val rect = androidx.compose.ui.geometry.Rect(0f, 0f, size.width, size.height)
        canvas.drawRoundRect(rect.left, rect.top, rect.right, rect.bottom, cr, cr, darkPaint)
        canvas.drawRoundRect(rect.left, rect.top, rect.right, rect.bottom, cr, cr, lightPaint)
    }
}

/**
 * Glow modifier — radial gradient glow behind a composable (no blur required).
 * Works on all API levels. Color and radius control the effect.
 */
fun Modifier.glowBehind(
    color: Color,
    radius: Dp = 40.dp,
    alpha: Float = 0.25f,
) = this.drawBehind {
    val brush = androidx.compose.ui.graphics.Brush.radialGradient(
        colors = listOf(color.copy(alpha = alpha), Color.Transparent),
        center = center,
        radius = radius.toPx().coerceAtLeast(1f),
    )
    drawRect(brush = brush)
}

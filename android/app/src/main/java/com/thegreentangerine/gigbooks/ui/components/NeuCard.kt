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
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.unit.dp
import com.thegreentangerine.gigbooks.ui.theme.GigColors

/**
 * Neumorphic raised card — matches web .neu-card exactly.
 * Uses Compose shadow + border for the neumorphic effect.
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
            .shadow(
                elevation = 6.dp,
                shape = shape,
                ambientColor = GigColors.shadowDark,
                spotColor = GigColors.shadowDark,
            )
            .clip(shape)
            .background(GigColors.surface)
            .border(1.dp, GigColors.neuBorder, shape)
            .padding(16.dp),
        content = content,
    )
}

/**
 * Neumorphic inset well — matches web .neu-inset exactly.
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
            .background(GigColors.surfaceInset)
            .border(1.dp, GigColors.neuInsetBorder, shape)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        content = content,
    )
}

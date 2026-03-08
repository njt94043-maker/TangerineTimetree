package com.thegreentangerine.gigbooks.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val GigColorScheme = darkColorScheme(
    primary = GigColors.green,
    secondary = GigColors.teal,
    tertiary = GigColors.orange,
    background = GigColors.background,
    surface = GigColors.surface,
    error = GigColors.danger,
    onPrimary = GigColors.background,
    onSecondary = GigColors.background,
    onTertiary = GigColors.background,
    onBackground = GigColors.text,
    onSurface = GigColors.text,
    onError = GigColors.text,
    surfaceVariant = GigColors.surfaceInset,
    onSurfaceVariant = GigColors.textDim,
    outline = GigColors.textMuted,
)

@Composable
fun GigBooksTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = GigColorScheme,
        typography = GigTypography,
        content = content,
    )
}

package com.thegreentangerine.gigbooks.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val TangerineColorScheme = darkColorScheme(
    primary = TangerineColors.green,
    secondary = TangerineColors.teal,
    tertiary = TangerineColors.orange,
    background = TangerineColors.background,
    surface = TangerineColors.surface,
    error = TangerineColors.danger,
    onPrimary = TangerineColors.background,
    onSecondary = TangerineColors.background,
    onTertiary = TangerineColors.background,
    onBackground = TangerineColors.text,
    onSurface = TangerineColors.text,
    onError = TangerineColors.text,
    surfaceVariant = TangerineColors.surfaceInset,
    onSurfaceVariant = TangerineColors.textDim,
    outline = TangerineColors.textMuted,
)

@Composable
fun TangerineMediaTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = TangerineColorScheme,
        typography = TangerineTypography,
        content = content,
    )
}

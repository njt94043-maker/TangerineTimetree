package com.thegreentangerine.gigbooks.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * GigBooks color palette — matches web app CSS custom properties exactly.
 * Dark neumorphic theme.
 */
object GigColors {
    // Backgrounds
    val background = Color(0xFF0a0a10)
    val surface = Color(0xFF111118)
    val surfaceInset = Color(0xFF0c0c12)

    // Text
    val text = Color(0xFFe0e0e0)
    val textDim = Color(0xFF888899)
    val textMuted = Color(0xFF555566)

    // Accent colors
    val green = Color(0xFF00e676)
    val teal = Color(0xFF4dd0e1)
    val orange = Color(0xFFf39c12)
    val purple = Color(0xFFbb86fc)
    val danger = Color(0xFFff5252)

    // Calendar colors
    val calGig = Color(0xFF00e676)
    val calPractice = Color(0xFFbb86fc)
    val calAvailable = Color(0xFF4dd0e1)
    val calAway = Color(0xFFff5252)

    // Neumorphic
    val neuBorder = Color(0x0AFFFFFF)      // rgba(255,255,255,0.04)
    val neuInsetBorder = Color(0x4D000000) // rgba(0,0,0,0.3)
    val shadowDark = Color(0xFF000000)
    val shadowLight = Color(0x08FFFFFF)    // rgba(255,255,255,0.03)
}

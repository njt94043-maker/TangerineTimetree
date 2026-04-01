package com.thegreentangerine.gigbooks.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * Tangerine Media color palette — matches web app CSS custom properties exactly.
 * Dark neumorphic theme.
 */
object TangerineColors {
    // Backgrounds
    val background = Color(0xFF08080c)
    val surface = Color(0xFF111118)
    val surfaceLight = Color(0xFF16161f)
    val surfaceInset = Color(0xFF0c0c12)

    // Text
    val text = Color(0xFFd0d0dc)
    val textDim = Color(0xFF7a7a94)
    val textMuted = Color(0xFF4a4a60)

    // Accent colors
    val green = Color(0xFF00e676)
    val greenDark = Color(0xFF00c853)
    val teal = Color(0xFF1abc9c)
    val cyan = Color(0xFF00bcd4)
    val orange = Color(0xFFf39c12)
    val purple = Color(0xFFbb86fc)
    val pink = Color(0xFFe040fb)
    val danger = Color(0xFFff5252)
    val slate = Color(0xFF78909c)

    // Calendar colors — mirrors web legend exactly
    val calGig = Color(0xFF00e676)        // Pub gig (green)
    val calClient = Color(0xFFf39c12)     // Client gig (tangerine)
    val calEnquiry = Color(0xFFf39c12)    // Enquiry (tangerine, rendered dashed)
    val calPractice = Color(0xFFbb86fc)   // Practice (purple)
    val calAvailable = Color(0xFF4a4a60)  // Available/unbooked (dark gray, matches web)
    val calAway = Color(0xFFff5252)       // Away (red)

    // Neumorphic — canonical V4 shadows
    val neuBorder = Color(0x0AFFFFFF)       // rgba(255,255,255,0.04)
    val neuInsetBorder = Color(0x4D000000)  // rgba(0,0,0,0.3)
    val shadowDark = Color(0xCC000000)      // rgba(0,0,0,0.8) — raised primary
    val shadowLight = Color(0x1F28283C)     // rgba(40,40,60,0.12) — raised secondary
}

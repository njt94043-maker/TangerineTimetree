package com.thegreentangerine.gigbooks.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.thegreentangerine.gigbooks.data.xr18.PhoneSettings
import com.thegreentangerine.gigbooks.ui.theme.JetBrainsMono
import com.thegreentangerine.gigbooks.ui.theme.Karla
import com.thegreentangerine.gigbooks.ui.theme.TangerineColors

/**
 * Bottom-sheet content for picking camera facing + output rotation. Used by both
 * PeerScreen and GigModeScreen (orchestrator camera). Settings persist via
 * [com.thegreentangerine.gigbooks.data.xr18.CameraSettingsStore]; callers wire
 * the persistence on `onChange`.
 */
@Composable
fun CameraSettingsSheet(
    title: String,
    subtitle: String?,
    settings: PhoneSettings,
    onChange: (PhoneSettings) -> Unit,
    extras: (@Composable () -> Unit)? = null,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            title,
            fontFamily = Karla, fontWeight = FontWeight.Bold,
            fontSize = 16.sp, color = TangerineColors.text,
        )
        if (!subtitle.isNullOrBlank()) {
            Text(
                subtitle,
                fontFamily = Karla, fontSize = 11.sp,
                color = TangerineColors.textMuted.copy(alpha = 0.7f),
            )
        }

        SegmentedRow(
            label = "Camera",
            options = listOf("back" to "Back", "front" to "Front (selfie)"),
            selected = settings.cameraFacing,
            onSelect = { onChange(settings.copy(cameraFacing = it)) },
        )

        // Rotation: "Auto" (-1) follows the device's mount orientation. The
        // numeric overrides force a specific rotation if Auto picks wrong.
        val rotationKey = if (settings.useAutoRotation) -1 else settings.rotationDegrees
        SegmentedRow(
            label = "Output rotation",
            options = listOf(-1 to "Auto", 0 to "0°", 90 to "90°", 180 to "180°", 270 to "270°"),
            selected = rotationKey,
            onSelect = { picked ->
                if (picked == -1) {
                    onChange(settings.copy(useAutoRotation = true))
                } else {
                    onChange(settings.copy(useAutoRotation = false, rotationDegrees = picked))
                }
            },
        )

        Text(
            "\"Auto\" matches the saved video to the phone's mount orientation when Gig Mode / Peer is opened. Use the numeric overrides if Auto picks wrong.",
            fontFamily = Karla, fontSize = 10.sp,
            color = TangerineColors.textMuted.copy(alpha = 0.6f),
        )

        extras?.invoke()
        Spacer(Modifier.height(12.dp))
    }
}

@Composable
private fun <T> SegmentedRow(
    label: String,
    options: List<Pair<T, String>>,
    selected: T,
    onSelect: (T) -> Unit,
) {
    Column {
        Text(
            label,
            fontFamily = Karla, fontSize = 11.sp,
            color = TangerineColors.textMuted,
        )
        Spacer(Modifier.height(6.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            options.forEach { (value, lbl) ->
                val isSel = value == selected
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(8.dp))
                        .background(
                            if (isSel) TangerineColors.orange.copy(alpha = 0.18f)
                            else TangerineColors.background,
                        )
                        .border(
                            1.dp,
                            if (isSel) TangerineColors.orange.copy(alpha = 0.6f)
                            else TangerineColors.textMuted.copy(alpha = 0.2f),
                            RoundedCornerShape(8.dp),
                        )
                        .clickable { onSelect(value) }
                        .padding(vertical = 12.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        lbl,
                        fontFamily = if (lbl.endsWith("°")) JetBrainsMono else Karla,
                        fontSize = 12.sp,
                        fontWeight = if (isSel) FontWeight.Bold else FontWeight.Normal,
                        color = if (isSel) TangerineColors.orange else TangerineColors.textDim,
                    )
                }
            }
        }
    }
}

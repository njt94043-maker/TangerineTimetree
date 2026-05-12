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
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.thegreentangerine.gigbooks.data.xr18.CameraRecordingManager
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
    zoomRange: CameraRecordingManager.ZoomRange? = null,
    exposureCaps: CameraRecordingManager.ExposureCaps? = null,
    stabilisationSupported: Boolean = false,
    freeStorageBytes: Long? = null,
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

        SegmentedRow(
            label = "Resolution",
            options = listOf("720p" to "720p", "1080p" to "1080p", "4K" to "4K"),
            selected = settings.resolution,
            onSelect = { onChange(settings.copy(resolution = it)) },
        )

        SegmentedRow(
            label = "Frame rate",
            options = listOf(24 to "24", 30 to "30", 60 to "60"),
            selected = settings.framerate,
            onSelect = { onChange(settings.copy(framerate = it)) },
        )

        // Bitrate bucket (S150 P3 §6.3). Pre-approved values from brief:
        // Eco 4 Mbps / Standard 10 Mbps / High 20 Mbps. Rebind-class (the
        // Recorder is rebuilt) — mid-recording changes blocked by the
        // CameraRecordingManager rebind guard.
        SegmentedRow(
            label = "Quality",
            options = listOf("Eco" to "Eco", "Standard" to "Std", "High" to "High"),
            selected = settings.qualityBucket,
            onSelect = { onChange(settings.copy(qualityBucket = it)) },
        )

        // Stabilisation toggle (S150 P3 §6.4). Hidden when the selected
        // camera doesn't support it — per feedback--unfinished-not-orphan.md
        // the capability guard ships in this commit, not deferred. Rebind-
        // class via VideoCapture.Builder.setVideoStabilizationEnabled.
        if (stabilisationSupported) {
            SegmentedRow(
                label = "Stabilisation",
                options = listOf("Off" to "Off", "On" to "On"),
                selected = settings.stabilisation,
                onSelect = { onChange(settings.copy(stabilisation = it)) },
            )
        }

        // Storage estimator + free-space warning (S150 P3). Reads
        // getExternalFilesDir().usableSpace from the caller. Warning fires
        // at <1.5× the rough need for a 90 min set at current bitrate.
        val bitrateBps = CameraRecordingManager.bitrateForBucket(settings.qualityBucket)
        val minPerGb = CameraRecordingManager.minutesPerGb(bitrateBps)
        val freeGb = freeStorageBytes?.let { it.toDouble() / 1_000_000_000.0 } ?: 0.0
        val freeMinutes = (freeGb * minPerGb).toInt()
        val warnThresholdMin = (90 * 1.5).toInt()  // 90 min set × 1.5× buffer
        Column {
            Text(
                "~$minPerGb min per GB at this quality",
                fontFamily = Karla, fontSize = 10.sp,
                color = TangerineColors.textMuted.copy(alpha = 0.7f),
            )
            if (freeStorageBytes != null) {
                val warn = freeMinutes < warnThresholdMin
                Text(
                    "%.1f GB free → ~%d min available%s".format(
                        freeGb, freeMinutes,
                        if (warn) " ⚠ low for a long set" else "",
                    ),
                    fontFamily = Karla, fontSize = 10.sp,
                    color = if (warn) TangerineColors.orange else TangerineColors.textMuted.copy(alpha = 0.7f),
                )
            }
        }

        // Zoom slider — rebind-free via cameraControl.setZoomRatio (§B.4
        // gig-safety upheld; mid-recording-safe). Range is read from the
        // camera at bind time, so first open shows "Zoom (1.0x)" until
        // bind resolves the camera. Slider value drives PhoneSettings;
        // PeerScreen also wires pinch-zoom to the same field.
        if (zoomRange != null && zoomRange.max > zoomRange.min) {
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "Zoom",
                        fontFamily = Karla, fontSize = 11.sp,
                        color = TangerineColors.textMuted,
                        modifier = Modifier.weight(1f),
                    )
                    Text(
                        "%.1fx".format(settings.zoomRatio.coerceIn(zoomRange.min, zoomRange.max)),
                        fontFamily = JetBrainsMono, fontSize = 12.sp,
                        color = TangerineColors.text,
                    )
                }
                Spacer(Modifier.height(2.dp))
                Slider(
                    value = settings.zoomRatio.coerceIn(zoomRange.min, zoomRange.max),
                    onValueChange = { onChange(settings.copy(zoomRatio = it)) },
                    valueRange = zoomRange.min..zoomRange.max,
                    colors = SliderDefaults.colors(
                        thumbColor = TangerineColors.orange,
                        activeTrackColor = TangerineColors.orange,
                        inactiveTrackColor = TangerineColors.textMuted.copy(alpha = 0.3f),
                    ),
                )
                Row(modifier = Modifier.fillMaxWidth()) {
                    Text(
                        "%.1fx".format(zoomRange.min),
                        fontFamily = JetBrainsMono, fontSize = 9.sp,
                        color = TangerineColors.textMuted.copy(alpha = 0.7f),
                    )
                    Spacer(Modifier.weight(1f))
                    Text(
                        "%.1fx".format(zoomRange.max),
                        fontFamily = JetBrainsMono, fontSize = 9.sp,
                        color = TangerineColors.textMuted.copy(alpha = 0.7f),
                    )
                }
            }
        }

        // Exposure compensation — rebind-free, mid-recording-safe via
        // cameraControl.setExposureCompensationIndex. Display values are
        // whole EV stops mapped to the camera's index granularity (most
        // phones: 1/3 EV steps, so -2 EV = index -6). Hidden if camera
        // reports no exposure-comp support.
        if (exposureCaps != null) {
            SegmentedRow(
                label = "Exposure",
                options = listOf(
                    "-2" to "−2",
                    "-1" to "−1",
                    "Auto" to "Auto",
                    "+1" to "+1",
                    "+2" to "+2",
                ),
                selected = settings.exposure,
                onSelect = { onChange(settings.copy(exposure = it)) },
            )
        }

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

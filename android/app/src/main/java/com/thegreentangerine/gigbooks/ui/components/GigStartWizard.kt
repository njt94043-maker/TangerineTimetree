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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.thegreentangerine.gigbooks.data.xr18.CameraRecordingManager
import com.thegreentangerine.gigbooks.ui.theme.JetBrainsMono
import com.thegreentangerine.gigbooks.ui.theme.Karla
import com.thegreentangerine.gigbooks.ui.theme.TangerineColors

/**
 * Start-of-gig wizard (S129 row 6).
 *
 * Pre-fills the gig name from the calendar entry on today's date if one is
 * present (passed in by caller — caller looks it up via GigRepository in a
 * coroutine and feeds it as `prefill`). The drummer can edit, or if the gig
 * isn't on the calendar, type one in manually.
 *
 * Tapping [Start gig] fires the [onStart] callback with the chosen name —
 * caller is responsible for: (1) firing the Reaper-rename HTTP, (2) firing
 * the per-set OSC record, and (3) flipping the GigSession state.
 */
@Composable
fun GigStartWizard(
    prefill: String,
    onCancel: () -> Unit,
    onStart: (name: String) -> Unit,
) {
    var fieldValue by remember(prefill) { mutableStateOf(TextFieldValue(prefill)) }
    val canStart = fieldValue.text.trim().isNotEmpty()

    Dialog(
        onDismissRequest = onCancel,
        properties = DialogProperties(usePlatformDefaultWidth = false, dismissOnClickOutside = true),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp)
                .clip(RoundedCornerShape(20.dp))
                .background(TangerineColors.surface)
                .border(1.dp, TangerineColors.orange.copy(alpha = 0.4f), RoundedCornerShape(20.dp))
                .padding(20.dp),
        ) {
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    "START GIG",
                    fontFamily = JetBrainsMono, fontWeight = FontWeight.Bold,
                    fontSize = 11.sp, letterSpacing = 2.sp,
                    color = TangerineColors.orange,
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    "Name the gig — Reaper will save the project under this name. You'll get a moment to review everything before recording starts.",
                    fontFamily = Karla, fontSize = 13.sp, color = TangerineColors.textMuted,
                )
                Spacer(Modifier.height(14.dp))
                OutlinedTextField(
                    value = fieldValue,
                    onValueChange = { fieldValue = it },
                    label = { Text("Gig name", fontFamily = Karla, fontSize = 12.sp) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = TangerineColors.orange,
                        unfocusedBorderColor = TangerineColors.textMuted.copy(alpha = 0.4f),
                        focusedLabelColor = TangerineColors.orange,
                        unfocusedLabelColor = TangerineColors.textMuted,
                        focusedTextColor = TangerineColors.text,
                        unfocusedTextColor = TangerineColors.text,
                        cursorColor = TangerineColors.orange,
                    ),
                )
                if (prefill.isNotEmpty()) {
                    Spacer(Modifier.height(6.dp))
                    Text(
                        "Pre-filled from today's calendar entry. Edit if needed.",
                        fontFamily = Karla, fontSize = 11.sp,
                        color = TangerineColors.textMuted.copy(alpha = 0.7f),
                    )
                }
                Spacer(Modifier.height(18.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                ) {
                    WizardButton(
                        label = "Cancel",
                        accent = TangerineColors.textMuted,
                        enabled = true,
                        onClick = onCancel,
                    )
                    Spacer(Modifier.width(10.dp))
                    WizardButton(
                        label = "Start gig",
                        accent = TangerineColors.orange,
                        enabled = canStart,
                        onClick = {
                        // F5: canonicalise here so the slug flowing through
                        // session.gigName → phone files → rig dir → MS host
                        // is the SAME string everywhere. Prevents the
                        // "testing 2" → APK "testing_2" / rig "testing-2"
                        // split that masked recordings from the pull filter.
                        onStart(CameraRecordingManager.slugifyForWizard(fieldValue.text))
                    },
                    )
                }
            }
        }
    }
}

@Composable
private fun WizardButton(
    label: String,
    accent: Color,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    val tint = if (enabled) accent else accent.copy(alpha = 0.3f)
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(10.dp))
            .background(tint.copy(alpha = 0.1f))
            .border(1.dp, tint.copy(alpha = 0.6f), RoundedCornerShape(10.dp))
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 18.dp, vertical = 10.dp),
    ) {
        Text(
            label,
            fontFamily = Karla, fontWeight = FontWeight.Bold,
            fontSize = 13.sp, color = tint,
        )
    }
}

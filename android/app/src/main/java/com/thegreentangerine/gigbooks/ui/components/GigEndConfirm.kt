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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.thegreentangerine.gigbooks.ui.theme.JetBrainsMono
import com.thegreentangerine.gigbooks.ui.theme.Karla
import com.thegreentangerine.gigbooks.ui.theme.TangerineColors

/**
 * End-of-gig confirmation (S129 row 6).
 *
 * Two-tap protection so accidental presses on the End-gig button don't blow
 * away the recording session mid-gig. Caller decides what end-gig actually
 * does (currently: per-set stop fanout + final Reaper save).
 */
@Composable
fun GigEndConfirm(
    gigName: String,
    setsRecorded: Int,
    onCancel: () -> Unit,
    onConfirm: () -> Unit,
) {
    Dialog(
        onDismissRequest = onCancel,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp)
                .clip(RoundedCornerShape(20.dp))
                .background(TangerineColors.surface)
                .border(1.dp, TangerineColors.danger.copy(alpha = 0.5f), RoundedCornerShape(20.dp))
                .padding(20.dp),
        ) {
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    "END GIG?",
                    fontFamily = JetBrainsMono, fontWeight = FontWeight.Bold,
                    fontSize = 11.sp, letterSpacing = 2.sp,
                    color = TangerineColors.danger,
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    gigName.ifBlank { "(unnamed gig)" },
                    fontFamily = Karla, fontWeight = FontWeight.Bold,
                    fontSize = 17.sp, color = TangerineColors.text,
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    "$setsRecorded set${if (setsRecorded == 1) "" else "s"} recorded.\nReaper will save the project. The project stays open so you can review takes after.",
                    fontFamily = Karla, fontSize = 12.sp,
                    color = TangerineColors.textMuted,
                )
                Spacer(Modifier.height(18.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                ) {
                    EndButton(
                        label = "Cancel",
                        accent = TangerineColors.textMuted,
                        onClick = onCancel,
                    )
                    Spacer(Modifier.width(10.dp))
                    EndButton(
                        label = "End gig",
                        accent = TangerineColors.danger,
                        onClick = onConfirm,
                    )
                }
            }
        }
    }
}

@Composable
private fun EndButton(label: String, accent: Color, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(10.dp))
            .background(accent.copy(alpha = 0.1f))
            .border(1.dp, accent.copy(alpha = 0.6f), RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 18.dp, vertical = 10.dp),
    ) {
        Text(
            label,
            fontFamily = Karla, fontWeight = FontWeight.Bold,
            fontSize = 13.sp, color = accent,
        )
    }
}

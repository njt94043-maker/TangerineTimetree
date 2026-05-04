package com.thegreentangerine.gigbooks.ui.screens

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.thegreentangerine.gigbooks.data.recordings.RecordingsRepository
import com.thegreentangerine.gigbooks.ui.theme.JetBrainsMono
import com.thegreentangerine.gigbooks.ui.theme.Karla
import com.thegreentangerine.gigbooks.ui.theme.TangerineColors
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Lists every MP4 captured by the orchestrator (Gig Mode self-cam) and by the peer
 * role on this device. Tap a row to share via FileProvider; long-press for delete.
 *
 * v1.1.10 hotfix screen. Without this, a release APK gives no way to verify whether
 * RECORD actually wrote a file — exactly the gap that turned the S122 gig into a
 * silent failure.
 */
@Composable
fun RecordingsScreen(onMenuClick: () -> Unit) {
    val context = LocalContext.current
    var refreshTick by remember { mutableIntStateOf(0) }
    val recordings by remember(refreshTick) {
        mutableStateOf(RecordingsRepository.scan(context.filesDir))
    }
    var pendingDelete by remember { mutableStateOf<RecordingsRepository.Recording?>(null) }

    Column(modifier = Modifier.fillMaxSize().background(TangerineColors.background)) {
        // Top bar
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onMenuClick) {
                Icon(Icons.Default.Menu, "Menu", tint = TangerineColors.text)
            }
            Spacer(Modifier.width(4.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    "Recordings",
                    fontFamily = Karla, fontWeight = FontWeight.Bold,
                    fontSize = 22.sp, color = TangerineColors.text,
                )
                val totalSize = recordings.sumOf { it.sizeBytes }
                Text(
                    "${recordings.size} file${if (recordings.size == 1) "" else "s"} · ${formatSize(totalSize)} on device",
                    fontFamily = Karla, fontSize = 11.sp, color = TangerineColors.textMuted,
                )
            }
            IconButton(onClick = { refreshTick++ }) {
                Icon(Icons.Default.Refresh, "Refresh", tint = TangerineColors.text)
            }
        }

        if (recordings.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(32.dp)) {
                    Icon(
                        Icons.Default.Videocam,
                        contentDescription = null,
                        tint = TangerineColors.textMuted.copy(alpha = 0.5f),
                        modifier = Modifier.size(48.dp),
                    )
                    Spacer(Modifier.height(12.dp))
                    Text(
                        "No recordings yet",
                        fontFamily = Karla, fontWeight = FontWeight.Bold,
                        fontSize = 16.sp, color = TangerineColors.text,
                    )
                    Spacer(Modifier.height(6.dp))
                    Text(
                        "Hit RECORD on Gig Mode (orchestrator self-cam) or pair as a Peer camera, and files will land here.",
                        fontFamily = Karla, fontSize = 12.sp,
                        color = TangerineColors.textMuted,
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(horizontal = 12.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                items(recordings, key = { it.file.absolutePath }) { rec ->
                    RecordingRow(
                        rec = rec,
                        onPlay = {
                            runCatching {
                                val intent = RecordingsRepository.playIntent(context, rec.file)
                                context.startActivity(Intent.createChooser(intent, "Play recording"))
                            }
                        },
                        onShare = {
                            runCatching {
                                val intent = RecordingsRepository.shareIntent(context, rec.file)
                                context.startActivity(Intent.createChooser(intent, "Share recording"))
                            }
                        },
                        onDelete = { pendingDelete = rec },
                    )
                }
            }
        }
    }

    // Delete confirmation
    pendingDelete?.let { rec ->
        DeleteConfirmDialog(
            rec = rec,
            onConfirm = {
                RecordingsRepository.delete(rec.file)
                pendingDelete = null
                refreshTick++
            },
            onDismiss = { pendingDelete = null },
        )
    }
}

@Composable
private fun RecordingRow(
    rec: RecordingsRepository.Recording,
    onPlay: () -> Unit,
    onShare: () -> Unit,
    onDelete: () -> Unit,
) {
    val sourceColor = when (rec.source) {
        RecordingsRepository.Source.Orchestrator -> TangerineColors.green
        RecordingsRepository.Source.Peer -> TangerineColors.teal
    }
    val sourceLabel = when (rec.source) {
        RecordingsRepository.Source.Orchestrator -> "DRUMMER CAM"
        RecordingsRepository.Source.Peer -> "PEER CAM"
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(TangerineColors.surface)
            .border(1.dp, TangerineColors.textMuted.copy(alpha = 0.18f), RoundedCornerShape(10.dp))
            .clickable(onClick = onPlay)  // Tap row → play (most common action)
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(4.dp))
                        .background(sourceColor.copy(alpha = 0.15f))
                        .padding(horizontal = 5.dp, vertical = 1.dp),
                ) {
                    Text(
                        sourceLabel,
                        fontFamily = JetBrainsMono, fontSize = 8.sp,
                        fontWeight = FontWeight.Bold, color = sourceColor,
                    )
                }
                Spacer(Modifier.width(8.dp))
                Text(
                    formatSize(rec.sizeBytes),
                    fontFamily = JetBrainsMono, fontSize = 10.sp,
                    color = TangerineColors.textMuted,
                )
            }
            Spacer(Modifier.height(4.dp))
            Text(
                rec.file.nameWithoutExtension,
                fontFamily = Karla, fontSize = 12.sp, fontWeight = FontWeight.SemiBold,
                color = TangerineColors.text, maxLines = 2,
            )
            Text(
                formatDate(rec.modifiedMs),
                fontFamily = Karla, fontSize = 10.sp, color = TangerineColors.textMuted,
            )
        }
        IconButton(onClick = onPlay) {
            Icon(Icons.Default.PlayArrow, "Play", tint = TangerineColors.green, modifier = Modifier.size(20.dp))
        }
        IconButton(onClick = onShare) {
            Icon(Icons.Default.Share, "Share", tint = TangerineColors.text, modifier = Modifier.size(18.dp))
        }
        IconButton(onClick = onDelete) {
            Icon(Icons.Default.Delete, "Delete", tint = TangerineColors.danger.copy(alpha = 0.7f), modifier = Modifier.size(18.dp))
        }
    }
}

@Composable
private fun DeleteConfirmDialog(
    rec: RecordingsRepository.Recording,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    androidx.compose.material3.AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Delete recording?", fontFamily = Karla) },
        text = {
            Text(
                "This will permanently delete:\n\n${rec.file.name}\n\n${formatSize(rec.sizeBytes)} · ${formatDate(rec.modifiedMs)}",
                fontFamily = Karla, fontSize = 12.sp,
            )
        },
        confirmButton = {
            androidx.compose.material3.TextButton(onClick = onConfirm) {
                Text("Delete", color = TangerineColors.danger, fontFamily = Karla)
            }
        },
        dismissButton = {
            androidx.compose.material3.TextButton(onClick = onDismiss) {
                Text("Cancel", color = TangerineColors.text, fontFamily = Karla)
            }
        },
        containerColor = TangerineColors.surface,
    )
}

private fun formatSize(bytes: Long): String = when {
    bytes >= 1_000_000_000L -> "%.1f GB".format(bytes / 1_000_000_000.0)
    bytes >= 1_000_000L -> "%.0f MB".format(bytes / 1_000_000.0)
    bytes >= 1_000L -> "%.0f KB".format(bytes / 1_000.0)
    else -> "$bytes B"
}

private fun formatDate(ms: Long): String =
    SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.UK).format(Date(ms))

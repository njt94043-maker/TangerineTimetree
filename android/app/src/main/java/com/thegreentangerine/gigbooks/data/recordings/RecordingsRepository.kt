package com.thegreentangerine.gigbooks.data.recordings

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import java.io.File

/**
 * Lists MP4s captured by the orchestrator (this device, when in Gig Mode) and the
 * peer role (this device, when in Peer mode). Same APK can play either role at
 * different times, so both folders are scanned. Powers the Recordings screen.
 *
 * Why this exists: post-S122 hotfix. Without an in-app file browser there's no way
 * to verify post-set captures from a release APK (run-as is blocked). The S122 gig
 * was lost partly because there was no visible signal that recording wasn't engaging.
 */
object RecordingsRepository {

    enum class Source { Orchestrator, Peer }

    data class Recording(
        val file: File,
        val source: Source,
        val sizeBytes: Long,
        val modifiedMs: Long,
    )

    fun scan(filesDir: File): List<Recording> {
        val out = mutableListOf<Recording>()
        listOf(
            File(filesDir, "orchestrator_recordings") to Source.Orchestrator,
            File(filesDir, "peer_recordings") to Source.Peer,
        ).forEach { (dir, source) ->
            dir.listFiles()?.forEach { f ->
                if (f.isFile && f.extension.equals("mp4", ignoreCase = true)) {
                    out.add(Recording(f, source, f.length(), f.lastModified()))
                }
            }
        }
        return out.sortedByDescending { it.modifiedMs }
    }

    fun shareIntent(context: Context, file: File): Intent {
        val uri = providerUri(context, file)
        return Intent(Intent.ACTION_SEND).apply {
            type = "video/mp4"
            putExtra(Intent.EXTRA_STREAM, uri)
            // setClipData lets the sharesheet read the URI for thumbnail preview;
            // without it Android logs ChooserPreview warnings + shows no thumbnail.
            clipData = android.content.ClipData.newRawUri(file.name, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
    }

    /** Opens the file in whatever video player the user has set as default. */
    fun playIntent(context: Context, file: File): Intent {
        val uri = providerUri(context, file)
        return Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "video/mp4")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
    }

    private fun providerUri(context: Context, file: File) =
        FileProvider.getUriForFile(context, "${context.packageName}.provider", file)

    fun delete(file: File): Boolean = runCatching { file.delete() }.getOrDefault(false)
}

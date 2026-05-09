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
 *
 * S148: video output base dir migrated from internal `filesDir` (private,
 * `/data/data/<pkg>/files/`, invisible to adb on release builds) to external
 * `getExternalFilesDir(null)` (`/sdcard/Android/data/<pkg>/files/`, accessible
 * via `adb pull` without root or run-as). This unblocks the post-prod chain
 * (pull-videos.py reads from this path). Legacy internal recordings remain
 * visible in the in-app Recordings screen via the dual scan below; only NEW
 * captures land at the external path.
 */
object RecordingsRepository {

    enum class Source { Orchestrator, Peer }

    data class Recording(
        val file: File,
        val source: Source,
        val sizeBytes: Long,
        val modifiedMs: Long,
    )

    /**
     * S148: canonical base dir for new video captures. External app-specific
     * storage when available (so adb pull works without root) — falls back to
     * private filesDir on devices/emulators without external storage. Used by
     * GigModeScreen (orchestrator) and PeerScreen (peer) to compute the
     * per-role output dir, and by [scan] as one of the locations to walk.
     */
    fun videoBaseDir(context: Context): File =
        context.getExternalFilesDir(null) ?: context.filesDir

    fun scan(context: Context): List<Recording> {
        val out = mutableListOf<Recording>()
        // Scan both the new external base AND the legacy private filesDir so
        // recordings made before the S148 update remain visible in-app.
        // Distinct() so a device that returns the same path for both (rare,
        // but possible) doesn't double-list every file.
        val bases = listOf(videoBaseDir(context), context.filesDir).distinctBy { it.absolutePath }
        bases.forEach { base ->
            listOf(
                File(base, "orchestrator_recordings") to Source.Orchestrator,
                File(base, "peer_recordings") to Source.Peer,
            ).forEach { (dir, source) ->
                dir.listFiles()?.forEach { f ->
                    if (f.isFile && f.extension.equals("mp4", ignoreCase = true)) {
                        out.add(Recording(f, source, f.length(), f.lastModified()))
                    }
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

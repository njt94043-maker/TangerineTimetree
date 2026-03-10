package com.thegreentangerine.gigbooks.data.audio

import android.content.Context
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File

/**
 * Local storage for takes (S41).
 * Non-best takes stay on device. Best takes upload to Supabase.
 * Stores audio files + metadata JSON in internal storage.
 */
object LocalTakesStore {

    private const val TAKES_DIR = "takes"
    private const val META_FILE = "takes_meta.json"

    @Serializable
    data class LocalTake(
        val id: String, // songId:userId:takeNumber
        val songId: String,
        val userId: String,
        val takeNumber: Int,
        val audioFileName: String,
        val durationSeconds: Double,
        val label: String,
        val createdAt: String,
        val videoFileName: String? = null,
    )

    @Serializable
    private data class TakesMetadata(
        val takes: MutableList<LocalTake> = mutableListOf()
    )

    private fun takesDir(context: Context): File {
        val dir = File(context.filesDir, TAKES_DIR)
        if (!dir.exists()) dir.mkdirs()
        return dir
    }

    private fun metaFile(context: Context): File = File(takesDir(context), META_FILE)

    private fun loadMeta(context: Context): TakesMetadata {
        val file = metaFile(context)
        if (!file.exists()) return TakesMetadata()
        return try {
            Json.decodeFromString(file.readText())
        } catch (e: Exception) {
            TakesMetadata()
        }
    }

    private fun saveMeta(context: Context, meta: TakesMetadata) {
        metaFile(context).writeText(Json.encodeToString(meta))
    }

    fun makeTakeId(songId: String, userId: String, takeNumber: Int): String =
        "$songId:$userId:$takeNumber"

    /** Get all local takes for a song/user, sorted by take number */
    fun getUserTakes(context: Context, songId: String, userId: String): List<LocalTake> {
        val meta = loadMeta(context)
        return meta.takes
            .filter { it.songId == songId && it.userId == userId }
            .sortedBy { it.takeNumber }
    }

    /** Get next take number for a song/user (D-143) */
    fun getNextTakeNumber(context: Context, songId: String, userId: String): Int {
        val takes = getUserTakes(context, songId, userId)
        return if (takes.isEmpty()) 1 else takes.maxOf { it.takeNumber } + 1
    }

    /** Save a take locally */
    fun saveTake(context: Context, take: LocalTake, audioData: ByteArray) {
        val audioFile = File(takesDir(context), take.audioFileName)
        audioFile.writeBytes(audioData)

        val meta = loadMeta(context)
        meta.takes.removeAll { it.id == take.id }
        meta.takes.add(take)
        saveMeta(context, meta)
    }

    /** Get audio file path for a take */
    fun getAudioFile(context: Context, take: LocalTake): File =
        File(takesDir(context), take.audioFileName)

    /** Delete a local take */
    fun deleteTake(context: Context, takeId: String) {
        val meta = loadMeta(context)
        val take = meta.takes.firstOrNull { it.id == takeId }
        if (take != null) {
            File(takesDir(context), take.audioFileName).delete()
            take.videoFileName?.let { File(takesDir(context), it).delete() }
            meta.takes.remove(take)
            saveMeta(context, meta)
        }
    }

    /** Delete all local takes for a song/user */
    fun deleteAllTakes(context: Context, songId: String, userId: String) {
        val meta = loadMeta(context)
        val toRemove = meta.takes.filter { it.songId == songId && it.userId == userId }
        toRemove.forEach { take ->
            File(takesDir(context), take.audioFileName).delete()
            take.videoFileName?.let { File(takesDir(context), it).delete() }
        }
        meta.takes.removeAll(toRemove.toSet())
        saveMeta(context, meta)
    }
}

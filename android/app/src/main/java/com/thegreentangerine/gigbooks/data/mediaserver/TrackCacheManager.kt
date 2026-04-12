package com.thegreentangerine.gigbooks.data.mediaserver

import android.content.Context
import android.util.Log
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

/**
 * Manages offline track caching for the media server.
 * - Auto-caches tracks on play (configurable max size)
 * - Supports explicit pin for offline
 * - Provides storage usage stats
 * - Background sync metadata when server becomes available
 */
class TrackCacheManager(private val context: Context) {

    companion object {
        private const val TAG = "TrackCacheManager"
        private const val DEFAULT_MAX_CACHE_MB = 2048L // 2GB default
        private const val METADATA_FILE = "cache_metadata.json"
    }

    private val json = Json { ignoreUnknownKeys = true; prettyPrint = false }

    private val cacheDir: File
        get() = File(context.cacheDir, "media_server_cache").also { it.mkdirs() }

    private val trackCacheDir: File
        get() = File(cacheDir, "tracks").also { it.mkdirs() }

    private val stemCacheDir: File
        get() = File(cacheDir, "stems").also { it.mkdirs() }

    private val _metadata = MutableStateFlow(loadMetadata())
    val metadata: StateFlow<CacheMetadata> = _metadata

    var maxCacheSizeMb: Long = DEFAULT_MAX_CACHE_MB

    // ── Auto-cache on play ──

    /**
     * Cache a track audio file for offline playback.
     * Called automatically on play.
     */
    suspend fun cacheTrackOnPlay(trackId: String, streamUrl: String): File? {
        val existing = getCachedTrack(trackId)
        if (existing != null) return existing

        // Check space
        if (getCacheSizeMb() >= maxCacheSizeMb) {
            evictOldest()
        }

        return downloadTrack(trackId, streamUrl)
    }

    /**
     * Explicitly pin a track for offline use (won't be evicted).
     */
    suspend fun pinTrack(trackId: String, streamUrl: String): Boolean {
        val file = cacheTrackOnPlay(trackId, streamUrl) ?: return false

        val meta = _metadata.value.copy()
        val entry = meta.tracks[trackId] ?: CachedTrackEntry(trackId = trackId)
        meta.tracks[trackId] = entry.copy(pinned = true, lastAccessed = System.currentTimeMillis())
        _metadata.value = meta
        saveMetadata(meta)
        return true
    }

    /**
     * Unpin a track (allows eviction).
     */
    fun unpinTrack(trackId: String) {
        val meta = _metadata.value.copy()
        meta.tracks[trackId]?.let {
            meta.tracks[trackId] = it.copy(pinned = false)
            _metadata.value = meta
            saveMetadata(meta)
        }
    }

    /**
     * Pin stems for offline practice.
     */
    suspend fun pinStems(trackId: String, client: MediaServerClient): Boolean {
        val dir = client.downloadStems(trackId) ?: return false

        val meta = _metadata.value.copy()
        val entry = meta.tracks[trackId] ?: CachedTrackEntry(trackId = trackId)
        meta.tracks[trackId] = entry.copy(stemsCached = true, pinned = true)
        _metadata.value = meta
        saveMetadata(meta)
        return true
    }

    // ── Query cached state ──

    fun getCachedTrack(trackId: String): File? {
        val file = File(trackCacheDir, trackId)
        return if (file.exists()) file else null
    }

    fun isTrackCached(trackId: String): Boolean = getCachedTrack(trackId) != null

    fun isTrackPinned(trackId: String): Boolean =
        _metadata.value.tracks[trackId]?.pinned == true

    fun isStemsCached(trackId: String): Boolean =
        _metadata.value.tracks[trackId]?.stemsCached == true

    // ── Storage management ──

    fun getCacheSizeMb(): Long = getCacheSizeBytes() / (1024 * 1024)

    fun getCacheSizeBytes(): Long =
        cacheDir.walkTopDown().filter { it.isFile }.sumOf { it.length() }

    fun getCachedTrackCount(): Int = _metadata.value.tracks.size

    fun getPinnedTrackCount(): Int = _metadata.value.tracks.values.count { it.pinned }

    /**
     * Clear all non-pinned cached tracks.
     */
    fun clearUnpinnedCache() {
        val meta = _metadata.value.copy()
        val toRemove = meta.tracks.filter { !it.value.pinned }.keys

        for (trackId in toRemove) {
            File(trackCacheDir, trackId).delete()
            File(stemCacheDir, trackId).deleteRecursively()
            meta.tracks.remove(trackId)
        }

        _metadata.value = meta
        saveMetadata(meta)
        Log.i(TAG, "Cleared ${toRemove.size} unpinned tracks from cache")
    }

    /**
     * Clear everything including pinned tracks.
     */
    fun clearAllCache() {
        trackCacheDir.deleteRecursively()
        stemCacheDir.deleteRecursively()
        trackCacheDir.mkdirs()
        stemCacheDir.mkdirs()

        _metadata.value = CacheMetadata()
        saveMetadata(_metadata.value)
        Log.i(TAG, "Cache fully cleared")
    }

    // ── Background sync ──

    /**
     * Sync metadata for cached tracks with the server.
     * Updates titles, artists, BPM, etc.
     */
    suspend fun syncMetadata(client: MediaServerClient) {
        if (!client.isConnected) return
        val meta = _metadata.value
        Log.i(TAG, "Syncing metadata for ${meta.tracks.size} cached tracks")
        // Metadata stays in sync through the server API — this is a no-op placeholder
        // for future enrichment (e.g., fetching updated metadata for cached tracks)
    }

    // ── Internal ──

    private suspend fun downloadTrack(trackId: String, streamUrl: String): File? =
        withContext(Dispatchers.IO) {
            try {
                val destFile = File(trackCacheDir, trackId)
                val conn = URL(streamUrl).openConnection() as HttpURLConnection
                conn.connectTimeout = 5000
                conn.readTimeout = 60_000

                if (conn.responseCode != 200) {
                    conn.disconnect()
                    return@withContext null
                }

                FileOutputStream(destFile).use { out ->
                    conn.inputStream.copyTo(out)
                }
                conn.disconnect()

                // Update metadata
                val meta = _metadata.value.copy()
                meta.tracks[trackId] = CachedTrackEntry(
                    trackId = trackId,
                    sizeBytes = destFile.length(),
                    cachedAt = System.currentTimeMillis(),
                    lastAccessed = System.currentTimeMillis(),
                )
                _metadata.value = meta
                saveMetadata(meta)

                Log.d(TAG, "Cached track $trackId (${destFile.length() / 1024}KB)")
                destFile
            } catch (e: Exception) {
                Log.e(TAG, "Failed to cache track $trackId: ${e.message}")
                null
            }
        }

    private fun evictOldest() {
        val meta = _metadata.value.copy()
        val candidates = meta.tracks.values
            .filter { !it.pinned }
            .sortedBy { it.lastAccessed }

        for (entry in candidates) {
            File(trackCacheDir, entry.trackId).delete()
            File(stemCacheDir, entry.trackId).deleteRecursively()
            meta.tracks.remove(entry.trackId)

            if (getCacheSizeMb() < maxCacheSizeMb * 0.8) break
        }

        _metadata.value = meta
        saveMetadata(meta)
    }

    private fun loadMetadata(): CacheMetadata {
        val file = File(cacheDir, METADATA_FILE)
        return try {
            if (file.exists()) json.decodeFromString(file.readText()) else CacheMetadata()
        } catch (e: Exception) {
            Log.w(TAG, "Failed to load cache metadata: ${e.message}")
            CacheMetadata()
        }
    }

    private fun saveMetadata(meta: CacheMetadata) {
        try {
            File(cacheDir, METADATA_FILE).writeText(json.encodeToString(meta))
        } catch (e: Exception) {
            Log.w(TAG, "Failed to save cache metadata: ${e.message}")
        }
    }
}

@Serializable
data class CacheMetadata(
    val tracks: MutableMap<String, CachedTrackEntry> = mutableMapOf(),
)

@Serializable
data class CachedTrackEntry(
    val trackId: String = "",
    val sizeBytes: Long = 0,
    val cachedAt: Long = 0,
    val lastAccessed: Long = 0,
    val pinned: Boolean = false,
    val stemsCached: Boolean = false,
)

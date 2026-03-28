package com.thegreentangerine.gigbooks.data.supabase

import android.content.Context
import android.util.Log
import kotlinx.serialization.KSerializer
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import java.io.File

/**
 * Generic file-based JSON cache for offline-first data access.
 * Stores serialized lists in the app's cache directory with TTL-based expiry.
 * Cache-first: always returns cached data immediately, then fetches fresh in background.
 */
class OfflineCache(context: Context) {

    companion object {
        private const val TAG = "OfflineCache"
        private const val CACHE_DIR = "offline_cache"
        private const val DEFAULT_TTL_MS = 30 * 60 * 1000L  // 30 minutes
    }

    private val cacheDir = File(context.cacheDir, CACHE_DIR).also { it.mkdirs() }

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    /**
     * Get cached list, or null if no cache or expired.
     * If [ignoreExpiry] is true, returns cached data even if stale (for offline use).
     */
    fun <T> getList(key: String, serializer: KSerializer<T>, ignoreExpiry: Boolean = false): List<T>? {
        val file = File(cacheDir, "$key.json")
        val metaFile = File(cacheDir, "$key.meta")
        if (!file.exists()) return null

        // Check expiry
        if (!ignoreExpiry && metaFile.exists()) {
            try {
                val savedAt = metaFile.readText().trim().toLong()
                if (System.currentTimeMillis() - savedAt > DEFAULT_TTL_MS) return null
            } catch (_: Exception) { /* treat as expired */ return null }
        }

        return try {
            val text = file.readText()
            json.decodeFromString(ListSerializer(serializer), text)
        } catch (e: Exception) {
            Log.w(TAG, "Cache read failed for $key: ${e.message}")
            null
        }
    }

    /**
     * Save a list to cache.
     */
    fun <T> putList(key: String, data: List<T>, serializer: KSerializer<T>) {
        try {
            val file = File(cacheDir, "$key.json")
            val metaFile = File(cacheDir, "$key.meta")
            file.writeText(json.encodeToString(ListSerializer(serializer), data))
            metaFile.writeText(System.currentTimeMillis().toString())
        } catch (e: Exception) {
            Log.w(TAG, "Cache write failed for $key: ${e.message}")
        }
    }

    /**
     * Cache-first fetch: returns cached data immediately if available,
     * then calls [fetch] to get fresh data and updates cache.
     * If offline and cache exists (even stale), returns cached data.
     * If offline and no cache, throws the original exception.
     */
    suspend fun <T> cacheFirst(
        key: String,
        serializer: KSerializer<T>,
        fetch: suspend () -> List<T>,
    ): List<T> {
        // Try network first
        return try {
            val fresh = fetch()
            putList(key, fresh, serializer)
            fresh
        } catch (e: Exception) {
            // Network failed — try cache (ignore expiry for offline)
            val cached = getList(key, serializer, ignoreExpiry = true)
            if (cached != null) {
                Log.d(TAG, "Offline: returning cached $key (${cached.size} items)")
                cached
            } else {
                throw e  // No cache, propagate error
            }
        }
    }

    /** Clear all cached data. */
    fun clear() {
        cacheDir.listFiles()?.forEach { it.delete() }
    }
}

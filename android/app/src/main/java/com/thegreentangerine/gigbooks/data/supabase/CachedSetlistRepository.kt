package com.thegreentangerine.gigbooks.data.supabase

import com.thegreentangerine.gigbooks.data.supabase.models.Setlist

/**
 * Offline-first wrapper around SetlistRepository.
 * Returns cached data when offline, updates cache on successful fetches.
 */
class CachedSetlistRepository(private val cache: OfflineCache) {

    suspend fun getSetlists(): List<Setlist> =
        cache.cacheFirst("setlists_all", Setlist.serializer()) {
            SetlistRepository.getSetlists()
        }

    suspend fun getSetlistsByType(type: String): List<Setlist> =
        cache.cacheFirst("setlists_type_$type", Setlist.serializer()) {
            SetlistRepository.getSetlistsByType(type)
        }
}

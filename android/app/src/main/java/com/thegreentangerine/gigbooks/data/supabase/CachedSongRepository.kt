package com.thegreentangerine.gigbooks.data.supabase

import com.thegreentangerine.gigbooks.data.supabase.models.Song

/**
 * Offline-first wrapper around SongRepository.
 * Read operations use cache-first strategy. Write operations pass through directly.
 */
class CachedSongRepository(private val cache: OfflineCache) {

    suspend fun getSongs(): List<Song> =
        cache.cacheFirst("songs_all", Song.serializer()) {
            SongRepository.getSongs()
        }

    suspend fun getSongsByCategory(category: String): List<Song> =
        cache.cacheFirst("songs_cat_$category", Song.serializer()) {
            SongRepository.getSongsByCategory(category)
        }

    suspend fun getSongsByOwner(ownerId: String): List<Song> =
        cache.cacheFirst("songs_owner_$ownerId", Song.serializer()) {
            SongRepository.getSongsByOwner(ownerId)
        }

    /** Direct pass-through — writes require network. */
    suspend fun getSong(id: String): Song = SongRepository.getSong(id)
    suspend fun createSong(name: String, category: String = "personal_original", bpm: Double = 120.0): Song =
        SongRepository.createSong(name, category, bpm)
    suspend fun updateSong(songId: String, updates: Map<String, Any?>) =
        SongRepository.updateSong(songId, updates)
}

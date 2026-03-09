package com.thegreentangerine.gigbooks.data.supabase

import com.thegreentangerine.gigbooks.data.supabase.models.BeatMap
import com.thegreentangerine.gigbooks.data.supabase.models.Song
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Order

object SongRepository {

    private val client get() = SupabaseProvider.client

    suspend fun getSongs(): List<Song> = client
        .from("songs")
        .select {
            order("name", Order.ASCENDING)
        }
        .decodeList()

    suspend fun getSongsByCategory(category: String): List<Song> = client
        .from("songs")
        .select {
            filter { eq("category", category) }
            order("name", Order.ASCENDING)
        }
        .decodeList()

    suspend fun getSongsByOwner(ownerId: String): List<Song> = client
        .from("songs")
        .select {
            filter { eq("owner_id", ownerId) }
            order("name", Order.ASCENDING)
        }
        .decodeList()

    suspend fun getSong(id: String): Song = client
        .from("songs")
        .select {
            filter { eq("id", id) }
        }
        .decodeSingle()

    suspend fun updateBeatInfo(songId: String, bpm: Double, beatOffsetMs: Int) {
        client.from("songs").update({
            set("bpm", bpm)
            set("beat_offset_ms", beatOffsetMs)
        }) {
            filter { eq("id", songId) }
        }
    }

    /** Fetch server-side beat map for a song. Returns null if none exists or status != 'ready'. */
    suspend fun getBeatMap(songId: String): BeatMap? {
        val result = client
            .from("beat_maps")
            .select {
                filter {
                    eq("song_id", songId)
                    eq("status", "ready")
                }
            }
            .decodeList<BeatMap>()
        return result.firstOrNull()
    }
}

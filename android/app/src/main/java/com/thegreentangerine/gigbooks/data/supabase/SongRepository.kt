package com.thegreentangerine.gigbooks.data.supabase

import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import com.thegreentangerine.gigbooks.data.supabase.models.BeatMap
import com.thegreentangerine.gigbooks.data.supabase.models.Song
import com.thegreentangerine.gigbooks.data.supabase.models.SongShare
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Order

object SongRepository {

    private val client get() = SupabaseProvider.client

    /** Quick-create a song with minimal fields (D-138 new song idea) */
    suspend fun createSong(
        name: String,
        category: String = "personal_original",
        bpm: Double = 120.0,
    ): Song {
        val userId = client.auth.currentUserOrNull()?.id ?: error("Not authenticated")
        return client.from("songs").insert(buildJsonObject {
            put("name", name)
            put("category", category)
            put("bpm", bpm)
            put("created_by", userId)
            if (category.startsWith("personal")) put("owner_id", userId)
        }) { select() }.decodeSingle()
    }

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

    /** Full song update via JSON object — keys are DB column names (snake_case). */
    suspend fun updateSong(songId: String, updates: Map<String, Any?>) {
        client.from("songs").update(buildJsonObject {
            for ((key, value) in updates) {
                when (value) {
                    is String -> put(key, value)
                    is Number -> put(key, value.toDouble())
                    is Boolean -> put(key, value)
                    null -> put(key, null as String?)
                    else -> put(key, value.toString())
                }
            }
        }) {
            filter { eq("id", songId) }
        }
    }

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

    // ─── Sharing (D-135) ─────────────────────────────

    suspend fun getSongShares(songId: String): List<SongShare> = client
        .from("song_shares")
        .select {
            filter { eq("song_id", songId) }
            order("created_at", Order.ASCENDING)
        }
        .decodeList()

    /** Get IDs of personal_original songs shared with a specific user */
    suspend fun getSharedSongIds(userId: String): Set<String> {
        val shares = client
            .from("song_shares")
            .select {
                filter { eq("shared_with", userId) }
            }
            .decodeList<SongShare>()
        return shares.map { it.songId }.toSet()
    }
}

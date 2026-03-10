package com.thegreentangerine.gigbooks.data.supabase

import com.thegreentangerine.gigbooks.data.supabase.models.SongStem
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.auth.auth

object StemRepository {

    private val client get() = SupabaseProvider.client

    suspend fun getStemsBySongId(songId: String): List<SongStem> = client
        .from("song_stems")
        .select {
            filter { eq("song_id", songId) }
        }
        .decodeList()

    /** Get all recorded takes for current user on a song (S41) */
    suspend fun getUserRecordedTakes(songId: String): List<SongStem> {
        val userId = client.auth.currentUserOrNull()?.id ?: return emptyList()
        return client
            .from("song_stems")
            .select {
                filter {
                    eq("song_id", songId)
                    eq("created_by", userId)
                    eq("source", "recorded")
                }
            }
            .decodeList()
    }

    /** Set a take as best take for current user on a song (D-130) */
    suspend fun setBestTake(stemId: String, songId: String) {
        val userId = client.auth.currentUserOrNull()?.id ?: return
        // Clear existing best takes for this user on this song
        client.from("song_stems").update(
            { set("is_best_take", false) }
        ) {
            filter {
                eq("song_id", songId)
                eq("created_by", userId)
                eq("is_best_take", true)
            }
        }
        // Set new best
        client.from("song_stems").update(
            { set("is_best_take", true) }
        ) {
            filter { eq("id", stemId) }
        }
    }

    /** Clear best take flag (D-149) */
    suspend fun clearBestTake(stemId: String) {
        client.from("song_stems").update(
            { set("is_best_take", false) }
        ) {
            filter { eq("id", stemId) }
        }
    }

    /** Delete a recorded take */
    suspend fun deleteRecordedTake(stemId: String) {
        client.from("song_stems").delete {
            filter { eq("id", stemId) }
        }
    }
}

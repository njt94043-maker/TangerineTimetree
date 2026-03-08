package com.thegreentangerine.gigbooks.data.supabase

import com.thegreentangerine.gigbooks.data.supabase.models.SongStem
import io.github.jan.supabase.postgrest.from

object StemRepository {

    private val client get() = SupabaseProvider.client

    suspend fun getStemsBySongId(songId: String): List<SongStem> = client
        .from("song_stems")
        .select {
            filter { eq("song_id", songId) }
        }
        .decodeList()
}

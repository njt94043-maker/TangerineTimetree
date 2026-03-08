package com.thegreentangerine.gigbooks.data.supabase

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

    suspend fun getSong(id: String): Song = client
        .from("songs")
        .select {
            filter { eq("id", id) }
        }
        .decodeSingle()
}

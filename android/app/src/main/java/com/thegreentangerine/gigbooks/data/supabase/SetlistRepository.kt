package com.thegreentangerine.gigbooks.data.supabase

import com.thegreentangerine.gigbooks.data.supabase.models.Setlist
import com.thegreentangerine.gigbooks.data.supabase.models.SetlistSongRow
import com.thegreentangerine.gigbooks.data.supabase.models.SetlistWithSongs
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order

object SetlistRepository {

    private val client get() = SupabaseProvider.client

    suspend fun getSetlists(): List<Setlist> = client
        .from("setlists")
        .select {
            order("name", Order.ASCENDING)
        }
        .decodeList()

    suspend fun getSetlistsByType(type: String): List<Setlist> = client
        .from("setlists")
        .select {
            filter { eq("setlist_type", type) }
            order("name", Order.ASCENDING)
        }
        .decodeList()

    suspend fun getSetlistSongs(setlistId: String): List<SetlistSongRow> = client
        .from("setlist_songs")
        .select(Columns.raw("*, songs(*)"))
        .decodeList<SetlistSongRow>()
        .filter { it.setlistId == setlistId }
        .sortedBy { it.position }

    suspend fun getAllSetlistsWithSongs(): List<SetlistWithSongs> {
        val setlists = getSetlists()
        // Fetch all setlist_songs with nested song data in one query
        val allRows = client
            .from("setlist_songs")
            .select(Columns.raw("*, songs(*)")) {
                order("position", Order.ASCENDING)
            }
            .decodeList<SetlistSongRow>()

        val rowsBySetlist = allRows.groupBy { it.setlistId }

        return setlists.map { setlist ->
            SetlistWithSongs(
                setlist = setlist,
                songs = rowsBySetlist[setlist.id] ?: emptyList(),
            )
        }
    }
}

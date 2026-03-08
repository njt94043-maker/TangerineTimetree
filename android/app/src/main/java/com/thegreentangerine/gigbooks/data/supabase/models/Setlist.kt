package com.thegreentangerine.gigbooks.data.supabase.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Setlist(
    val id: String,
    val name: String,
    val description: String = "",
    val notes: String = "",
    @SerialName("created_by") val createdBy: String = "",
    @SerialName("created_at") val createdAt: String = "",
    @SerialName("updated_at") val updatedAt: String = "",
)

/**
 * Raw row from setlist_songs joined with songs(*).
 * Supabase PostgREST nested select puts the joined song under "songs" as a single object.
 */
@Serializable
data class SetlistSongRow(
    val id: String,
    @SerialName("setlist_id") val setlistId: String,
    @SerialName("song_id") val songId: String,
    val position: Double = 0.0,
    val notes: String = "",
    val songs: Song? = null,
)

data class SetlistWithSongs(
    val setlist: Setlist,
    val songs: List<SetlistSongRow>,
) {
    val songCount: Int get() = songs.size

    val totalDurationSeconds: Int? get() {
        val durations = songs.mapNotNull { it.songs?.durationSeconds?.toInt() }
        return if (durations.isEmpty()) null else durations.sum()
    }

    val totalDurationFormatted: String? get() = totalDurationSeconds?.let {
        val m = it / 60; val s = it % 60; "%d:%02d".format(m, s)
    }
}

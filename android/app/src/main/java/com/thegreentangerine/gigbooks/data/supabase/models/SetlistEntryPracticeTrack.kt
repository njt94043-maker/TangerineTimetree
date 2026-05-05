package com.thegreentangerine.gigbooks.data.supabase.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

/**
 * Per-version practice track row (S129 row 1, schema migration
 * `20260505000000_s129_setlist_entry_practice_tracks.sql`).
 *
 * Each setlist entry can have 0..8 of these — one per (versionLabel, format)
 * pair: original stereo / original stems / ours_a stereo / ours_a stems /
 * ours_b * 2 / ours_c * 2.
 *
 * Audio bytes live on Media Server (`msTrackId` / `msStemsRefs`). For Web
 * practice (W4 — band members on mobile), the MS ingest pipeline opt-in
 * uploads to Supabase Storage, populating `supabasePath` / `supabaseStemsPaths`.
 */
@Serializable
data class SetlistEntryPracticeTrack(
    val id: String,
    @SerialName("setlist_entry_id")     val setlistEntryId: String,
    @SerialName("version_label")        val versionLabel: String,   // original | ours_a | ours_b | ours_c
    val format: String,                                             // stereo | stems
    @SerialName("ms_track_id")          val msTrackId: String? = null,
    @SerialName("ms_stems_refs")        val msStemsRefs: JsonElement? = null,
    @SerialName("supabase_path")        val supabasePath: String? = null,
    @SerialName("supabase_stems_paths") val supabaseStemsPaths: JsonElement? = null,
    @SerialName("gig_album")            val gigAlbum: String? = null,
    @SerialName("duration_seconds")     val durationSeconds: Int? = null,
    val bpm: Int? = null,
    val notes: String? = null,
    @SerialName("created_at")           val createdAt: String? = null,
    @SerialName("updated_at")           val updatedAt: String? = null,
) {
    val isOriginal get() = versionLabel == VERSION_ORIGINAL
    val isOurs get() = versionLabel.startsWith(VERSION_OURS_PREFIX)

    /** Display label like "Ours A · stems" or "Original · stereo". */
    fun displayLabel(): String {
        val v = when (versionLabel) {
            VERSION_ORIGINAL -> "Original"
            VERSION_OURS_A -> "Ours A"
            VERSION_OURS_B -> "Ours B"
            VERSION_OURS_C -> "Ours C"
            else -> versionLabel
        }
        return "$v · $format"
    }

    /** Best ref for the MS player flow — track id, or null if not ingested yet. */
    fun msRefOrNull(): String? = msTrackId

    companion object {
        const val VERSION_ORIGINAL = "original"
        const val VERSION_OURS_A = "ours_a"
        const val VERSION_OURS_B = "ours_b"
        const val VERSION_OURS_C = "ours_c"
        const val VERSION_OURS_PREFIX = "ours_"

        const val FORMAT_STEREO = "stereo"
        const val FORMAT_STEMS = "stems"

        // Display order: Original first (canonical reference), then ours by recency.
        val VERSION_ORDER = listOf(VERSION_ORIGINAL, VERSION_OURS_A, VERSION_OURS_B, VERSION_OURS_C)
        val FORMAT_ORDER = listOf(FORMAT_STEREO, FORMAT_STEMS)
    }
}

package com.thegreentangerine.gigbooks.data.supabase.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Song(
    val id: String,
    val name: String,
    val artist: String = "",
    val bpm: Int = 120,
    @SerialName("time_signature_top") val timeSignatureTop: Int = 4,
    @SerialName("time_signature_bottom") val timeSignatureBottom: Int = 4,
    val subdivision: Int = 1,
    @SerialName("swing_percent") val swingPercent: Int = 50,
    @SerialName("accent_pattern") val accentPattern: String? = null,
    @SerialName("click_sound") val clickSound: String = "default",
    @SerialName("count_in_bars") val countInBars: Int = 0,
    @SerialName("duration_seconds") val durationSeconds: Int? = null,
    val key: String = "",
    val notes: String = "",
    val lyrics: String = "",
    val chords: String = "",
    @SerialName("beat_offset_ms") val beatOffsetMs: Int = 0,
    @SerialName("audio_url") val audioUrl: String? = null,
    @SerialName("audio_storage_path") val audioStoragePath: String? = null,
    @SerialName("created_by") val createdBy: String = "",
    @SerialName("created_at") val createdAt: String = "",
    @SerialName("updated_at") val updatedAt: String = "",
) {
    val hasAudio: Boolean get() = !audioUrl.isNullOrBlank()
    val timeSig: String get() = "$timeSignatureTop/$timeSignatureBottom"
    val durationFormatted: String? get() = durationSeconds?.let {
        val m = it / 60; val s = it % 60; "%d:%02d".format(m, s)
    }
}

package com.thegreentangerine.gigbooks.data.supabase.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Song(
    val id: String,
    val name: String,
    val artist: String = "",
    val bpm: Double = 120.0,
    @SerialName("time_signature_top") val timeSignatureTop: Double = 4.0,
    @SerialName("time_signature_bottom") val timeSignatureBottom: Double = 4.0,
    val subdivision: Double = 1.0,
    @SerialName("swing_percent") val swingPercent: Double = 50.0,
    @SerialName("accent_pattern") val accentPattern: String? = null,
    @SerialName("click_sound") val clickSound: String = "default",
    @SerialName("count_in_bars") val countInBars: Double = 0.0,
    @SerialName("duration_seconds") val durationSeconds: Double? = null,
    val key: String = "",
    val notes: String = "",
    val lyrics: String = "",
    val chords: String = "",
    @SerialName("beat_offset_ms") val beatOffsetMs: Double = 0.0,
    @SerialName("audio_url") val audioUrl: String? = null,
    @SerialName("audio_storage_path") val audioStoragePath: String? = null,
    @SerialName("created_by") val createdBy: String = "",
    @SerialName("created_at") val createdAt: String = "",
    @SerialName("updated_at") val updatedAt: String = "",
) {
    val hasAudio: Boolean get() = !audioUrl.isNullOrBlank()
    val timeSig: String get() = "${timeSignatureTop.toInt()}/${timeSignatureBottom.toInt()}"
    val durationFormatted: String? get() = durationSeconds?.let {
        val secs = it.toInt(); val m = secs / 60; val s = secs % 60; "%d:%02d".format(m, s)
    }
}

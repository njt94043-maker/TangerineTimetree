package com.thegreentangerine.gigbooks.data.supabase.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Mixer channel mapping for stems (matches SQL CHECK constraint labels, lowercase in DB):
 *   idx 0 (ch2) = DRUMS
 *   idx 1 (ch3) = BASS
 *   idx 2 (ch4) = GUITAR
 *   idx 3 (ch5) = KEYS
 *   idx 4 (ch6) = VOCALS
 *   idx 5 (ch7) = BACKING
 *   idx 6 (ch8) = OTHER
 */
enum class StemLabel {
    DRUMS, BASS, GUITAR, KEYS, VOCALS, BACKING, OTHER;

    /** Fixed mixer channel index for this label (ch2 = index 0). */
    val stemIndex: Int get() = ordinal

    companion object {
        fun fromString(value: String): StemLabel =
            entries.firstOrNull { it.name == value.uppercase() } ?: OTHER
    }
}

@Serializable
data class SongStem(
    val id: String,
    @SerialName("song_id") val songId: String,
    val label: String,
    @SerialName("audio_url") val audioUrl: String? = null,
    @SerialName("audio_storage_path") val audioStoragePath: String? = null,
    @SerialName("file_size_bytes") val fileSizeBytes: Long? = null,
    @SerialName("duration_seconds") val durationSeconds: Double? = null,
    @SerialName("created_at") val createdAt: String = "",
    @SerialName("updated_at") val updatedAt: String = "",
) {
    val stemLabel: StemLabel get() = StemLabel.fromString(label)
    val stemIndex: Int get() = stemLabel.stemIndex
    val mixerChannel: Int get() = 2 + stemIndex // ch0=click, ch1=track, ch2..7=stems
}

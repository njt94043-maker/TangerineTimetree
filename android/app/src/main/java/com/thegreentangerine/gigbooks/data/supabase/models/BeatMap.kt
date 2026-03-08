package com.thegreentangerine.gigbooks.data.supabase.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.float

/**
 * Server-side beat detection result (madmom RNN+DBN).
 * beats: JSONB array of float seconds [0.45, 0.92, 1.38, ...]
 */
@Serializable
data class BeatMap(
    val id: String,
    @SerialName("song_id") val songId: String,
    val beats: JsonArray,        // JSONB → JsonArray of JsonPrimitive floats
    val bpm: Double = 0.0,
    val status: String = "pending",  // pending | analysing | ready | failed
    val error: String? = null,
    @SerialName("created_at") val createdAt: String = "",
    @SerialName("updated_at") val updatedAt: String = "",
) {
    /** Convert JSONB beats array to a FloatArray of seconds. */
    fun beatsAsFloatArray(): FloatArray {
        return FloatArray(beats.size) { i -> (beats[i] as JsonPrimitive).float }
    }
}

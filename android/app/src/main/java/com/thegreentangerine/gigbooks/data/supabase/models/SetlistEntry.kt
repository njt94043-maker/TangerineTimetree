package com.thegreentangerine.gigbooks.data.supabase.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

/**
 * Single setlist row — self-contained SOT replacing the dead Songs model
 * (S118 ecosystem-pivot lock; S121 schema). Every app reads this verbatim
 * from Supabase Realtime: APK, Media Server PWA, TGT Web (propose-only),
 * Studio v2.
 *
 * Practice material lives on Media Server. `practiceAudioRef` and
 * `practiceStemsRefs` are flat pointers (URL-or-handle); Media Server
 * resolves them however it likes internally — Supabase never stores audio.
 */
@Serializable
data class SetlistEntry(
    val id: String,
    @SerialName("list_id")        val listId: String,           // staples | party | classic_rock
    val position: Int,
    val title: String,
    val artist: String? = null,
    val bpm: Int? = null,
    @SerialName("beats_per_bar")  val beatsPerBar: Int? = 4,
    @SerialName("click_y_n")      val clickYN: Boolean = false,
    @SerialName("click_config")   val clickConfig: JsonElement? = null,
    @SerialName("led_visual")     val ledVisual: String? = null,
    @SerialName("backdrop_url")   val backdropUrl: String? = null,
    val notes: String? = null,
    @SerialName("chord_text")     val chordText: String? = null,
    @SerialName("lyric_text")     val lyricText: String? = null,
    @SerialName("drum_text")      val drumText: String? = null,
    @SerialName("practice_audio_ref")  val practiceAudioRef: String? = null,
    @SerialName("practice_stems_refs") val practiceStemsRefs: JsonElement? = null,
    @SerialName("created_at")     val createdAt: String? = null,
    @SerialName("updated_at")     val updatedAt: String? = null,
) {
    companion object {
        const val LIST_STAPLES = "staples"
        const val LIST_PARTY = "party"
        const val LIST_CLASSIC_ROCK = "classic_rock"
        val LIST_ORDER = listOf(LIST_STAPLES, LIST_PARTY, LIST_CLASSIC_ROCK)
        val LIST_LABELS = mapOf(
            LIST_STAPLES to "Staples",
            LIST_PARTY to "Party",
            LIST_CLASSIC_ROCK to "Classic Rock",
        )
    }
}

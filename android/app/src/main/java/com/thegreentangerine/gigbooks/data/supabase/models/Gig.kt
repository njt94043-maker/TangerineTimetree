package com.thegreentangerine.gigbooks.data.supabase.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Gig(
    val id: String,
    val date: String,                                     // YYYY-MM-DD
    @SerialName("gig_type") val gigType: String = "gig", // "gig" | "practice"
    @SerialName("gig_subtype") val gigSubtype: String = "pub", // "pub" | "client"
    val status: String = "confirmed",                     // "enquiry" | "pencilled" | "confirmed" | "cancelled"
    val venue: String = "",
    @SerialName("client_name") val clientName: String = "",
    @SerialName("load_time") val loadTime: String? = null,    // HH:MM
    @SerialName("start_time") val startTime: String? = null,
    @SerialName("end_time") val endTime: String? = null,
    val notes: String = "",
    val visibility: String = "public",
    @SerialName("created_at") val createdAt: String = "",
) {
    val isGig: Boolean      get() = gigType == "gig"
    val isPractice: Boolean get() = gigType == "practice"
    val isClient: Boolean   get() = isGig && gigSubtype == "client"
    val isPub: Boolean      get() = isGig && gigSubtype == "pub"
    val isEnquiry: Boolean  get() = isClient && status != "confirmed"
    val isCancelled: Boolean get() = status == "cancelled"

    /** "19:30" → "7:30 PM" — simple 24h→12h conversion for display. */
    val startTimeFormatted: String? get() = startTime?.let { formatTime(it) }

    private fun formatTime(t: String): String {
        val parts = t.split(":")
        if (parts.size < 2) return t
        val h = parts[0].toIntOrNull() ?: return t
        val m = parts[1]
        val ampm = if (h < 12) "AM" else "PM"
        val h12 = when (h) { 0 -> 12; in 13..23 -> h - 12; else -> h }
        return "$h12:$m $ampm"
    }
}

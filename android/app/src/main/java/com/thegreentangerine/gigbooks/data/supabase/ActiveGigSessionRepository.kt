package com.thegreentangerine.gigbooks.data.supabase

import io.github.jan.supabase.postgrest.from
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * S41: Manages active_gig_sessions rows for PWA gig discovery.
 * When APK connects to Studio for a live gig, it writes a row here.
 * PWAs subscribe via Supabase Realtime to detect active gigs.
 */
object ActiveGigSessionRepository {

    private val client get() = SupabaseProvider.client

    @Serializable
    data class ActiveGigSessionInsert(
        @SerialName("gig_id") val gigId: String? = null,
        @SerialName("studio_ip") val studioIp: String,
        @SerialName("ws_port") val wsPort: Int = 8731,
        @SerialName("pairing_secret") val pairingSecret: String = "",
        @SerialName("created_by") val createdBy: String,
    )

    /** Insert a row when starting a live gig session. Returns the row ID. */
    suspend fun startSession(
        gigId: String?,
        studioIp: String,
        wsPort: Int = 8731,
        pairingSecret: String = "",
        userId: String,
    ): String {
        val row = ActiveGigSessionInsert(
            gigId = gigId,
            studioIp = studioIp,
            wsPort = wsPort,
            pairingSecret = pairingSecret,
            createdBy = userId,
        )
        val result = client.from("active_gig_sessions").insert(row) {
            select()
        }.decodeSingle<ActiveGigSessionRow>()
        return result.id
    }

    /** Mark a session as ended. */
    suspend fun endSession(sessionId: String) {
        client.from("active_gig_sessions").update({
            set("ended_at", "now()")
        }) {
            filter { eq("id", sessionId) }
        }
    }

    /** End all active sessions created by this user (cleanup on disconnect). */
    suspend fun endAllForUser(userId: String) {
        client.from("active_gig_sessions").update({
            set("ended_at", "now()")
        }) {
            filter {
                eq("created_by", userId)
                isExact("ended_at", null)
            }
        }
    }

    @Serializable
    data class ActiveGigSessionRow(
        val id: String,
        @SerialName("gig_id") val gigId: String? = null,
        @SerialName("studio_ip") val studioIp: String = "",
        @SerialName("ws_port") val wsPort: Int = 8731,
        @SerialName("pairing_secret") val pairingSecret: String = "",
        @SerialName("started_at") val startedAt: String = "",
        @SerialName("ended_at") val endedAt: String? = null,
        @SerialName("created_by") val createdBy: String = "",
    )
}

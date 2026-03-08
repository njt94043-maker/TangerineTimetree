package com.thegreentangerine.gigbooks.data.supabase.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class AwayDate(
    val id: String,
    @SerialName("user_id") val userId: String,
    @SerialName("start_date") val startDate: String, // YYYY-MM-DD
    @SerialName("end_date") val endDate: String,
    val reason: String = "",
    @SerialName("created_at") val createdAt: String = "",
)

package com.thegreentangerine.gigbooks.data.supabase.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Profile(
    val id: String,
    val name: String = "",
    @SerialName("is_admin") val isAdmin: Boolean = true,
    @SerialName("band_role") val bandRole: String = "",
)

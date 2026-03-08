package com.thegreentangerine.gigbooks.data.supabase

import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.auth.status.SessionStatus
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

data class UserProfile(
    val id: String,
    val email: String,
    val name: String,
    val bandRole: String,
)

object AuthRepository {

    private val auth get() = SupabaseProvider.client.auth

    val isAuthenticated: Flow<Boolean>
        get() = auth.sessionStatus.map { it is SessionStatus.Authenticated }

    val sessionStatus: Flow<SessionStatus>
        get() = auth.sessionStatus

    suspend fun signIn(email: String, password: String) {
        auth.signInWith(Email) {
            this.email = email
            this.password = password
        }
    }

    suspend fun signOut() {
        auth.signOut()
    }

    fun currentUserId(): String?    = auth.currentUserOrNull()?.id
    fun currentUserEmail(): String? = auth.currentUserOrNull()?.email
}

package com.thegreentangerine.gigbooks.data.supabase

import android.util.Log
import com.thegreentangerine.gigbooks.data.supabase.models.EditSurface
import com.thegreentangerine.gigbooks.data.supabase.models.GigLockState
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.postgresChangeFlow
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import java.time.Instant

/**
 * Single-row Realtime control of gig-lock state. When `isLocked == true`,
 * setlist edits should be routed through SetlistPendingEditsRepository
 * instead of SetlistEntriesRepository — they auto-apply on gig-end.
 *
 * Default value when row is RLS-hidden = unlocked (matches getGigLockState
 * fallback in shared/supabase/queries.ts).
 */
object GigLockRepository {

    private const val TAG = "GigLockRepo"
    private val client get() = SupabaseProvider.client
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val UNLOCKED_DEFAULT = GigLockState(
        id = 1,
        isLocked = false,
        lockedBySurface = null,
        lockedAt = null,
        gigLabel = null,
        updatedAt = "",
    )

    private val _state = MutableStateFlow(UNLOCKED_DEFAULT)
    val state: StateFlow<GigLockState> = _state.asStateFlow()

    @Volatile private var subscribed = false

    fun start() {
        if (subscribed) return
        subscribed = true
        scope.launch { refresh() }
        scope.launch { subscribe() }
    }

    suspend fun refresh() {
        try {
            val row = client.from("gig_lock_state").select {
                filter { eq("id", 1) }
                limit(1)
            }.decodeList<GigLockState>().firstOrNull() ?: UNLOCKED_DEFAULT
            _state.value = row
        } catch (e: Exception) {
            Log.w(TAG, "Refresh failed: ${e.message}", e)
            // Keep last known good (or UNLOCKED_DEFAULT) — don't flip locked on a fetch error.
        }
    }

    /**
     * Flip the lock. S141: gig wizard's armGig fires setLocked(true, gigName);
     * end-gig fires setLocked(false). DB-side trigger blocks regular auth users
     * from writing setlist_entries when locked (service-role bypasses).
     *
     * Fire-and-forget per Sovereign Spec §B.5 (internet-never-blocks-gig):
     * Supabase failure logs but does not throw. Gig still proceeds locally.
     */
    suspend fun setLocked(
        locked: Boolean,
        gigLabel: String? = null,
        surface: String = EditSurface.APK,
    ): Boolean = try {
        val now = Instant.now().toString()
        val payload = buildJsonObject {
            put("is_locked", JsonPrimitive(locked))
            put("locked_by_surface", if (locked) JsonPrimitive(surface) else JsonNull)
            put("locked_at", if (locked) JsonPrimitive(now) else JsonNull)
            put("gig_label", if (locked && gigLabel != null) JsonPrimitive(gigLabel) else JsonNull)
            put("updated_at", JsonPrimitive(now))
        }
        client.from("gig_lock_state").update(payload) { filter { eq("id", 1) } }
        Log.i(TAG, "setLocked($locked) ok gig_label=$gigLabel")
        true
    } catch (e: Exception) {
        Log.w(TAG, "setLocked($locked) failed: ${e.message}", e)
        false
    }

    private suspend fun subscribe() {
        try {
            val channel = client.channel("public:gig_lock_state")
            val flow = channel.postgresChangeFlow<PostgresAction>(schema = "public") {
                table = "gig_lock_state"
            }
            channel.subscribe()
            flow.collect { _ -> refresh() }
        } catch (e: Exception) {
            Log.w(TAG, "Realtime subscribe failed: ${e.message}", e)
        }
    }
}

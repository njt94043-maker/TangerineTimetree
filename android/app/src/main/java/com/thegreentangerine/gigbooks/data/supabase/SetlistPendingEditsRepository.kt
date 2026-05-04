package com.thegreentangerine.gigbooks.data.supabase

import android.util.Log
import com.thegreentangerine.gigbooks.data.supabase.models.SetlistActor
import com.thegreentangerine.gigbooks.data.supabase.models.SetlistPendingEdit
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.postgresChangeFlow
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject

/**
 * Edits queued during gig-lock. Surfaces check GigLockRepository.isLocked
 * before writing — if locked, route through `queueEdit()` here instead of
 * SetlistEntriesRepository.* — those auto-apply on gig-end (auto-apply
 * daemon deferred S125; for now Nathan can manually drain the queue).
 */
object SetlistPendingEditsRepository {

    private const val TAG = "SetlistPendingEditsRepo"
    private val client get() = SupabaseProvider.client
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val _entries = MutableStateFlow<List<SetlistPendingEdit>>(emptyList())
    val entries: StateFlow<List<SetlistPendingEdit>> = _entries.asStateFlow()

    /** Unapplied edits only — what the Queued drawer renders. */
    val unapplied: StateFlow<List<SetlistPendingEdit>> = _entries
        .map { list -> list.filter { it.appliedAt == null } }
        .let { flow ->
            val state = MutableStateFlow<List<SetlistPendingEdit>>(emptyList())
            scope.launch { flow.collect { state.value = it } }
            state.asStateFlow()
        }

    @Volatile private var subscribed = false

    fun start() {
        if (subscribed) return
        subscribed = true
        scope.launch { refresh() }
        scope.launch { subscribe() }
    }

    suspend fun refresh() {
        try {
            val rows = client.from("setlist_pending_edits").select {
                order("created_at", Order.ASCENDING)
            }.decodeList<SetlistPendingEdit>()
            _entries.value = rows
        } catch (e: Exception) {
            Log.w(TAG, "Refresh failed: ${e.message}", e)
        }
    }

    private suspend fun subscribe() {
        try {
            val channel = client.channel("public:setlist_pending_edits")
            val flow = channel.postgresChangeFlow<PostgresAction>(schema = "public") {
                table = "setlist_pending_edits"
            }
            channel.subscribe()
            flow.collect { _ -> refresh() }
        } catch (e: Exception) {
            Log.w(TAG, "Realtime subscribe failed: ${e.message}", e)
        }
    }

    /** Queue an edit for later auto-apply. `payload` shape is action-specific
     *  (mirrors queuePendingEdit in shared/supabase/queries.ts). */
    suspend fun queueEdit(
        listId: String,
        entryId: String?,
        action: String,
        payload: JsonElement,
        actor: SetlistActor,
        surface: String,
    ): Boolean = try {
        client.from("setlist_pending_edits").insert(buildJsonObject {
            put("list_id", JsonPrimitive(listId))
            put("entry_id", entryId?.let { JsonPrimitive(it) } ?: JsonNull)
            put("actor_id", actor.id.let { JsonPrimitive(it) })
            put("actor_name", JsonPrimitive(actor.name))
            put("surface", JsonPrimitive(surface))
            put("action", JsonPrimitive(action))
            put("payload", payload)
        })
        true
    } catch (e: Exception) {
        Log.w(TAG, "queueEdit failed: ${e.message}", e)
        false
    }
}

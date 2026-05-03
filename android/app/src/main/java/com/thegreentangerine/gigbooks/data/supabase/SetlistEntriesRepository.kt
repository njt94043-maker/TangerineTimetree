package com.thegreentangerine.gigbooks.data.supabase

import android.util.Log
import com.thegreentangerine.gigbooks.data.supabase.models.SetlistEntry
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
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject

/**
 * Source of truth for setlist data on the APK side. Replaces SongRepository.
 *
 * Initial fetch via Postgrest, then Supabase Realtime broadcasts every
 * INSERT/UPDATE/DELETE on `public.setlist_entries`. On any change the repo
 * re-fetches (small N, well under 100 rows) and republishes the full sorted
 * list so consumers don't have to merge deltas. Sorted by (list_id, position).
 *
 * Lives as a singleton because the realtime subscription should outlive any
 * single screen — opening + closing DrummerPrompterScreen shouldn't tear down
 * the channel.
 */
object SetlistEntriesRepository {

    private const val TAG = "SetlistEntriesRepo"
    private val client get() = SupabaseProvider.client
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val _entries = MutableStateFlow<List<SetlistEntry>>(emptyList())
    val entries: StateFlow<List<SetlistEntry>> = _entries.asStateFlow()

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    @Volatile private var subscribed = false

    /**
     * Begin observing setlist_entries. Idempotent — safe to call from every
     * screen / ViewModel init that consumes the data; only the first call
     * actually opens the channel.
     */
    fun start() {
        if (subscribed) return
        subscribed = true
        scope.launch { refresh() }
        scope.launch { subscribe() }
    }

    suspend fun refresh() {
        _loading.value = true
        _error.value = null
        try {
            val rows = client.from("setlist_entries").select {
                order("list_id", Order.ASCENDING)
                order("position", Order.ASCENDING)
            }.decodeList<SetlistEntry>()
            _entries.value = rows
        } catch (e: Exception) {
            Log.w(TAG, "Refresh failed: ${e.message}", e)
            _error.value = e.message
        } finally {
            _loading.value = false
        }
    }

    private suspend fun subscribe() {
        try {
            val channel = client.channel("public:setlist_entries")
            val flow = channel.postgresChangeFlow<PostgresAction>(schema = "public") {
                table = "setlist_entries"
            }
            channel.subscribe()
            flow.collect { _ ->
                // Any change = re-fetch. Cheap (small N).
                refresh()
            }
        } catch (e: Exception) {
            Log.w(TAG, "Realtime subscribe failed: ${e.message}", e)
            _error.value = "Realtime: ${e.message}"
        }
    }

    // ── Mutations (used by the authoring UI in task 4+) ────────────────────

    suspend fun updateField(id: String, field: String, value: Any?): Boolean = try {
        client.from("setlist_entries").update(buildJsonObject {
            put(field, value.toJson())
        }) { filter { eq("id", id) } }
        true
    } catch (e: Exception) {
        Log.w(TAG, "updateField($field) failed: ${e.message}", e)
        false
    }

    suspend fun insert(entry: SetlistEntry): Boolean = try {
        client.from("setlist_entries").insert(entry)
        true
    } catch (e: Exception) {
        Log.w(TAG, "insert failed: ${e.message}", e)
        false
    }

    suspend fun delete(id: String): Boolean = try {
        client.from("setlist_entries").delete { filter { eq("id", id) } }
        true
    } catch (e: Exception) {
        Log.w(TAG, "delete failed: ${e.message}", e)
        false
    }

    private fun Any?.toJson(): JsonElement = when (this) {
        null -> JsonNull
        is Boolean -> JsonPrimitive(this)
        is Number -> JsonPrimitive(this)
        is String -> JsonPrimitive(this)
        is JsonElement -> this
        else -> JsonPrimitive(toString())
    }
}

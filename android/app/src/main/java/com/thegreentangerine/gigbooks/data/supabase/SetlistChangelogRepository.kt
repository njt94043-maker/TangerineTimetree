package com.thegreentangerine.gigbooks.data.supabase

import android.util.Log
import com.thegreentangerine.gigbooks.data.supabase.models.SetlistActor
import com.thegreentangerine.gigbooks.data.supabase.models.SetlistChangelogEntry
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
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject

/**
 * Append-only audit log of every setlist edit across all 3 surfaces.
 * Powers the Changelog drawer + post-gig audit. Read-only from the APK
 * side except for `log()` which is called by SetlistEntriesRepository
 * after each successful write.
 */
object SetlistChangelogRepository {

    private const val TAG = "SetlistChangelogRepo"
    private val client get() = SupabaseProvider.client
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val _entries = MutableStateFlow<List<SetlistChangelogEntry>>(emptyList())
    val entries: StateFlow<List<SetlistChangelogEntry>> = _entries.asStateFlow()

    @Volatile private var subscribed = false

    fun start() {
        if (subscribed) return
        subscribed = true
        scope.launch { refresh() }
        scope.launch { subscribe() }
    }

    suspend fun refresh(limit: Long = 50) {
        try {
            val rows = client.from("setlist_changelog").select {
                order("created_at", Order.DESCENDING)
                limit(limit)
            }.decodeList<SetlistChangelogEntry>()
            _entries.value = rows
        } catch (e: Exception) {
            Log.w(TAG, "Refresh failed: ${e.message}", e)
        }
    }

    private suspend fun subscribe() {
        try {
            val channel = client.channel("public:setlist_changelog")
            val flow = channel.postgresChangeFlow<PostgresAction>(schema = "public") {
                table = "setlist_changelog"
            }
            channel.subscribe()
            flow.collect { _ -> refresh() }
        } catch (e: Exception) {
            Log.w(TAG, "Realtime subscribe failed: ${e.message}", e)
        }
    }

    /** Insert a changelog row. Don't throw on failure — the underlying edit
     *  already succeeded; losing one log row is recoverable, blocking the
     *  user isn't. (Mirrors logSetlistChange in shared/supabase/queries.ts.) */
    suspend fun log(
        listId: String,
        entryId: String?,
        action: String,
        fieldChanged: String? = null,
        oldValue: String? = null,
        newValue: String? = null,
        actor: SetlistActor,
        surface: String,
    ) {
        try {
            client.from("setlist_changelog").insert(buildJsonObject {
                put("list_id", JsonPrimitive(listId))
                put("entry_id", entryId?.let { JsonPrimitive(it) } ?: JsonNull)
                put("actor_id", actor.id.let { JsonPrimitive(it) })
                put("actor_name", JsonPrimitive(actor.name))
                put("surface", JsonPrimitive(surface))
                put("action", JsonPrimitive(action))
                put("field_changed", fieldChanged?.let { JsonPrimitive(it) } ?: JsonNull)
                put("old_value", oldValue?.let { JsonPrimitive(it) } ?: JsonNull)
                put("new_value", newValue?.let { JsonPrimitive(it) } ?: JsonNull)
            })
        } catch (e: Exception) {
            Log.w(TAG, "Changelog log failed: ${e.message}", e)
        }
    }
}

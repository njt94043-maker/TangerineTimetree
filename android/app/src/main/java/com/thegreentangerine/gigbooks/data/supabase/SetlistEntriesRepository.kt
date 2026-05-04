package com.thegreentangerine.gigbooks.data.supabase

import android.util.Log
import com.thegreentangerine.gigbooks.data.supabase.models.EditSurface
import com.thegreentangerine.gigbooks.data.supabase.models.SetlistAction
import com.thegreentangerine.gigbooks.data.supabase.models.SetlistActor
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
 *
 * S127: cross-surface direct edit. All mutations go through
 * createEntry/updateEntry/deleteEntry/reorderEntries/moveEntry which take an
 * actor + surface tag, write the change, AND insert a changelog row. When
 * GigLockRepository reports locked, callers should route through
 * SetlistPendingEditsRepository.queueEdit instead of these — the repo itself
 * doesn't read the lock state to keep dependencies simple.
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

    // ── Authoring writes (S127 — actor-tagged + auto-changelog) ────────────

    /** Create a new entry at end of `listId`. Returns the inserted row. */
    suspend fun createEntry(
        listId: String,
        title: String,
        artist: String? = null,
        bpm: Int? = null,
        clickYN: Boolean = false,
        actor: SetlistActor,
        surface: String = EditSurface.APK,
    ): SetlistEntry? = try {
        val tail = _entries.value.filter { it.listId == listId }.maxOfOrNull { it.position } ?: 0
        val payload = buildJsonObject {
            put("list_id", JsonPrimitive(listId))
            put("position", JsonPrimitive(tail + 1))
            put("title", JsonPrimitive(title))
            if (artist != null) put("artist", JsonPrimitive(artist))
            if (bpm != null) put("bpm", JsonPrimitive(bpm))
            put("click_y_n", JsonPrimitive(clickYN))
        }
        val row = client.from("setlist_entries")
            .insert(payload) { select() }
            .decodeSingle<SetlistEntry>()
        SetlistChangelogRepository.log(
            listId = listId,
            entryId = row.id,
            action = SetlistAction.CREATED,
            newValue = title,
            actor = actor,
            surface = surface,
        )
        row
    } catch (e: Exception) {
        Log.w(TAG, "createEntry failed: ${e.message}", e)
        _error.value = "Create failed: ${e.message}"
        null
    }

    /** Update one or more fields on an entry. One changelog row per scalar
     *  field — keeps history precise. `prev` is the pre-edit row used to
     *  populate old_value on the changelog row. */
    suspend fun updateEntry(
        id: String,
        patch: Map<String, Any?>,
        prev: SetlistEntry,
        actor: SetlistActor,
        surface: String = EditSurface.APK,
    ): Boolean = try {
        val payload = buildJsonObject {
            for ((field, value) in patch) {
                put(field, value.toJson())
            }
        }
        client.from("setlist_entries").update(payload) { filter { eq("id", id) } }
        for ((field, newVal) in patch) {
            val oldVal = entryFieldString(prev, field)
            SetlistChangelogRepository.log(
                listId = prev.listId,
                entryId = id,
                action = SetlistAction.UPDATED,
                fieldChanged = field,
                oldValue = oldVal,
                newValue = newVal?.toString(),
                actor = actor,
                surface = surface,
            )
        }
        true
    } catch (e: Exception) {
        Log.w(TAG, "updateEntry failed: ${e.message}", e)
        _error.value = "Update failed: ${e.message}"
        false
    }

    /** Single-field convenience used by inline toggles (e.g. click_y_n). */
    suspend fun updateField(
        id: String,
        field: String,
        value: Any?,
        prev: SetlistEntry,
        actor: SetlistActor,
        surface: String = EditSurface.APK,
    ): Boolean = updateEntry(id, mapOf(field to value), prev, actor, surface)

    suspend fun deleteEntry(
        entry: SetlistEntry,
        actor: SetlistActor,
        surface: String = EditSurface.APK,
    ): Boolean = try {
        client.from("setlist_entries").delete { filter { eq("id", entry.id) } }
        SetlistChangelogRepository.log(
            listId = entry.listId,
            entryId = null,           // FK set null on delete
            action = SetlistAction.DELETED,
            oldValue = entry.title,
            actor = actor,
            surface = surface,
        )
        true
    } catch (e: Exception) {
        Log.w(TAG, "deleteEntry failed: ${e.message}", e)
        _error.value = "Delete failed: ${e.message}"
        false
    }

    /** Reorder N entries within one list. Caller passes the new full ordering
     *  for that list. Issued as N small updates (small N — fine). */
    suspend fun reorderEntries(
        listId: String,
        orderedIds: List<String>,
        actor: SetlistActor,
        surface: String = EditSurface.APK,
    ): Boolean = try {
        orderedIds.forEachIndexed { idx, id ->
            client.from("setlist_entries").update(buildJsonObject {
                put("position", JsonPrimitive(idx + 1))
            }) { filter { eq("id", id) } }
        }
        SetlistChangelogRepository.log(
            listId = listId,
            entryId = null,
            action = SetlistAction.REORDERED,
            newValue = orderedIds.size.toString(),
            actor = actor,
            surface = surface,
        )
        true
    } catch (e: Exception) {
        Log.w(TAG, "reorderEntries failed: ${e.message}", e)
        _error.value = "Reorder failed: ${e.message}"
        false
    }

    /** Move an entry to another list (carries to end of target list). */
    suspend fun moveEntry(
        entry: SetlistEntry,
        toList: String,
        actor: SetlistActor,
        surface: String = EditSurface.APK,
    ): Boolean {
        if (toList == entry.listId) return false
        return try {
            val tail = _entries.value.filter { it.listId == toList }.maxOfOrNull { it.position } ?: 0
            client.from("setlist_entries").update(buildJsonObject {
                put("list_id", JsonPrimitive(toList))
                put("position", JsonPrimitive(tail + 1))
            }) { filter { eq("id", entry.id) } }
            SetlistChangelogRepository.log(
                listId = toList,
                entryId = entry.id,
                action = SetlistAction.MOVED,
                oldValue = entry.listId,
                newValue = toList,
                actor = actor,
                surface = surface,
            )
            true
        } catch (e: Exception) {
            Log.w(TAG, "moveEntry failed: ${e.message}", e)
            _error.value = "Move failed: ${e.message}"
            false
        }
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private fun entryFieldString(e: SetlistEntry, field: String): String? = when (field) {
        "title" -> e.title
        "artist" -> e.artist
        "bpm" -> e.bpm?.toString()
        "beats_per_bar" -> e.beatsPerBar?.toString()
        "click_y_n" -> e.clickYN.toString()
        "led_visual" -> e.ledVisual
        "backdrop_url" -> e.backdropUrl
        "notes" -> e.notes
        "chord_text" -> e.chordText
        "lyric_text" -> e.lyricText
        "drum_text" -> e.drumText
        "practice_audio_ref" -> e.practiceAudioRef
        else -> null
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

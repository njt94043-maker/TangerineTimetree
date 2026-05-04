package com.thegreentangerine.gigbooks.ui.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.thegreentangerine.gigbooks.data.supabase.AuthRepository
import com.thegreentangerine.gigbooks.data.supabase.GigLockRepository
import com.thegreentangerine.gigbooks.data.supabase.SetlistChangelogRepository
import com.thegreentangerine.gigbooks.data.supabase.SetlistEntriesRepository
import com.thegreentangerine.gigbooks.data.supabase.SetlistPendingEditsRepository
import com.thegreentangerine.gigbooks.data.supabase.models.EditSurface
import com.thegreentangerine.gigbooks.data.supabase.models.SetlistAction
import com.thegreentangerine.gigbooks.data.supabase.models.SetlistActor
import com.thegreentangerine.gigbooks.data.supabase.models.SetlistEntry
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject

/**
 * Owns actor identity + dispatches edits to the right repository (live vs
 * pending-queue) based on gig-lock state. Screens should consume the four
 * underlying repositories' StateFlows directly for reads — this VM only
 * brokers writes.
 */
class SetlistsViewModel : ViewModel() {

    private val SURFACE = EditSurface.APK

    private val _saving = MutableStateFlow(false)
    val saving: StateFlow<Boolean> = _saving.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    init {
        // Idempotent — first VM init kicks off all subscriptions, subsequent
        // VMs (recreated on rotation) reuse the live channels.
        SetlistEntriesRepository.start()
        SetlistChangelogRepository.start()
        SetlistPendingEditsRepository.start()
        GigLockRepository.start()
    }

    fun clearError() { _error.value = null }

    /** Resolve the actor from Auth. Display name = email local-part if no
     *  profile name is plumbed through (Profile fetch lives on TGT Web; the
     *  APK never had the profiles table wired in). */
    private fun resolveActor(): SetlistActor {
        val id = AuthRepository.currentUserId() ?: NIL_UUID
        val email = AuthRepository.currentUserEmail()
        val name = email?.substringBefore('@') ?: "APK"
        return SetlistActor(id = id, name = name)
    }

    private val isLocked: Boolean get() = GigLockRepository.state.value.isLocked
    private val activeEntries: List<SetlistEntry>
        get() = SetlistEntriesRepository.entries.value

    private suspend fun <T> wrap(block: suspend () -> T): T? {
        _saving.value = true
        _error.value = null
        return try {
            block()
        } catch (e: Exception) {
            _error.value = e.message ?: "Save failed"
            null
        } finally {
            _saving.value = false
        }
    }

    fun addEntry(listId: String, title: String, artist: String?, bpm: Int?, click: Boolean) {
        viewModelScope.launch {
            val actor = resolveActor()
            wrap {
                if (isLocked) {
                    val payload = buildJsonObject {
                        put("list_id", JsonPrimitive(listId))
                        put("title", JsonPrimitive(title))
                        artist?.let { put("artist", JsonPrimitive(it)) }
                        bpm?.let { put("bpm", JsonPrimitive(it)) }
                        put("click_y_n", JsonPrimitive(click))
                    }
                    SetlistPendingEditsRepository.queueEdit(
                        listId = listId, entryId = null,
                        action = SetlistAction.CREATED,
                        payload = payload, actor = actor, surface = SURFACE,
                    )
                } else {
                    SetlistEntriesRepository.createEntry(
                        listId = listId, title = title, artist = artist,
                        bpm = bpm, clickYN = click, actor = actor, surface = SURFACE,
                    )
                }
            }
        }
    }

    fun updateEntry(entry: SetlistEntry, patch: Map<String, Any?>) {
        if (patch.isEmpty()) return
        viewModelScope.launch {
            val actor = resolveActor()
            wrap {
                if (isLocked) {
                    val payload = buildJsonObject {
                        for ((k, v) in patch) put(k, jsonOf(v))
                    }
                    SetlistPendingEditsRepository.queueEdit(
                        listId = entry.listId, entryId = entry.id,
                        action = SetlistAction.UPDATED,
                        payload = payload, actor = actor, surface = SURFACE,
                    )
                } else {
                    SetlistEntriesRepository.updateEntry(
                        id = entry.id, patch = patch, prev = entry,
                        actor = actor, surface = SURFACE,
                    )
                }
            }
        }
    }

    fun deleteEntry(entry: SetlistEntry) {
        viewModelScope.launch {
            val actor = resolveActor()
            wrap {
                if (isLocked) {
                    val payload = buildJsonObject {
                        put("id", JsonPrimitive(entry.id))
                        put("title", JsonPrimitive(entry.title))
                    }
                    SetlistPendingEditsRepository.queueEdit(
                        listId = entry.listId, entryId = entry.id,
                        action = SetlistAction.DELETED,
                        payload = payload, actor = actor, surface = SURFACE,
                    )
                } else {
                    SetlistEntriesRepository.deleteEntry(entry, actor, SURFACE)
                }
            }
        }
    }

    fun moveEntry(entry: SetlistEntry, toListId: String) {
        if (toListId == entry.listId) return
        viewModelScope.launch {
            val actor = resolveActor()
            wrap {
                if (isLocked) {
                    val payload = buildJsonObject {
                        put("id", JsonPrimitive(entry.id))
                        put("from", JsonPrimitive(entry.listId))
                        put("to", JsonPrimitive(toListId))
                    }
                    SetlistPendingEditsRepository.queueEdit(
                        listId = toListId, entryId = entry.id,
                        action = SetlistAction.MOVED,
                        payload = payload, actor = actor, surface = SURFACE,
                    )
                } else {
                    SetlistEntriesRepository.moveEntry(entry, toListId, actor, SURFACE)
                }
            }
        }
    }

    fun reorder(listId: String, entryId: String, direction: Int) {
        val list = activeEntries.filter { it.listId == listId }.sortedBy { it.position }
        val idx = list.indexOfFirst { it.id == entryId }
        if (idx < 0) return
        val newIdx = idx + direction
        if (newIdx < 0 || newIdx >= list.size) return
        val reordered = list.toMutableList()
        val moved = reordered.removeAt(idx)
        reordered.add(newIdx, moved)
        val orderedIds = reordered.map { it.id }

        viewModelScope.launch {
            val actor = resolveActor()
            wrap {
                if (isLocked) {
                    val payload = buildJsonObject {
                        put("orderedIds", buildJsonArray { orderedIds.forEach { add(JsonPrimitive(it)) } })
                    }
                    SetlistPendingEditsRepository.queueEdit(
                        listId = listId, entryId = entryId,
                        action = SetlistAction.REORDERED,
                        payload = payload, actor = actor, surface = SURFACE,
                    )
                } else {
                    SetlistEntriesRepository.reorderEntries(
                        listId = listId, orderedIds = orderedIds,
                        actor = actor, surface = SURFACE,
                    )
                }
            }
        }
    }

    private fun jsonOf(v: Any?) = when (v) {
        null -> kotlinx.serialization.json.JsonNull
        is Boolean -> JsonPrimitive(v)
        is Number -> JsonPrimitive(v)
        is String -> JsonPrimitive(v)
        else -> JsonPrimitive(v.toString())
    }

    companion object {
        private const val NIL_UUID = "00000000-0000-0000-0000-000000000000"
    }
}

package com.thegreentangerine.gigbooks.data.supabase

import android.util.Log
import com.thegreentangerine.gigbooks.data.supabase.models.SetlistEntryPracticeTrack
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

/**
 * Read-only sibling of [SetlistEntriesRepository] for the per-version
 * practice tracks (S129 W3b reader). Singleton + Realtime.
 *
 * Writes happen from the MS ingest pipeline (server-side Python), not the
 * APK — the APK is purely a consumer here.
 */
object SetlistEntryPracticeTracksRepository {

    private const val TAG = "PracticeTracksRepo"
    private val client get() = SupabaseProvider.client
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val _tracks = MutableStateFlow<List<SetlistEntryPracticeTrack>>(emptyList())
    val tracks: StateFlow<List<SetlistEntryPracticeTrack>> = _tracks.asStateFlow()

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    @Volatile private var subscribed = false

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
            val rows = client.from("setlist_entry_practice_tracks").select {
                order("setlist_entry_id", Order.ASCENDING)
                order("version_label", Order.ASCENDING)
                order("format", Order.ASCENDING)
            }.decodeList<SetlistEntryPracticeTrack>()
            _tracks.value = rows
        } catch (e: Exception) {
            Log.w(TAG, "Refresh failed: ${e.message}", e)
            _error.value = e.message
        } finally {
            _loading.value = false
        }
    }

    private suspend fun subscribe() {
        try {
            val channel = client.channel("public:setlist_entry_practice_tracks")
            val flow = channel.postgresChangeFlow<PostgresAction>(schema = "public") {
                table = "setlist_entry_practice_tracks"
            }
            channel.subscribe()
            flow.collect { _ -> refresh() }
        } catch (e: Exception) {
            Log.w(TAG, "Realtime subscribe failed: ${e.message}", e)
            _error.value = "Realtime: ${e.message}"
        }
    }

    /** All practice-track rows for one setlist entry, ordered for UI display. */
    fun tracksForEntry(entryId: String?): List<SetlistEntryPracticeTrack> {
        if (entryId == null) return emptyList()
        return _tracks.value
            .filter { it.setlistEntryId == entryId }
            .sortedWith(
                compareBy(
                    { SetlistEntryPracticeTrack.VERSION_ORDER.indexOf(it.versionLabel).let { i -> if (i < 0) Int.MAX_VALUE else i } },
                    { SetlistEntryPracticeTrack.FORMAT_ORDER.indexOf(it.format).let { i -> if (i < 0) Int.MAX_VALUE else i } },
                ),
            )
    }

    /** Count of `ours_*` versions for an entry — used to decide if we show the chip. */
    fun oursCountForEntry(entryId: String?): Int {
        if (entryId == null) return 0
        return _tracks.value.count { it.setlistEntryId == entryId && it.isOurs }
    }

    /** Reactive flow of `ours_*` count for a given entry — drives the chip badge. */
    fun oursCountFlow(entryId: String?) = tracks.map { list ->
        if (entryId == null) 0 else list.count { it.setlistEntryId == entryId && it.isOurs }
    }
}

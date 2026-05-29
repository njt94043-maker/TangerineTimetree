package com.thegreentangerine.gigbooks.data.orchestrator

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

/**
 * Durable FIFO of unsent gig-command POSTs (S133 P1 / S186 batch-D-2).
 *
 * S23-hotspot drops mid-set lose any song-marker / start / stop POSTs fired
 * during the dead window. This queue catches them so the next successful
 * send (or an explicit [GigCommandClient.flushQueue] from a connectivity
 * receiver) drains them oldest-first.
 *
 * Storage: SharedPreferences (single JSON-array entry). Why not Room? Room
 * is not yet a project dep and the queue is tiny (<100 entries in the worst
 * dropout) — pulling Room in would dwarf the actual feature. The
 * [PrefsStorage] abstraction lets unit tests swap an in-memory map in.
 *
 * Concurrency model: all mutations are serialised through `synchronized(lock)`
 * — the queue is touched from coroutine IO + occasionally main, so a
 * lock-free MutableStateFlow read would race vs. the prefs commit. Cheap;
 * read-heavy callers use [size] which is also locked.
 */
class GigCommandQueue(
    private val storage: Storage,
) {

    constructor(context: Context) : this(
        PrefsStorage(context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE))
    )

    /** One queued POST: endpoint path + JSON body + monotonic enqueue time. */
    data class Entry(val path: String, val body: String, val tsMs: Long)

    interface Storage {
        fun read(): String?
        fun write(json: String)
    }

    private val lock = Any()

    fun enqueue(path: String, body: String, tsMs: Long = System.currentTimeMillis()) {
        synchronized(lock) {
            val entries = readAll().toMutableList()
            if (entries.size >= MAX_ENTRIES) {
                // Drop the oldest — newer markers are more valuable in a
                // sustained dropout (the gig moved on; ancient song-name
                // markers for songs we've already finished hurt less than
                // losing the song currently being marked).
                entries.removeAt(0)
            }
            entries.add(Entry(path, body, tsMs))
            writeAll(entries)
        }
    }

    fun peek(): Entry? = synchronized(lock) { readAll().firstOrNull() }

    fun removeHead() {
        synchronized(lock) {
            val entries = readAll().toMutableList()
            if (entries.isNotEmpty()) {
                entries.removeAt(0)
                writeAll(entries)
            }
        }
    }

    fun size(): Int = synchronized(lock) { readAll().size }

    fun clear() {
        synchronized(lock) { writeAll(emptyList()) }
    }

    fun snapshot(): List<Entry> = synchronized(lock) { readAll().toList() }

    private fun readAll(): List<Entry> {
        val raw = storage.read() ?: return emptyList()
        return try {
            val arr = JSONArray(raw)
            val out = ArrayList<Entry>(arr.length())
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                out.add(Entry(
                    path = o.getString("path"),
                    body = o.getString("body"),
                    tsMs = o.optLong("ts", 0L),
                ))
            }
            out
        } catch (_: Exception) {
            // Corrupt blob — discard rather than crash the gig. The queue is
            // best-effort; losing it once on bad parse beats wedging start().
            emptyList()
        }
    }

    private fun writeAll(entries: List<Entry>) {
        val arr = JSONArray()
        for (e in entries) {
            arr.put(JSONObject().apply {
                put("path", e.path)
                put("body", e.body)
                put("ts", e.tsMs)
            })
        }
        storage.write(arr.toString())
    }

    companion object {
        private const val PREFS_NAME = "tgt_gig_cmd_queue"
        private const val KEY = "entries_json"
        /** Hard cap so a multi-hour dropout doesn't bloat SharedPreferences. */
        const val MAX_ENTRIES = 200
    }

    /** Default storage — single key in a private SharedPreferences file. */
    private class PrefsStorage(private val prefs: SharedPreferences) : Storage {
        override fun read(): String? = prefs.getString(KEY, null)
        override fun write(json: String) {
            prefs.edit().putString(KEY, json).apply()
        }
    }
}

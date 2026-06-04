package com.thegreentangerine.gigbooks.data.orchestrator

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Gig session state machine (S129 row 6, refined v1.2.3).
 *
 * Wraps the existing per-set RECORD/STOP fanout (OrchestratorService) with a
 * gig-level lifecycle so the drummer's flow at the gig is:
 *
 *   IDLE
 *     -> [Start gig wizard: name + save]    -> ARMED
 *                                              (project saved, NOT recording —
 *                                               drummer reviews everything first)
 *     -> [Begin recording]                   -> ACTIVE_SET (set 1)
 *     -> [Pause/Break]                       -> BREAK
 *     -> [Continue]                          -> ACTIVE_SET (same set#, no marker)
 *     -> [Continue + new set]                -> ACTIVE_SET (set#+1, marker dropped)
 *     -> ... (repeat per set) ...
 *     -> [End gig + confirm]                 -> ENDED -> IDLE
 *
 * ARMED is the post-wizard / pre-record stage. Reaper has the named project
 * loaded but transport is idle. The drummer can verify peer cameras, mixer
 * state, prompter setlist, etc. before committing to the take.
 *
 * BREAK has two continue paths so brief mid-set pauses (talk between songs,
 * tech glitch) don't get marked as new sets — the marker only drops when the
 * drummer explicitly says "this is a new set boundary".
 *
 * Each transition fans out:
 *   - APK record-trigger: per-set OSC bundle (S120 cursor-at-end + record)
 *     and per-set stop. Drives Reaper recording AND peer phones.
 *   - Reaper project-state command via [GigCommandClient]:
 *       start -> open template + save-as <gigs_dir>/<gig_name>/<gig_name>.rpp
 *       save  -> save (only on set-boundary Continue — v1.2.8 debounce; pauses
 *                no longer save, since each Main_OnCommand 40026 serialises the
 *                whole project and visibly lagged the wizard)
 *       stop  -> save (final). No auto-close.
 *   - Set-boundary marker: HTTP /song-marker with title "Set N" — only on
 *     the "Continue + new set" path. Reaper-side song-marker-listener.lua
 *     drops a named marker.
 */
class GigSession {

    enum class State { IDLE, ARMED, ACTIVE_SET, BREAK, ENDED }

    data class Snapshot(
        val state: State = State.IDLE,
        val gigName: String = "",
        val gigDate: String = "",   // F4: YYYYMMDD; set at arm() so the slug stays stable across sets even past midnight
        val setNumber: Int = 0,
        val armedTracks: Set<Int> = emptySet(),  // S202: record-arm set chosen in the wizard; persists across sets via copy()
    )

    private val _snapshot = MutableStateFlow(Snapshot())
    val snapshot: StateFlow<Snapshot> = _snapshot.asStateFlow()

    val state: State get() = _snapshot.value.state
    val gigName: String get() = _snapshot.value.gigName
    val gigDate: String get() = _snapshot.value.gigDate
    val setNumber: Int get() = _snapshot.value.setNumber
    val armedTracks: Set<Int> get() = _snapshot.value.armedTracks

    /** Wizard finishes -> ARMED. Project named + saved, transport idle. */
    fun arm(name: String, armedTracks: Set<Int>) {
        _snapshot.value = Snapshot(
            state = State.ARMED,
            gigName = name,
            gigDate = todayYyyyMmDd(),
            setNumber = 0,
            armedTracks = armedTracks,
        )
    }

    companion object {
        /** F4: YYYYMMDD for the device's current local date. Stable for the gig
         *  even if the clock crosses midnight mid-gig — slug stays fixed. */
        fun todayYyyyMmDd(): String {
            val cal = java.util.Calendar.getInstance()
            val y = cal.get(java.util.Calendar.YEAR)
            val m = cal.get(java.util.Calendar.MONTH) + 1
            val d = cal.get(java.util.Calendar.DAY_OF_MONTH)
            return "%04d%02d%02d".format(y, m, d)
        }
    }

    /** ARMED -> ACTIVE_SET (set 1). Only valid from ARMED. */
    fun beginRecording() {
        if (_snapshot.value.state != State.ARMED) return
        _snapshot.value = _snapshot.value.copy(
            state = State.ACTIVE_SET,
            setNumber = 1,
        )
    }

    fun pause() {
        if (_snapshot.value.state != State.ACTIVE_SET) return
        _snapshot.value = _snapshot.value.copy(state = State.BREAK)
    }

    /** Brief mid-set pause continuing — same set number, no marker. */
    fun continueSameSet() {
        if (_snapshot.value.state != State.BREAK) return
        _snapshot.value = _snapshot.value.copy(state = State.ACTIVE_SET)
    }

    /** Set-boundary continue — set#+1, caller drops the marker. */
    fun continueNewSet() {
        if (_snapshot.value.state != State.BREAK) return
        _snapshot.value = _snapshot.value.copy(
            state = State.ACTIVE_SET,
            setNumber = _snapshot.value.setNumber + 1,
        )
    }

    fun end() {
        if (_snapshot.value.state == State.IDLE) return
        _snapshot.value = _snapshot.value.copy(state = State.ENDED)
    }

    /** Reset back to IDLE after a wrap-up tick — frees the wizard for the next gig. */
    fun reset() {
        _snapshot.value = Snapshot()
    }
}

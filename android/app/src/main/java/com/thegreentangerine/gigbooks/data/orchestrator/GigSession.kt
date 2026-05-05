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
 *       start -> name + save the .rpp at <gigs_dir>/<gig_name>/<gig_name>.rpp
 *       save  -> save (on every Pause / Continue / End — gig-recording-per-set
 *                lock from S119)
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
        val setNumber: Int = 0,
    )

    private val _snapshot = MutableStateFlow(Snapshot())
    val snapshot: StateFlow<Snapshot> = _snapshot.asStateFlow()

    val state: State get() = _snapshot.value.state
    val gigName: String get() = _snapshot.value.gigName
    val setNumber: Int get() = _snapshot.value.setNumber

    /** Wizard finishes -> ARMED. Project named + saved, transport idle. */
    fun arm(name: String) {
        _snapshot.value = Snapshot(
            state = State.ARMED,
            gigName = name,
            setNumber = 0,
        )
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

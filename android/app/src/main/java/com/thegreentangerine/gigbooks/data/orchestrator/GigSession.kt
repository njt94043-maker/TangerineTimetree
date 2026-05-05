package com.thegreentangerine.gigbooks.data.orchestrator

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Gig session state machine (S129 row 6).
 *
 * Wraps the existing per-set RECORD/STOP fanout (OrchestratorService) with a
 * gig-level lifecycle so the drummer's flow at the gig is:
 *
 *   IDLE
 *     -> [Start gig wizard: name + save]   -> ACTIVE_SET (set 1)
 *     -> [Pause/Break]                     -> BREAK
 *     -> [Continue]                        -> ACTIVE_SET (set 2)
 *     -> ... (repeat per set) ...
 *     -> [End gig + confirm]               -> ENDED -> IDLE
 *
 * Each transition fans out:
 *   - APK record-trigger: existing per-set OSC bundle (S120 cursor-at-end + record)
 *     and per-set stop. Drives Reaper recording AND peer phones.
 *   - Reaper project-state command via [GigCommandClient]:
 *       start -> name + save the .rpp at <gigs_dir>/<gig_name>/<gig_name>.rpp
 *       save  -> save (on every Pause / Continue / End — gig-recording-per-set
 *                lock from S119: every set should be saved-on-disk before the
 *                next state)
 *       stop  -> save (final). No auto-close — drummer keeps the project open.
 *
 * Per-set takes are owned by Reaper's transport (cursor-at-end-on-record), so
 * this state machine doesn't track time-positions itself; it's purely the
 * surface that decides which OSC + HTTP calls fire at which moment.
 */
class GigSession {

    enum class State { IDLE, ACTIVE_SET, BREAK, ENDED }

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

    /** First set begins immediately on Start gig — no separate "armed" state. */
    fun start(name: String) {
        _snapshot.value = Snapshot(
            state = State.ACTIVE_SET,
            gigName = name,
            setNumber = 1,
        )
    }

    fun pause() {
        if (_snapshot.value.state != State.ACTIVE_SET) return
        _snapshot.value = _snapshot.value.copy(state = State.BREAK)
    }

    fun cont() {
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

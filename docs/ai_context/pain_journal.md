# TGT — Pain Journal

> Root cause analysis of real failures. Update after significant debugging.

---

## S59: Click scheduler gated by preference flag (2026-03-13)

**Symptom**: Click didn't play on track start. Mute/unmute from mixer would start the click, but out of time.

**Root cause**: `play()` checked `clickEnabledRef.current` (loaded from DB `player_click_enabled`) and conditionally called `clickRef.current.start()`. During S54 debugging, the pref was persisted as `false` to the DB. So click scheduler never started. `toggleClick` then called `start()` mid-playback with no position context — out of time.

**Why this was wrong**: The research from Chris Wilson ("A Tale of Two Clocks") and Tone.js already established the pattern — the timing engine (scheduler) must ALWAYS run. Mute/unmute is a gain control, not a start/stop of the scheduler. Every real audio app works this way. The research was done in S58 but wasn't fully applied — the scheduler was still conditionally started.

**Fix**: ClickScheduler always starts with the track. Added `muted` flag that controls whether OscillatorNodes are created. Beat events and timing always run regardless of mute state. `toggleClick` calls `setMuted()` instead of `start()`/`stop()`.

**Lesson**: When research gives us a pattern, apply it COMPLETELY — not just to the specific bug that prompted the research. The "all scheduling in one timer" principle also implies "scheduler always runs." These are connected implications of the same design principle.

**Prevention**: Before writing audio code, check: "Does this conditionally start/stop a timing engine based on UI state?" If yes, it's wrong. Timing engines run. UI controls gain/mute.

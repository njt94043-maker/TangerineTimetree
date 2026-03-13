# TGT — Status (Instant Context)

> Single source of "where are we right now". Read this FIRST every session.
> Updated at end of every session. Keep under 60 lines.

---

## Current State
- **Phase**: S55 — Web click debug (partially fixed — audible in background only).
- **What works**: Android (full, V4 player with beat-synced visualisers + interactive mixer + all S51 fixes confirmed by Nathan), Cloud Run (beats + stems + CORS + skip_stems + re-analyse), Capture (category field + badges + filter + theme). Web stems/mixer work. Web click NOW AUDIBLE but only when app is backgrounded/minimised — silent when foregrounded.
- **Last session (S55)**: Diagnosed click issue. Test beep (OscillatorNode → masterGain) works in foreground. Pre-rendered AudioBuffer clicks were silent in foreground but played in background. Switched ClickScheduler from AudioBuffer to OscillatorNode approach — click now plays in background (somewhat in time) but still silent in foreground on both PC and mobile.
- **KEY FINDING**: Click plays when app is minimised/backgrounded, silent when foregrounded. This is true for BOTH AudioBuffer and OscillatorNode approaches. The test beep button (user-gesture-triggered OscillatorNode) works in foreground. Something in the foreground tick loop (rAF) may be interfering with scheduled audio.
- **Seed status**: 117 gigs (114 linked to venue_id) + 62 away dates. 29 clients, 65 venues. 4 songs.

## S55 Changes
- **ClickScheduler.ts**: Replaced pre-rendered AudioBuffer approach with OscillatorNode + envelope gain (same pattern as working test beep). Removed all buffer rendering code. Subdivisions also switched to OscillatorNode.
- **Player.tsx**: Added "Test Beep" button in debug banner (direct OscillatorNode → masterGain). Added AudioEngine import.
- **NATHAN_VERBATIM.md**: Logged all session messages.

## NEXT SESSION PRIORITY: Why does click only play in background?
The critical diagnostic: scheduled audio (both AudioBuffer and OscillatorNode) is audible when app is backgrounded but silent when foregrounded. Test beep (user-gesture-triggered) works in foreground. This points to the rAF tick loop interfering.

**Debug approach — MUST do in order:**
1. **Disable rAF tick loop entirely** — in `play()`, comment out `AudioEngine.startTick(...)`. If click plays in foreground, the tick loop is the culprit.
2. **If tick loop is culprit, isolate which part**: strip tick callback to just `AudioEngine.pollBeats()` (remove setCurrentTime, resyncToPosition, FFT, beat intensity). Add back one at a time.
3. **Top suspects in tick loop**:
   - `setCurrentTime(pos)` — triggers React re-render 60x/sec, may starve main thread
   - `clickRef.current.resyncToPosition(pos)` — modifies scheduler's nextBeatTime every frame, may prevent clicks from being scheduled
   - `fftDataRef.current = AudioEngine.getFrequencyData()` — AnalyserNode read every frame
4. **If tick loop is NOT the culprit**, investigate Chrome's scheduled audio policy (gesture scope, node GC).

## Remaining Items
- [ ] **Fix web click foreground playback** — #1 priority
- [ ] Remove debug banner + test beep + console.log after click fixed
- [ ] Web visualisers: user testing (blocked by click issue)
- [ ] Queue items: NeuCard → flat rows (Android)
- [ ] Between-songs screen completeness check
- [ ] Android Settings: verify display prefs not duplicated (D-118)
- [ ] Android Calendar: cell shadows verification

## Big Picture
- **Vision**: 3 live apps + 1 future, all one family (D-156). Same theme, shared metadata.
- **Pipeline**: Capture → Web → Cloud Run → Both apps. Future: Capture → ClickTrack.
- **Architecture**: Monorepo (`shared/` + `web/` + `android/` + `capture/` + `native/` [shelved])

## What's Deployed
- **Web**: thegreentangerine.com (Vercel, auto-deploys from master, SW auto-update)
- **Android**: Compose debug APK on Samsung RFCW113WZRM (2026-03-13, S52)
- **Supabase**: jlufqgslgjowfaqmqlds.supabase.co (26 tables, 4 storage buckets)
- **Cloud Run**: beat-analysis service — revision beat-analysis-00009-th7
- **Capture**: localhost:5174 (UI) + localhost:9123 (backend). Flakey but functional.

## Session Protocol (Quick Reference)
**Start**: Read STATUS.md → IMPACT_MAP.md → todo.md → SPRINT_PROMPTS.md (for current sprint)
**End**: Update STATUS.md → todo.md → SESSION_LOG.md → gotchas.md → decisions_log.md → IMPACT_MAP.md → schema_map.md. Provide next sprint prompt.
**EVERY CHANGE**: Ask "what else does this affect?" across ALL apps (D-156).

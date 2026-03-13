# TGT — Status (Instant Context)

> Single source of "where are we right now". Read this FIRST every session.
> Updated at end of every session. Keep under 60 lines.

---

## Current State
- **Phase**: S59 complete — Click scheduler always-runs fix deployed. Needs user testing.
- **What works**: Android (full), Cloud Run, Capture. Web stems/mixer work. Web time display works. **Web click WORKS IN FOREGROUND**.
- **What was fixed (S59)**: Click scheduler was gated behind `player_click_enabled` DB pref (set `false` during S54 debug). Scheduler now ALWAYS runs — mute controls audibility only, not scheduling. Follows established audio pattern: timing engines run, UI controls gain.
- **Seed status**: 117 gigs (114 linked to venue_id) + 62 away dates. 29 clients, 65 venues. 4 songs.

## S59 Fix
- **Symptom**: Click didn't play on track start. Mute/unmute from mixer would start click, but out of time.
- **Root cause**: `play()` conditionally called `clickRef.start()` based on `player_click_enabled` DB pref. Pref was `false` from S54 debug. `toggleClick` called `start()`/`stop()` instead of controlling gain — starting mid-playback with no position sync.
- **Fix**: ClickScheduler gets `muted` flag. Scheduler ALWAYS starts with track. `setMuted()` controls whether OscillatorNodes are created. Beat events and timing always run. `toggleClick` calls `setMuted()` not `start()`/`stop()`.
- **Principle**: Same research (Chris Wilson + Tone.js) — timing engines always run, mute is gain control.
- **Status**: Deployed to Vercel. **NOT YET TESTED BY USER** — click timing accuracy still needs verification.

## NEXT SESSION (S60): Test click + evaluate remaining items
1. **Test click-to-track sync** — play a song with beat map, 60+ seconds, check if click is in time
2. **If click works**: remove debug banner + test beep + console.log
3. **Evaluate FFT necessity** — D-169 says vis is beat-synced, may not need FFT at all
4. **If FFT not needed**: close that item, move on to remaining parity items

## Remaining Items
- [ ] **Verify click timing** — user testing needed (S59 always-runs fix deployed, untested)
- [ ] **Evaluate FFT necessity** — D-169 says vis is beat-synced only, may not need FFT
- [ ] Remove debug banner + test beep + console.log after click confirmed fixed
- [ ] Web visualisers: user testing (blocked by click verification)
- [ ] Queue items: NeuCard → flat rows (Android)
- [ ] Between-songs screen completeness check

## What's Deployed
- **Web**: thegreentangerine.com (S59 — click scheduler always runs, mute = audibility only)
- **Android**: Compose debug APK on Samsung RFCW113WZRM (2026-03-13, S52)
- **Supabase**: jlufqgslgjowfaqmqlds.supabase.co (26 tables, 4 storage buckets)
- **Cloud Run**: beat-analysis service — revision beat-analysis-00009-th7

## Session Protocol (Quick Reference)
**Start**: Read STATUS.md → IMPACT_MAP.md → todo.md → SPRINT_PROMPTS.md (for current sprint)
**End**: Update STATUS.md → todo.md → SESSION_LOG.md. Commit + push.
**TESTING**: Clear site data → close tab → fresh tab → verify BUILD timestamp. One change per push.
**EVERY CHANGE**: Ask "what else does this affect?" across ALL apps (D-156).
**NO GUESSING**: Every code change must be backed by research or reference implementation.

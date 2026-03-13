# TGT — Status (Instant Context)

> Single source of "where are we right now". Read this FIRST every session.
> Updated at end of every session. Keep under 60 lines.

---

## Current State
- **Phase**: S58 complete — Research-backed drift fix deployed. Needs user testing.
- **What works**: Android (full), Cloud Run, Capture. Web stems/mixer work. Web time display works. **Web click WORKS IN FOREGROUND**. Beat intensity decay restored.
- **What was fixed (S58)**: resyncToPosition moved from rAF (60fps) into ClickScheduler's own 25ms setInterval. Eliminates race condition that killed OscillatorNodes.
- **Seed status**: 117 gigs (114 linked to venue_id) + 62 away dates. 29 clients, 65 venues. 4 songs.

## S58 Research Finding + Fix
- **Root cause**: resyncToPosition was called from rAF (60fps) while ClickScheduler's setInterval (25ms) simultaneously read `nextBeatTime` — race condition between two timers writing/reading the same variable.
- **Research**: Chris Wilson (A Tale of Two Clocks) + Tone.js both confirm: all scheduling writes MUST be in ONE timer. rAF is for visuals only.
- **Fix**: ClickScheduler gets a `trackPositionGetter` callback. `schedule()` (25ms timer) calls `resyncToPosition()` internally — same timer that reads `nextBeatTime` for scheduling. No more race.
- **Beat intensity**: decay restored in rAF tick loop (safe — only writes to a ref, no scheduling).
- **Status**: Deployed to Vercel. **NOT YET TESTED BY USER** — results in next session.

## NEXT SESSION (S59): Test drift fix + evaluate remaining items
1. **Test click-to-track sync** — play a song with beat map, 60+ seconds, check drift
2. **If click works**: remove debug banner + test beep + console.log
3. **Evaluate FFT necessity** — D-169 says vis is beat-synced, may not need FFT at all
4. **If FFT not needed**: close that item, move on to remaining parity items

## Remaining Items
- [ ] **Verify click drift fix** — user testing needed (S58 fix deployed, untested)
- [ ] **Evaluate FFT necessity** — D-169 says vis is beat-synced only, may not need FFT
- [ ] Remove debug banner + test beep + console.log after click confirmed fixed
- [ ] Web visualisers: user testing (blocked by click drift fix verification)
- [ ] Queue items: NeuCard → flat rows (Android)
- [ ] Between-songs screen completeness check

## What's Deployed
- **Web**: thegreentangerine.com (S58 drift fix — resync inside scheduler timer)
- **Android**: Compose debug APK on Samsung RFCW113WZRM (2026-03-13, S52)
- **Supabase**: jlufqgslgjowfaqmqlds.supabase.co (26 tables, 4 storage buckets)
- **Cloud Run**: beat-analysis service — revision beat-analysis-00009-th7

## Session Protocol (Quick Reference)
**Start**: Read STATUS.md → IMPACT_MAP.md → todo.md → SPRINT_PROMPTS.md (for current sprint)
**End**: Update STATUS.md → todo.md → SESSION_LOG.md. Commit + push.
**TESTING**: Clear site data → close tab → fresh tab → verify BUILD timestamp. One change per push.
**EVERY CHANGE**: Ask "what else does this affect?" across ALL apps (D-156).
**NO GUESSING**: Every code change must be backed by research or reference implementation.

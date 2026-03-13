# TGT — Status (Instant Context)

> Single source of "where are we right now". Read this FIRST every session.
> Updated at end of every session. Keep under 60 lines.

---

## Current State
- **Phase**: S57 complete — Web click works in foreground. Tick loop restoration blocked by resyncToPosition.
- **What works**: Android (full), Cloud Run, Capture. Web stems/mixer work. Web time display works. **Web click WORKS IN FOREGROUND** at step 2c tick loop.
- **What's missing from tick loop**: resyncToPosition, beat intensity, FFT — cannot add without research.
- **Seed status**: 117 gigs (114 linked to venue_id) + 62 away dates. 29 clients, 65 venues. 4 songs.

## S57 Finding: resyncToPosition breaks click
- Adding `resyncToPosition` to rAF tick loop (60fps) kills click audio — OscillatorNodes go silent in foreground.
- This contradicts S56 step 2d where resyncToPosition appeared safe — but S56 2d had AnalyserNode in series (inactive). Now AnalyserNode is parallel. Something about the combination kills audio.
- **Guessing at fixes is NOT acceptable.** Next session MUST research proper Web Audio sync patterns (Chris Wilson, Tone.js, etc.) before writing any code.

## S56 Isolation Results + S57 Update
| Step | Tick loop contents | Click? |
|------|--------------------|--------|
| Baseline | pollBeats only | **WORKS** ✓ |
| 2b | + position + loop | **WORKS** ✓ |
| 2c | + setCurrentTime + emitTimeUpdate | **WORKS** ✓ |
| 2d (S56) | + resyncToPosition (series analyser) | **WORKS** ✓ (drifts) |
| 2d (S57) | + resyncToPosition (parallel analyser) | **BROKE** ✗ |
| 2e (S56) | + FFT + beat intensity | **BROKE** ✗ |
| **Current** | **2c + parallel AnalyserNode** | **WORKS** ✓ |

## NEXT SESSION (S58): Research-first approach
**MANDATORY**: Research proper Web Audio metronome-to-track sync before writing ANY code.
1. Study Chris Wilson's lookahead scheduling article — how does it handle drift with external sources?
2. Study Tone.js Transport sync — how does it align scheduled events to track playback?
3. Understand WHY resyncToPosition in rAF kills OscillatorNodes — is it the frequency of nextBeatTime modification?
4. Design a researched solution. Present to Nathan BEFORE coding.
5. Then: beat intensity + FFT (separate from resync).

## Remaining Items
- [ ] **Fix click drift** — research-backed sync approach (resyncToPosition in rAF kills click)
- [ ] **Restore beat intensity** — drives metronome visualisers (D-169)
- [ ] **Restore FFT** — may not be needed if vis is beat-synced only (D-169)
- [ ] Remove debug banner + test beep + console.log after click fixed
- [ ] Web visualisers: user testing (blocked by click drift fix)
- [ ] Queue items: NeuCard → flat rows (Android)
- [ ] Between-songs screen completeness check

## What's Deployed
- **Web**: thegreentangerine.com (click works, drifts without resync)
- **Android**: Compose debug APK on Samsung RFCW113WZRM (2026-03-13, S52)
- **Supabase**: jlufqgslgjowfaqmqlds.supabase.co (26 tables, 4 storage buckets)
- **Cloud Run**: beat-analysis service — revision beat-analysis-00009-th7

## Session Protocol (Quick Reference)
**Start**: Read STATUS.md → IMPACT_MAP.md → todo.md → SPRINT_PROMPTS.md (for current sprint)
**End**: Update STATUS.md → todo.md → SESSION_LOG.md. Commit + push.
**TESTING**: Clear site data → close tab → fresh tab → verify BUILD timestamp. One change per push.
**EVERY CHANGE**: Ask "what else does this affect?" across ALL apps (D-156).
**NO GUESSING**: Every code change must be backed by research or reference implementation.

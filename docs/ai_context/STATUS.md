# TGT — Status (Instant Context)

> Single source of "where are we right now". Read this FIRST every session.
> Updated at end of every session. Keep under 60 lines.

---

## Current State
- **Phase**: S56 — Web click debug (partial progress, needs methodology overhaul).
- **What works**: Android (full), Cloud Run, Capture. Web stems/mixer work. Web time display works.
- **Web click**: Still foreground-silent, background-audible. S56 made progress on isolation but AI kept changing multiple things at once, contaminating results.
- **Seed status**: 117 gigs (114 linked to venue_id) + 62 away dates. 29 clients, 65 venues. 4 songs.

## S56 Changes
- **AudioEngine.ts**: AnalyserNode moved from series (masterGain → analyser → destination) to parallel branch (masterGain → destination, masterGain → analyser). NOT YET CONFIRMED if this helps — was pushed alongside full tick loop restore.
- **useAudioEngine.ts**: Tick loop currently at step 2c level (pollBeats + position + loop + setCurrentTime). resync/FFT/beat intensity excluded.

## S56 Isolation Results (CONFIRMED by Nathan, hard refresh each step)
| Step | Added to tick loop | Click? |
|------|--------------------|--------|
| Baseline | pollBeats only | **WORKS** ✓ |
| 2b | + position + loop checking | **WORKS** ✓ |
| 2c | + setCurrentTime + emitTimeUpdate | **WORKS** ✓ |
| 2d | + resyncToPosition | **WORKS** ✓ (still drifts) |
| 2e | + FFT + beat intensity | **BROKE** ✗ |
| 2e-i | remove FFT, keep beat intensity | **BROKE** ✗ |
| revert 2d | back to step 2d code | **BROKE** ✗ (permanent) |
| AnalyserNode fix + full restore | parallel analyser + all features | **BROKE** ✗ |
| revert 2c + analyser fix | step 2c + parallel analyser | **NOT YET TESTED** |

## KEY INSIGHT: The break at step 2e was PERMANENT
Reverting to previously-working code did NOT fix the click. This means something persistent (likely AnalyserNode/AudioContext state) was damaged and survived code reloads. The AnalyserNode parallel fix may address this but hasn't been tested in isolation.

## NEXT SESSION PRIORITY: Audit methodology, then continue isolation
**CRITICAL**: AI kept making multiple changes per push. Next session MUST:
1. **Establish testing protocol**: one change per push, hard refresh + close tab, confirm version hash visible in UI
2. **Test AnalyserNode fix in isolation**: current deploy has parallel analyser + step 2c tick loop — Nathan needs to close all tabs, reopen, test
3. **If click works**: add back resync → test → add back beat intensity → test → add back FFT → test
4. **If click still broken**: the permanent damage theory is wrong — need fresh AudioContext (clear site data)
5. **Click timing/drift is a SEPARATE issue** — don't conflate with foreground silence

## Remaining Items
- [ ] **Fix web click foreground playback** — #1 priority (in progress)
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

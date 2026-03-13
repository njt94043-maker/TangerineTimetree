# TGT — Status (Instant Context)

> Single source of "where are we right now". Read this FIRST every session.
> Updated at end of every session. Keep under 60 lines.

---

## Current State
- **Phase**: S54 — Web click debug (still broken).
- **What works**: Android (full, V4 player with beat-synced visualisers + interactive mixer + all S51 fixes confirmed by Nathan), Cloud Run (beats + stems + CORS + skip_stems + re-analyse), Capture (category field + badges + filter + theme). Web stems/mixer RESTORED (S54 reverted AudioEngine.ts + ClickScheduler.ts to S51 baseline).
- **Last session (S54)**: Removed Player Settings from Settings.tsx (D-171). Reverted AudioEngine.ts + ClickScheduler.ts to S51 (c95537b) — fixed broken stems but click still silent. Added debug logging + BPM fallbacks to useAudioEngine.ts. Debug banner on Player.tsx.
- **Web click**: STILL BROKEN. Audio files (AudioEngine.ts, ClickScheduler.ts) are now exact S51 code (last known working). Debug banner shows CLK:✅ON, CTX:running, GAIN:1.00, BPM:90.9, ENG:playing — everything looks correct but no click sound. The problem is likely in useAudioEngine.ts (S54 additions on top of S51) or the call path to ClickScheduler.start().
- **Seed status**: 117 gigs (114 linked to venue_id) + 62 away dates. 29 clients, 65 venues. 4 songs.

## S54 Changes
- **Settings.tsx**: Removed Player Settings section (D-171 — prefs controlled from drawer only).
- **AudioEngine.ts + ClickScheduler.ts**: Reverted to S51 (c95537b). Restored inline AnalyserNode chain (masterGain → analyser → destination). Pre-rendered AudioBuffer click sounds (not OscillatorNode).
- **useAudioEngine.ts**: Added debug logging, BPM fallbacks, clickMuted sync from DB, updatePlayerPrefs persist on drawer toggle, beatIntensity/barTargets for visualisers.
- **Player.tsx**: Debug banner showing click state (temporary).
- **gotchas.md**: Logged S54 mistakes (blind guessing, failing to backtrack, Settings parity).

## NEXT SESSION PRIORITY: Web Click — Isolate useAudioEngine.ts
The audio core (AudioEngine.ts, ClickScheduler.ts) is S51 code that was confirmed working. The bug is in how useAudioEngine.ts calls the scheduler. Debug approach:
1. Check browser console for [TGT-CLICK-DEBUG] logs — confirm ClickScheduler.start() is actually called
2. Compare useAudioEngine.ts current vs S51 (c95537b) — diff S54 additions to find what broke the click path
3. If ClickScheduler.start() IS being called but no sound, add a test: manually create an OscillatorNode and play it to confirm AudioContext can produce sound at all
4. If ClickScheduler.start() is NOT being called, trace the clickEnabledRef → play() path in useAudioEngine.ts
5. Consider restoring useAudioEngine.ts to S51 state as a clean baseline, then re-add S54 features one at a time

## Remaining Items
- [ ] **Fix web click** — #1 priority
- [ ] Remove debug banner + console.log after click fixed
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

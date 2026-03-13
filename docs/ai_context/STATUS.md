# TGT — Status (Instant Context)

> Single source of "where are we right now". Read this FIRST every session.
> Updated at end of every session. Keep under 60 lines.

---

## Current State
- **Phase**: S53 — Web click fix + mobile black screen fix.
- **What works**: Android (full, V4 player with beat-synced visualisers + interactive mixer + all S51 fixes confirmed by Nathan), Cloud Run (beats + stems + CORS + skip_stems + re-analyse), Capture (category field + badges + filter + theme).
- **Last session (S53)**: Rewrote ClickScheduler from AudioBuffer to OscillatorNode approach. Fixed mobile black screen (stale SW cache). Deployed — needs user verification.
- **Web click fix**: Rewrote ClickScheduler to use OscillatorNode + gain envelope instead of pre-rendered AudioBuffers. The buffer approach silently failed after S52 changes. Oscillator approach is fundamentally more reliable. **DEPLOYED but NOT YET VERIFIED by user.**
- **Mobile black screen**: Was stale SW cache on phone from before skipWaiting/clientsClaim was deployed. Cleared Chrome data to fix. Future deploys auto-update via SW mechanism.
- **Seed status**: 117 gigs (114 linked to venue_id) + 62 away dates. 29 clients, 65 venues. 4 songs.

## S53 Changes
- **ClickScheduler rewrite**: OscillatorNode per click (sine wave + gain envelope: 1ms attack, sustain, 30ms total). Removed pre-rendered buffer approach entirely. D-159 preserved (all beats identical, no accent).
- **Mobile black screen fix**: Cleared stale Chrome SW cache via ADB. SW auto-update mechanism (S52) prevents recurrence.

## NEXT SESSION PRIORITY: Verify Web Click
1. Nathan to test web click on live site (thegreentangerine.com) — does click produce audible sound now?
2. If still broken: DevTools console debugging (AudioContext state, OscillatorNode creation, gain routing)
3. Web visualisers still untested by user (were blocked by click issue)

## Remaining Items
- [ ] **Verify web click fix** — deployed, needs user testing
- [ ] Web visualisers: user testing (blocked by click issue until now)
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

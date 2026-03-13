# TGT — Status (Instant Context)

> Single source of "where are we right now". Read this FIRST every session.
> Updated at end of every session. Keep under 60 lines.

---

## Current State
- **Phase**: S52 — Bug fixes + stabilisation continued.
- **What works**: Android (full, V4 player with beat-synced visualisers + interactive mixer + all S51 fixes confirmed by Nathan), Cloud Run (beats + stems + CORS + skip_stems + re-analyse), Capture (category field + badges + filter + theme).
- **Last session (S52)**: Beat-synced visualisers (D-169), web click null-prefs fix, PWA standalone guidance (D-170), SW auto-update mechanism.
- **CRITICAL OPEN BUG**: Web click sound not working. APK click works. Web click was working previously — something in S51 or S52 broke it. Null prefs fix + BPM fallbacks applied but didn't resolve. Needs deeper investigation next session.
- **User testing feedback (S52)**:
  1. **APK click**: Fixed, solid (confirmed S52)
  2. **APK visualisers**: OK with beat-synced approach (confirmed S52)
  3. **Web click**: NO AUDIBLE CLICK — top priority next session
  4. **Web visualisers**: Not yet tested (blocked by click/cache issue)
  5. **PWA standalone import**: Cannot connect to localhost (browser security). Nathan accepts this limitation (D-170). Use Chrome browser.
  6. **PWA cache**: Users were getting stale code. Fixed with SW skipWaiting + clientsClaim + auto-reload on controllerchange + 5min update check.
- **Seed status**: 117 gigs (114 linked to venue_id) + 62 away dates. 29 clients, 65 venues. 4 songs.

## S52 Changes
- **Visualisers (D-169)**: All 3 modes (Spectrum/Rings/Burst) now beat-driven metronome flash. Quick attack, slow release (~500ms). EQ bell-curve bar shape. Both platforms.
- **Web click fix (partial)**: getPlayerPrefs() null fallback + BPM/config fallbacks. Did NOT fix the issue — deeper investigation needed.
- **PWA standalone (D-170)**: Detects standalone mode, shows orange warning for import.
- **SW auto-update**: skipWaiting + clientsClaim + controllerchange reload + 5min update poll. Future deploys auto-update all users.

## NEXT SESSION PRIORITY: Web Click
The web click worked before S51. Something in S51 or S52 broke it. Steps:
1. Run local dev server, test click in Chrome DevTools with console open
2. Check AudioContext state, ClickScheduler.isPlaying, BPM config
3. Verify click buffers are created and scheduled
4. Check if the issue is scheduling (clicks never fire) or audio routing (clicks fire but silent)
5. Compare S50 code vs S51 diff for the breaking change

## Remaining Items
- [ ] **Web click — BROKEN** — top priority
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

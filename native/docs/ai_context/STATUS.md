# TGT — Status (Instant Context)

> Single source of "where are we right now". Read this FIRST every session.
> Updated at end of every session. Keep under 60 lines.

---

## Current State
- **Phase**: S37 complete + Capture tool hardened. Web player polish done. Capture tool: armed mode, writer thread, priority boost, server launchers all built.
- **What works**: Everything from S36/S37. Capture tool: armed mode (threshold detection + pre-roll buffer), writer thread (decoupled disk I/O from audio callback), HIGH_PRIORITY_CLASS process boost during recording, 40ms buffer for OS scheduling jitter tolerance, VBS/PS1 silent launchers, Chrome extension armed UI state with pulse animation.
- **Last session**: Capture tool hardening — armed mode full-stack (wasapi_capture.py + routes_capture.py + sidepanel.js/css), writer thread + priority boost for glitch-free audio, timer fixes (client-side wall clock, pause tracking), server launchers (start-silent.vbs, start.ps1), band context docs (MEMORY.md + blueprint.md).
- **Next action**: S38 — Visual testing on thegreentangerine.com, fix CSS issues, add more songs, Android player prefs UI, song import from capture. Capture: real-world audio quality testing, FFmpeg encoding diagnostics.
- **Seed status**: 117 gigs (114 linked to venue_id) + 62 away dates. 29 clients, 65 venues in Supabase. 3 songs (Cissy Strut, Sultans of Swing, War Pigs) fully processed.
- **Band roles**: All 4 profiles populated (Nathan=Drums, Neil=Bass, James=Lead Vocals, Adam=Guitar & Backing Vocals)

## Next Sprint — S38: Visual Testing + Content
### Goals
1. **Visual testing** — Test Library + Player on thegreentangerine.com, fix any CSS/layout issues
2. **Add more songs** — Manual via web + song import from capture tool (currently only 3)
3. **Android player prefs UI** — Mirror web's 7 toggles in SettingsScreen
4. **Song import from capture** — Bulk add songs from Nathan's capture workflow

### Sprint Roadmap
| Sprint | Scope | Status |
|--------|-------|--------|
| S34 | Migration + type updates + shared queries | Done |
| S35 | Android Library refactor + player refactor | Done |
| S36 | Web audio engine + Library redesign + Player UI | Done |
| S37 | Web player polish (wake lock, waveform, prefs UI, set complete, beat glow) | **Done** |
| S38 | Visual testing + add songs + Android prefs + capture import | **Next** |
| S31C | On-device testing (BTrack offline fallback) | Parked |

### Still Pending (not sprint-assigned)
- Add more songs via web app (currently only 3)
- User to verify 44 WhatsApp-confirmed fees, then batch-update
- **Dep gig calendar feature** — diagonal split colour for member-away + dep-gig days (D-117)
- **Offline cache management** — user controls local storage
- **Song import / bulk add** — from capture tool or batch flow (S38 target)
- **Recording/video capture** — front camera during practice (D-089, deferred)

## Big Picture
- **Vision**: GigBooks (Android/Compose) = Nathan's personal performance + practice tool. Web = full band management + practice for all members.
- **North star**: Nathan has pixel-perfect dark neumorphic app with click track + setlists on stage + beat-locked MP3 practice. Other band members use web app (invoicing, quotes, stage prompter, practice).
- **Architecture**: Monorepo (`shared/` + `native/` [shelved] + `web/` + `android/`)
- **Android app scope**: Calendar, Songs, Setlists, Live Mode, Practice Mode, Settings. NO invoicing/quotes/PDF.
- **Web app scope**: Full band management (invoicing, quotes, clients, venues, dashboard, PDF) + Live Mode + Practice Mode.
- **Audio**: Android = C++ AudioEngine (Oboe + SoundTouch) via JNI. Web = Web Audio API + SoundTouchJS (S36).
- **Design**: Dark neumorphic — GigColors matching web CSS, Karla + JetBrains Mono.
- **Users**: Nathan (Android for stage, web for management), Neil/James/Adam (web only)

## What's Deployed
- **Web**: thegreentangerine.com (Vercel, auto-deploys from master)
- **Android**: Compose debug APK on Samsung RFCW113WZRM (2026-03-08)
- **Supabase**: jlufqgslgjowfaqmqlds.supabase.co (25 tables, 4 storage buckets)
- **Cloud Run**: beat-analysis service on GCP tangerine-time-tree (europe-west1)
- **Capture tool**: localhost:5174 (UI) + localhost:9123 (backend). Launch via start-silent.vbs or start.ps1. Backend auto-starts via vite plugin.

## Session Protocol (Quick Reference)
**Start**: Read STATUS.md → IMPACT_MAP.md → todo.md → (deeper docs only if needed)
**End**: Update STATUS.md → todo.md → SESSION_LOG.md → gotchas.md (if learned) → decisions_log.md (if decided) → IMPACT_MAP.md (if coupling changed) → schema_map.md (if schema changed)

# TGT — Status (Instant Context)

> Single source of "where are we right now". Read this FIRST every session.
> Updated at end of every session. Keep under 60 lines.

---

## Current State
- **Phase**: S37 complete — Web player polish done. Wake lock, waveform visualiser, player prefs UI, set complete/between-songs, beat glow polish all built. Android fully built (S35). Cloud Run pipeline live.
- **What works**: Everything from S36 + wake lock (visibility re-acquire), waveform visualiser (canvas amplitude peaks on seek bar), player prefs settings UI (7 toggles in Settings, auto-save), set complete celebration screen + between-songs countdown transition (setlist mode), beat glow polish (pulse animation, multi-layer box-shadow, downbeat accent). Both tsc + vite build clean.
- **Last session**: S37 — 1 session. Wake lock hook + player prefs toggles in Settings + set complete/between-songs overlay + waveform canvas + beat glow CSS animations + songComplete flag in useAudioEngine.
- **Next action**: S38 — Visual testing on thegreentangerine.com, fix CSS issues, add more songs, lyrics/chords scroll sync.
- **Seed status**: 117 gigs (114 linked to venue_id) + 62 away dates. 29 clients, 65 venues in Supabase. 3 songs (Cissy Strut, Sultans of Swing, War Pigs) fully processed.
- **Band roles**: All 4 profiles populated (Nathan=Drums, Neil=Bass, James=Lead Vocals, Adam=Guitar & Backing Vocals)

## Next Sprint — S38: Visual Testing + Content
### Goals
1. **Visual testing** — Test Library + Player on thegreentangerine.com, fix any CSS/layout issues
2. **Add more songs** — Bulk add flow or manual via web (currently only 3)
3. **Lyrics/chords scroll sync** — Auto-sync to playback position
4. **Android player prefs UI** — Mirror web's 7 toggles in SettingsScreen

### Sprint Roadmap
| Sprint | Scope | Status |
|--------|-------|--------|
| S34 | Migration + type updates + shared queries | Done |
| S35 | Android Library refactor + player refactor | Done |
| S36 | Web audio engine + Library redesign + Player UI | Done |
| S37 | Web player polish (wake lock, waveform, prefs UI, set complete, beat glow) | **Done** |
| S38 | Visual testing + add songs + scroll sync | **Next** |
| S31C | On-device testing (BTrack offline fallback) | Parked |

### Still Pending (not sprint-assigned)
- Add more songs via web app (currently only 3)
- User to verify 44 WhatsApp-confirmed fees, then batch-update
- **Dep gig calendar feature** — diagonal split colour for member-away + dep-gig days (D-117)
- **Offline cache management** — user controls local storage
- **Song import / bulk add** — no batch flow, manual add only
- **Lyrics/chords scroll sync** — auto-sync to playback position (discussed, not decided)
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

## Session Protocol (Quick Reference)
**Start**: Read STATUS.md → IMPACT_MAP.md → todo.md → (deeper docs only if needed)
**End**: Update STATUS.md → todo.md → SESSION_LOG.md → gotchas.md (if learned) → decisions_log.md (if decided) → IMPACT_MAP.md (if coupling changed) → schema_map.md (if schema changed)

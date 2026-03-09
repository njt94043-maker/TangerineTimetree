# TGT — Status (Instant Context)

> Single source of "where are we right now". Read this FIRST every session.
> Updated at end of every session. Keep under 60 lines.

---

## Current State
- **Phase**: S35 complete — Android fully built (Library, Live, Practice, Calendar, Settings). Web fully shipped (invoicing, quotes, calendar, stage prompter, public site). Cloud Run pipeline live.
- **What works**: Full pipeline verified for all 3 songs. Cloud Run processing (madmom beats + Demucs stems). Web + Android builds clean. Song categories + setlist types + player prefs columns live in Supabase. Android Library: filter pills, inline launch, queue overlay, set complete, speed safety. 25 Supabase tables, 4 storage buckets, 28 PDF templates.
- **Last session**: S35 — Android Library + Player refactor (filter pills, queue overlay, set complete, speed safety modal).
- **Next action**: S36 — Web audio engine (TypeScript Web Audio API + SoundTouchJS). Then S37 — Web player UI.
- **Seed status**: 117 gigs (114 linked to venue_id) + 62 away dates. 29 clients, 65 venues in Supabase. 3 songs (Cissy Strut, Sultans of Swing, War Pigs) fully processed.
- **Band roles**: All 4 profiles populated (Nathan=Drums, Neil=Bass, James=Lead Vocals, Adam=Guitar & Backing Vocals)

## Next Sprint — S36: Web Audio Engine
### Goals
1. **TypeScript audio engine** — Web Audio API click scheduling (frame-accurate), track playback (fetch + decode), stem mixing (gain nodes per channel), speed control (SoundTouchJS for pitch-preserved time-stretch), A-B loop region
2. **Web Library redesign** — Same tabs/filters as Android (Songs/Setlists tabs, category pills, setlist type pills, inline Live/Practice launch buttons)
3. **Player prefs loading** — Load per-user player_*_enabled toggles from user_settings, wire to engine config

### After S36 — S37: Web Player UI
- React player component (visual hero, transport, queue overlay, set complete screen)
- Live + Practice modes (mode flag controls which features show)
- Per-user prefs toggles in settings UI
- Wake lock API, waveform visualiser (Canvas)

### Sprint Roadmap
| Sprint | Scope | Status |
|--------|-------|--------|
| S34 | Migration + type updates + shared queries | Done |
| S35 | Android Library refactor + player refactor | Done |
| S36 | Web audio engine (TypeScript) + Library redesign | **Next** |
| S37 | Web player UI (Live + Practice modes) | Blocked on S36 |
| S31C | On-device testing (BTrack offline fallback) | Parked |

### Still Pending (not sprint-assigned)
- Add more songs via web app (currently only 3)
- User to verify 44 WhatsApp-confirmed fees, then batch-update
- **Player prefs UI** — 7 toggles exist in DB, no settings screen shows them (Android or web)
- **Dep gig calendar feature** — diagonal split colour for member-away + dep-gig days (D-117)
- **Offline cache management** — user controls local storage
- **Song import / bulk add** — no batch flow, manual add only
- **Lyrics/chords scroll sync** — auto-sync to playback position (discussed, not decided)
- **Beat visualization timing** — card glow locked (D-119) but fade curve not specified
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
**Start**: Read STATUS.md → todo.md → (deeper docs only if needed)
**End**: Update STATUS.md → todo.md → SESSION_LOG.md → gotchas.md (if learned) → decisions_log.md (if decided)

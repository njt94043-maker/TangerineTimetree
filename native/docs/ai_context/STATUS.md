# TGT — Status (Instant Context)

> Single source of "where are we right now". Read this FIRST every session.
> Updated at end of every session. Keep under 60 lines.

---

## Current State
- **Phase**: S36 complete — Web audio engine + Library redesign + Player UI all built. Android fully built (S35). Cloud Run pipeline live.
- **What works**: Full Web Audio API stack: AudioEngine singleton, ClickScheduler (frame-accurate, 5 click sounds, beat map mode), TrackPlayer (SoundTouchJS pitch-preserved speed), StemMixer (per-stem gain/mute/solo). Library view (tabbed Songs/Setlists, category + type filter pills, inline Live/Practice launch). Player view (transport, beat counter, lyrics/chords, speed control, A-B loop, stem mixer, setlist queue overlay). Forgot password flow. Both tsc + vite build clean.
- **Last session**: S36 — 3 sessions. Session 1: Forgot password fix + AudioEngine + ClickScheduler. Session 2: TrackPlayer + StemMixer + useAudioEngine hook. Session 3: Library component + Player component + view routing + CSS.
- **Next action**: S37 — Polish + visual testing + wake lock + waveform visualiser + player prefs settings UI.
- **Seed status**: 117 gigs (114 linked to venue_id) + 62 away dates. 29 clients, 65 venues in Supabase. 3 songs (Cissy Strut, Sultans of Swing, War Pigs) fully processed.
- **Band roles**: All 4 profiles populated (Nathan=Drums, Neil=Bass, James=Lead Vocals, Adam=Guitar & Backing Vocals)

## Next Sprint — S37: Web Player Polish
### Goals
1. **Visual testing** — Test Library + Player on thegreentangerine.com, fix any CSS/layout issues
2. **Wake lock API** — Keep screen awake during playback (Live and Practice modes)
3. **Waveform visualiser** — Canvas-based amplitude display on seek bar (Practice mode)
4. **Player prefs settings UI** — 7 toggle switches in Settings screen (click, flash, lyrics, chords, notes, drums, vis)
5. **Set complete screen** — Between-songs waiting screen + set complete celebration (setlist mode)
6. **Beat glow polish** — Card-level glow curve (D-119), fade timing

### Sprint Roadmap
| Sprint | Scope | Status |
|--------|-------|--------|
| S34 | Migration + type updates + shared queries | Done |
| S35 | Android Library refactor + player refactor | Done |
| S36 | Web audio engine + Library redesign + Player UI | **Done** |
| S37 | Web player polish (wake lock, waveform, prefs UI) | **Next** |
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
**Start**: Read STATUS.md → IMPACT_MAP.md → todo.md → (deeper docs only if needed)
**End**: Update STATUS.md → todo.md → SESSION_LOG.md → gotchas.md (if learned) → decisions_log.md (if decided) → IMPACT_MAP.md (if coupling changed) → schema_map.md (if schema changed)

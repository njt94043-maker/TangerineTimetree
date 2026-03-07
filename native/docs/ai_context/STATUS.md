# TGT — Status (Instant Context)

> Single source of "where are we right now". Read this FIRST every session.
> Updated at end of every session. Keep under 60 lines.

---

## Current State
- **Phase**: S27C complete + UI alignment sprint. C++ build VERIFIED. **Ready for S28+ (Recording/Video).**
- **Blocker**: NONE — C++ build verified. APK installed on device.
- **Last session**: 2026-03-07 — UI alignment: native calendar matches web (drawer nav, flex grid, styling parity). Removed Cal/List toggle + Away Dates button from calendar (drawer handles nav). Added Gig List + Away Dates drawer screens. Flex-based calendar grid. Safe area fix. Wider web calendar.
- **Next action**: S28+ — Recording/Video spec
- **Seed status**: 117 gigs (114 linked to venue_id) + 62 away dates. 29 clients, 65 venues in Supabase.
- **Band roles**: All 4 profiles populated (Nathan=Drums, Neil=Bass, James=Lead Vocals, Adam=Guitar & Backing Vocals)

## Big Picture
- **Vision**: GigBooks = band manager + live performance tool + practice tool. One app for everything.
- **North star**: Nathan manages gigs/invoices/quotes AND performs with click track + setlists on stage AND practices songs with beat-locked MP3s. Other members get stage prompter (lyrics/chords) on web.
- **Architecture**: Monorepo (`shared/` + `native/` + `web/`) — Supabase for all data. C++ audio engine (Oboe) via Expo Native Module for native app. Web = no audio, stage prompter only.
- **Audio engine**: `native/modules/click-engine/` — Expo Native Module wrapping C++/Oboe metronome + track player + mixer + beat detector. SoundTouch for time-stretch. JS API: `native/src/audio/ClickEngine.ts`.
- **Live Mode**: `native/app/(drawer)/live.tsx` — full-screen stage view, setlist nav, beat viz, transport, swing slider, wake lock (expo-keep-awake).
- **Design**: Collapsible drawer nav on both apps (IMPLEMENTED S19). Unified theme.
- **Users**: Nathan (admin/drummer — full audio features), Neil/James/Adam (management + stage prompter)

## Active Risks
1. **C++ build VERIFIED** — Oboe 1.9.3 + SoundTouch + track_player + beat_detector all compile and link. 105MB release APK built 2026-03-07.
2. **APK installed** — 105MB release APK installed on Samsung RFCW113WZRM (2026-03-07).
3. **SoundTouch licensing** — LGPL. Fine for personal band app. Vendored source in `modules/click-engine/android/third_party/soundtouch/`.

## What's Deployed
- **Web**: thegreentangerine.com (Vercel, auto-deploys from master)
- **Native**: Release APK installed on Samsung RFCW113WZRM (2026-03-07)
- **Supabase**: jlufqgslgjowfaqmqlds.supabase.co (production, 23 tables live, S26A migration pushed)

## Supabase Tables (23 live)
- **Calendar**: profiles, gigs, away_dates, gig_changelog, away_date_changelog
- **Public site**: public_media, contact_submissions
- **Invoicing (S10)**: clients, venues, invoices, receipts, user_settings, band_settings
- **Quoting (S15)**: service_catalogue, quotes, quote_line_items, formal_invoices, formal_invoice_line_items, formal_receipts
- **S23A**: venue_photos, venues restructured, gigs/quotes/invoices/formal_invoices have venue_id FK
- **S25A+S26A**: songs (now with lyrics/chords/beat_offset_ms), setlists, setlist_songs
- **Storage**: public-media, venue-photos, practice-tracks
- **RPC**: `next_invoice_number()`, `next_quote_number()` — atomic increments

## Session Protocol (Quick Reference)
**Start**: Read STATUS.md → todo.md → (deeper docs only if needed) → `npx tsc --noEmit`
**End**: Update STATUS.md → todo.md → SESSION_LOG.md → gotchas.md (if learned) → decisions_log.md (if decided)

## Sprint Roadmap
| Sprint | Focus | Status |
|--------|-------|--------|
| S1-S25C | Band manager (calendar, invoicing, quotes, venues, clients, setlists, PDF, public site) | ALL DONE |
| **S26A** | **C++ audio engine Expo Module + schema migration (lyrics/chords/beat_offset_ms) + role-based song form** | **DONE** |
| **S26B** | **Live Mode UI — stage view, setlist nav, beat viz, transport, wake lock** | **DONE** |
| **S26C** | **Track player C++ + beat detection + SoundTouch time-stretch + A-B loop + MP3 decode** | **DONE** |
| **S27A** | **Practice Mode UI — speed slider, A-B markers, beat step/nudge, volume mix** | **DONE** |
| **S27B** | **Practice tools — tap tempo, save settings to song, song notes display** | **DONE** |
| **S27C** | **Web stage prompter — lyrics/chords/song info, setlist nav (no audio)** | **DONE** |
| **S28+** | **Recording/video — spec later** | BACKLOG |

Prompts: `native/docs/ai_context/SPRINT_PROMPTS.md`

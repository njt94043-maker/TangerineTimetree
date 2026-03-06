# TGT — Status (Instant Context)

> Single source of "where are we right now". Read this FIRST every session.
> Updated at end of every session. Keep under 60 lines.

---

## Current State
- **Phase**: S25C complete. Big-picture realignment DONE. **Ready for S26A (C++ audio engine).**
- **Blocker**: None. Pre-flight passed: NDK 27.1, CMake 3.22.1, expo-modules-core installed, 36GB free.
- **Last session**: 2026-03-06 — Big-picture realignment. Confirmed S26-S28 roadmap: Live Mode + Practice Mode + Web Stage Prompter. C++ engine ported from ClickTrack (`C:\Apps\Click`), not built from scratch.
- **Next action**: S26A — Expo Native Module with C++/Oboe metronome + mixer from ClickTrack. Schema migration (lyrics, chords, beat_offset_ms). Role-based song form.
- **Seed status**: 117 gigs (114 linked to venue_id) + 62 away dates. 29 clients, 65 venues in Supabase.
- **Band roles**: All 4 profiles populated (Nathan=Drums, Neil=Bass, James=Lead Vocals, Adam=Guitar & Backing Vocals)

## Big Picture
- **Vision**: GigBooks = band manager + live performance tool + practice tool. One app for everything.
- **North star**: Nathan manages gigs/invoices/quotes AND performs with click track + setlists on stage AND practices songs with beat-locked MP3s. Other members get stage prompter (lyrics/chords) on web.
- **Architecture**: Monorepo (`shared/` + `native/` + `web/`) — Supabase for all data. C++ audio engine (Oboe) via Expo Native Module for native app. Web = no audio, stage prompter only.
- **Audio source**: ClickTrack (`C:\Apps\Click\app\src\main\cpp\`) — proven C++/Oboe metronome engine. Port metronome + mixer, strip samples/loops/poly/midi. ClickTrack evolves separately into sticking/rudiment practice app.
- **Design**: Collapsible drawer nav on both apps (IMPLEMENTED S19). Unified theme.
- **Users**: Nathan (admin/drummer — full audio features), Neil/James/Adam (management + stage prompter)

## Active Risks
1. **Expo Module + C++/Oboe integration** — first time adding native C++ to this project. S26A starts with a "hello beep" proof before porting full engine.
2. **Native APK rebuilt** — 103MB release APK built 2026-03-06. Needs sideload to Samsung device.
3. **aubio licensing** — GPL. Fine for personal band app. Note if ever publishing commercially.

## What's Deployed
- **Web**: thegreentangerine.com (Vercel, auto-deploys from master)
- **Native**: Release APK installed on Samsung RFCW113WZRM (2026-03-05)
- **Supabase**: jlufqgslgjowfaqmqlds.supabase.co (production, 20 tables live, S24A migration pushed)

## Supabase Tables (23 live)
- **Calendar**: profiles, gigs, away_dates, gig_changelog, away_date_changelog
- **Public site**: public_media, contact_submissions
- **Invoicing (S10)**: clients, venues, invoices, receipts, user_settings, band_settings
- **Quoting (S15)**: service_catalogue, quotes, quote_line_items, formal_invoices, formal_invoice_line_items, formal_receipts
- **S23A**: venue_photos (new table), venues restructured (ratings/postcode/notes, no client_id), gigs/quotes/invoices/formal_invoices have venue_id FK, gigs have client_id FK
- **S25A**: songs, setlists, setlist_songs (new tables)
- **Storage**: public-media, venue-photos, practice-tracks (new S25A)
- **RPC**: `next_invoice_number()`, `next_quote_number()` — atomic increments

## Session Protocol (Quick Reference)
**Start**: Read STATUS.md → todo.md → (deeper docs only if needed) → `npx tsc --noEmit`
**End**: Update STATUS.md → todo.md → SESSION_LOG.md → gotchas.md (if learned) → decisions_log.md (if decided)

## Sprint Roadmap
| Sprint | Focus | Status |
|--------|-------|--------|
| S1-S25C | Band manager (calendar, invoicing, quotes, venues, clients, setlists, PDF, public site) | ALL DONE |
| **S26A** | **C++ audio engine Expo Module + schema migration (lyrics/chords/beat_offset_ms) + role-based song form** | **NEXT** |
| **S26B** | **Live Mode UI — stage view, setlist nav, beat viz, transport, wake lock** | PLANNED |
| **S26C** | **Track player C++ + aubio beat detection + SoundTouch time-stretch + A-B loop** | PLANNED |
| **S27A** | **Practice Mode UI — speed slider, A-B markers, beat step/nudge, volume mix** | PLANNED |
| **S27B** | **Practice tools — speed trainer, tap tempo, muted bars, save to song** | PLANNED |
| **S27C** | **Web stage prompter — lyrics/chords/song info, setlist nav (no audio)** | PLANNED |
| **S28+** | **Recording/video — spec later** | BACKLOG |

Prompts: `native/docs/ai_context/SPRINT_PROMPTS.md`

# TGT — Status (Instant Context)

> Single source of "where are we right now". Read this FIRST every session.
> Updated at end of every session. Keep under 60 lines.

---

## Current State
- **Phase**: Server-side beat detection pipeline built end-to-end. Ready to deploy + test.
- **What works**: C++ engine plays click at beat map timestamps. Upload + stem pipeline works. All screens built. Server-side madmom service ready to deploy. Web triggers analysis after upload, Android fetches from Supabase with BTrack fallback.
- **What's new (S31A)**: madmom Cloud Run service (Dockerfile + main.py), beat_maps Supabase table, web analysis trigger + status UI, Android fetches server beat map, C++ nativeApplyExternalBeatMap JNI method.
- **Last session**: S31A — Built full server-side beat detection pipeline. Both apps build clean (web tsc + android gradle).
- **Next action**: Deploy Cloud Run service, run beat_maps migration, test end-to-end with Sultans/Cissy Strut/War Pigs.
- **Seed status**: 117 gigs (114 linked to venue_id) + 62 away dates. 29 clients, 65 venues in Supabase.
- **Band roles**: All 4 profiles populated (Nathan=Drums, Neil=Bass, James=Lead Vocals, Adam=Guitar & Backing Vocals)

## Next Session Plan: S31B — Deploy + End-to-End Test
- Deploy Cloud Run service (`gcloud builds submit` + `gcloud run deploy`)
- Run beat_maps migration via Supabase dashboard SQL editor
- Set VITE_BEAT_ANALYSIS_URL in Vercel env vars
- Upload test tracks (Sultans, Cissy Strut, War Pigs) → verify analysis
- Test on Android device: verify server beat map applied, BTrack fallback works
- If working: push to production

## Big Picture
- **Vision**: GigBooks (Android/Compose) = Nathan's personal performance + practice tool. Web = full band management.
- **North star**: Nathan has pixel-perfect dark neumorphic app with click track + setlists on stage + beat-locked MP3 practice. Other band members use web app (invoicing, quotes, stage prompter).
- **Architecture**: Monorepo (`shared/` + `native/` [shelved] + `web/` + `android/` [new])
- **Android app scope**: Calendar, Songs, Setlists, Live Mode, Practice Mode, Settings. NO invoicing/quotes/PDF.
- **Web app scope**: Full band management (invoicing, quotes, clients, venues, dashboard, PDF, stage prompter).
- **Audio engine**: `android/app/src/main/cpp/` — C++ AudioEngine → JNI → AudioEngineBridge.kt (Oboe + SoundTouch).
- **Design**: Dark neumorphic — GigColors matching web CSS, Karla + JetBrains Mono, NeuCard/NeuWell composables.
- **Users**: Nathan (full audio features), Neil/James/Adam (web only)

## Active Risks
1. **Cloud Run not yet deployed** — service built but needs `gcloud` deploy + beat_maps migration.
2. **C++ build VERIFIED** — Oboe 1.9.3 + SoundTouch + all engine files compile and link in Compose project.
3. **APK installed** — Compose debug APK installed on Samsung RFCW113WZRM (2026-03-08).
4. **React Native shelved** — archived but still in git. Can resume if Compose doesn't work out.

## What's Deployed
- **Web**: thegreentangerine.com (Vercel, auto-deploys from master)
- **Android**: Compose debug APK installed on Samsung RFCW113WZRM (2026-03-08)
- **Supabase**: jlufqgslgjowfaqmqlds.supabase.co (production, 23 tables live + song_stems + beat_maps pending migration)

## Compose Project Structure (android/)
- **Theme**: GigColors, GigTypography, GigBooksTheme (dark, matches web)
- **Navigation**: ModalNavigationDrawer, 6 screens (Calendar, Songs, Setlists, Live, Practice, Settings)
- **Screens done**: ALL — CalendarScreen, LibraryScreen (songs+setlists tabs), LiveScreen, PracticeScreen, SettingsScreen, LoginScreen
- **Components**: NeuCard, NeuWell, MetronomeComponents (BeatDisplay, PlayStopButton, BeatDot animated)
- **Data**: SupabaseProvider singleton, AuthRepository, SongRepository, SetlistRepository — wired to AppViewModel
- **Audio**: AppViewModel → AudioEngineBridge.kt → C++ — click (ch0) + main track (ch1) + stems (ch2..7). Server beat map fetch → BTrack fallback. Stems auto-load after track load.
- **Build**: `cd android && ./gradlew assembleDebug --no-daemon`

## Supabase Tables (25 — 23 live + 2 pending migration)
- **Calendar**: profiles, gigs, away_dates, gig_changelog, away_date_changelog
- **Public site**: public_media, contact_submissions
- **Invoicing (S10)**: clients, venues, invoices, receipts, user_settings, band_settings
- **Quoting (S15)**: service_catalogue, quotes, quote_line_items, formal_invoices, formal_invoice_line_items, formal_receipts
- **S23A**: venue_photos, venues restructured, gigs/quotes/invoices/formal_invoices have venue_id FK
- **S25A+S26A**: songs (now with lyrics/chords/beat_offset_ms), setlists, setlist_songs
- **S28A**: song_stems (table + RLS live), song-stems storage bucket
- **S28B**: StemLabel/SongStem Kotlin types, StemRepository, stem engine wired (ch2..8)
- **S31A**: beat_maps (pending migration) — server-side beat detection results
- **Storage**: public-media, venue-photos, practice-tracks, song-stems
- **RPC**: `next_invoice_number()`, `next_quote_number()` — atomic increments

## Session Protocol (Quick Reference)
**Start**: Read STATUS.md → todo.md → (deeper docs only if needed)
**End**: Update STATUS.md → todo.md → SESSION_LOG.md → gotchas.md (if learned) → decisions_log.md (if decided)

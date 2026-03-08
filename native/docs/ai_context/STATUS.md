# TGT — Status (Instant Context)

> Single source of "where are we right now". Read this FIRST every session.
> Updated at end of every session. Keep under 60 lines.

---

## Current State
- **Phase**: Jetpack Compose rewrite scaffolded + building + installed. Ready to build out screens.
- **Blocker**: NONE — Compose scaffold builds and installs on Samsung RFCW113WZRM.
- **Last session**: 2026-03-08 — Compose rewrite scaffolded (android/), builds successfully (4m32s), installed on device. React Native archived to D:/tgt/gigbooks-react-native-backup-2026-03-08.7z (still in git).
- **Next action**: Build out Compose screens — Songs, Setlists, Live Mode, Practice Mode, Settings. Wire up Supabase Kotlin queries for calendar data. Add login screen.
- **Seed status**: 117 gigs (114 linked to venue_id) + 62 away dates. 29 clients, 65 venues in Supabase.
- **Band roles**: All 4 profiles populated (Nathan=Drums, Neil=Bass, James=Lead Vocals, Adam=Guitar & Backing Vocals)

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
1. **C++ build VERIFIED** — Oboe 1.9.3 + SoundTouch + all engine files compile and link in Compose project.
2. **APK installed** — Compose debug APK installed on Samsung RFCW113WZRM (2026-03-08).
3. **React Native shelved** — archived but still in git. Can resume if Compose doesn't work out.

## What's Deployed
- **Web**: thegreentangerine.com (Vercel, auto-deploys from master)
- **Android**: Compose debug APK installed on Samsung RFCW113WZRM (2026-03-08)
- **Supabase**: jlufqgslgjowfaqmqlds.supabase.co (production, 23 tables live)

## Compose Project Structure (android/)
- **Theme**: GigColors, GigTypography, GigBooksTheme (dark, matches web)
- **Navigation**: ModalNavigationDrawer, 6 screens (Calendar, Songs, Setlists, Live, Practice, Settings)
- **Screens done**: CalendarScreen (month grid, today highlight, legend) — data not wired yet
- **Screens TODO**: Songs, Setlists, Live Mode, Practice Mode, Settings, Login
- **Components**: NeuCard, NeuWell (neumorphic surfaces)
- **Data**: SupabaseProvider singleton, AuthRepository (sign in/out/session)
- **Audio**: AudioEngineBridge.kt → C++ (all methods declared, not wired to UI yet)
- **Build**: `cd android && ./gradlew assembleDebug --no-daemon`

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
**Start**: Read STATUS.md → todo.md → (deeper docs only if needed)
**End**: Update STATUS.md → todo.md → SESSION_LOG.md → gotchas.md (if learned) → decisions_log.md (if decided)

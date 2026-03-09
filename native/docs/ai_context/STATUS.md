# TGT — Status (Instant Context)

> Single source of "where are we right now". Read this FIRST every session.
> Updated at end of every session. Keep under 60 lines.

---

## Current State
- **Phase**: S33 planning — Songs/Setlists/Live/Practice big-picture redesign.
- **What works**: Full pipeline verified for all 3 songs. Cloud Run processing. Web + Android builds clean. Booking system integrated. Practice/Live UI mockup v5 approved (2-tier transport, visual hero, bottom sheet mixer).
- **What's new (this session)**: Practice mockup v5 approved. C++ TrackPlayer::stop() fixed (loop-aware reset). A/B/Clear promoted to main transport (2-tier: speed+loop top, play/stop/restart/click bottom). Big-picture songs/setlists/live/practice flow requirements captured (see Next Session Plan).
- **Last session**: S32B/C testing + Practice/Live UI redesign mockup iteration.
- **Next action**: S33 planning session — full flow redesign for songs → setlists → live/practice. Schema changes needed. Mockups for each screen. See SPRINT_PROMPTS.md.
- **Seed status**: 117 gigs (114 linked to venue_id) + 62 away dates. 29 clients, 65 venues in Supabase.
- **Band roles**: All 4 profiles populated (Nathan=Drums, Neil=Bass, James=Lead Vocals, Adam=Guitar & Backing Vocals)

## Next Session Plan — S33: Songs/Setlists/Live/Practice Big-Picture Redesign
### Song Categories (schema change needed)
- **Tange Covers** — covers the band plays live
- **Tange Originals** — original songs by the band
- **Personal Songs** — songs each member knows individually (for dep/standing-in gigs)

### Setlist Types (schema change needed)
- **Tange Setlists** — band setlists for TGT gigs
- **Other Band Setlists** — setlists for bands any member stands in for

### Live Mode (no backing tracks, click + visuals only)
1. Play entire library start-to-finish (prev/next + swipe full list to select)
2. Play filtered library (Tange covers / originals / personal by member or all)
3. Play a setlist start-to-finish (choose from available setlists)
- Click + flash visuals from song BPM (server analysis + user-preferred speed)
- **Speed safety check**: if user's preferred speed differs from analysis BPM, prompt "Did you forget to reset speed after practice?" before live mode starts
- No backing tracks in live mode

### Practice Mode (backing tracks + click + visuals)
- Same 3 playback modes as live (library / filtered / setlist)
- Same song navigation (prev/next + swipe list)
- With backing tracks (main track + stems)
- With click + flash visuals
- Speed control, A-B loop, mixer, beat nudge — all from approved mockup v5

### UI Redesign
- Approved mockup: `mockups/practice-redesign.html` (v5)
- Visual hero area with canvas visualisations (spectrum/rings/burst)
- Compact waveform seekbar
- 2-tier transport (top: speed ±5 + A/B/Clear; bottom: restart + play + stop + click)
- Bottom sheet drawer (mixer faders + settings: subdivision, count-in, beat nudge)
- Uniform beat edge glow (no downbeat distinction)
- Same treatment for both Live and Practice (Practice adds backing tracks + mixer)

### Still Pending
- On-device testing: BTrack offline fallback (airplane mode)
- Web UI visual testing at thegreentangerine.com
- Add more songs via web app (currently only 3)
- User to verify 44 WhatsApp-confirmed fees, then batch-update

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
1. **Cloud Run deployed** — `https://beat-analysis-672617156755.europe-west1.run.app` (europe-west1, 8Gi RAM, 4 CPU, 900s timeout, max 2 instances, concurrency 1). Cold start ~90s (PyTorch + Demucs model loading). GCP project: tangerine-time-tree. Cloud Tasks queue: stem-processing.
2. **C++ build VERIFIED** — Oboe 1.9.3 + SoundTouch + all engine files compile and link in Compose project.
3. **APK installed** — Compose debug APK installed on Samsung RFCW113WZRM (2026-03-08).
4. **React Native shelved** — archived but still in git. Can resume if Compose doesn't work out.

## What's Deployed
- **Web**: thegreentangerine.com (Vercel, auto-deploys from master)
- **Android**: Compose debug APK installed on Samsung RFCW113WZRM (2026-03-08)
- **Supabase**: jlufqgslgjowfaqmqlds.supabase.co (production, 25 tables live including song_stems + beat_maps)
- **Cloud Run**: beat-analysis service on GCP tangerine-time-tree project (europe-west1)

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
- **S31A**: beat_maps (LIVE) — server-side beat detection results
- **Storage**: public-media, venue-photos, practice-tracks, song-stems
- **RPC**: `next_invoice_number()`, `next_quote_number()` — atomic increments

## Session Protocol (Quick Reference)
**Start**: Read STATUS.md → todo.md → (deeper docs only if needed)
**End**: Update STATUS.md → todo.md → SESSION_LOG.md → gotchas.md (if learned) → decisions_log.md (if decided)

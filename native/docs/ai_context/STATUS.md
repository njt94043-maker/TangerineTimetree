# TGT — Status (Instant Context)

> Single source of "where are we right now". Read this FIRST every session.
> Updated at end of every session. Keep under 60 lines.

---

## Current State
- **Phase**: Audio practice mode partially working. BPM fix confirmed working. Beat alignment (phase offset) still wrong.
- **Blocker**: Beat detector returns wrong beat offset → click fires at correct rate but wrong phase relative to track.
- **Last session**: 2026-03-08 session 8 — On-device testing. Fixed 4 audio bugs: (1) OOM: `mutableListOf<Short>` boxes PCM → ByteArray chunks + ShortBuffer. (2) 8.8% speed error: Oboe opens at 48kHz, MP3 at 44.1kHz → added linear interpolation resample in decodeAudio. (3) BPM override: applyEngineSettings was overriding detected BPM → guard: if detectedBpm>0 skip metadata BPM. (4) **Beat offset per-beat accumulation bug**: displacement was added to every nextBeatFrame_, making effective BPM = sr*60/(fpb+offset) instead of just delaying first beat. Fixed: offset applied once at start(), per-beat is 0. Nudge now uses pendingPhaseShift_ atomic (applied at next beat boundary). Also: unified transport (play/pause/stop + click mute), sample rate mismatch fix, safe area via safeDrawingPadding + statusBarsPadding. All committed + pushed (bab0050 and later).
- **Next action**: Research + fix beat alignment (S30A). Beat detector gives wrong offset — click fires at right BPM but not phase-locked to track. See next session plan below.
- **Seed status**: 117 gigs (114 linked to venue_id) + 62 away dates. 29 clients, 65 venues in Supabase.
- **Band roles**: All 4 profiles populated (Nathan=Drums, Neil=Bass, James=Lead Vocals, Adam=Guitar & Backing Vocals)

## Next Session Plan: S30A — Beat Alignment Fix
- Research beat_detector.cpp accuracy — does it return correct offset for "Sultans of Swing"?
- Investigate: SoundTouch BPMDetect vs custom onset autocorrelation
- Add logcat output of raw analysis result (bpm + offsetMs) at analysis time
- Possible approach: use FFT-based beat tracking OR manual offset slider as fallback
- Manual fine-tune: offset slider (±500ms range) in PracticeScreen, saves to Supabase
- Goal: user can align click to track manually if auto-detect is wrong

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
- **Supabase**: jlufqgslgjowfaqmqlds.supabase.co (production, 23 tables live + song_stems pending migration)

## Compose Project Structure (android/)
- **Theme**: GigColors, GigTypography, GigBooksTheme (dark, matches web)
- **Navigation**: ModalNavigationDrawer, 6 screens (Calendar, Songs, Setlists, Live, Practice, Settings)
- **Screens done**: ALL — CalendarScreen, LibraryScreen (songs+setlists tabs), LiveScreen, PracticeScreen, SettingsScreen, LoginScreen
- **Components**: NeuCard, NeuWell, MetronomeComponents (BeatDisplay, PlayStopButton, BeatDot animated)
- **Data**: SupabaseProvider singleton, AuthRepository, SongRepository, SetlistRepository — wired to AppViewModel
- **Audio**: AppViewModel → AudioEngineBridge.kt → C++ — click (ch0) + main track (ch1) + stems (ch2..7). Beat polling coroutine. Stems auto-load after track load.
- **Build**: `cd android && ./gradlew assembleDebug --no-daemon`

## Supabase Tables (24 — 23 live + 1 pending migration)
- **Calendar**: profiles, gigs, away_dates, gig_changelog, away_date_changelog
- **Public site**: public_media, contact_submissions
- **Invoicing (S10)**: clients, venues, invoices, receipts, user_settings, band_settings
- **Quoting (S15)**: service_catalogue, quotes, quote_line_items, formal_invoices, formal_invoice_line_items, formal_receipts
- **S23A**: venue_photos, venues restructured, gigs/quotes/invoices/formal_invoices have venue_id FK
- **S25A+S26A**: songs (now with lyrics/chords/beat_offset_ms), setlists, setlist_songs
- **S28A**: song_stems ✓ (table + RLS live), song-stems storage bucket ✓
- **S28B**: StemLabel/SongStem Kotlin types, StemRepository, stem engine wired (ch2..8) ✓
- **Storage**: public-media, venue-photos, practice-tracks, song-stems ✓
- **RPC**: `next_invoice_number()`, `next_quote_number()` — atomic increments

## Session Protocol (Quick Reference)
**Start**: Read STATUS.md → todo.md → (deeper docs only if needed)
**End**: Update STATUS.md → todo.md → SESSION_LOG.md → gotchas.md (if learned) → decisions_log.md (if decided)

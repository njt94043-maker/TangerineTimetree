# TGT — Status (Instant Context)

> Single source of "where are we right now". Read this FIRST every session.
> Updated at end of every session. Keep under 60 lines.

---

## Current State
- **Phase**: S34 complete — Migration applied, types/queries updated, web + android forms updated.
- **What works**: Full pipeline verified for all 3 songs. Cloud Run processing. Web + Android builds clean. Booking system integrated. Song categories + setlist types + player prefs columns live in Supabase.
- **What's new (this session)**: S34 migration applied (songs.category, songs.owner_id, songs.drum_notation, setlists.setlist_type, setlists.band_name, user_settings 7x player_*_enabled). Shared TS types updated (SongCategory, SetlistType, PlayerPrefs). Shared queries (getSongsByCategory, getSongsByOwner, getSetlistsByType, getPlayerPrefs, updatePlayerPrefs). Android data classes + repos updated. Web SongForm: category selector + owner picker (personal) + drum notation (drummer). Web SetlistList/SetlistDetail: setlist_type selector + band_name field + dynamic PDF band name.
- **Last session**: S33 planning — schema design, architecture decisions, 3 new mockups, migration SQL drafted, sprint roadmap S34-S37.
- **Next action**: S35 — Android Library refactor + player refactor (Library as launchpad, shared player screen).
- **Seed status**: 117 gigs (114 linked to venue_id) + 62 away dates. 29 clients, 65 venues in Supabase.
- **Band roles**: All 4 profiles populated (Nathan=Drums, Neil=Bass, James=Lead Vocals, Adam=Guitar & Backing Vocals)

## Next Session Plan — S35: Android Library + Player Refactor
### Implementation Tasks
1. **Library as launchpad** — Songs/Setlists tabs, filter pills (category, member), launch into player
2. **Shared player screen** — Single composable with mode flag (Live vs Practice)
3. **Queue overlay** — Reorder mid-performance from song list overlay
4. **Set complete screen** — End-of-setlist display
5. **Speed safety check** — Modal confirmation for speed changes during live performance

### Architecture Decisions (from S33)
- **Library as launchpad**: Drawer has 4 items (Calendar, Library, Settings, + web-only items). Live/Practice launch FROM Library, not as separate nav destinations.
- **Shared player screen**: One screen with mode flag (Live = click+visuals+lyrics, Practice = +tracks+mixer). Compose: single composable. Web: single React component.
- **Web gets Live + Practice**: Web Audio API + SoundTouchJS for audio. All 4 members can practice from browser.
- **Stage prompter merges into Live Mode**: Per-user toggles (click, flash, lyrics, chords) in user_settings. Neil/James/Adam disable click, keep lyrics.
- **1 setlist = 1 gig**: No multi-set. Player waits between songs. "Set Complete" screen at end.
- **Live reorder**: Queue can be reordered mid-performance from song list overlay.
- **Personal songs unrestricted**: Can go in any setlist (TGT or other band).

### Sprint Roadmap
| Sprint | Scope |
|--------|-------|
| S34 | Migration + type updates + shared queries |
| S35 | Android Library refactor + player refactor |
| S36 | Web audio engine (TypeScript) + Library redesign |
| S37 | Web player UI (Live + Practice modes) |

### Mockups (S33 output)
- `mockups/library-browser.html` — Songs/Setlists tabs, category filters, member sub-filter, launch buttons
- `mockups/player-live.html` — Live mode v7: A/B glow toggle, display toggles in drawer, speed safety check modal
- `mockups/player-queue.html` — Queue overlay (reorder), between-songs waiting screen, set complete screen
- `mockups/practice-redesign.html` — Practice mode v5 (approved, existing)

### Still Pending
- On-device testing: BTrack offline fallback (airplane mode)
- Web UI visual testing at thegreentangerine.com
- Add more songs via web app (currently only 3)
- User to verify 44 WhatsApp-confirmed fees, then batch-update
- **Dep gig calendar feature** — diagonal split colour for member-away + dep-gig days (separate planning session)
- **Offline cache management** — user controls local storage (separate implementation sprint)

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

## Supabase Tables (25 live)
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

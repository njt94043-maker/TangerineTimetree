# TGT — Session Log

> What each session built, tested, and blocked.
> Append at the end of every session.
> For instant context, read STATUS.md first.

## Latest Sessions (Quick Index)
| Date | Focus | Key Outcome |
|------|-------|-------------|
| 2026-03-09 | Full codebase audit + SOT doc overhaul | Deep audit of both apps (web + android + shared). Created IMPACT_MAP.md (component dependency/ripple map). Updated schema_map.md (added beat_maps, song_stems, S34 columns, 3 missing migrations). Rewrote gotchas.md Android section (reframed as active patterns, added 6 audit findings). Populated pain_journal.md. Key findings: booking wizard is fit for purpose (intentionally comprehensive), adoption blockers are onboarding friction (no forgot-password, no role-based drawer filtering), offline queue lacks conflict detection. Recalibrated after Nathan explained symbiotic management model. |
| 2026-03-09 | S35 — Android Library + Player refactor | LibraryScreen: category filter pills (All/Covers/Originals/Personal), setlist type filters (All/TGT/Other), category tags on cards, BPM on right, TRACK badge, inline Live/Practice launch (replaced ModalBottomSheet). GigBooksApp: drawer simplified to Calendar/Library/Settings. LiveScreen: queue overlay (reorder + jump-to-song), set complete celebration screen, speed safety modal. AppViewModel: isSetComplete, restartSetlist, reorderSetlistSong, jumpToSong. Gradle build clean. |
| 2026-03-09 | S34 — Migration + types + queries | Supabase migration applied (songs.category, owner_id, drum_notation; setlists.setlist_type, band_name; user_settings 7x player prefs). Shared TS types (SongCategory, SetlistType, PlayerPrefs on UserSettings). Shared queries (category/owner/type filters, player prefs CRUD). Android Song.kt + Setlist.kt data classes + repo filters. Web SongForm (category selector, owner picker for personal, drum notation for drummer). Web SetlistList + SetlistDetail (type selector, band_name field, dynamic PDF band name). Both tsc + gradle build clean. |
| 2026-03-09 | S33 cont — Mockup polish + A/B glow | Player-live v7: display toggles moved into bottom sheet drawer (D-118), card-level beat glow as default with full-screen as A/B toggle (D-119). Tested both glow modes, card glow confirmed as preferred but full-screen preserved for on-device A/B test. All 4 mockups finalised and plan approved. |
| 2026-03-09 | S33 — Songs/Setlists/Live/Practice planning | Schema design (song categories + setlist types + player prefs). 3 mockups: library-browser (Songs/Setlists tabs, filters, launch), player-live (lyrics/chords, speed safety check, simplified bottom sheet), player-queue (queue overlay+reorder, between-songs, set complete). Architecture: Library-as-launchpad (4 drawer items), shared player with mode flag, web gets Live+Practice (Web Audio + SoundTouchJS), stage prompter merges into Live Mode with per-user prefs. Decisions D-107 through D-119. Migration SQL drafted. Sprint roadmap S34-S37. |
| 2026-03-09 | S32B/C testing + Practice UI redesign | All 3 songs processed. Re-process verified. APK rebuilt. Booking confirmed. Then: Practice/Live UI redesign — 5 mockup iterations converging on media-player layout (visual hero + canvas vis + compact waveform + 2-tier transport + bottom sheet mixer). C++ stop() fixed for loop-aware reset. Big-picture songs/setlists/live/practice flow requirements captured for S33 planning. |
| 2026-03-09 | S32A — Automated stem separation | Cloud Run expanded (PyTorch CPU + Demucs htdemucs + torchaudio + soundfile). Cloud Tasks queue stem-processing. /process (202) → /process-worker (beats + stems). Web: triggerProcessing + polling. Android: processingStatus banner. E2E verified: Cissy Strut 90.9 BPM + 4 auto stems. Fixed: torchaudio, soundfile backend, created_by NOT NULL. |
| 2026-03-08 | S31B — Deploy + end-to-end test | Cloud Run deployed (europe-west1, Python 3.10, madmom 0.16.1). Fixed 3 compat issues (Cython build dep, collections.MutableSequence removed in 3.10, np.float removed in numpy 1.24). beat_maps migration applied via Supabase CLI (migration history repaired). Vercel env var VITE_BEAT_ANALYSIS_URL set + production redeployed. All 3 test tracks analysed via CLI: Cissy Strut (90.9 BPM, 287 beats, 53s cold), Sultans, War Pigs (750+ beats, 2min). GCP project: tangerine-time-tree, billing account linked. gcloud SDK installed via winget. |
| 2026-03-08 | S31A — Server-side beat detection (madmom) | Built full pipeline: Cloud Run Python service (madmom RNN+DBN, POST /analyse → JSON beats+BPM), beat_maps Supabase table (song_id FK, beats JSONB, bpm, status), web triggers analysis after practice track upload (auto-fetch + send to Cloud Run, status UI on song form), Android AppViewModel fetches server beat map before falling back to BTrack, C++ nativeApplyExternalBeatMap (float seconds → frames, reuses loadBeatMap path). Shared TS types (BeatMap, BeatMapStatus) + queries (getBeatMap, upsertBeatMap). Both apps build clean (web tsc + android gradle). NOT YET DEPLOYED — needs gcloud deploy + Supabase migration + Vercel env var. |
| 2026-03-08 | S30C — Beat detection research + architecture decision | Deep research: BTrack limits are architectural (5% tempo transition cap, onset-based = can't handle syncopation). Evaluated madmom (RNN+DBN, best accuracy), librosa (onset DP, same weakness as BTrack), Essentia (C++ multi-feature, AGPL, ~80%), BeatNet (CRNN+particle filter). **Decision: server-side madmom** → beat map stored in Supabase → C++ engine reads timestamps. BTrack removable. Explored web-only consolidation (Web Audio API could do practice playback) but confirmed native C++ still needed for live stage latency. GigBooks stays as performance client. Cloud Run free tier = zero cost at band scale. |
| 2026-03-08 | S30B — Beat alignment confirmed + limits found | Catch-up burst fix confirmed as original drift cause. Sultans of Swing holds 97+ bars. ANALYSIS_SECONDS 180→900 (was capping at 3 min, song is 5:47). Tested: Sultans (works), Cissy Strut (fails — syncopation, click never settles), War Pigs (fails — tempo changes + silence). Protocol followed this session. Next: research before coding. |
| 2026-03-08 | S30A — Beat map full overhaul | BTrack replaces spectral-flux detector. Two-pass analysis (30s rough BPM → seeded full pass). Fixed BTrack 44100 Hz hardcode (5 locations + setSampleRate()). cleanBeatMap (local sliding-window IBI: removes double-detects, fills single gaps). Full beat map stored as actual BTrack positions. loadBeatMap now skips past beats immediately (no catch-up burst). applyBeatMap passes current track/metro frame. Accent removed. ⏮ restart button added. Regrid (uniform grid) tried + reverted — wrong approach for variable-tempo tracks. Beat alignment unconfirmed on device — context lost mid-session. Protocol not followed (STATUS.md not read at start). |
| 2026-03-08 | S30 pre — Audio on-device testing + fixes | OOM fix (ByteArray+ShortBuffer for PCM), 44.1→48kHz resample (linear interp in decodeAudio), BPM guard (applyEngineSettings skips metadata if detectedBpm>0), **beat offset per-beat accumulation bug fixed** (C++ metronome: offset applied once at start(), nudge uses pendingPhaseShift_ atomic), unified transport (play/pause/stop + click mute), safe area insets (safeDrawingPadding + statusBarsPadding). BPM now confirmed correct (157 BPM fires at right rate). Beat phase alignment still wrong — detector returns incorrect offset. Next session: S30A beat alignment research + fix. |
| 2026-03-08 | S29A — CalendarScreen real data | Gig.kt + AwayDate.kt models; GigRepository; AppViewModel calendar state + loadCalendarMonth(); CalendarScreen rewritten (coloured dots, DayDetail panel, loading spinner); GigBooksApp wired (start destination). BUILD SUCCESSFUL. Committed 9d5ec16. |
| 2026-03-08 | S28D — Beat-locked click alignment | nativeSetBeatOffsetMs(ms) C++/JNI/Kotlin; SongRepository.updateBeatInfo(); AppViewModel runAnalysis() + applyDetectedBeat() + auto-apply stored offset; BeatAlignBanner composable; analysis spinner + aligned indicator in TrackSection. BUILD SUCCESSFUL. |
| 2026-03-08 | S28C — Waveform visualiser + stem volume sliders | WaveformSeekBar (Canvas, 600pt envelope, green bars, orange loop region, tap-to-seek). computeEnvelope() in AppViewModel. StemsCard: per-stem sliders with colour-coded labels. stemGains Map + setStemGain() → nativeSetChannelGain. BUILD SUCCESSFUL. |
| 2026-03-08 | S28B — N-channel mixer + stem loading | C++: TrackPlayer::reset(), MAX_STEMS=6 stemPlayers_[] (ch2..7), loadStem/clearStem/clearAllStems, transport sync on all stems (play/pause/stop/seek/loop/speed), onAudioReady stem render loop. JNI: nativeLoadStem/nativeClearStem/nativeClearAllStems. Kotlin: AudioEngineBridge externals, SongStem.kt+StemLabel enum (DRUMS=ch2..OTHER=ch7), StemRepository.kt, AppViewModel stem state + loadStemsForSong() auto-called after track load. S28A manual step still pending. |
| 2026-03-08 | Compose full app buildout (session 2) | AppViewModel (shared state + C++ engine wiring). LiveScreen (setlist nav, beat display, BPM adj, count-in). PracticeScreen (speed slider, beat nudge, subdivision, A-B loop). SettingsScreen (account, engine status, sign out). MetronomeComponents (animated beat dots). LibraryScreen updated (song action sheet, setlist play button). Fix: publishable API key (old rotated key). Fix: Postgres numeric fields → Double in Song.kt + Setlist.kt (were Int, broke JSON decode). Fix: JVM setter clash → renamed applySpeed/applySubdivision. Fix: remember{} for sheetSong. Fix: skipPartialExpansion removed in BOM 2025.05. BUILD SUCCESSFUL. Installed on Samsung. Committed + pushed (bbeb080). |
| 2026-03-08 | Compose rewrite scaffold + first build | Archived RN app to D:/tgt/. Scaffolded android/ (Gradle 9.0, Compose BOM 2025.05, Supabase Kotlin 3.1.4, Oboe 1.9.3). Dark neumorphic theme, ModalNavigationDrawer shell, CalendarScreen, NeuCard/NeuWell, AudioEngineBridge JNI, C++ engine ported. Fixed 4 build issues (Gradle settings syntax, AndroidX, SDK rename, OOM via page file). BUILD SUCCESSFUL 4m32s. Installed on Samsung. Committed (134 files). |
| 2026-03-08 | iOS map auto-detect + visual parity session wrap-up | Auto-detect iOS for Apple Maps default (web + native). SOT docs updated. All committed + pushed. |
| 2026-03-07 | Visual parity audit + audio upload UI | 8 visual fixes: calendar neon glows (gig/practice/unavailable/today), Today button tangerine outline, shadow simplification (uniform borders), drawer user avatar+name, song/setlist card left-border accents, drawer logo single-line. Audio upload UI on song edit forms (both apps): expo-document-picker (native), hidden file input (web), upload/replace/remove practice tracks. 10 files, 506 insertions. |
| 2026-03-07 | UI alignment: native ↔ web parity | Removed Cal/List toggle + Away Dates button from calendar screen (drawer handles nav). Added gig-list.tsx + away-dates.tsx drawer screens. Calendar: flex-based grid (no manual cellHeight), orange arrows, green Today pill, orange today border. Safe area: Math.max(insets.bottom, 12). Wider web calendar (margin 16→8px). APK built + installed on Samsung. |
| 2026-03-07 | C++ build fix + stage prompter polish | Fixed Oboe 1.9.2→1.9.3 (1.9.2 not on Maven). Added SoundTouch cpu_detect_x86.cpp, mmx_optimized.cpp, sse_optimized.cpp to CMakeLists. Fixed Kotlin withContext→runBlocking (AsyncFunction not suspend). Added .cxx/ to .gitignore. Stage prompter: back/close buttons. 105MB release APK built successfully. |
| 2026-03-07 | S27C — Web Stage Prompter | Full-screen stage prompter: setlist picker, lyrics/chords display (ChordPro inline + block mode), song info bar (key/BPM/time sig/duration/artist), prev/next nav + sidebar song list, fullscreen mode (F key), auto-scroll (S key, adjustable speed), keyboard navigation (arrows), per-song notes + setlist notes, responsive, #000 bg. tsc clean. |
| 2026-03-07 | S27B — Practice Tools | Tap tempo (measure tap intervals, display live BPM, Apply to engine, Save to Song in Supabase). Save All Settings button (BPM, subdivision, swing, accent, click sound, count-in, beat_offset_ms → updateSong). Song notes collapsible display in practice view. tsc clean. |
| 2026-03-07 | S27A — Practice Mode UI | Practice screen (practice.tsx). Song picker (filter to songs with audio_url, search). MP3 download+decode via loadPracticeTrack(). Progress bar with playhead, time display, A-B loop markers+region. Speed slider (50-150%) with +/-5% buttons, reset, slider. Beat LED visualization (reused from live.tsx). Transport: play/pause/stop. Volume: click/track/master sliders + split stereo toggle (IEM). Count-in selector (0/1/2/4 bars). Beat nudge (earlier/later). BPM display with effective BPM (base*speed). Drawer nav entry. User cut speed trainer + gap click from S27B. tsc clean. |
| 2026-03-07 | S26C — Track Player Engine | C++ track_player (PCM playback, A-B loop, SoundTouch time-stretch). beat_detector (onset autocorrelation, no aubio). SoundTouch vendored. MP3 decode (Kotlin MediaCodec). Track on ch1, click on ch0, mixed in onAudioReady. Speed control (track+click proportional). Beat nudge. Full JNI+Kotlin+TS API (15 new functions). tsc clean. BLOCKER: C++ build unverified. |
| 2026-03-07 | S26B — Live Mode UI | Full-screen stage view (live.tsx). Setlist selector, song nav (prev/next), beat LED visualization (red downbeat, teal others, scale+glow animation). Transport play/stop. Swing slider (50-75%, snap-to-middle). Song metadata (BPM large monospace, key, time sig). Count-in banner. Wake lock (expo-keep-awake). Performance section in drawer. Header hidden for immersive view. tsc clean. |
| 2026-03-06 | S26A — Audio Engine Foundation | Expo Native Module created (modules/click-engine/). Ported C++ engine from ClickTrack: metronome.h/cpp, mixer.h/cpp, wav_loader.h/cpp, stripped audio_engine.h/cpp (metronome+mixer only, no poly/sample/loop/midi). JNI bridge + Kotlin ClickEngineBridge + ClickEngineModule. JS/TS typed wrapper + loadSong() helper. Supabase migration: lyrics, chords, beat_offset_ms on songs. Shared types+queries updated. Role-based song forms (both apps): drummer sees metronome settings, others see simplified. Decision D-099 (Expo Module architecture). BLOCKER: C++ build not yet verified on device. |
| 2026-03-06 | Big-picture realignment + S26-S28 roadmap | Confirmed full roadmap: S26A (C++ engine Expo Module + schema), S26B (Live Mode UI), S26C (track player + aubio + SoundTouch), S27A (Practice Mode UI), S27B (practice tools), S27C (web stage prompter), S28+ (recording). C++ ported from ClickTrack (C:\Apps\Click), not built from scratch. Single Oboe stream (zero drift). aubio for beat detection, SoundTouch for time-stretch. Beat step/nudge from Rec'n'Share. Role-based song forms. Lyrics + chords + beat_offset_ms schema additions. Pre-flight passed: NDK/CMake/expo-modules-core all ready. Decisions D-090–D-098. Sprint prompts written for S26A–S27C. |
| 2026-03-06 | APK rebuild + S26A scoping | APK rebuilt (103MB release, assembleRelease 7m14s). S26A planning started: no existing Oboe/C++ code in repo, Song schema has all metronome fields (bpm, swing_percent, subdivision, accent_pattern, click_sound, count_in_bars). User notes: swing = slider with snap-to-middle. Deferred S26A for big-picture realignment session. |
| 2026-03-06 | S25B+C — Songs & Setlists UI + PDF + extras | Songs UI (both apps): list, search, add, edit, delete. Setlists UI (both apps): list, create, detail with song management + drag-to-reorder (web) + move up/down (native). Setlist PDF: band-themed template with logo, gradient header, song table, sharing. Gig list: visibility toggle (globe/lock icon). 12hr AM/PM time format throughout (web fmt() + native fmt/formatTime). Gig list back nav fix (popstate delay 0→100ms). Both tsc clean. |
| 2026-03-06 | S25A — Songs & Setlists: schema + types + queries | 3 new Supabase tables (songs, setlists, setlist_songs) + practice-tracks storage bucket. 6 shared types (Song, Setlist, SetlistSong, SetlistSongWithDetails, SetlistWithSongs, ClickSound). 20 shared query functions. Native wrappers. Migration pushed. Decisions D-083–D-089 (songs in Supabase, C++ audio engine, live mode, practice mode, setlist PDF sharing). Feature planning: 8-sprint Songs & Setlists epic (S25A–S28+). Both tsc clean. |
| 2026-03-05 | S24B — Bill-to flexibility UI (both apps) | Migration pushed to Supabase. Bill-to toggle on invoice+quote forms (both apps). Venue contact fields on venue forms/detail (both apps). Invoice/quote list billed-to name. Removed "Client is the venue" toggle from gig forms. Create Invoice button on gig day views with prefill (both apps). Invoiced badge on gigs with linked invoices. Web InvoiceForm prefill props. createVenue expanded (contact fields). Both tsc clean. |
| 2026-03-05 | S24A — Bill-to flexibility: schema + types + queries | Migration SQL (venue contact fields, nullable client_id, gig_id FK, CHECK constraints). Types updated (BillTo, venue contact fields on WithClient types). Queries updated (venue LEFT JOINs, resolveBillTo(), getInvoiceByGigId(), mapInvoiceRow/mapQuoteRow/mapFormalInvoiceRow helpers). Native wrapper updated. Both tsc clean. Migration needs pushing to Supabase. |
| 2026-03-05 | S24 planning — bill-to flexibility | Brainstormed venue/client invoicing model. Decided: invoices/quotes can target venue OR client (D-078-082). Planned S24A (schema+types+queries) + S24B (UI+gig→invoice shortcut). Sprint prompts written. |
| 2026-03-05 | Venue/client seeding + "Same as venue" toggle + key rotation | Committed all S23 work (51 files). Seeded 65 venues + 29 clients from 117 gig history (deduped 80+ text variants). Cleaned 62 gig venue/client text to canonical names. Built "Client is the venue" checkbox on gig forms (both apps). **INCIDENT: service_role key committed to public repo** — RESOLVED: legacy JWT keys disabled, new publishable/secret keys active, old key verified rejected, GitHub alert dismissed. |
| 2026-03-05 | Surgical audit + SOT cleanup | Audited all SOT docs + both codebases. Rewrote CLAUDE.md, gotchas.md, todo.md, schema_map.md (all had obsolete SQLite references). Fixed EntityPicker `label` bug (both apps). Deleted 3 dead files (database.sqlite.ts, queries.sqlite.ts, useMutationWithQueue.ts). Fixed decisions_log.md duplicate IDs. Both tsc + vite clean. |
| 2026-03-05 | S22 — Native visual overhaul | Pixel-perfect match webapp: BODY 13→14, NeuButton minHeight+padding, NeuWell minHeight 44, NeuSelect sizing, StatusBadge 10px, overlay 0.7, left-border accents on invoice/quote cards, stats shadows, addBtn green/black, font bumps across all screens. ~20 files, style-only. Both tsc clean. |
| 2026-03-05 | S23D — Quote+Invoice flow + audit (both apps) | EntityPicker in QuoteForm+InvoiceForm (both apps). venue_id through full chain: quote→formal_invoice→gig→invoice. Native quote accept→gig with venue_id+client_id. Audit: dropdown zero-results fix, create error handling, debounce cleanup, 7 native action handlers try/catch, stale address fix, NeuButton disabled, init/reload error handling. S23 epic complete. 10 files modified. Both tsc+vite clean. |
| 2026-03-05 | S23C — Gig booking flow update (both apps) | EntityPicker components (web: searchable dropdown + inline "Add New" form; native: FlatList dropdown + neumorphic styling). GigForm venue/client pickers save venue_id/client_id. Navigate button on DayDetail (web) + GigDaySheet (native) — fetches venue address, opens map app. Map app preference in Settings (web localStorage, native AsyncStorage). Free-text still works (venue_id null for unlinked). 2 new files, 8 modified. Both tsc + vite clean. |
| 2026-03-05 | S23B — Venue management UI (both apps) | Native: StarRating component, venues drawer screen (list/search/add), venue/new.tsx, venue/[id].tsx (edit+ratings+photos+notes+upload). Web: VenueList, VenueDetail (edit+ratings+photos+upload), ViewContext+Drawer wired, CSS+vite config. Decoupled venues from client screens (both apps). 6 new files, 10 modified. Both tsc clean. |
| 2026-03-05 | S23A — Venue/client restructure: DB + types + queries | Snapshot backup, migration SQL pushed (venues decoupled, ratings/photos/postcode added, venue_id FK on gigs/quotes/invoices/formal_invoices, venue_photos table + storage bucket), types + queries updated, native wrapper updated, backwards-compat for UI code, both tsc clean. |
| 2026-03-05 | S21 final — Time picker, autocomplete, layout parity | Fixed native crash (nav dep version). iOS WheelTimePicker (FlatList snap, enlarged, scroll-bleed fix). Field autocomplete (both apps). Layout parity: dashboard rewrite, DaySheet buttons, client actions, gig form ordering. Vercel .npmrc fix. APK built+installed. **User: native still doesn't visually match webapp → S22 visual overhaul is #1 priority.** |
| 2026-03-05 | S21 — Codebase audit + hardening | Full audit (web+native+shared): 8 confirmed issues fixed across 17 files. Division-by-zero guard, PostgREST injection sanitization, preview error handling, realtime subscription status callbacks (6 locs), GigForm/InvoiceForm/QuoteForm error handling, native list screen try/catch, GigDaySheet error state. Removed dead (tabs)/ directory. Disk cleanup: freed ~12 GB (non-TGT node_modules, VS Code caches). Both tsc + vite clean. |
| 2026-03-05 | S21 cont — Swipe nav + back-button fix | Day detail swipe left/right between event dates (both apps). Prev/next arrows, slide animation. View history stack replaces returnView — back buttons now step through views one at a time. Committed + pushed to master. Both tsc + vite clean. |
| 2026-03-05 | S21 partial — Seed data + web polish + away logic | Seeded 116 gigs + 62 away dates into Supabase. Only original timetree fees (11). 44 WhatsApp fees listed for user review. Band roles populated. Web polish: disabled buttons, email→bookings@, contact auto-dismiss. Away = any member (removed partial). Bright red calendar cells matching green/purple intensity. Removed totalMembers param. Both tsc + vite clean. |
| 2026-03-05 | Disk cleanup | Freed 14 GB: Gradle caches (16 GB), npm cache (1.1 GB), Gradle wrapper (0.3 GB), project .gradle, Windows Temp (>7d). C: drive 2.4 GB → 16.4 GB free. Note: first APK build will re-download Gradle deps. |
| 2026-03-05 | S19+ + S20 — Calendar restyle, filter dropdowns, logo, splash, skeletons | S19+: dark inset calendar cells (both), calendar default landing, NeuSelect dropdown, invoice/quote filter/sort dropdowns (both). S20: clear-bg logo in drawers+icons, SplashScreen (Juice Drop animation), SkeletonLoaders (4 variants replace LoadingSpinner), app.json bg→#08080c, .env with service role key. Disk cleanup (1.9GB Android build cache). All tsc+vite clean. |
| 2026-03-04 | Sprint S19 — Navigation + design unification | Web: Drawer component (3-mode responsive), removed main-actions/view-toggle, responsive breakpoints. Native: @react-navigation/drawer, renamed (tabs)→(drawer), custom drawer content. Theme unified (colors/shadows/typography match mockup). All tsc clean + vite build passes. |
| 2026-03-04 | Sprint S18 — Native quote UI parity | 4 new screens (quotes list, quote wizard, quote detail, quote preview), StatusBadge extended, queries adapter extended, settings expanded (service catalogue/PLI/T&Cs/quote defaults), Quotes tab added, tsc clean |
| 2026-03-04 | Sprint S17 — Web quote lifecycle + formal invoicing | QuoteDetail (6-stage progressive lifecycle), QuotePreview (multi-page: quote+invoice+receipts), Accept flow with formal invoice auto-generation, calendar integration, App.tsx wired, ~120 lines CSS, vite code splitting updated, tsc clean |
| 2026-03-04 | Sprint S16 — Web quote wizard + service catalogue UI | ViewContext extended, useQuoteData hook, Settings extended (service catalogue/PLI/T&Cs), QuoteList, QuoteForm (4-step wizard), App.tsx wired, ~150 lines CSS, tsc clean |
| 2026-03-04 | Sprint S15 — Quote system backend | 6 new Supabase tables + RLS + RPC pushed live, 12 shared types, ~20 query functions, 16 PDF templates (quote + formal invoice), tsc clean |
| 2026-03-04 | Sprint S14 — Dashboard + export + invoice polish | Dashboard component, CSV export utils, sort/search on InvoiceList, ~120 lines CSS, tsc clean |
| 2026-03-04 | Sprint S13 — Web invoicing + settings + clients | 6 components, 2 hooks, ViewContext extended, ~250 lines CSS, code splitting, tsc clean |
| 2026-03-04 | Sprint S12 — Shared PDF templates | 17 template files moved native→shared, barrel export, native imports updated, tsc clean |
| 2026-03-04 | Sprint S11 — Native SQLite → Supabase swap | Adapter layer, full-app login gate, on-demand PDFs, tsc clean |
| 2026-03-04 | Sprint S10 — Supabase invoicing schema | 6 new tables + RLS + RPC pushed live, shared types/queries, SQLite migration script |
| 2026-03-04 | Sprint S9 — Roadmap audit + HTML mockups | Full audit (S1-S8), S9-S20 roadmap, 3 HTML mockups, collapsible drawer nav |
| 2026-03-04 | Sprint S8 — Polish pass | CSS extraction, ViewContext, error boundaries, light theme, code splitting, DNS |
| 2026-03-04 | Sprint S7 — MEDIUM code issues | Date utils, shared components, skeleton loaders, validation, themed modals |
| 2026-03-04 | Sprint S6 — Public Website Sprint 3 | Media gallery, media manager, contact form, IONOS domain docs |
| 2026-03-04 | Sprint S5 — Public Website Sprint 2 | PublicSite component, LoginModal, SEO, public gigs, member profiles |
| 2026-03-04 | Sprint S4 — Public Website Sprint 1 | Schema migration, is_public toggle, profile page |
| 2026-03-04 | Sprint S3 — Docs + CI/CD | Schema map, web blueprint, GitHub Actions, env.example, blueprint fixes |
| 2026-03-04 | Sprint S2 — HIGH code issues | Type safety, error handling, offline improvements, spinner time picker |
| 2026-03-04 | Codebase audit + critical fixes + SOT redesign | 3 critical bugs fixed, STATUS.md created, sprint roadmap defined |
| 2026-03-04 | Audit phases 4-6 + public site planning | Offline support, change summary, Polish, public site plan |
| 2026-03-04 | Audit phases 1-3 | Sync, errors, validation, auth, web redesign, native UX |
| 2026-03-03 | Native gig list + monorepo | Gig list view, Cal/List toggle, monorepo restructure |
| 2026-03-03 | Shared gig calendar | Supabase backend, Timetree PWA, gig types |

---

## Session: 2026-03-06 — Sprint S26A: Audio Engine Foundation

### What was built

**Expo Native Module (`modules/click-engine/`):**
- `expo-module.config.json` — auto-linked Android module
- `android/build.gradle` — CMake + Oboe 1.9.2 prefab
- `android/CMakeLists.txt` — builds `clickengine` shared library from 5 C++ files
- `android/src/main/AndroidManifest.xml` — minimal library manifest

**C++ engine (ported from ClickTrack, namespace `gigbooks`):**
- `metronome.h/cpp` — frame-counting metronome with subdivisions, swing, speed trainer, muted bars, custom clicks, count-in, beat displacement, random drop, backbeat, split stereo
- `mixer.h/cpp` — 16-channel gain management, master gain, split stereo
- `wav_loader.h/cpp` — 16-bit PCM WAV loader → stereo float
- `audio_engine.h/cpp` — **stripped**: metronome + mixer only (no poly/sample/loop/midi). Singleton, Oboe callbacks.
- `jni_bridge.cpp` — JNI bridge (`Java_com_tgtent_gigbooks_clickengine_ClickEngineBridge_*`)

**Kotlin layer:**
- `ClickEngineBridge.kt` — `object` with `@JvmStatic external` native methods
- `ClickEngineModule.kt` — Expo `Module()` with full function definitions (Double→Float conversions for JS interop)

**JS/TS layer:**
- `modules/click-engine/src/ClickEngineModule.ts` — `requireNativeModule('ClickEngine')`
- `modules/click-engine/index.ts` — typed exports + click sound constants
- `src/audio/ClickEngine.ts` — higher-level wrapper with `loadSong(song: Song)` helper

**Schema migration:**
- `20260306_s26a_song_lyrics_chords_beat_offset.sql` — ALTER songs ADD lyrics, chords, beat_offset_ms
- Pushed to Supabase (migration repair required for 12 remote-only versions)

**Shared types + queries:**
- Song: added `lyrics: string`, `chords: string`, `beat_offset_ms: number`
- SetlistSongWithDetails: added `song_lyrics`, `song_chords`
- createSong: added `lyrics?`, `chords?`, `beat_offset_ms?` params
- getSetlistSongs: select + mapping updated for lyrics/chords

**Role-based song forms (both apps):**
- Native `song/new.tsx` + `song/[id].tsx`: conditional metronome section (drummer only), chords/lyrics card (all)
- Web `SongForm.tsx`: `bandRole` prop, conditional metronome section, chords/lyrics card
- Web `App.tsx`: passes `bandRole={profile?.band_role}` to SongForm

### Blockers
- C++ build not verified on device — needs `npx expo prebuild --clean` + `gradlew assembleDebug`

### Decisions
- D-099: Expo Native Module architecture for C++ audio (local module in modules/, Kotlin object JNI bridge, stripped engine)

---

## Session: 2026-03-05 — Sprint S23A: Venue/Client Restructure (DB + Types + Queries)

### What was built

**Data snapshot:**
- Created `native/scripts/snapshot-s23a.ts` — backs up clients (3), venues (3), gigs (117), quotes (0), invoices (0), formal_invoices (0) to `backups/snapshot-s23a-2026-03-05.json`

**Supabase migration (`20260305200000_s23a_venue_client_restructure.sql`):**
- ALTER venues: dropped `client_id` FK + column, added `postcode` TEXT, `rating_atmosphere/crowd/stage/parking` SMALLINT (1-5 CHECK), `notes` TEXT
- CREATE `venue_photos` table (id UUID PK, venue_id FK CASCADE, file_url, storage_path, caption, created_by FK, created_at)
- ALTER gigs: added `venue_id` UUID FK SET NULL, `client_id` UUID FK SET NULL
- ALTER quotes: added `venue_id` UUID FK SET NULL
- ALTER invoices: added `venue_id` UUID FK SET NULL
- ALTER formal_invoices: added `venue_id` UUID FK SET NULL
- RLS policies: venue_photos (auth read, creator insert/delete), venues rebuilt (auth read/update, creator insert/delete)
- Storage: `venue-photos` bucket (public) + auth policies
- Pushed via `supabase db push` (20 tables live)

**shared/supabase/types.ts:**
- Venue: removed `client_id`, added `postcode`, `rating_*` (4 fields), `notes`
- New: `VenuePhoto` interface
- Gig: added `venue_id`, `client_id` (both `string | null`)
- Quote: added `venue_id` (`string | null`)
- Invoice: added `venue_id` (`string | null`)
- FormalInvoice: added `venue_id` (`string | null`)

**shared/supabase/queries.ts:**
- Replaced `getVenuesForClient` with `getVenues()`, `getVenue(id)`, `searchVenues(query)`
- `createVenue()` — overloaded: new object signature + legacy positional args compat
- New: `updateVenue()` (ratings, notes, address, postcode)
- New: `getVenuePhotos()`, `uploadVenuePhoto()`, `deleteVenuePhoto()`
- `createGig()` — accepts `venue_id`, `client_id`
- `createInvoice()` — accepts `venue_id`
- `createQuote()` — accepts `venue_id`
- `updateQuote()` — accepts `venue_id`
- `updateInvoice()` — accepts `venue_id`
- `acceptQuote()` — carries `venue_id` to formal invoice
- Deprecated `getVenuesForClient()` kept for backwards compat

**native/src/db/queries.ts:**
- Added VenuePhoto type export
- New exports: getVenues, getVenue, searchVenues, updateVenue, getVenuePhotos, uploadVenuePhoto, deleteVenuePhoto
- Deprecated getVenuesForClient re-exported for backwards compat
- addVenue overloaded (new + legacy signatures)
- createInvoice/updateInvoice/createQuote accept venue_id

### What was tested
- `web: npx tsc -b` — PASS
- `native: npx tsc --noEmit` — PASS
- Migration pushed to live Supabase without errors

### Blocked / Next
- S23B: Venue management UI (both apps) — venues drawer screen, venue detail with ratings/photos/notes

---

## Session: 2026-03-04 — Sprint S19: Navigation + Design Unification

### What was built

**Theme Unification:**
- Updated `native/src/theme/colors.ts` — aligned all COLORS to match web/mockup darker palette (#08080c bg, #111118 card, #d0d0dc text, #00e676 green, #ff5252 danger, etc.)
- Updated `native/src/theme/shadows.ts` — neuRaisedStyle/neuInsetStyle now use unified palette colors
- Updated `native/src/theme/typography.ts` — LABEL fontSize 9→11, letterSpacing 2→0.8, BODY fontSize 12→13
- Updated `web/src/App.css` — --radius-card: 14→16px, --radius-input: 10→12px (matches native)
- Added `green`, `greenDark`, `border`, `inset` tokens to native COLORS

**Web Drawer Navigation:**
- Created `web/src/components/Drawer.tsx` — responsive drawer with 3 modes: mobile overlay (hamburger toggle), tablet icon rail (56px, hover-to-expand), desktop full (220px always open)
- Nav items grouped into Calendar/Business/Band sections + footer (Profile, Settings)
- Active state: green left-border + green text + subtle green bg tint
- VIEW_TO_NAV mapping ensures sub-views (invoice-detail, quote-form, etc.) highlight parent nav item
- Updated `web/src/App.tsx` — hamburger button in header, Drawer component, `<main>` wrapper, removed main-actions/view-toggle, header shows brand text + screen name + avatar
- Updated `web/src/App.css` — drawer CSS (overlay, panel, items, sections, footer), hamburger CSS, header fixed at 52px, main-content with responsive margin-left, removed max-width:480px, 4 responsive breakpoints (@768 rail, @1024 full, @1440 wide padding), light theme drawer overrides

**Native Drawer Navigation:**
- Installed `@react-navigation/drawer`
- Renamed `app/(tabs)/` → `app/(drawer)/`
- Rewrote `app/(drawer)/_layout.tsx` — uses `expo-router/drawer` with custom `drawerContent` component
- Custom drawer: neumorphic dark styling, Tangerine Timetree branding, Calendar/Business sections, green active indicator, footer with Settings
- Drawer header: hamburger toggle + screen title (via react-navigation)
- Updated 6 screens (index, invoices, quotes, clients, gigs, settings) — removed SafeAreaView, removed redundant title headers, updated action buttons (pill style with text vs old circle +)
- Fixed `/(tabs)/invoices` → `/(drawer)/invoices` link

### Files changed
- `native/src/theme/colors.ts` — unified palette
- `native/src/theme/shadows.ts` — updated hardcoded colors
- `native/src/theme/typography.ts` — font size/spacing bump
- `native/app/(drawer)/_layout.tsx` — NEW drawer layout (replaces tabs)
- `native/app/(drawer)/index.tsx` — SafeAreaView→View, header cleanup
- `native/app/(drawer)/invoices.tsx` — SafeAreaView→View, header cleanup
- `native/app/(drawer)/quotes.tsx` — SafeAreaView→View, header cleanup
- `native/app/(drawer)/clients.tsx` — SafeAreaView→View, header cleanup
- `native/app/(drawer)/gigs.tsx` — removed insets, removed screenTitle
- `native/app/(drawer)/settings.tsx` — SafeAreaView→View, removed title
- `web/src/components/Drawer.tsx` — NEW
- `web/src/App.tsx` — drawer integration, header redesign
- `web/src/App.css` — drawer CSS, responsive breakpoints, removed main-actions

### Verification
- `npx tsc -b` (web) — PASS
- `npx tsc --noEmit` (native) — PASS
- `npx vite build` (web) — PASS

---

## Session: 2026-03-04 — Sprint S16: Web Quote Wizard + Service Catalogue UI

### What was built
- **ViewContext** (`web/src/hooks/useViewContext.tsx`) — 4 new views (quotes, quote-form, quote-detail, quote-preview), quoteId + editQuoteId state, 5 navigation functions (goToQuotes, goToNewQuote, goToEditQuote, goToQuoteDetail, goToQuotePreview)
- **useQuoteData hook** (`web/src/hooks/useQuoteData.ts`) — fetches quotes via getQuotes(), realtime subscription on quotes table, returns { quotes, loading, error, refresh }
- **Settings extended** (`web/src/components/Settings.tsx`) — 4 new sections: Service Catalogue (CRUD with reorder), PLI Insurance (insurer, policy, cover, expiry), Default T&Cs (textarea), Quote Defaults (validity days). All saved via updateBandSettingsExtended().
- **QuoteList** (`web/src/components/QuoteList.tsx`) — stats bar (total quoted, pending, accepted), search, 6 filter tabs with counts, 5 sort options, quote cards with colored status badges and event type labels
- **QuoteForm** (`web/src/components/QuoteForm.tsx`) — 4-step wizard: (1) client search/select + "Add New Client" modal + event type/date/venue, (2) service catalogue picker + custom items + editable line items + discount + running total, (3) PLI toggle + T&Cs + validity + notes, (4) style preview carousel (7 styles via getQuoteHtml + iframe) + "Create Quote" button
- **App.tsx** — imports QuoteList/QuoteForm/useQuoteData, quote views wired, Quotes button in main actions, handleQuoteSaved callback
- **App.css** — ~150 lines: service catalogue list, package builder grid, line item rows, running total, PLI toggle group, extras section

### What was tested
- `npx tsc -b` (web) — passes clean

### What's next
- S17: Web quote lifecycle (QuoteDetail component with send/accept/decline/expire actions, formal invoice generation, quote-detail + quote-preview views)

---

## Session: 2026-03-04 — Sprint S15: Quote System Backend

### What was built
- **Supabase migration** (`supabase/migrations/20260304210000_quoting_schema.sql`) — 6 new tables: service_catalogue, quotes, quote_line_items, formal_invoices, formal_invoice_line_items, formal_receipts. ALTER band_settings with 7 new columns (PLI + T&C + quote fields). RPC `next_quote_number()`. RLS policies for all 6 tables. Pushed live (19 tables total).
- **Shared types** (`shared/supabase/types.ts`) — 12 new types: QuoteStatus, EventType, PLIOption, ServiceCatalogueItem, Quote, QuoteWithClient, QuoteLineItem, FormalInvoice, FormalInvoiceWithClient, FormalInvoiceLineItem, FormalReceipt, FormalReceiptWithMember. Extended BandSettings with PLI/T&C/quote fields.
- **Shared queries** (`shared/supabase/queries.ts`) — ~20 new functions: service catalogue CRUD (get, getAll, create, update, delete), quote CRUD (get, getAll, create, update, delete), quote line items (get, replace), lifecycle (sendQuote, acceptQuote → auto-creates formal invoice with line items, declineQuote, expireQuote), formal invoices (get, getByQuote, getLineItems, send, markPaid → generates receipts), formal receipts (get), updateBandSettingsExtended.
- **Quote PDF templates** (8 files) — quoteTemplate.ts (classic, QuoteTemplateData interface), 6 themed variants (premium dark, clean professional, bold rock, christmas, halloween, valentine), getQuoteHtml.ts router
- **Formal invoice PDF templates** (8 files) — formalInvoiceTemplate.ts (classic, FormalInvoiceTemplateData interface), 6 themed variants (premium dark, clean professional, bold rock, christmas, halloween, valentine), getFormalInvoiceHtml.ts router
- **Barrel export** (`shared/templates/index.ts`) — added getQuoteHtml, getFormalInvoiceHtml, QuoteTemplateData, FormalInvoiceTemplateData

### Files changed
- `supabase/migrations/20260304210000_quoting_schema.sql` (NEW)
- `shared/supabase/types.ts` (extended)
- `shared/supabase/queries.ts` (extended)
- `shared/templates/quoteTemplate.ts` (NEW)
- `shared/templates/quoteTemplatePremiumDark.ts` (NEW)
- `shared/templates/quoteTemplateCleanProfessional.ts` (NEW)
- `shared/templates/quoteTemplateBoldRock.ts` (NEW)
- `shared/templates/quoteTemplateChristmas.ts` (NEW)
- `shared/templates/quoteTemplateHalloween.ts` (NEW)
- `shared/templates/quoteTemplateValentine.ts` (NEW)
- `shared/templates/getQuoteHtml.ts` (NEW)
- `shared/templates/formalInvoiceTemplate.ts` (NEW)
- `shared/templates/formalInvoiceTemplatePremiumDark.ts` (NEW)
- `shared/templates/formalInvoiceTemplateCleanProfessional.ts` (NEW)
- `shared/templates/formalInvoiceTemplateBoldRock.ts` (NEW)
- `shared/templates/formalInvoiceTemplateChristmas.ts` (NEW)
- `shared/templates/formalInvoiceTemplateHalloween.ts` (NEW)
- `shared/templates/formalInvoiceTemplateValentine.ts` (NEW)
- `shared/templates/getFormalInvoiceHtml.ts` (NEW)
- `shared/templates/index.ts` (extended)

### Verification
- `npx tsc -b` (web) — clean
- `npx tsc --noEmit` (native) — clean

---

## Session: 2026-03-04 — Sprint S14: Dashboard + Export + Invoice Polish

### What was built
- **Dashboard component** (`web/src/components/Dashboard.tsx`) — stats cards (total invoiced, outstanding, paid, tax year total), overdue invoice alerts, recent invoices list, monthly breakdown (last 6 months), CSV export buttons, quick nav section
- **Export utilities** (`web/src/utils/export.ts`) — `exportInvoicesCSV()` with proper CSV escaping + browser download, `filterByTaxYear()` for UK tax year (Apr-Mar)
- **InvoiceList enhancements** — search bar (searches invoice number, client, venue, description), sort dropdown (date asc/desc, amount asc/desc, status), `useMemo` for filtered+sorted results
- **ViewContext update** — added `dashboard` view type + `goToDashboard()` nav helper, default authenticated view changed from `calendar` to `dashboard`
- **App.tsx wiring** — Dashboard rendered, Home/Cal/List view toggle, back targets from invoices/settings/clients/website point to dashboard
- **CSS** — ~120 lines dashboard styles (stats grid, monthly breakdown, export buttons, sections, light theme overrides), invoice controls row (filter + sort side-by-side), text-overflow ellipsis on long client names
- **Vite code splitting** — Dashboard added to invoicing chunk

### Files changed
- `web/src/components/Dashboard.tsx` (NEW)
- `web/src/utils/export.ts` (NEW)
- `web/src/components/InvoiceList.tsx` (sort + search)
- `web/src/hooks/useViewContext.tsx` (dashboard view + goToDashboard)
- `web/src/App.tsx` (Dashboard import + render + nav)
- `web/src/App.css` (dashboard + sort/search CSS)
- `web/vite.config.ts` (code splitting)

### Verification
- `npx tsc -b` (web) — clean, no errors

---

## Session: 2026-03-04 — Sprint S13: Web Invoicing + Settings + Clients

**Goal**: Full web invoicing CRUD, settings management, and client management.

**What was built**:
- `web/src/utils/format.ts` — Added 4 utilities: formatDateLong, formatGBP, todayISO, addDaysISO
- `web/src/hooks/useInvoiceData.ts` — Invoice data hook with realtime Supabase subscription
- `web/src/hooks/useSettings.ts` — Combined user + band settings hook with CombinedSettings type
- `web/src/hooks/useViewContext.tsx` — Extended with 6 new views (invoices, invoice-form, invoice-detail, invoice-preview, settings, clients) + 7 nav helpers + invoiceId/editInvoiceId state
- `web/src/components/Settings.tsx` — Two sections: Your Details (bank info via upsertUserSettings) + Band Settings (trading name, payment terms via updateBandSettings). Sort code auto-format, terms clamp.
- `web/src/components/ClientList.tsx` — Full CRUD with search, add/edit/delete modals, venue management (list/add/delete venues per client)
- `web/src/components/InvoiceList.tsx` — Status filter tabs (All/Draft/Sent/Paid), stats bar (invoiced/outstanding/paid), card list with number/client/amount/status/date
- `web/src/components/InvoiceForm.tsx` — 3-step wizard mirroring native: Step 1 client selection + inline creation, Step 2 gig details (venue datalist from client venues, date, amount, auto-description), Step 3 style carousel with iframe srcdoc preview and dot navigation
- `web/src/components/InvoiceDetail.tsx` — Invoice info card, status controls (draft/sent/paid with markInvoicePaid), receipts list, actions (preview, duplicate, delete with ConfirmModal)
- `web/src/components/InvoicePreview.tsx` — Multi-page iframe (invoice + receipts), page navigation tabs, print via contentWindow.print()
- `web/src/App.tsx` — All 6 components wired in with conditional rendering, nav buttons added to main-actions (Invoices, Clients, Settings)
- `web/src/App.css` — ~250 lines: stats bar, filter tabs, invoice cards, detail grid, status badges, step indicator, carousel, client list, venue management, settings sections, modal card, empty text, light theme overrides
- `web/vite.config.ts` — Added 'invoicing' chunk (6 components) to manualChunks

**Files created**: 8 (6 components + 2 hooks)
**Files modified**: 4 (App.tsx, App.css, format.ts, vite.config.ts, useViewContext.tsx)
**TypeScript**: Both `web -b` and `native --noEmit` pass clean

---

## Session: 2026-03-04 — Sprint S12: Shared PDF Templates

### Done
- **Moved 17 template files** from `native/src/pdf/` → `shared/templates/`: 7 invoice templates (classic, premium, clean, bold, christmas, halloween, valentine), 7 receipt templates, invoiceStyles.ts, getInvoiceTemplate.ts, getReceiptTemplate.ts, logo.ts
- **Created utility files**: `shared/templates/colors.ts` (PDF_COLORS), `shared/templates/htmlEscape.ts`
- **Created barrel export**: `shared/templates/index.ts` — exports all public API (getInvoiceHtml, getReceiptHtml, INVOICE_STYLES, etc.)
- **Fixed import paths**: All themed templates updated from `'../utils/htmlEscape'` → `'./htmlEscape'`
- **Fixed `verbatimModuleSyntax`**: Added `type` keyword to type-only imports in all 12 themed templates + 2 routers (web tsconfig requires this)
- **Consolidated `InvoiceStyle` type**: Removed duplicate definition from `invoiceStyles.ts`, now imports from `../supabase/types`. Also cleaned up `native/src/db/queries.ts` — removed `SupaInvoiceStyle` alias, uses `InvoiceStyle` directly.
- **Updated 4 native invoice screens**: `new.tsx`, `[id].tsx`, `preview.tsx`, `receipts.tsx` — import templates from `@shared/templates/*`, keep `generatePdf`/`sharePdf` from local `../../src/pdf/generatePdf`
- **Cleaned up `native/src/pdf/`**: Only `generatePdf.ts` remains (expo-print/sharing — native-only)
- **TypeScript clean**: Both `native --noEmit` and `web -b` pass

### Key Files Changed
- `shared/templates/` — 20 new files (17 moved + colors.ts + htmlEscape.ts + index.ts)
- `native/app/invoice/new.tsx` — imports from @shared/templates
- `native/app/invoice/[id].tsx` — imports from @shared/templates
- `native/app/invoice/preview.tsx` — imports from @shared/templates
- `native/app/invoice/receipts.tsx` — imports from @shared/templates
- `native/src/db/queries.ts` — InvoiceStyle import consolidated
- `native/src/pdf/` — 18 files deleted, only generatePdf.ts remains

### Decisions
- Templates are pure HTML generators (no native dependencies) — perfect for sharing
- `generatePdf.ts` stays native-only (expo-print) — web will use browser print or iframe for PDF
- `PDF_COLORS` duplicated (shared/templates/colors.ts + native/src/theme/colors.ts) to avoid cross-dependency

### Remaining
- S13 next: Web invoicing — full CRUD + PDF preview using shared templates
- Still pending: SQLite migration script, device testing

### Next Sprint
- **S13**: Web invoicing — create invoice/receipt CRUD screens, PDF preview using shared templates, browser-based PDF generation

---

## Session: 2026-03-04 — Sprint S11: Native SQLite → Supabase Swap

### Done
- **Supabase adapter** (`native/src/db/queries.ts`): Full rewrite — thin wrapper around `@shared/supabase/queries`. Merges `UserSettings` + `BandSettings` → `GigBooksSettings`, maps `Profile` → `BandMember`, no-ops for `updateInvoicePdfUri`/`updateReceiptPdfUri`. Zero import changes needed in screens.
- **Login gate** (`native/src/components/LoginGate.tsx`): Extracted from `gigs.tsx`, now wraps entire app via `_layout.tsx`. Email/password fields, neumorphic styling.
- **App layout** (`native/app/_layout.tsx`): Removed `initDatabase()` and SQLite dependency. Added `AppContent` with auth check — shows `LoginGate` if not authenticated.
- **Invoice detail** (`app/invoice/[id].tsx`): Removed `pdf_uri` refs, `deletePdf` import, "Regenerate PDF" button. Share always generates on demand.
- **Invoice new** (`app/invoice/new.tsx`): Removed `updateInvoicePdfUri`. `addClient` returns `Client` directly. No PDF pre-generation.
- **Invoice preview** (`app/invoice/preview.tsx`): Replaced `pdfUri` with `pdfFilename` in `PreviewPage`. Share generates PDF on-the-fly.
- **Receipts** (`app/invoice/receipts.tsx`): On-demand PDF via `getReceiptHtml()` → `generatePdf()` → `sharePdf()`.
- **Settings** (`app/(tabs)/settings.tsx`): Band members read-only (from Supabase profiles). Invoice number display shows `TGT-` prefix.
- **Gigs** (`app/(tabs)/gigs.tsx`): Removed inline LoginGate (~65 lines), simplified to render GigsMainView directly.
- **Shared types** (`shared/supabase/types.ts`): Updated `InvoiceStyle` from 3 → 7 styles matching native PDF templates.
- **SQLite backup**: `database.ts` → `database.sqlite.ts`, `queries.ts` → `queries.sqlite.ts` (excluded from tsc via tsconfig).
- **TypeScript**: Both `native --noEmit` and `web -b` pass cleanly.

### Key Files Changed
- `native/src/db/queries.ts` — Supabase adapter (REWRITE)
- `native/src/db/index.ts` — simplified re-exports
- `native/src/components/LoginGate.tsx` — new component
- `native/app/_layout.tsx` — full-app auth gate
- `native/app/(tabs)/gigs.tsx` — removed inline login
- `native/app/(tabs)/settings.tsx` — read-only band members
- `native/app/invoice/[id].tsx` — on-demand PDF, no pdf_uri
- `native/app/invoice/new.tsx` — simplified save flow
- `native/app/invoice/preview.tsx` — on-demand PDF sharing
- `native/app/invoice/receipts.tsx` — on-demand PDF sharing
- `shared/supabase/types.ts` — InvoiceStyle 7 styles
- `native/tsconfig.json` — exclude backup files

### Decisions
- **Full login gate**: Entire app requires Supabase auth (no offline mode)
- **PDF on demand**: No `pdf_uri` caching — PDFs generated fresh each time for sharing. Preview still uses WebView HTML.
- **Adapter pattern**: Thin compatibility layer keeps all screen imports unchanged (`../../src/db`)
- **Settings split**: `getSettings()` merges UserSettings + BandSettings; `updateSettings()` routes fields to correct table
- **Band members**: Read-only in settings — managed via Supabase profiles, not editable in-app

### Remaining
- Run SQLite migration script (`native/scripts/migrate-sqlite-to-supabase.ts`) — needs `SUPABASE_SERVICE_ROLE_KEY` + `NATHAN_USER_ID`
- Manual testing on device when APK build works

### Next Session
- Start S12: Shared PDF templates (move `native/src/pdf/` → `shared/templates/`)

---

## Session: 2026-03-04 — Sprint S10: Supabase Invoicing Schema

### Done
- **Migration SQL** (`supabase/migrations/20260304200000_invoicing_schema.sql`): 6 new tables — `clients`, `venues`, `invoices`, `receipts`, `user_settings`, `band_settings`. Full RLS policies. Dropped stale pre-existing `invoices` + `user_settings` tables.
- **RPC function** `next_invoice_number()`: SECURITY DEFINER, atomic UPDATE+RETURNING for thread-safe invoice numbering.
- **Shared types** (`shared/supabase/types.ts`): Added Client, Venue, Invoice, InvoiceWithClient, Receipt, ReceiptWithMember, UserSettings, BandSettings, DashboardStats, InvoiceStatus, InvoiceStyle.
- **Shared queries** (`shared/supabase/queries.ts`): Full CRUD for clients (incl. search), venues, invoices (create with RPC, update, delete, status change), receipts (incl. markInvoicePaid with equal split), user_settings (upsert), band_settings, dashboard stats.
- **SupabaseClientLike** updated with `rpc` method.
- **SQLite migration script** (`native/scripts/migrate-sqlite-to-supabase.ts`): Reads from better-sqlite3, maps SQLite text IDs → UUID, preserves FK relationships, uses service role key.
- **Pushed to live Supabase**: 13 tables total (7 existing + 6 new). Band_settings seeded with defaults.
- **Web tsc**: Clean compile verified.

### Key Files
- `supabase/migrations/20260304200000_invoicing_schema.sql` — migration SQL
- `shared/supabase/types.ts` — invoicing types
- `shared/supabase/queries.ts` — invoicing CRUD queries
- `shared/supabase/clientRef.ts` — added rpc to interface
- `native/scripts/migrate-sqlite-to-supabase.ts` — SQLite → Supabase migration

### Decisions
- Invoice number format: `TGT-0001` (via `next_invoice_number()` RPC)
- `band_settings` is a singleton (CHECK constraint `id = 'default'`), admin-only update via RLS
- `user_settings` keyed by profile UUID, per-user banking details
- Receipts cascade-delete with invoices (ON DELETE CASCADE)
- `invoices.venue` stays TEXT (not FK) per D-027

### Next Session
- Start S11: Native SQLite → Supabase swap (replace native query imports with shared/supabase)

---

## Session: 2026-03-04 — Sprint S9: Full Roadmap Audit + HTML Mockups

### Done
- **Full roadmap audit**: Reviewed all 73 decisions (decisions_log.md), ROADMAP_V2.md, FEATURE_SPEC_PACKAGE_BUILDER.md, all shipped code (S1-S8). Produced complete inventory of what's built, decided, and planned.
- **S9-S20 roadmap**: 12 sprints planned covering Supabase migration, web invoicing, package builder, design unification, iOS polish. Approved by user. Plan at `.claude/plans/graceful-mixing-dongarra.md`.
- **native-mockup.html**: Mobile-framed interactive mockup — 24 screens showing finished native app (calendar, invoices, quotes, clients, settings, receipts, lifecycle management).
- **web-mockup.html**: Desktop interactive mockup — 20+ screens showing finished web app (public site + all authenticated views with sidebar nav).
- **responsive-mockup.html**: Unified responsive mockup with collapsible drawer navigation pattern:
  - Mobile (<768px): hamburger → drawer slides as overlay with backdrop
  - Tablet (768-1023px): icon-only rail (56px), expands on hover
  - Desktop (≥1024px): full expanded sidebar (220px) always visible
  - Breakpoint indicator showing viewport width + device category
  - Covers all screens: calendar, gigs, away dates, invoices, quotes, clients, media, enquiries, settings, profile
- **Seed data identified**: `C:\Apps\timetree-scrape\timetree_gigs.xlsx` — 116 gigs + 62 away dates from TimeTree export (to import in S10)

### Key Decisions
- Full feature parity between native and web apps
- Supabase replaces SQLite for ALL data (ROADMAP_V2 supersedes D-015)
- Collapsible drawer navigation on BOTH apps (user chose over tabs)
- PDFs on-demand, templates in shared/templates/
- Shared INV-XXX sequence, separate QTE-XXX sequence
- Responsive breakpoints: iPhone SE 2nd gen (375px) → Samsung S23 Ultra (384px) → iPad (768px) → Desktop (1024px+) → 1920px
- Unified Tangerine Timetree brand — mockups define end-state visual target

### Additional (continuation session)
- User approved mockups, confirmed native app must use collapsible drawer (not tabs) — same as web
- User deferred APK build: "don't want to see the native app until it's finished, only build if you need to"
- S9 marked complete. S10 queued as next sprint.

### Files Created
- `mockups/native-mockup.html`
- `mockups/web-mockup.html`
- `mockups/responsive-mockup.html`
- `.claude/plans/graceful-mixing-dongarra.md`

---

## Session: 2026-03-04 — Sprint S8: Polish Pass

### Done
- **CSS extraction**: Moved ~80 inline `style={{}}` objects to CSS classes in App.css. Created utility classes: `.page-header`, `.page-title`, `.page-header-spacer`, `.form-top`, `.flex-row-gap-*`, `.btn-full`, `.btn-flex`, `.main-actions`, `.day-title`, `.empty-message`, `.gig-card-inset`, `.gig-venue-name`, `.gig-client-name`, `.gig-notes-text`, `.gig-creator-text`, `.gig-actions-row`, `.away-section`, `.day-actions`, `.form-actions`, `.checkbox-label`, `.password-toggle`, `.saved-text`, etc.
- **ViewContext**: Created `useViewContext.tsx` with `ViewProvider` + `useView()` hook. Navigation state (view, selectedDate, editGigId, returnView) extracted from MainView. Provides `goToDay`, `goToAddGig`, `goToEditGig`, `goBack` etc. MainView is now ~40 lines shorter.
- **Error boundaries**: Created `ErrorBoundary` component for web (class component, auto-reset) and native (React Native styled). Wrapped app-level rendering in both.
- **Light theme**: Added `@media (prefers-color-scheme: light)` block to App.css. Overrides all CSS variables (backgrounds, text, accents, shadows, glows) for a warm cream/white light theme. Component-specific overrides for calendar cells, buttons, badges, toggles.
- **Code splitting**: Configured `manualChunks` in vite.config.ts — PublicSite gets its own chunk, MediaManager + Enquiries share a chunk.
- **DNS**: IONOS DNS configured via API (A @ → 76.76.21.21, CNAME www → cname.vercel-dns.com). Propagation confirmed.

### tsc
- `web tsc -b`: PASS
- `native tsc --noEmit`: PASS

### Files Changed (Web)
- `web/src/hooks/useViewContext.tsx` — NEW (ViewProvider + useView)
- `web/src/components/ErrorBoundary.tsx` — NEW
- `web/src/App.tsx` — ViewProvider wrap, useView() in MainView, ErrorBoundary wrap
- `web/src/App.css` — S8 utility classes, error boundary styles, light theme media query
- `web/src/components/DayDetail.tsx` — inline styles → CSS classes
- `web/src/components/GigForm.tsx` — inline styles → CSS classes
- `web/src/components/AwayManager.tsx` — inline styles → CSS classes
- `web/src/components/GigList.tsx` — inline styles → CSS classes
- `web/src/components/Enquiries.tsx` — inline styles → CSS classes
- `web/src/components/MediaManager.tsx` — inline styles → CSS classes
- `web/src/components/ProfilePage.tsx` — inline styles → CSS classes
- `web/src/components/LoginModal.tsx` — inline styles → CSS classes
- `web/vite.config.ts` — manualChunks code splitting

### Files Changed (Native)
- `native/src/components/ErrorBoundary.tsx` — NEW
- `native/app/_layout.tsx` — ErrorBoundary wrap

---

## Session: 2026-03-04 — Sprint S7: MEDIUM Code Issues Batch

### Done
- **web/src/utils/format.ts**: Extracted 8 shared formatting utilities (fmt, fmtFee, formatDisplayDate, formatGroupDate, daysUntil, formatRange, formatRelative, formatShortDate). Removed duplicate definitions from DayDetail, GigList, AwayManager, Enquiries.
- **web/src/hooks/useMutationWithQueue.ts**: New hook encapsulating the try/catch/isNetworkError/queueMutation pattern. Exported `QueuedMutation` interface from useOfflineQueue.
- **web/src/components/ErrorAlert.tsx**: Shared error display component (full with retry button, or compact inline). Replaced inline error `<p>` patterns across GigForm, AwayManager, LoginModal, ProfilePage, DayDetail, GigList.
- **web/src/components/LoadingSpinner.tsx**: Shared loading component with skeleton mode (animated pulse bars). Replaced inline "Loading..." text in GigList, DayDetail, MediaManager, Enquiries, App.tsx.
- **web/src/components/ConfirmModal.tsx**: Themed confirm dialog replacing browser `confirm()`. Supports danger mode, keyboard (Escape), focus management. Replaced 5 confirm() calls: GigForm (incomplete warning + delete), DayDetail (delete), AwayManager (delete), MediaManager (delete).
- **web/src/App.css**: Added CSS for ErrorAlert, LoadingSpinner, skeleton loader animation, ConfirmModal overlay.
- **native/app/(tabs)/settings.tsx**: Sort code auto-format (XX-XX-XX, digits only), payment terms clamp (1–365).
- **native/app/invoice/new.tsx**: Invoice amount auto-rounds to 2 decimal places on blur.

### tsc
- `web tsc -b`: PASS
- `native tsc --noEmit`: PASS

### Files Changed (Web)
- `web/src/utils/format.ts` — NEW
- `web/src/hooks/useMutationWithQueue.ts` — NEW
- `web/src/hooks/useOfflineQueue.ts` — exported QueuedMutation
- `web/src/components/ErrorAlert.tsx` — NEW
- `web/src/components/LoadingSpinner.tsx` — NEW
- `web/src/components/ConfirmModal.tsx` — NEW
- `web/src/components/DayDetail.tsx` — use shared imports, skeleton, ConfirmModal
- `web/src/components/GigList.tsx` — use shared imports, skeleton, ErrorAlert
- `web/src/components/GigForm.tsx` — refactored submit flow, ConfirmModal ×2, ErrorAlert
- `web/src/components/AwayManager.tsx` — use shared imports, ConfirmModal, ErrorAlert
- `web/src/components/MediaManager.tsx` — ConfirmModal, LoadingSpinner
- `web/src/components/Enquiries.tsx` — use shared format imports, LoadingSpinner
- `web/src/components/LoginModal.tsx` — ErrorAlert
- `web/src/components/ProfilePage.tsx` — ErrorAlert
- `web/src/App.tsx` — LoadingSpinner
- `web/src/App.css` — new shared component styles

### Files Changed (Native)
- `native/app/(tabs)/settings.tsx` — sort code validation, payment terms clamping
- `native/app/invoice/new.tsx` — amount rounding on blur

---

## Session: 2026-03-04 — Sprint S6: Public Website Sprint 3

### Done
- **web/src/components/PublicSite.tsx**: Added dynamic media gallery section — fetches from `getPublicMedia()`, displays photos in responsive grid with lightbox overlay, video cards with YouTube embed support. Gallery nav link in header (conditional on media existing). Hero CTA switches to "View Gallery" when media exists.
- **web/src/components/MediaManager.tsx**: New component for authenticated band members. Features: drag-and-drop photo upload to Supabase Storage `public-media` bucket, multi-file support, YouTube video URL input with auto-embed URL extraction and thumbnail generation, inline title editing, toggle visibility, delete with Storage cleanup. Accessible via "Manage Media" button in main app view.
- **Contact form**: Replaced mailto link with a Supabase-backed form — fields: name, email, event type (select), preferred date, message. Submits via `submitContactForm()` to `contact_submissions` table. Success/error states with mailto fallback on error.
- **web/src/components/Enquiries.tsx**: New in-app enquiry inbox for band members. Shows submissions with unread badge, expand to see full details, Reply (opens mailto to enquirer), Archive. Relative timestamps, event type badges.
- **Supabase migration** (`20260304140000_storage_and_contact.sql`): Created `public-media` Storage bucket (public, 10MB limit, image/video MIME types, auth upload/delete policies). Created `contact_submissions` table with anon insert + auth read/update RLS.
- **shared/supabase/queries.ts**: Added media CRUD (`createMediaEntry`, `updateMediaEntry`, `deleteMediaEntry`, `getAllMedia`) + contact queries (`submitContactForm`, `getContactSubmissions`, `markSubmissionRead`, `archiveSubmission`).
- **shared/supabase/types.ts**: Added `ContactSubmission` interface.
- **shared/supabase/clientRef.ts**: Added optional `storage` property to `SupabaseClientLike` interface.
- **web/src/App.tsx**: Added `'media'` and `'enquiries'` view types, MediaManager + Enquiries imports, "Manage Media" and "Booking Enquiries" buttons in main view.
- **web/src/App.css**: Added ~300 lines — gallery grid, lightbox overlay, contact form inputs, media manager styles, enquiries inbox styles. Mobile responsive rules.

### Manual Steps for User
1. **IONOS Domain**: In IONOS DNS settings for thegreentangerine.com — set A record `@` → `76.76.21.21`, CNAME `www` → `cname.vercel-dns.com`. Add custom domain in Vercel project settings.

### Tests
- `web: npx tsc -b` — PASS
- `native: npx tsc --noEmit` — PASS
- `web: npx vite build` — PASS (432KB JS, 32KB CSS, 7 SW entries)

---

## Session: 2026-03-04 — Sprint S5: Public Website Sprint 2

### Done
- **web/src/components/PublicSite.tsx**: Full single-page scrolling website for unauthenticated visitors. 7 sections: hero (band name, tagline, CTAs), upcoming gigs (dynamic from `getPublicGigs()`), about the band (description + member cards), for venues (6 benefit cards + 2 testimonials), pricing (5 tiers), contact (mailto-based), footer.
- **web/src/components/LoginModal.tsx**: Overlay modal replacing the old full-page LoginPage. Triggered by "Band Login" button in public site header. Close button to dismiss. Same login form logic.
- **web/src/App.tsx**: Updated auth flow — unauthenticated users see PublicSite instead of LoginPage. Login modal state managed at App level. Removed LoginPage import.
- **web/index.html**: SEO meta tags — OpenGraph (type, title, description, image, url, site_name), Twitter cards (summary_large_image), Schema.org JSON-LD (MusicGroup + LocalBusiness with genre, area served, social links).
- **shared/supabase/queries.ts**: Added `getPublicProfiles()` — fetches all profiles for public display, graceful fallback if anon read denied.
- **web/src/App.css**: Full public site CSS — sticky header with glass-morphism, hero with gradient backgrounds, responsive grid layouts for gigs/benefits/pricing/members, mobile hamburger menu, login modal overlay styling. All prefixed with `ps-` to scope.
- **Responsive**: Mobile-first with `@media (max-width: 768px)` breakpoint — hamburger nav, stacked grids, adjusted padding.

### Architecture
- Public site replaces login page for unauth users (single app, two experiences)
- Band members fetched dynamically via `getPublicProfiles()` with hardcoded fallback (RLS may block anon reads on profiles)
- No new dependencies added — pure React + CSS
- All styles scoped with `ps-` prefix (public site) and `login-modal-` prefix

### Notes
- Profiles table RLS only allows authenticated reads. `getPublicProfiles()` returns empty array for anon users → falls back to hardcoded members. To make dynamic, add anon SELECT policy on profiles.
- Gallery section not included yet (planned for S6 with `getPublicMedia()`)
- Contact uses mailto link (Supabase Edge Function planned for S6)
- Both tsc checks pass (web -b + native --noEmit)

---

## Session: 2026-03-04 — Sprint S4: Public Website Sprint 1

### Done
- **Supabase migration** (`20260304120000_public_site_schema.sql`): Added `is_public` boolean to gigs, `band_role` text to profiles, created `public_media` table with RLS policies for anonymous read access
- **shared/supabase/types.ts**: Added `is_public` to Gig, `band_role` to Profile, new `PublicMedia` interface
- **shared/supabase/queries.ts**: Added `getPublicGigs()`, `getPublicMedia()`, `updateProfile()`, `is_public` param to `createGig()`
- **web GigForm.tsx**: "Show on website" checkbox (gigs only, not practices), persisted via is_public field, works with offline queue
- **native app/gig/new.tsx**: "Show on website" Switch component (gigs only), matching neumorphic style
- **web ProfilePage.tsx**: New component — editable name + band_role, read-only email, save + sign out buttons
- **web App.tsx**: Added `'profile'` to View type, split header into clickable name → profile + separate sign out, profile view rendering

### Notes
- Both tsc checks pass clean
- Web build succeeds (vite build)
- Migration applied to live Supabase instance via `supabase db push`

---

## Session: 2026-03-04 — Sprint S3: Documentation + CI/CD

### Done
- **schema_map.md**: Added Part B — all 5 Supabase tables (profiles, gigs, away_dates, gig_changelog, away_date_changelog) with full column defs, types, RLS policies, indexes, triggers, relationships
- **web/docs/blueprint.md**: Created — routing, components, hooks, PWA config, styling, data flow, offline strategy, auth, state management, file structure, build/deploy
- **.github/workflows/check.yml**: Created — runs `npx tsc --noEmit` (native) and `npx tsc -b` (web) on PRs to master
- **web/.env.example**: Created with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY placeholders
- **native blueprint.md fixes**: "4 invoice styles" → "7 styles", "5 tables" → "6 tables", D-015 clarified with Supabase exception

### Notes
- All 5 Sprint S3 goals completed — no build/install needed for any of them
- CI/CD workflow needs first PR to validate (untested)
- Next: reboot PC → fix APK build → Sprint S4 (public website)

---

## Session: 2026-03-04 — Sprint S2: HIGH Code Issues

### What Was Done
- **Type-safe row mappings** in shared/supabase/queries.ts — replaced all `(row: any)` casts with typed join interfaces (`GigWithProfileJoin`, `AwayDateWithProfileJoin`, etc.)
- **SupabaseClientLike interface** improved in clientRef.ts — `auth` property now has typed methods (`getUser`, `getSession`, `refreshSession`, `signInWithPassword`, `signOut`, `onAuthStateChange`)
- **Changelog error handling** — all 5 changelog inserts wrapped in try/catch (best-effort, non-blocking)
- **getSettings() nullable** — returns `GigBooksSettings | null` instead of asserting `row!`; `createInvoice()` guards with null check
- **Offline queue conflict detection** — `entityExists()` check before replaying update/delete mutations in web useOfflineQueue.ts
- **DayDetail offline mutations** — added delete button with offline queueing, offline-aware fetch error messages
- **Spinner time picker** — `display="spinner"` on DateTimePicker in native gig form (replaces analogue clock)
- Both `tsc` checks pass clean (native `--noEmit` + web `-b`)

### What Was Tested
- `npx tsc --noEmit` in native/ — clean
- `npx tsc -b` in web/ — clean

### What's Blocked
- APK build — `android/` directory locked by stale process. Needs PC reboot, then `npx expo prebuild --clean` → `./gradlew assembleRelease`

### Next Session Priorities
- Reboot PC, fix APK build
- Sprint S3: Supabase docs, web blueprint, CI/CD

---

## Session: 2026-03-02 — SOT Docs Bootstrap

### What Was Done
- Created `docs/ai_context/` directory
- Created all 7 SOT documents:
  - `blueprint.md` — architecture north star
  - `schema_map.md` — full database schema + TypeScript interfaces
  - `decisions_log.md` — 20 locked decisions (D-001 to D-020)
  - `todo.md` — current tasks and backlog
  - `SESSION_LOG.md` — this file
  - `gotchas.md` — lessons learned (seeded with known patterns)
  - `pain_journal.md` — process improvements (empty, ready for entries)
- Updated `CLAUDE.md` with SOT protocol references (session start/end)

### What Was Tested
- N/A (documentation only, no code changes)

### What's Blocked
- Nothing

### Next Session Priorities
- Normal feature work — SOT infrastructure is now in place
- First real session should follow the full session start protocol

---

## Session: 2026-03-02 — Multiple Invoice Styles

### What Was Done
- **New feature: 4 invoice PDF styles** (classic, premium dark, clean professional, bold rock)
- Created `src/pdf/invoiceStyles.ts` — InvoiceStyle type + metadata constants
- Created 3 new HTML template files (converted from JSX designs):
  - `src/pdf/invoiceTemplatePremiumDark.ts` — dark luxury, Playfair Display + Cormorant Garamond
  - `src/pdf/invoiceTemplateCleanProfessional.ts` — warm cream, DM Serif Display + Libre Baskerville
  - `src/pdf/invoiceTemplateBoldRock.ts` — bold dark, Archivo Black + Bebas Neue + Syne
- Created `src/pdf/getInvoiceTemplate.ts` — dispatcher (Record lookup with classic fallback)
- Created `src/components/StylePicker.tsx` — horizontal scrollable NeuCard picker
- Updated `src/db/database.ts` — added `style` column to invoices table + ALTER TABLE migration
- Updated `src/db/queries.ts` — added `style` to Invoice type + createInvoice()
- Updated `app/invoice/new.tsx` — style picker in Step 2, style in createInvoice, dispatcher for HTML
- Updated `app/invoice/[id].tsx` — dispatcher for regenerate, style in "Create Similar", style in detail view
- Added decisions D-021 through D-025

### What Was Tested
- `npx tsc --noEmit` passes clean
- Built and installed APK on physical device (RFCW113WZRM)
- App stuck on splash screen — caused by Metro not running (port 8081 was occupied during build)
- Fixed by killing stale process on 8081 and starting `npx expo start`

### What's Blocked
- Nothing

### Next Session Priorities
- Verify app loads past splash screen and test all 4 styles on physical device
- Verify "Create Similar" carries style forward
- Verify existing invoices default to Classic

---

## Session: 2026-03-02 — Real Logo + Venues + Full-Screen Preview

### What Was Done
- **Fixed phantom emulator-5562**: Root cause = NTKDaemon.exe (Native Instruments) on port 5563. Fixed by setting service to manual start (`sc config NTKDaemonService start= demand`)
- **Real TGT logo**: Circular-cropped actual logo as base64 PNG, replacing generated SVG in `src/pdf/logo.ts`. All 5 templates (4 invoice + 1 receipt) auto-pick it up
- **Venues tied to clients**: New `venues` table with CASCADE FK to clients. `VenuePicker` component (modal dropdown) replaces free-text venue input in wizard Step 2. Venue management on client edit screen
- **Full-screen invoice preview**: `react-native-webview` added. Wizard Step 3 is now a horizontal paginated carousel of WebView-rendered invoices in all 4 styles. User swipes to browse, taps "Approve & Generate". Replaces old StylePicker + text summary
- New DB operations: `getVenuesForClient()`, `addVenue()`, `deleteVenue()`
- `PRAGMA foreign_keys = ON` added to getDb()
- Decisions D-026 through D-031 added
- Cleaned up stale `ANDROID_SERIAL` env var

### What Was Tested
- `npx tsc --noEmit` passes clean
- Built and installed APK on physical device (RFCW113WZRM)
- App launched via adb reverse + am start

### What's Blocked
- Nothing

### Next Session Priorities
- Test venue picker flow (select existing, add new, prefill from "Create Similar")
- Test full-screen preview carousel (swipe, arrows, approve)
- Test venue management on client edit screen
- Test logo appears correctly in generated PDFs

---

## Session: 2026-03-02 — Delete Invoice + Full Usability Audit

### What Was Done

**Delete Invoice Feature:**
- `deleteInvoice(id)` in queries.ts — collects PDF URIs, deletes receipts first (no CASCADE), then invoice
- `deletePdf(uri)` in generatePdf.ts — deletes file from disk via expo-file-system File API
- Delete button on invoice detail screen with confirmation dialog

**Comprehensive Usability Audit (22 findings, 14 fixed, 8 intentional no-action):**

1. **Data integrity (queries.ts):**
   - `createInvoice()` wrapped in `db.withExclusiveTransactionAsync()` — atomic insert + counter bump
   - `createReceipts()` duplicate guard — returns existing receipts if already generated
   - Receipt rounding fix — remainder pennies assigned to first receipt

2. **HTML safety (5 templates):**
   - New `src/utils/htmlEscape.ts` utility
   - Applied to all 5 PDF templates (classic, premium dark, clean professional, bold rock, receipt)
   - Prevents broken PDFs when client names contain `&`, `<`, `>`, `"`

3. **CSV export fix:** Newlines in company_name/venue fields replaced with spaces

4. **Calendar fix:** `useState(2026)` → `useState(() => new Date().getFullYear())`

5. **Modal backdrop dismiss:** VenuePicker + wizard new-client modal dismiss on backdrop tap

6. **Unsaved changes warning:** Client edit screen warns before discarding dirty form

7. **Invoice list + dashboard polish:**
   - New `app/(tabs)/invoices.tsx` — full searchable invoice list (FlatList, search, pull-to-refresh)
   - New Invoices tab in tab bar (between Dashboard and Clients)
   - Dashboard: pull-to-refresh + "View All Invoices" link

8. **Dead code cleanup:** Deleted `StylePicker.tsx` (replaced by WebView carousel last session)

**No-action items (intentional):**
- StatusBadge 8-digit hex colors (valid in RN)
- Dashboard outstanding = sent only (correct accounting)
- Status flow not enforced (flexibility needed for direct gig payments)
- Past dates selectable in calendar (invoices for past gigs)
- No email/phone validation (single-user app)
- Seed data stays as Nathan's (personal app)
- PDF colors hardcoded in templates (standalone HTML)

### What Was Tested
- `npx tsc --noEmit` passes clean
- Built and installed release APK on physical device (RFCW113WZRM)

### What's Blocked
- Nothing

### Next Session Priorities
- Test all audit fixes on device (invoice list, search, pull-to-refresh, backdrop dismiss, unsaved changes warning)
- Test delete invoice flow
- Test receipt duplicate guard
- Verify HTML escape in PDFs with `&` in client names

---

## Session: 2026-03-02 — Calendar Fix + Swipe/Preview Plan

### What Was Done
- **Fixed calendar day alignment bug**: Days were not aligned under correct column headers (Feb 1 showed under MON instead of SUN). Root cause: `flexWrap: 'wrap'` + `justifyContent: 'space-around'` on the grid didn't reliably align with the header row. Fixed by switching to explicit row-based rendering — each week is its own `<View style={{ flexDirection: 'row' }}>` with 7 `flex: 1` cells. Headers use the same layout. Alignment is now guaranteed.
- **Planned 4 features** (approved, not yet implemented):
  1. Calendar swipe (PanResponder for month navigation)
  2. WebView swipe fix (wizard Step 3 — `nestedScrollEnabled={false}`)
  3. Full-screen invoice preview (new route `app/invoice/preview.tsx`)
  4. Save PDF before sharing (decouple generate from share)
- Created HTML mockups for user review — all approved

### What Was Tested
- `npx tsc --noEmit` passes clean
- Built and installed release APK on physical device (RFCW113WZRM)
- Calendar alignment verified visually on device

### What's Blocked
- Nothing

### Next Session Priorities
- Implement the 4 planned features (plan at `~/.claude/plans/piped-munching-corbato.md`)
  1. Save Before Share (change `generateAndSharePdf` → `generatePdf` in wizard + detail)
  2. WebView Swipe Fix (`nestedScrollEnabled={false}` + CSS `overflow-x: hidden`)
  3. Calendar Swipe (PanResponder on grid area)
  4. Full-Screen Preview (new `preview.tsx` route + `updateInvoiceStyle` query + Preview button on detail)
- Build release APK + install + test on device
- Update SOT docs

---

## Session: 2026-03-02 — Swipe/Preview Feature Implementation

### What Was Done
- **Save Before Share**: `generateAndSharePdf` → `generatePdf` in wizard (`new.tsx`) and detail (`[id].tsx`). Invoice creation no longer opens share sheet — saves PDF and lands on detail screen. Button label changed to "Approve & Save". Share and Regenerate are now separate actions on the detail screen.
- **WebView Swipe Fix**: `nestedScrollEnabled={false}` on WebView in wizard Step 3 carousel. WebView no longer intercepts horizontal swipes, so FlatList paging works. Added `overflow-x: hidden; width: 100%` to classic invoice template body CSS as defensive measure.
- **Calendar Swipe**: Added `PanResponder` to CalendarPicker day grid. Swipe right → previous month, swipe left → next month. Arrow buttons remain. Uses refs for latest goToPrev/goToNext to avoid stale closures. Threshold: `|dx| > |dy|` and `|dx| > 10` to activate, `|dx| > 50` to trigger navigation.
- **Full-Screen Invoice Preview**: New `app/invoice/preview.tsx` route. Horizontal FlatList carousel with all 4 styles. Style name bar + counter overlay. Navigation arrows. "Use This Style" button — if different from current, updates style in DB, regenerates PDF, deletes old PDF, goes back. If same style, shows "Current Style" (dimmed) and just goes back.
- **Supporting changes**: `updateInvoiceStyle()` query in `queries.ts`. Detail screen switched from `useEffect` to `useFocusEffect` (from expo-router) so data reloads when returning from preview. "Preview Invoice" button added to detail screen above "Share Invoice PDF".
- Decisions D-039 through D-042 added.

### What Was Tested
- `npx tsc --noEmit` passes clean
- Built and installed release APK on physical device (RFCW113WZRM)
- App launched via adb reverse + am start

### What's Blocked
- Nothing

### Next Session Priorities
- Test all 4 features on device (swipe, preview, save before share, calendar swipe)

---

## Session: 2026-03-02 — UX Polish + Auto Receipts

### What Was Done
- **Preview viewport fix**: WebView previews now replace `width=device-width` with `width=800` in the viewport meta tag, so the HTML renders at A4 proportions and auto-scales to fit the phone screen. Preview now matches actual PDF output.
- **Detail preview simplified**: `preview.tsx` rewritten from a 4-style carousel to a single-style full-screen WebView showing only the invoice's saved style. Shows invoice number in header, style name, and a Share button at the bottom.
- **Share auto-marks as "sent"**: Sharing an invoice PDF now auto-updates status from "draft" to "sent". Only upgrades — never downgrades from "paid".
- **Paid auto-generates receipts**: New `markInvoicePaid()` in queries.ts wraps status change + receipt creation in `withExclusiveTransactionAsync`. Idempotent — if receipts already exist, just updates status. Button on detail screen changes to "View Receipts" when receipts exist.
- Decisions D-043 through D-047 added.

### What Was Tested
- `npx tsc --noEmit` passes clean
- Built and installed release APK on physical device (RFCW113WZRM)

### What's Blocked
- Nothing

### Next Session Priorities
- Test on device:
  1. Preview viewport — does it now match the actual PDF proportions?
  2. Share invoice → status changes to "sent"
  3. Mark as paid → receipts auto-generated → "View Receipts" button appears
  4. Wizard Step 3 preview viewport also correct
- Consider FreeAgent API integration for tax reporting (see D-047)

---

## Session: 2026-03-02 — Styled Receipt Templates + Swipeable Receipt Preview

### What Was Done
- **Swipeable receipt preview**: `preview.tsx` rewritten from single-page WebView to a horizontal FlatList carousel showing invoice + all attached receipts. Page label bar, counter, navigation arrows, and per-page Share button. Receipt pages generated in preview from receipt data.
- **Styled receipt templates**: Created 3 new receipt templates matching invoice styles:
  - `src/pdf/receiptTemplatePremiumDark.ts` — dark luxury, matches Premium Dark invoice
  - `src/pdf/receiptTemplateCleanProfessional.ts` — warm cream, matches Clean Professional invoice
  - `src/pdf/receiptTemplateBoldRock.ts` — bold dark, matches Bold Rock invoice
- **Receipt template dispatcher**: Created `src/pdf/getReceiptTemplate.ts` — same `Record<InvoiceStyle, fn>` pattern as invoice dispatcher with classic fallback
- **Updated call sites**: Both `receipts.tsx` and `preview.tsx` now use `getReceiptHtml(style, data)` instead of `generateReceiptHtml(data)`, so receipts match their parent invoice's visual style
- **Fixed receipt generation**: `receipts.tsx` now uses `generatePdf()` instead of `generateAndSharePdf()` — no more share dialog popping up for each receipt during batch generation
- Decision D-048 added (supersedes D-024)

### What Was Tested
- `npx tsc --noEmit` passes clean
- Built and installed release APK on physical device (RFCW113WZRM)

### What's Blocked
- Nothing

### Next Session Priorities
- Test on device:
  1. Preview carousel — swipe between invoice and receipts
  2. Receipt styling matches invoice style (try all 4 styles)
  3. Receipt generation still works (Generate All Receipts button)
  4. Share individual receipts from receipts screen
- Consider FreeAgent API integration for tax reporting (see D-047)

---

## Session: 2026-03-02 — Themed Templates Planning + JSX Polish

### What Was Done
- **Polished `themed-invoices-batch1.jsx`** (3 themed invoice prototypes):
  - Rewrote HollyCorner SVG — smooth bezier leaf shapes with bright red berries (replaced zigzag starburst paths)
  - Rebuilt Rose SVG — layered concentric petals (outer swoops, mid curls, inner bud, center dot)
  - Added CSS multi-layer radial-gradient paper-grain textures to all 3 templates:
    - Christmas: fine dot grid on dark green
    - Halloween: grunge texture on near-black
    - Valentine: linen crosshatch on warm cream
  - Boosted opacity on: pumpkin body/face, scattered hearts, bats, Christmas tree watermark, baubles, HeartCluster
- **Decided HTML-first prototyping workflow** (D-050): prototype as standalone .html files, iterate in browser, convert to .ts — avoids JSX→HTML conversion overhead
- **Planned app integration** (D-049): 3 new seasonal styles (christmas, halloween, valentine) — same dispatcher pattern as existing 4 styles, 6 new .ts template files + type/dispatcher updates
- **Created partial HTML mockups** in `mockups/` folder: 4 existing template mockups extracted from .ts files (placeholder logos — needs fixing)
- Updated `CLAUDE.md` file map, decisions log (D-049, D-050), todo.md

### What Was Tested
- No code changes to app — planning session only

### What's Blocked
- Nothing

### Next Session Priorities
1. **Primary**: Create 3 themed invoice + 3 receipt .ts template files from `themed-invoices-batch1.jsx`
2. Update `invoiceStyles.ts`, `getInvoiceTemplate.ts`, `getReceiptTemplate.ts`
3. `npx tsc --noEmit` + rebuild + test on device
4. **Secondary**: Fix mockups (real logo, 3 themed mockups, index.html)

---

## Session: 2026-03-02 — Themed Templates Implementation

### What Was Done
- **Created 6 new template files** from `themed-invoices-batch1.jsx` JSX prototype:
  - `src/pdf/invoiceTemplateChristmas.ts` — dark forest green, Cormorant Garamond + Outfit, holly/snowflake/tree/bauble SVG decorations, gold accents
  - `src/pdf/invoiceTemplateHalloween.ts` — near-black, Syne + Space Grotesk, pumpkin/bat/spider/candle SVG decorations, orange ember accents
  - `src/pdf/invoiceTemplateValentine.ts` — warm cream, Playfair Display + Lora, heart/rose SVG decorations, berry-pink accents
  - `src/pdf/receiptTemplateChristmas.ts` — matching Christmas receipt (reduced decorations)
  - `src/pdf/receiptTemplateHalloween.ts` — matching Halloween receipt (reduced decorations)
  - `src/pdf/receiptTemplateValentine.ts` — matching Valentine receipt (reduced decorations)
- All templates follow existing Bold Rock pattern: CSS classes (no inline styles), htmlEscape on all data fields, TGT_LOGO_SVG, Google Fonts via link tag
- `invoiceStyles.ts`, `getInvoiceTemplate.ts`, `getReceiptTemplate.ts` were already updated (from previous session planning)
- Updated `CLAUDE.md` file map with 6 new template files

### What Was Tested
- `npx tsc --noEmit` passes clean
- Built and installed release APK on physical device (RFCW113WZRM)
- App launched successfully

### What's Blocked
- Nothing

### Next Session Priorities
- Test all 7 invoice styles on device (especially SVG decorations in expo-print PDFs)
- Test all 7 receipt styles match their parent invoice
- Visual polish pass if any decorations look wrong at PDF scale
- Fix HTML mockups (real logo, 3 themed mockups, index.html)

---

## Session: 2026-03-03 — Shared Gig Calendar (Supabase + Tangerine Timetree PWA)

### What Was Done

**Supabase Backend:**
- Created Supabase project (jlufqgslgjowfaqmqlds) with 4 tables: profiles, gigs, away_dates, gig_changelog
- Row-Level Security policies: all authenticated read, own away_dates CRUD, any gig CRUD
- Database triggers: auto-create profile on signup, auto-update timestamps
- Created 4 user accounts (Nathan admin + Neil, James, Adam) — cleaned up 3 old "Last Minute" project users
- Migration: added `gig_type` column ('gig' | 'practice') to gigs table

**Tangerine Timetree PWA (new project at C:\Apps\TangerineTimetree\):**
- Full React + TypeScript + Vite web app — login, calendar, day detail, gig form, away manager
- Shared Supabase client + types + queries (same API shape as GigBooks)
- PWA manifest + Apple meta tags for installable iPhone web app
- Dark neon theme: near-black background (#08080c), gunmetal cards (#111118), neon green gigs (#00e676), purple practice (#bb86fc), red away (#ff5252), tangerine branding
- Neumorphic CSS with glow effects, backdrop blur overlay
- Deployed to Vercel at tangerine-timetree.vercel.app (GitHub: njt94043-maker/TangerineTimetree)

**UX Iterations (3 rounds of user feedback):**
1. Added practice sessions as separate gig_type — "Add Gig" and "Add Practice" as separate buttons in DayDetail
2. Simplified availability: any member away = band unavailable (removed "partial" status)
3. Complete dark theme overhaul: gigs = neon green (not gold), available = subtle dark grey, neon glow effects throughout

**GigBooks Updates:**
- Updated CLAUDE.md: 5 tabs, Supabase exception, 11 new gig-related files in file map

### What Was Tested
- `npx tsc --noEmit` passes clean (both GigBooks and Tangerine Timetree)
- `npx expo export --platform android` passes (GigBooks)
- Vite build passes (Tangerine Timetree)
- Deployed and live at tangerine-timetree.vercel.app

### What's Blocked
- Nothing

### Next Session Priorities
- Add "list view for all gigs" to Tangerine Timetree (user requested, deferred to next session)
- Sync GigBooks native app types/queries with gig_type changes
- Test GigBooks Gigs tab on physical device
- Test Tangerine Timetree on band members' iPhones

---

## Session: 2026-03-03 — Gig List + gig_type Sync + Monorepo Planning

### What Was Done

**Tangerine Timetree — Gig List View:**
- Added `getUpcomingGigs(limit=50)` to `src/supabase/queries.ts`
- Created `src/components/GigList.tsx` — chronological list grouped by date, countdown badges, practice/gig differentiation, fee/time/payment display
- Updated `src/App.tsx` — Cal/List toggle in header, `viewMode` state, `returnView` tracking
- Added ~120 lines of gig list CSS to `src/App.css`
- Fixed unused `formatFullDate` variable that broke Vercel build
- Committed and pushed — deployed on Vercel

**GigBooks — gig_type Sync:**
- Updated `src/supabase/types.ts` — added `GigType`, `gig_type` field, updated `isGigIncomplete` and `computeDayStatus` for practice support
- Updated `src/supabase/queries.ts` — added `gig_type` to `createGig`
- Updated `src/components/GigCalendar.tsx` — purple for practice, neon green for gig, updated legend and dot colors
- Updated `src/components/GigDaySheet.tsx` — practice badge, separate Add Gig/Add Practice buttons, conditional field display
- Updated `app/gig/new.tsx` — accepts `gigType` param, hides gig-only fields for practice
- Updated `app/(tabs)/gigs.tsx` — passes `gigType` when navigating
- Added `purple: '#bb86fc'` + calendar colors (`calGig`, `calPractice`, `calAvailable`, `calAway`) to `src/theme/colors.ts`
- Fixed AsyncStorage Maven dependency in `android/build.gradle`
- Built and installed release APK on device (RFCW113WZRM)

**Monorepo Planning (approved, not implemented):**
- Explored both codebases — confirmed 95%+ Supabase code duplication
- Plan approved: combine into `C:\Apps\TGT\` with `shared/`, `web/`, `native/` structure
- Plan saved at `~/.claude/plans/partitioned-nibbling-narwhal.md`

### Issues This Session
- Previous session accidentally worked on DevMirror instead of GigBooks (inherited mess)
- GigBooks gig list view was NOT added (only Timetree got it)
- GigBooks calendar still looks visually different from Timetree (neumorphic circles vs flat CSS grid)
- Color fixes applied in code but user reported calendar still didn't match Timetree

### What Was Tested
- `npx tsc --noEmit` passes (both projects)
- Vite build passes (Timetree) — deployed on Vercel
- GigBooks APK built and installed on device

### What's Blocked
- Nothing

### Next Session Priorities
1. **Monorepo setup**: Create `C:\Apps\TGT\` with shared/web/native structure, move both apps in
2. **GigBooks gig list view**: Port `GigList.tsx` from Timetree to React Native
3. **Build + install GigBooks APK** with all pending changes

---

## Session: 2026-03-03 — Monorepo Restructure

### What Was Done

**Monorepo setup at C:\Apps\TGT\:**
- Created `C:\Apps\TGT\` with `shared/`, `web/`, `native/` structure
- Moved TangerineTimetree `.git` to TGT root (preserves full commit history)
- Copied TangerineTimetree → `web/`, GigBooks → `native/`
- Root `package.json` with convenience scripts (no npm workspaces — avoids Metro symlink issues)
- Root `.gitignore` covering both projects

**Shared Supabase layer (shared/supabase/):**
- `types.ts` — unified from GigBooks version (has `'partial'` DayStatus, `totalMembers` param on `computeDayStatus`, practice validation in `isGigIncomplete`)
- `queries.ts` — merged: GigBooks base + Timetree's `getUpcomingGigs()`, uses `getSupabase()` bridge pattern
- `config.ts` — hardcoded URL + anon key (Metro can't use `import.meta.env`)
- `clientRef.ts` — new `initSupabase(client)` / `getSupabase()` bridge, uses `SupabaseClientLike` interface (avoids requiring `@supabase/supabase-js` in shared/)
- `index.ts` — barrel re-export

**Metro config for native/:**
- Created `metro.config.js` with `watchFolders: [shared/]` and `nodeModulesPaths: [native/node_modules/]`
- Updated `tsconfig.json` with `@shared/*` path alias and `include: [".", "../shared"]`

**Vite config for web/:**
- Updated `vite.config.ts` with `resolve.alias: { '@shared': '../shared' }`
- Updated `tsconfig.app.json` with `@shared/*` path alias and `include: ["src", "../shared"]`

**Import updates (both apps):**
- All supabase type/query/config imports changed to `@shared/supabase/*`
- Deleted 6 local copies (types.ts, queries.ts, config.ts in each app)
- Platform-specific files stay local: `client.ts` (AsyncStorage vs browser), `AuthContext.tsx` (native only), `useAuth.ts` (web only)
- Fixed web `Calendar.tsx` — added `totalMembers` prop to support partial availability from shared `computeDayStatus`

**Bug fixes during unification:**
- Web now has `'partial'` DayStatus (was missing)
- Web's `isGigIncomplete` now validates practice sessions (was always returning false)
- Web's `deleteGig` now logs complete changelog entries (was missing `field_changed`, `new_value`)
- Web's `computeDayStatus` now uses `totalMembers` for proper partial availability

### What Was Tested
- `npx tsc --noEmit` passes clean (native/)
- `npx tsc -b` passes clean (web/)
- Git commit successful (182 files, renames detected)

### What's Blocked
- Vercel deployment needs root directory updated to `web/` (manual dashboard change)
- Git push not done yet (pending user decision on repo name)

### Next Session Priorities
1. **Push to GitHub** — update remote if renaming repo, push monorepo commit
2. **Update Vercel** — set root directory to `web/`
3. **GigBooks gig list view** — port `GigList.tsx` from web to React Native
4. **Build + install GigBooks APK** — verify Metro resolves shared/ imports at runtime
5. **Test Timetree** on band members' iPhones

---

## Session: 2026-03-03 — Native Gig List + Web Toggle Move + Audit + Plan

### What Was Done
- **GigBooks gig list view**: Ported `GigList.tsx` from web to React Native (FlatList, grouped by date, countdown badges, neumorphic cards)
- **Web Cal/List toggle**: Moved from header to below calendar content (user feedback: too tight)
- **Cal/List toggle for native**: Added viewMode toggle + GigList component to `gigs.tsx`
- **Vercel deployment**: User set root directory to `web/`; committed and pushed to trigger deploy
- **Comprehensive fit-for-purpose audit**: 50+ issues across both apps, consolidated into prioritized list (7 CRITICAL, 8 HIGH, MEDIUM/LOW)
- **6-phase implementation plan**: Created and approved at `~/.claude/plans/ticklish-moseying-deer.md`

### What Was Tested
- `npx tsc --noEmit` passes clean (native)
- `npx tsc -b` passes clean (web)
- Built and installed release APK on device (RFCW113WZRM)
- Vercel deployed with `web/` root directory

### Next Session Priorities
- Phase 1: Critical Data & Sync Fixes

---

## Session: 2026-03-04 — Phase 1: Critical Data & Sync Fixes

### What Was Done

**1.1 — List view realtime sync (both apps):**
- Native `GigList.tsx`: Added Supabase realtime subscription (`gig-list` channel), refetches on any `gigs` table change
- Web `GigList.tsx`: Added Supabase realtime subscription (`gig-list-web` channel), refetches on any `gigs` table change
- Both list views now auto-update when other users add/edit/delete gigs

**1.2 — Error handling everywhere:**
- Native `GigList.tsx`: Added `error` state, retry UI ("Failed to load gigs. Tap to retry.")
- Native `gigs.tsx`: Added `calendarError` state, error banner with retry in calendar view
- Web `GigList.tsx`: Added `error` state, retry button
- Web `useCalendarData.ts`: Added `error` state, exposed in return value
- Web `App.tsx`: Error banner above calendar/list when `calendarError` is set
- Web `DayDetail.tsx`: Error state on `getGigsByDate()` failure with retry button

**1.3 — Form validation with warnings:**
- Web `GigForm.tsx`: Before save, checks `isGigIncomplete()` — shows `confirm()` dialog listing missing fields, user can save anyway (marked INCOMPLETE)
- Native `new.tsx`: Before save, checks `isGigIncomplete()` — shows `Alert.alert()` with "Save Anyway" / "Go Back", user can save anyway

**1.4 — Auth token expiry handling:**
- `shared/supabase/clientRef.ts`: Added `onAuthError()` callback registration + `handleAuthError()` trigger
- `shared/supabase/queries.ts`: Added `checkAuthError(error)` helper — detects PGRST301, 401, JWT expired, not authenticated; calls `handleAuthError()` before all `throw error` statements
- Web `useAuth.ts`: Registers `onAuthError` handler → signs out + clears state → shows login page
- Native `AuthContext.tsx`: Registers `onAuthError` handler → signs out + clears state → shows login gate

**Bonus Phase 3 items (implemented alongside GigList changes):**
- 3.1 — Add gig buttons in list view: Added `ListFooterComponent` with "Add Gig" + "Add Practice" buttons
- 3.2 — Pull-to-refresh on list view: Added `RefreshControl` to FlatList
- 3.3 — Long text overflow: Added `numberOfLines={2}` to venue, `numberOfLines={1}` to client

### What Was Tested
- `npx tsc --noEmit` passes clean (native)
- `npx tsc -b` passes clean (web)
- `npx expo export --platform android` — 1249 modules bundled successfully
- Release APK built and installed on device (RFCW113WZRM)

### What's Blocked
- Nothing

### Next Session Priorities
- Phase 2: Web Visual Redesign (safe areas, touch targets, font sizes, contrast, spacing, accessibility)
- Phase 3 remaining: day sheet scroll fix, calendar gig count indicator, success feedback on save

---

## Session: 2026-03-04 — Phase 2: Web Visual Redesign

### What Was Done

**2.1 — Safe areas:**
- Removed `user-scalable=no` from viewport meta (accessibility requirement)
- Added `env(safe-area-inset-*)` padding to `.app` (left/right), `.header` (top), `.day-sheet` (bottom), `.form-wrap` (bottom)

**2.2 — Touch targets (44px minimum):**
- Calendar arrows: 8px → 14px padding + 44×44 min + flex center
- View toggle buttons: 6px/12px → 10px/16px + 44px min-height
- Calendar cells: 40px → 44px min-height
- Away delete button: 8px → 14px padding + 44×44 min (converted from `<span>` to `<button>`)
- GigList cards: 14px → 16px padding
- DayDetail cards: 14px → 16px padding
- Toggle buttons: 12px → 14px padding + 44px min-height
- Changelog toggle: 44px min-height tap area
- Legend items: 32px min-height with padding
- All `.btn`: min-height 48px, `.btn-small`: min-height 44px
- Input fields: min-height 44px

**2.3 — Font sizes (11px minimum everywhere):**
- Day headers: 10px → 11px
- Legend labels: 10px → 11px
- View toggle: 11px → 12px
- Badges: 9px → 10px
- Changelog time: 9px → 11px
- Form labels: 10px → 11px
- Detail labels: 12px → 13px
- Detail values: 12px → 13px
- "Added by" text: 10px → 11px
- Changelog text: 11px → 12px

**2.4 — Color contrast (WCAG AA):**
- `--color-text-dim`: `#585870` → `#7a7a94` (~4.5:1 on dark bg)
- `--color-text-muted`: `#333344` → `#4a4a60` (~3:1 for secondary)
- `--color-available`: updated to match new muted value
- Input placeholder color: now uses `--color-text-dim` (improved contrast)

**2.5 — Visual hierarchy & spacing:**
- Header: added subtle bottom border, logo 36px → 40px
- Calendar: grid gap 2px → 3px, bolder today indicator (stronger glow)
- Day detail rows: padding 3px → 8px vertical
- GigList cards: margin 8px → 12px between cards
- Form labels: margin 14px → 16px top spacing
- Status dots: 5px → 7px diameter

**2.6 — Accessibility:**
- Added `:focus-visible` styling (2px tangerine outline, 2px offset)
- Added `.neu-inset:focus-within` highlight for focused inputs
- Converted header user `<div>` to `<button>`
- Converted header `<div>` to semantic `<header>`
- Converted calendar day cells from `<div>` to `<button>` with `aria-label`
- Added `aria-label="Previous month"` / `"Next month"` to calendar arrows
- Added `aria-label="Delete away date"` to away delete button
- Converted payment type toggles from `<div>` to `<button type="button">`
- Converted away-delete `<span>` to `<button>`
- Added `htmlFor`/`id` linking on all form labels (GigForm, AwayManager, LoginPage)
- Added `role="alert"` to all error messages (App.tsx, DayDetail, GigForm, AwayManager, GigList, LoginPage)
- Added `.error-banner` CSS class for consistent error styling
- Removed `-webkit-tap-highlight-color: transparent` from buttons and toggles

### What Was Tested
- `npx tsc -b` passes clean (web)
- `npx tsc --noEmit` passes clean (native)
- `npx vite build` passes (7 precache entries, 622 KiB)

### What's Blocked
- Nothing

### Next Session Priorities
- Phase 3 remaining: day sheet scroll fix (3.4), calendar gig count indicator (3.5), success feedback on save (3.6)
- Phase 4: In-App Change Summary (away_date_changelog, last_opened_at, change summary banner)
- Push to GitHub → Vercel deploys web changes
- Test on iPhone: touch targets, safe areas, focus states

---

## Session: 2026-03-04 — Phase 3 Remaining: Native UX Fixes

### What Was Done

**3.4 — Day sheet scroll fix:**
- `GigDaySheet.tsx` line 209: `scroll: { flexGrow: 0 }` → `flexGrow: 1`
- ScrollView now expands to fill available space, allowing scroll when 5+ gigs on a day

**3.5 — Calendar gig count indicator (both apps):**
- **Web** (`Calendar.tsx`): When `dateGigs.length > 1`, renders a `<span className="day-count">` badge showing the count
- **Web** (`App.css`): New `.day-count` class — 14px circle, 8px mono font, positioned top-right of calendar cell
- **Native** (`GigCalendar.tsx`): When `dateGigs.length > 1`, renders a `<View style={countBadge}>` with count text
- **Native**: New `countBadge` + `countText` styles — 14px circle, 8px mono font, top-right of day circle

**3.6 — Success feedback on save (native):**
- `new.tsx`: After successful save, shows `ToastAndroid.show()` with "Gig saved" / "Practice saved" / "Gig updated" / "Practice updated"
- Non-blocking toast (doesn't require dismiss), then navigates back
- Android-only (ToastAndroid), iOS has no equivalent used

### What Was Tested
- `npx tsc --noEmit` passes clean (native)
- `npx tsc -b` passes clean (web)
- `npx vite build` passes (7 precache entries, 623 KiB)

### What's Blocked
- Nothing

### Next Session Priorities
- Phase 4: In-App Change Summary (away_date_changelog, last_opened_at, change summary banner)
- Push to GitHub → Vercel deploys Phase 2 + 3 web changes
- Build release APK → test on device (scroll fix, count badges, toast feedback)
- Test web on iPhone (touch targets, safe areas, focus states)

---

## Session: 2026-03-04 — Phase 4: In-App Change Summary

### What Was Done

**4.1 — Supabase migration:**
- Added `last_opened_at TIMESTAMPTZ DEFAULT NOW()` column to `profiles` table
- Created `away_date_changelog` table (id, away_date_id, user_id, action, date_range, reason, created_at)
- RLS policies: authenticated read, own inserts
- Migration applied via `supabase db push` (Supabase CLI linked to project jlufqgslgjowfaqmqlds)
- Migration file: `supabase/migrations/20260304105634_phase4_change_summary.sql`

**4.2 — Shared queries (`shared/supabase/queries.ts`):**
- `updateLastOpened()`: Updates `profiles.last_opened_at` to NOW() for current user
- `getChangesSince(since)`: Queries both `gig_changelog` and `away_date_changelog` for entries after `since`, by other users only. JOINs profiles for names, gigs for venue/date context. Returns `ChangeSummaryItem[]` with human-readable descriptions, sorted by most recent, limited to 10
- `createAwayDate()`: Now logs to `away_date_changelog` (action: 'created', date_range, reason)
- `deleteAwayDate()`: Now fetches away date info before delete, logs to `away_date_changelog` (action: 'deleted')

**4.3 — Shared types (`shared/supabase/types.ts`):**
- Added `last_opened_at` to `Profile` interface
- Added `ChangeSummaryItem` type: `{ type, action, user_name, description, created_at }`
- Formatter logic inlined into `getChangesSince()` — no separate file needed

**4.4 — Web implementation (`web/src/App.tsx` + `web/src/App.css`):**
- On MainView mount, fetches changes since `profile.last_opened_at` (once per session via useRef flag)
- Dismissible banner with tangerine left border, dark card, lists changes with colored dots (green for gig, red for away)
- "Dismiss" button calls `updateLastOpened()` and clears banner
- New CSS classes: `.change-banner`, `.change-banner-header`, `.change-banner-title`, `.change-banner-dismiss`, `.change-banner-list`, `.change-banner-item`, `.change-dot`

**4.5 — Native implementation (`native/app/(tabs)/gigs.tsx`):**
- On first mount, fetches changes since `profile.last_opened_at` (once per session via useRef flag)
- Shows `Alert.alert("What's Changed", summary)` with formatted list
- On dismiss (OK button), calls `updateLastOpened()`
- `profile` prop passed from GigsTab to GigsMainView

**Decisions:** D-057 (in-app change summary), D-058 (away_date_changelog table), D-059 (last_opened_at tracking)

### What Was Tested
- `npx tsc --noEmit` passes clean (native)
- `npx tsc -b` passes clean (web)
- `npx vite build` passes (7 precache entries, 627 KiB)

### What's Blocked
- Nothing

### Next Session Priorities
- Push to GitHub → Vercel deploys Phase 2 + 3 + 4 web changes
- Build release APK → test on device (change summary alert, scroll fix, count badges, toast)
- Test web on iPhone (touch targets, safe areas, focus states, change banner)
- Phase 5: Full Offline Support (service worker caching, offline queue)

---

## Session: 2026-03-04 — Phase 5: Full Offline Support

### What Was Done

**5.1 — Web: Service worker offline caching (`web/vite.config.ts`):**
- Added Workbox `runtimeCaching` config with two strategies:
  - Supabase REST API: `NetworkFirst` with 10s timeout, 24h cache, 50 entries max
  - Google Fonts: `CacheFirst` with 1-year cache, 20 entries max
- Added offline indicator banner to `App.tsx` — "You're offline — showing cached data"
- Detects connectivity via `navigator.onLine` + `online`/`offline` events
- Auto-refreshes calendar data when connectivity returns
- New `.offline-banner` CSS class in `App.css`

**5.2 — Web: Offline mutation queue (`web/src/hooks/useOfflineQueue.ts`):**
- New file: localStorage-based mutation queue (5 mutation types: createGig, updateGig, deleteGig, createAwayDate, deleteAwayDate)
- `isNetworkError()`: detects fetch failures and offline state
- `queueMutation()`: adds mutation to localStorage queue
- `useOfflineQueue()` hook: tracks pending count, auto-replays queue on reconnect, calls `onSynced` callback
- Integrated into `GigForm.tsx`: catches network errors on save/delete, queues and treats as success
- Integrated into `AwayManager.tsx`: catches network errors on create/delete, queues mutations
- `App.tsx`: shows pending count in offline banner, shows "X changes syncing..." when back online

**5.3 — Native: AsyncStorage cache (`native/src/utils/offlineCache.ts`):**
- New file: caches gigs, away dates, and profiles in AsyncStorage keyed by year-month
- `cacheCalendarData()`: stores after each successful network fetch
- `getCachedCalendarData()`: retrieves cached data for given month
- `gigs.tsx` `fetchData()`: on network failure, falls back to cache and shows "Offline — showing cached data" banner
- New `offlineBanner` / `offlineBannerText` styles

**5.4 — Native: Offline mutation queue (`native/src/utils/offlineQueue.ts`):**
- New file: AsyncStorage-based mutation queue (same 5 mutation types as web)
- `isNetworkError()` / `queueMutation()`: detect and queue failed mutations
- `replayQueue()`: replays queued mutations when online, keeps failed items
- `startOfflineQueueListener()`: subscribes to NetInfo connectivity changes, auto-replays on reconnect
- Installed `@react-native-community/netinfo` package
- Integrated into `gig/new.tsx`: catches network errors on save/delete, queues with toast feedback
- Integrated into `gig/away.tsx`: catches network errors on create/delete away dates
- `gigs.tsx`: starts offline queue listener alongside realtime subscriptions

**Decisions:** D-060 (NetworkFirst SW caching), D-061 (offline mutation queue pattern), D-062 (AsyncStorage cache)

### What Was Tested
- `npx tsc --noEmit` passes clean (native)
- `npx tsc -b` passes clean (web)
- `npx vite build` passes (7 precache entries, 630 KiB)

### What's Blocked
- Nothing

### Next Session Priorities
- Push to GitHub → Vercel deploys Phase 2–5 web changes
- Build release APK → test on device (offline mode, change summary, all Phase 3 fixes)
- Test web on iPhone (offline indicator, change banner, touch targets, safe areas)
- Phase 6: Polish & Remaining Items (today button, time picker, calendar preservation, etc.)

---

## Session: 2026-03-04 — Phase 6: Polish & Remaining Items

### What Was Done

**6.1 — Today button (both apps):**
- Web Calendar: "Today" button appears in header when not on current month, resets year/month
- Native Calendar: "Today" pill below header, tapping month title also returns to today

**6.2 — Time picker on native gig form:**
- Installed `@react-native-community/datetimepicker@8.6.0`
- Replaced TextInput fields for load-in/start/end time with Pressable + native DateTimePicker
- Smart defaults: load-in 18:00, start 21:00, end 23:30

**6.3 — Calendar month preservation on web:**
- Already working — year/month state lives in MainView, persists across Cal↔List switches

**6.4 — Away date editing (both apps):**
- New `updateAwayDate()` query in `shared/supabase/queries.ts`
- Web: tap away card content to edit (prefills form, saves via update)
- Native: same — Pressable card opens form in edit mode with editingId tracking

**6.5 — Multiple gig dots (both apps):**
- Both calendars now show up to 3 individual dots (one per gig, colored by type)
- Each dot shows incomplete indicator if applicable
- Count badge shows "+N" only when >3 gigs on a day

**6.6 — Swipe-down dismiss on native day sheet:**
- Added PanResponder to handle area (expanded touch target)
- Swipe down >60px triggers onClose

**6.7 — Dynamic header title on web:**
- Header shows "Calendar", "Upcoming", "Away Dates" based on current view

**6.8 — PWA launch screen:**
- Added `apple-touch-startup-image` meta tag pointing to logo-512
- Added `description` meta tag for better PWA install experience

**6.9 — Password visibility toggle (both apps):**
- Web: Show/Hide button inside password input
- Native: Show/Hide text button next to password field

### What Was Tested
- `npx tsc --noEmit` passes clean (native)
- `npx tsc -b` passes clean (web)
- Git push to GitHub succeeded (`d725d39..afc4d74 master -> master`) — Vercel auto-deploys web changes
- **APK build FAILED** — cmake error from `@react-native-community/datetimepicker` JNI codegen

### What's Blocked
- **APK build**: `Process 'command cmake.exe' finished with non-zero exit value 1` during `assembleRelease`. Only cmake 3.22.1 installed. The datetimepicker generates JNI codegen with CMakeLists.txt requiring `cmake_minimum_required(VERSION 3.13)` — version should be fine but compilation fails. Likely fix: `npx expo prebuild --clean` to regenerate android native project, or update cmake SDK, or check full cmake error output.

### Next Session Priorities
- **Fix APK build** — try `npx expo prebuild --clean` then rebuild, or install newer cmake via sdkmanager
- Test all Phase 6 items on device once APK builds
- Test Tangerine Timetree PWA on band members' iPhones

---

## Session: 2026-03-04 — Public Website Planning + Base44 Export Analysis

### What Was Done

**Base44 Export Analysis:**
- Extracted and catalogued full base44 source export (`green-tangerine-hub-e58b6a1a.zip`, 80+ files)
- Read all 7 public pages (Home, ForVenues, Pricing, Contact, Photos, Videos, MerchShop)
- Read all 18 hub/admin pages (Dashboard, Bookings, etc.)
- Read Layout, CSS, Tailwind config, key components (BookingForm, InvoiceGenerator, ExpenseForm)
- Documented full data model (14 entities), business logic, design system, and all page content
- Compiled comprehensive reference: `base44-export/SITE_REFERENCE.md`

**Public Website Planning:**
- Decided: Build public site INTO existing `web/` app (not separate project)
- Decided: Option C — static content pages + dynamic sections (gigs, gallery) fed from Supabase
- Decided: No merch shop (not used)
- Decided: Gigs need `is_public` flag to control website visibility
- Decided: Profile page with name, avatar, band role
- Decided: Domain (thegreentangerine.com on IONOS) → point to Vercel
- Created full implementation plan: `PLAN_PUBLIC_SITE.md`

**Plan covers:**
1. Supabase schema (is_public on gigs, band_role on profiles, public_media table, RLS for anonymous reads)
2. Gig form toggle — "Show on Website" (web + native)
3. Profile page (web) — name, avatar, band role
4. Public website (7 sections: hero, gigs, about, for venues, pricing, gallery, contact)
5. Login modal (replaces LoginPage for auth-gated access)
6. Domain setup (IONOS DNS → Vercel)
7. 3-sprint implementation order

### What Was Tested
- No code changes — planning session only

### What's Blocked
- Nothing

### Next Session Priorities
1. Sprint 1: Supabase migration + shared types/queries + gig form toggle + profile page
2. Sprint 2: Public website component + login modal + SEO
3. Sprint 3: Media gallery + contact form + domain setup

---

## Session: 2026-03-04 — Full Codebase Audit + Critical Fixes + SOT Redesign

### What Was Done
- **Full surgical audit** of entire codebase using 5 parallel agents:
  - Shared layer (types, queries, config, clientRef)
  - Native app (all screens, forms, data layer, PDF, offline, auth)
  - Web app (components, hooks, PWA, auth, styling, routing)
  - SOT docs (all 7 docs + CLAUDE.md + MEMORY.md)
  - Project config (package.json, tsconfig, vite, metro, Supabase, CI/CD)
- **Identified 12 issues** (4 critical, 8 high) + 26 medium + 13 low
- **Fixed 3 CRITICAL bugs:**
  1. Added `updateAwayDate` to offline queues in both native (`offlineQueue.ts`) and web (`useOfflineQueue.ts`) — users could not edit away dates while offline
  2. Added `refreshSession()` to `AuthContext.tsx` on mount — prevents expired JWT silent failures after idle/offline
  3. Wrapped `createReceipts()` in `withExclusiveTransactionAsync()` — prevents partial receipt creation on crash
- **SOT redesign — context loss prevention:**
  - Created `STATUS.md` — instant context document (read in 30 seconds, replaces reading 6 files)
  - Updated `CLAUDE.md` session protocol to prioritize STATUS.md
  - Restructured `todo.md` with Blocked/Next/Planned/Backlog sections
  - Added session index to top of SESSION_LOG.md
  - Defined 8-sprint roadmap (S1-S8) covering all remaining work

### What Was Tested
- `npx tsc --noEmit` in native/ — passes clean (exit 0)
- `npx tsc -b` in web/ — passes clean (exit 0)

### What's Blocked
- APK build (cmake/datetimepicker) — unchanged, fix planned for Sprint S2

### Decisions Made
- D-069: STATUS.md as instant-context document — 3-layer context system (instant/working/deep)
- D-070: Sprint roadmap S2-S8 for remaining work
- D-071: Session protocol updated to read STATUS.md first

### Next Session Priorities (Sprint S2)
1. Fix APK build (prebuild clean + cmake debugging)
2. Fix HIGH code issues: type safety in shared queries, changelog error handling, getSettings nullable
3. Add conflict detection to offline queue
4. Add offline support to web DayDetail component

---

## Session — 2026-03-05 (Review UX + Venue/Client Design)

### What Was Done
1. **Review editor UX audit + fixes** (web PWA)
   - Auto-growing review text textarea (JS-based, cross-browser — `field-sizing: content` rejected due to Samsung Internet support)
   - Rating/Source/Date grid: 3-col → 2-col on mobile (Date full-width), preventing truncation
   - Full-width stacked 48px action buttons on mobile full-screen form
   - URL input type (`type="url"` + `inputMode="url"`) for review link field
   - Label spacing (`margin-top: 12px`) inside review form
   - Close button enlarged to 44x44px minimum touch target
   - Committed + pushed to Vercel: `045e58f`

2. **Venue/Client data model design** (discussion + planning, no code)
   - Designed two-list model: venues (physical places) and clients (people who pay) — independent, no forced link
   - Walk-through of 8 real-world booking flows confirming the model holds
   - Identified full blast radius: 24 files across native + web + shared + 1 migration
   - Split into 4-session epic (S23A-D)
   - Decision: clean restructure (snapshot + wipe) since no production data yet

### Files Changed
- `web/src/components/Settings.tsx` — auto-grow textarea, review-edit-grid class, URL input type (both edit + add forms)
- `web/src/App.css` — `.input-textarea-auto`, mobile review form styles (grid, buttons, spacing, close button)
- `native/docs/ai_context/STATUS.md` — S23 plan, updated risks, sprint roadmap
- `native/docs/ai_context/todo.md` — S23A-D task breakdown, S22 deferred

### Decisions Made
- D-072: Venues and clients are separate independent lists. No forced venue→client FK. Gigs/quotes/invoices reference both via optional FKs. Text fields kept for denormalised display.
- D-073: Clean DB restructure (not backwards-compat migration) since no production data exists yet.
- D-074: S22 (native visual overhaul) deferred in favour of S23 (venue/client restructure).

### What's Blocked
- Nothing

### Next Session: S23A
- Supabase migration SQL, updated types, updated queries, TypeScript clean
- See SPRINT_PROMPTS.md for pickup prompt

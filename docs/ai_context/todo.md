# TGT — Todo

> Current tasks, priorities, and backlog.
> Update after every task completion. See STATUS.md for instant context.

---

## Immediate Actions
- [x] **Big-picture realignment** — DONE. Port C++ from ClickTrack, single Oboe stream, aubio beat detection, SoundTouch time-stretch. Role-based song forms. Web stage prompter.
- [x] **S26A: Audio Engine Foundation** — Expo Native Module + C++/Oboe metronome + mixer from ClickTrack. Schema migration (lyrics, chords, beat_offset_ms). Role-based song edit form.
- [x] Sideload APK to Samsung device (installed 2026-03-07)
- [x] UI alignment: native calendar matches web — drawer nav, flex grid, styling parity
- [x] Visual parity audit: 8 fixes (neon glows, Today button, shadows, drawer avatar, card accents, logo)
- [x] Audio upload UI: practice track upload/replace/remove on song edit forms (both apps)
- [x] **Compose app full buildout** — Login, Library, Live Mode, Practice Mode, Settings, AppViewModel, C++ wiring
- [x] On-device test: verify click track fires (confirmed 157 BPM works correctly)
- [x] On-device test: load a practice track (track loads, click fires at correct BPM)
- [x] **S30A+B: Beat alignment fix + on-device confirmation** — Catch-up burst was the drift cause (fixed). BTrack per-beat positions work for steady-tempo tracks (Sultans holds 97+ bars). ANALYSIS_SECONDS raised to 900s.
- [x] **S30C: Beat detection research** — DONE. BTrack limits are architectural (onset-based, 5% tempo cap). madmom (RNN+DBN) chosen. Server-side on Cloud Run, beat maps in Supabase, C++ reads timestamps. D-104/105/106.
- [x] **S31A: Server-side beat detection (madmom)** — DONE. Cloud Run service (Dockerfile + main.py), beat_maps migration, shared types/queries, web triggers after upload + status UI, Android fetches server beat map (BTrack fallback), C++ nativeApplyExternalBeatMap. Both apps build clean.
- [x] **S31B: Deploy + end-to-end test** — DONE. Cloud Run deployed (Python 3.10, madmom 0.16.1, numpy 1.23.5). beat_maps migration applied via CLI. Vercel env var set + redeployed. All 3 tracks analysed successfully (Cissy Strut 90.9 BPM/287 beats, Sultans, War Pigs). Fixed: Cython build dep, collections.MutableSequence patch, np.float deprecation.
- [x] **S32A: Automated stem separation** — DONE. Cloud Run expanded (PyTorch CPU + Demucs htdemucs + torchaudio + soundfile). Cloud Tasks queue (stem-processing, europe-west1). /process enqueues, /process-worker runs full pipeline (madmom beats → Demucs 4 stems → MP3 encode → Supabase upload). Web: triggerProcessing + 3s polling + auto badge. Android: processingStatus + 10s polling + PracticeScreen banner. Migrations: song_stems.source, created_by nullable, beat_maps status CHECK. End-to-end verified: Cissy Strut (90.9 BPM, 4 stems). Fixed: torchaudio missing, soundfile backend, created_by NOT NULL constraint.
- [x] **S32B/C: Testing + polish** — All 3 songs processed (Cissy Strut 90.9, Sultans 150, War Pigs 90.9 BPM + 4 auto stems each). Re-process verified (old stems replaced). Android APK rebuilt + installed. Booking integration confirmed (BookingWizard + GigHub wired, migration applied).
- [x] **S33: Songs/Setlists/Live/Practice big-picture redesign** — DONE. Schema design (songs.category, songs.owner_id, setlists.setlist_type, setlists.band_name, user_settings player prefs). 3 mockups (library-browser, player-live, player-queue). Architecture: Library-as-launchpad, shared player with mode flag, web gets Live+Practice (Web Audio + SoundTouchJS), stage prompter merges into Live Mode, per-user toggle prefs. Migration SQL drafted. Sprint roadmap S34-S37.
- [x] **S34: Migration + types + queries** — Applied s33_migration_draft.sql. Updated shared TS types (SongCategory, SetlistType, Song, Setlist, UserSettings player prefs). Shared queries (getSongsByCategory, getSongsByOwner, getSetlistsByType, getPlayerPrefs, updatePlayerPrefs). Kotlin data classes (Song.kt + Setlist.kt). Android repos (SongRepository + SetlistRepository filters). Web SongForm (category selector, owner picker, drum notation). Web SetlistList/SetlistDetail (setlist_type selector, band_name field). Both builds clean.
- [x] **S35: Android Library + player refactor** — Library as launchpad (Songs/Setlists tabs, filter pills, launch into player). Shared player screen (mode flag: Live vs Practice). Queue overlay with reorder. Set complete screen. Speed safety check.
- [x] **S36: Web audio engine + Library redesign + Player UI** — AudioEngine singleton, ClickScheduler (5 click sounds, beat map mode, subdivisions, swing), TrackPlayer (SoundTouchJS), StemMixer (per-stem gain/mute/solo), useAudioEngine hook. Library component (Songs/Setlists tabs, category/type filter pills, inline Live/Practice launch). Player component (transport, beat counter, lyrics/chords, speed, A-B loop, stem mixer, setlist queue). Forgot password fix. View routing (library + player views). Drawer updated (single Library item). All CSS. tsc + vite build clean.
- [x] **S37: Web player polish** — Wake lock API (visibility re-acquire). Waveform visualiser (canvas amplitude peaks). Player prefs settings UI (7 toggles in Settings, auto-save). Set complete celebration + between-songs countdown. Beat glow polish (pulse animation, multi-layer box-shadow). songComplete flag in useAudioEngine.
- [x] **S38: Visual Unification** — Android GigColors corrected (5 values + 5 new tokens: surfaceLight, greenDark, cyan, pink, slate). NeuCard shadows canonical V4. New PlayerComponents.kt (shared composables: PlayerHeader, VisualHero, TextPanel, Transport, DrawerHandle, DisplayToggleRow, SettingsPills, MixerRow). LiveScreen.kt + PracticeScreen.kt rebuilt to V4 (header→hero→text→transport→drawer via ModalBottomSheet). Web Player.tsx rebuilt (v4-* CSS classes, V4Waveform, TogglePill, drawer overlay). App.css player section rewritten. Both builds clean.
- [x] **S39: Foundation** — Migration pushed: category rename (tgt_*), song_shares table, is_best_take on song_stems, can_access_song() helper, RLS rewrite. Shared types (SongStem.is_best_take, source='recorded'). Shared queries (getSongShares, shareSong, unshareSong, setBestTake, clearBestTake). Cloud Run skip_stems flag (D-148). Web category references updated. Web tsc + vite build clean.
- [x] **S40: Library + SongForm (Both)** — Web Library.tsx: two dropdowns (Scope + Type) replacing pills (D-128), category badges (teal=TGT, orange=personal), owner name tags, lock icons, Edit/Delete hidden for non-owned. Web SongForm.tsx: sharing UI for personal_original, read-only mode for shared songs. Android LibraryScreen.kt: FilterDropdown composables, category badges, owner tags, lock icons. Android Song.kt: tgt_* categories, canEdit(), SongShare model. Profile.kt added. AppViewModel loads profileNames + sharedSongIds. Both builds clean.
- [ ] **S31C: On-device testing** — Test Android practice with server beat maps + stems, verify BTrack offline fallback (airplane mode), test web UI visually at thegreentangerine.com.
- [ ] Add more songs via web app (currently only 3: Sultans, Cissy Strut, War Pigs)
- [x] **S29A: Compose CalendarScreen with real Supabase data** — DONE (gigs + away dates, coloured dots, tap-to-expand)
- [ ] User to verify 44 WhatsApp-confirmed fees, then batch-update

## Capture Tool — Diagnostics & Planning

### Immediate Diagnostics (next session)
- [ ] **Real-world audio quality test** — Play a full song through speakers/headphones while recording via capture tool. Listen to playback for micro-pauses/glitches. Compare WAV waveform in Audacity for dropouts. This validates the writer thread + priority boost fix.
- [ ] **Armed mode end-to-end test** — Start armed, play audio, verify auto-trigger, check pre-roll captures first ~200ms of audio cleanly. Verify stop-while-armed cancels cleanly (no leftover WAV).
- [ ] **FFmpeg encoding audit** — Check FFmpeg MP3 encoding quality settings (bitrate, sample rate). Verify encoded MP3 matches WAV quality. Check for encoding errors in logs.
- [ ] **Concurrent load test** — Record while Chrome plays YouTube + other apps active. Verify no glitches with HIGH_PRIORITY_CLASS + 40ms buffer + writer thread.

### Capture → Library Pipeline (S38 target)
- [ ] **Song import workflow** — Design flow: capture WAV → FFmpeg encode MP3 → upload to Supabase `practice-tracks` bucket → create Song record → trigger Cloud Run processing (beats + stems). This is the key bridge between capture tool and web/android practice modes.
- [ ] **Bulk import UX** — Multiple recordings → batch import with metadata entry (song name, artist, BPM if known). Queue processing for each.
- [ ] **Capture history view** — Show previous recordings in sidepanel with play/review/import/delete actions. Currently only shows current session.

### Extension UX Improvements
- [ ] **Level meter visualization** — Current peak_level is a number. Add visual meter bar (green→yellow→red) in sidepanel during armed/recording states.
- [ ] **Recording timer format** — Show MM:SS format instead of raw seconds for longer recordings.
- [ ] **Error handling UI** — Surface WASAPI errors (device not found, stream open failed) in sidepanel with user-friendly messages and retry button.
- [ ] **Device selector** — Allow choosing which WASAPI loopback device to capture from (currently auto-detects default speakers).

### Backend Robustness
- [ ] **Graceful shutdown** — Handle uvicorn reload while recording is active (currently crashes the session). Save partial WAV, clean up state.
- [ ] **Session recovery** — If backend restarts mid-recording, detect orphaned WAV files and offer recovery in the sidepanel.
- [ ] **Logging** — Add structured logging to wasapi_capture.py (writer thread stats: frames written, queue depth, dropped frames count). Surface in /api/admin/logs.

## Backlog — Performance & Practice Epic

### S26A — Audio Engine Foundation (DONE)
- [x] Prove Expo Module + C++ + Oboe with "hello beep" test
- [x] Port metronome.h/cpp from ClickTrack (strip to essentials)
- [x] Port mixer.h/cpp from ClickTrack
- [x] Port wav_loader.h/cpp from ClickTrack
- [x] Write stripped audio_engine.h/cpp (metronome + mixer only)
- [x] Write Expo Native Module (Kotlin + JNI bridge)
- [x] JS API: startEngine, stopEngine, setBpm, setTimeSignature, setSubdivision, setSwing, setAccentPattern, setClickSound, setCountIn, startClick, stopClick, getCurrentBeat, getCurrentBar
- [x] loadSong(song) — configures engine from Song fields
- [x] Supabase migration: ALTER songs ADD lyrics TEXT, chords TEXT, beat_offset_ms INTEGER
- [x] Update shared types (Song: lyrics, chords, beat_offset_ms)
- [x] Update shared queries (song CRUD with new fields)
- [x] Role-based song edit form: Nathan sees metronome settings, others see simplified form
- [x] Both tsc clean
- [x] **C++ build VERIFIED** — Oboe 1.9.3 + SoundTouch (all sources) + Kotlin runBlocking fix. 105MB APK built.

### S26B — Live Mode UI (native) (DONE)
- [x] Full-screen stage view — dark (#000000), high-contrast, stage-readable
- [x] Setlist selector → load setlist, navigate songs, engine auto-reconfigures
- [x] Song metadata: name, artist, BPM (large monospace), key, time sig, notes
- [x] Beat visualization (LED dots: beat 1 = red/accent, others = teal, scale + glow on active)
- [x] Transport: play/stop (large circular button)
- [x] Prev/next song buttons with auto-loadSong()
- [x] Swing slider (50-75%, snap-to-middle at 50% = straight)
- [x] Song position indicator ("3 of 12")
- [x] Count-in visual (orange banner)
- [x] Wake lock (expo-keep-awake)
- [x] Bar counter display
- [x] Drawer nav: "Performance" section with Live Mode
- [x] Header hidden for immersive stage view

### S26C — Track Player Engine (native, C++) (DONE)
- [x] MP3 decode: Kotlin MediaCodec -> PCM -> JNI -> C++ track_player
- [x] track_player.h/cpp — plays PCM through same Oboe stream as metronome
- [x] Beat detection — onset autocorrelation BPM detector (custom, no aubio dep)
- [x] SoundTouch integration — pitch-preserved time-stretch (vendored source)
- [x] A-B loop: set start/end frames, region looping
- [x] Speed control: setTrackSpeed adjusts SoundTouch rate + metronome BPM together
- [x] Position reporting to JS (current frame / total frames)
- [x] Beat step/nudge — realign click to track (shift metronome phase)
- [x] Mixer: click channel 0, track channel 1, master gain
- [x] analyseTrack() returns BPM + beatOffsetMs for auto-populate
- [x] **C++ build VERIFIED** — compiles and links for all ABIs

### S27A — Practice Mode UI (native) (DONE)
- [x] Practice screen — select song with attached MP3, search/filter
- [x] Progress bar with playhead + time display
- [x] Speed slider (50%-150%, pitch preserved) with +/-5% buttons and reset
- [x] A-B loop markers (set A, set B, clear — visual on progress bar)
- [x] Click volume + track volume + master volume sliders
- [x] Split stereo toggle (IEM: click L, track R)
- [x] Count-in selector (off, 1, 2, 4 bars)
- [x] Beat step/nudge buttons (earlier/later)
- [x] BPM display updates with speed changes (shows effective + original)
- [x] Beat visualization (LED dots from Live Mode)
- [x] Transport: play/pause/stop
- [x] Drawer nav: Practice in Performance section

### S27B — Practice Tools (native) (DONE)
- [x] Tap tempo: measure intervals, set BPM, save to song
- [x] Save all current settings back to Song in Supabase (one button)
- [x] Song notes display in practice view

### S27C — Web Stage Prompter (DONE)
- [x] Read-only setlist display with song details
- [x] Lyrics display (scrolling with auto-scroll option)
- [x] Chords display (inline ChordPro or separate block)
- [x] Song info: name, artist, BPM, key, time sig, duration
- [x] Setlist navigation (prev/next + sidebar + keyboard arrows)
- [x] Full-screen mode for tablet on music stand (F key or button)
- [x] Auto-scroll with configurable speed (S key or button)
- [x] No audio — display only
- [x] #000000 background for stage readability
- [x] Responsive (phone, tablet, desktop)
- [x] ViewContext + Drawer integration

### S28B — N-Channel Mixer + Stem Loading (DONE)
- [x] TrackPlayer::reset() — safe unload without audio-thread race
- [x] AudioEngine MAX_STEMS=6, stemPlayers_[6] (ch2..ch7)
- [x] loadStem/clearStem/clearAllStems — load PCM into stem slot, sync speed
- [x] Transport sync — play/pause/stop/seek/setLoopRegion/clearLoopRegion/setTrackSpeed all applied to all loaded stems
- [x] onAudioReady — stem render loop (ch2..ch7, gain from mixer)
- [x] JNI bridge — nativeLoadStem, nativeClearStem, nativeClearAllStems
- [x] AudioEngineBridge.kt — 3 new externals
- [x] SongStem.kt — @Serializable data class + StemLabel enum (DRUMS=0/BASS=1/GUITAR=2/KEYS=3/VOCALS=4/OTHER=5)
- [x] StemRepository.kt — getStemsBySongId()
- [x] AppViewModel — loadedStems + stemsLoading + stemErrors state; loadStemsForSong() auto-called after track loads; clears on song change

### S28C — Waveform + Per-Stem Mixing (DONE)
- [x] Waveform visualiser in PracticeScreen (amplitude envelope computed from PCM, canvas overlay)
- [x] Loop region A-B markers overlaid on waveform (orange rect + boundary lines)
- [x] Playhead green line + thumb circle advancing as track plays
- [x] Tap-to-seek on waveform (pointerInput detectTapGestures)
- [x] Per-stem volume sliders in PracticeScreen (for each loadedStem: label + gain slider)
- [x] stemGains state in AppViewModel; setStemGain() calls nativeSetChannelGain(2+idx, gain)
- [x] Auto-analyse BPM + beatOffsetMs on track load (populate song fields if empty) — S28D complete

### S28+ — Recording/Video (defer)
- [x] Front camera recording while practicing — Done in S41 (both platforms)
- [x] Spec properly when S27 complete — Done in S41

## Backlog — Other
- FreeAgent API integration — sync income/expenses for tax reporting (D-047, needs planning)

---

## Key Decisions
- GigBooks = band manager + live performance + practice tool (one app)
- C++ audio engine ported from ClickTrack (proven Oboe/metronome code)
- Single Oboe stream — metronome + track player mixed in C++ callback (zero drift)
- aubio for beat detection, SoundTouch for time-stretch (both C++)
- Speed trainer + gap click (muted bars) CUT from practice mode (user prefers manual tempo control)
- Beat step/nudge button for manual click-to-track alignment
- Role-based song forms: Nathan sees metronome settings, others see simplified
- Lyrics + chords on Song (stage prompter for all members)
- Web stage prompter = read-only, no audio (C++ engine is native-only)
- Lyrics/chords display = static prompter, NOT auto-scrolling karaoke (D-122). Content is reference material (key, chords, structure, fill notes) — glanced at between sections, not followed line-by-line.
- ClickTrack evolves separately into sticking/rudiment practice app
- Full feature parity for management features (invoicing, quotes, calendar)
- Supabase replaces SQLite for ALL data
- Collapsible drawer navigation on BOTH apps (not tabs)
- API keys: publishable + secret — legacy JWT keys disabled

---

## Completed Sprints (Summary)

| Sprint | Focus | Date |
|--------|-------|------|
| S1-S3 | Audit, critical fixes, SOT redesign, docs, CI/CD | 2026-03-04 |
| S4-S6 | Public website (3 phases): profiles, public site, media/contact | 2026-03-04 |
| S7-S8 | Code dedup, validation, CSS extraction, ViewContext, error boundaries | 2026-03-04 |
| S9 | HTML mockups (design target) | 2026-03-04 |
| S10 | Supabase invoicing schema + migration | 2026-03-04 |
| S11 | Native SQLite -> Supabase swap | 2026-03-04 |
| S12 | Shared PDF templates (28 styles) | 2026-03-04 |
| S13 | Web invoicing (6 components, 2 hooks) | 2026-03-04 |
| S14 | Dashboard + export + invoice polish | 2026-03-04 |
| S15 | Quote system backend (6 tables, 16 templates) | 2026-03-04 |
| S16 | Web quote wizard + service catalogue UI | 2026-03-04 |
| S17 | Web quote lifecycle + formal invoicing | 2026-03-04 |
| S18 | Native quote UI parity | 2026-03-04 |
| S19 | Navigation + design unification (drawer on both) | 2026-03-04 |
| S19+ | Calendar restyle + filter dropdowns + parity | 2026-03-05 |
| S20 | Logo, animated splash, skeleton loaders, app icons | 2026-03-05 |
| S21 | APK build fix + device testing + layout parity | 2026-03-05 |
| S22 | Native visual overhaul — pixel-perfect match webapp | 2026-03-05 |
| S23A-D | Venue/client restructure (4 sprints: DB, UI, gig flow, quote/invoice chain) | 2026-03-05 |
| S24A-B | Bill-to flexibility (schema + UI, both apps) | 2026-03-05 |
| S25A | Songs & Setlists: schema + types + queries + storage | 2026-03-06 |
| S25B+C | Songs & Setlists UI (both apps) + setlist PDF sharing | 2026-03-06 |
| -- | Gig list visibility toggle + 12hr AM/PM format + back nav fix | 2026-03-06 |
| -- | Big-picture realignment: S26-S28 roadmap confirmed | 2026-03-06 |
| S26A | Audio Engine Foundation: Expo Module + C++ + schema + role-based forms | 2026-03-06 |
| S26B-C | Live Mode UI + Track Player Engine (C++) | 2026-03-07 |
| S27A-C | Practice Mode UI + tools + Web Stage Prompter | 2026-03-07 |
| S28B-D | N-channel mixer, waveform, stem loading, beat-locked alignment | 2026-03-08 |
| S29A | Compose CalendarScreen with real Supabase data | 2026-03-08 |
| S30A-C | Beat alignment overhaul + detection research (madmom chosen) | 2026-03-08 |
| S31A-B | Server-side madmom beat detection — Cloud Run deploy + e2e test | 2026-03-08 |
| S32A | Automated stem separation — Demucs on Cloud Run via Cloud Tasks | 2026-03-09 |
| S32B/C | Testing + polish — all songs processed, re-process verified, APK rebuilt | 2026-03-09 |
| S33 | Songs/Setlists/Live/Practice planning — schema, mockups, architecture decisions | 2026-03-09 |
| S34 | Migration + types + queries (song categories, setlist types, player prefs) | 2026-03-09 |
| S35 | Android Library refactor + player refactor (filter pills, queue overlay, set complete) | 2026-03-09 |
| S36 | Web audio engine + Library redesign + Player UI (AudioEngine, ClickScheduler, TrackPlayer, StemMixer) | 2026-03-09 |
| S37 | Web player polish (wake lock, waveform, player prefs, set complete, beat glow) | 2026-03-09 |
| S38 | Visual Unification — Android tokens corrected, both players rebuilt to V4 target design | 2026-03-10 |
| S39 | Foundation — Migration (categories, sharing, is_best_take, RLS), shared types/queries, Cloud Run beats-only | 2026-03-10 |
| S40 | Library + SongForm (Both) — Dropdowns, categories, sharing UI, ownership, read-only on web + Android | 2026-03-10 |
| S41 | Recording + Takes (Both) — Recording flow, takes list, post-recording, new song idea on web + Android | 2026-03-10 |
| S42 | View Mode (Both) — 3rd player tab (Live/Practice/View), local video hero + visualiser fallback, record from View | 2026-03-10 |

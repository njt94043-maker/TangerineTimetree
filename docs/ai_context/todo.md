# TGT — Todo

> Current tasks, priorities, and backlog.
> Update after every task completion. See STATUS.md for instant context.

---

## CRITICAL BUGS — Must Fix Before Cosmetics

### Track Loading Broken — Both Platforms (D-165)
- [ ] **Android: Add `nativeResetTrack()` JNI binding** — expose C++ `TrackPlayer::reset()` to Kotlin
- [ ] **Android: `selectSong()` must auto-load track** — stop playback → reset old track/stems → download & load new song's track + stems. No manual "Load Track" step.
- [ ] **Android: `nextSong()`/`prevSong()` must trigger full track swap** — same stop→reset→load cycle
- [ ] **Web: Verify same auto-load/release behaviour** — web TrackPlayer must release old track when song changes (D-164: both platforms)

### Player Not Persistent — Both Platforms (D-166)
- [ ] **Android: Player survives navigation** — navigating to Library/Calendar/Settings must NOT destroy player state. Back button or re-entering player restores song, position, mode.
- [ ] **Android: Clean up C++ engine on explicit close only** — track should only be released when user explicitly exits the player session (e.g. "End Session"), not on navigation
- [ ] **Web: Verify player persistence** — same behaviour expected (D-164: both platforms)

### Android Library — Header Gap Bug
- [ ] **Fix gap between header ("Library" / "New Idea") and Songs/Setlists tabs**

---

## Immediate Actions — S45 Screen-for-Screen Lockdown

### Web — Library — REBUILD to match Android (D-163)
> **NOTE: Previous Web Library tasks are INVALID.** Web Library must be rebuilt to match Android's layout (NeuCard cards, big BPM right-aligned, badges inline, tap-to-expand with Live/Practice/View buttons). Not a refinement of the current web layout.

### Web — Calendar
> **Web calendar IS the benchmark.** Android matches web, not the other way around. No changes needed.

### Web — Library (D-163: match Android) — DONE (S47)
- [x] Rebuild song cards: NeuCard + left accent border (teal/orange) + big BPM right-aligned
- [x] Badges inline: scope (TGT/Personal) + type (Cover/Original) + key + time sig + duration + TRACK
- [x] Tap-to-expand card → reveal Live/Practice/View launch buttons + Edit
- [x] Filter dropdowns with labels above (Scope / Type) — already had these
- [x] Setlists: tap-to-expand with Live/Practice/View + Edit buttons, left accent border
- [x] Tab bar accent colours (teal for Songs, orange for Setlists)

### Web — Player — BLOCKED (Vercel deploy failing)
- [x] Live transport: nav row (prev song / queue / next song) — DONE (S45)
- [x] Queue overlay with 3 tabs (Queue/Songs/Setlists) — DONE (S45)
- [x] Glow toggle (card=default, fullscreen=experimental) — DONE (S45)
- [x] Wire up settings pills — DONE (S45)
- [x] Vis button label already "Spectrum" — verified
- [x] Text panel max-height 200→120px — DONE (S47)
- [x] Practice transport: speed + A-B loop layout already correct — verified
- [x] Waveform strip height 56→72px — DONE (S47)
- [x] Fullscreen gap fixed (margin-top + padding zeroed) — DONE (S47)
- [x] Empty text panel hidden when no content — DONE (S47)
- [x] Safe-area insets (top/bottom) — DONE (S47)
- [x] Menu ☰ + Close ✕ buttons in header (D-166) — DONE (S47)
- [x] Side drawer available in player view — DONE (S47)
- [x] Live BPM adjustment (-5/+5) with safety modal — DONE (S47)
- [x] Queue reorder arrows (D-115) — DONE (S47)
- [x] Always-active queue (D-168) — no standalone mode — DONE (S47)
- [x] Queue overlay fullscreen + teal theme — DONE (S47)
- [x] Songs tab rebuilds queue on pick (D-168) — DONE (S47)
- [x] **BLOCKER: Fix Vercel deploy failure** — FIXED (S48). Unused `getSong` import + `setStandaloneSong` setter caused TS6133. All S47 changes now live.

### Web — Settings (match mockup screen 17)
- [ ] Add Account section
- [ ] Add Audio Engine status section
- [ ] Add About section
- [ ] Fix form structure classes

### Android — Library (match mockup screens 5-6)
- [ ] Filter pills → dropdowns (D-128)
- [ ] Queue items: NeuCard → flat rows

### Android — Player (match mockups/player-live.html + mockups/practice-redesign.html)
- [x] Live transport: nav row (prev song / queue / next song) — DONE (S45)
- [x] Queue overlay with 3 tabs (Queue/Songs/Setlists) — DONE (S45)
- [x] Browse Songs button when no setlist active — DONE (S45)
- [x] Glow toggle (card=default, fullscreen=experimental) — DONE (S45)
- [ ] Add "Burst" option to vis switcher
- [ ] Practice transport: top row = speed (-5/100%/+5) left + A-B loop (A/B/Clear) right
- [ ] Practice: waveform strip with loop region + playhead
- [x] Mixer rebuilt: wider channels (44dp), taller faders (80dp), draggable gain, mute toggles
- [ ] Web mixer: wire track mute onClick, add draggable faders (parity with Android)
- [ ] Verify between-songs screen completeness

### Android — Settings + Calendar
- [ ] Verify display prefs not duplicated in Settings (should be drawer-only per D-118)
- [ ] Verify calendar cell shadows match mockup

### Existing Backlog
- [ ] **S31C: On-device testing** — Test Android practice with server beat maps + stems, verify BTrack offline fallback (airplane mode), test web UI visually at thegreentangerine.com.
- [ ] Add more songs via web app (currently only 3: Sultans, Cissy Strut, War Pigs)
- [ ] User to verify 44 WhatsApp-confirmed fees, then batch-update

## Capture — Alignment + Pipeline (OVERDUE)

### Capture Category Alignment (S43 — DONE)
- [x] **Add `category` column** to tracks SQLite schema + migration
- [x] **Backend**: TrackUpdate model, list_tracks filter, ID3 tagger (TXXX:CATEGORY)
- [x] **UI**: Category dropdown in TrackDetail, badge on TrackCard, filter in TrackList
- [x] **Theme**: Teal (#1abc9c) + purple (#bb86fc) in theme.css

### Import Pipeline (S44 — DONE except bulk)
- [x] **Song import workflow** — Web ImportPanel: browse Capture tracks (localhost:9123), map metadata to Supabase Song, upload MP3 to practice-tracks, trigger Cloud Run /process, mark imported in Capture (song_id FK).
- [ ] **Bulk import UX** — Multiple recordings → batch import with metadata entry. Queue processing for each.
- [ ] **Capture history view** — Show previous recordings in sidepanel with play/review/import/delete actions.

### Capture Diagnostics (flakey but functional)
- [ ] **Real-world audio quality test** — Play a full song while recording. Listen for micro-pauses/glitches. Validates writer thread + priority boost.
- [ ] **Armed mode end-to-end test** — Start armed, play audio, verify auto-trigger + pre-roll.
- [ ] **FFmpeg encoding audit** — Check quality settings (bitrate, sample rate).
- [ ] **Concurrent load test** — Record while Chrome plays YouTube + other apps active.

### Extension UX Improvements
- [ ] **Level meter visualization** — Current peak_level is a number. Add visual meter bar (green→yellow→red) in sidepanel during armed/recording states.
- [ ] **Recording timer format** — Show MM:SS format instead of raw seconds for longer recordings.
- [ ] **Error handling UI** — Surface WASAPI errors (device not found, stream open failed) in sidepanel with user-friendly messages and retry button.
- [ ] **Device selector** — Allow choosing which WASAPI loopback device to capture from (currently auto-detects default speakers).

### Backend Robustness
- [ ] **Graceful shutdown** — Handle uvicorn reload while recording is active (currently crashes the session). Save partial WAV, clean up state.
- [ ] **Session recovery** — If backend restarts mid-recording, detect orphaned WAV files and offer recovery in the sidepanel.
- [ ] **Logging** — Add structured logging to wasapi_capture.py (writer thread stats: frames written, queue depth, dropped frames count). Surface in /api/admin/logs.

## Cloud Run + Processing (S43 — DONE except Android)
- [x] **Deploy beats-only + re-analyse** — revision beat-analysis-00009-th7
- [x] **Web: skip_stems param** — triggerProcessing() now passes skip_stems flag
- [x] **Re-analyse endpoint** (D-151) — POST /re-analyse, clears beat_map, enqueues beats-only task
- [x] **Web: Re-analyse button** — SongForm now has "Re-analyse Beats" + "Full Re-process" buttons
- [x] **Android: SongForm** — SongFormScreen.kt: full edit form (name, artist, category, BPM, key, time sig, subdivision, swing, count-in, notes, lyrics, chords, drum notation). Edit button in LibraryScreen SongCard. Navigation wired in GigBooksApp.
- [x] **Android: triggerProcessing** — Cloud Run /process trigger from SongForm (skip_stems=true)
- [x] **Android: Re-analyse** — Cloud Run /re-analyse trigger from SongForm

## SOT Doc Gaps (found S43)
- [x] **IMPACT_MAP**: Added Capture, Import Pipeline, ClickTrack sections
- [x] **CLAUDE.md**: Added ClickTrack to app list, updated App Scope Split with ClickTrack column + category fields, added cross-app rules
- [x] **decisions_log.md**: Added D-154 through D-158
- [x] **gotchas.md**: Added Capture dismissal + big picture loss entries
- [x] **Memory**: Rewritten MEMORY.md + new ecosystem-rules.md

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
- [ ] **Library-as-queue** — Play all songs (or filtered subset) as a queue without needing a setlist. Significant add — separate sprint item. Both platforms.
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
| S43 | Capture Alignment + Cloud Run — category field (schema+backend+UI+theme), /re-analyse endpoint, Cloud Run deploy (rev 00009), web skip_stems + re-analyse buttons | 2026-03-10 |
| S44 | Import Pipeline + Android SongForm — Web ImportPanel (Capture→Supabase→Cloud Run), Android SongFormScreen (full edit + processing triggers), LibraryScreen Edit button | 2026-03-10 |

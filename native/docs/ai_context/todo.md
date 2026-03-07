# TGT — Todo

> Current tasks, priorities, and backlog.
> Update after every task completion. See STATUS.md for instant context.

---

## Immediate Actions
- [x] **Big-picture realignment** — DONE. Port C++ from ClickTrack, single Oboe stream, aubio beat detection, SoundTouch time-stretch. Role-based song forms. Web stage prompter.
- [x] **S26A: Audio Engine Foundation** — Expo Native Module + C++/Oboe metronome + mixer from ClickTrack. Schema migration (lyrics, chords, beat_offset_ms). Role-based song edit form.
- [ ] Sideload APK to Samsung device (103MB built 2026-03-06)
- [ ] User to verify 44 WhatsApp-confirmed fees, then batch-update

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
- [ ] **BLOCKER**: C++ build verification needed — `npx expo prebuild --clean` + `gradlew assembleDebug`

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
- [ ] **BLOCKER**: C++ build verification needed — prebuild + assembleDebug

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

### S27B — Practice Tools (native)
- [ ] Tap tempo: measure intervals, set BPM, save to song
- [ ] Save all current settings back to Song in Supabase (one button)
- [ ] Song notes display in practice view

### S27C — Web Stage Prompter
- [ ] Read-only setlist display with song details
- [ ] Lyrics display (scrolling or paged)
- [ ] Chords display (inline with lyrics or separate)
- [ ] Song info: name, artist, BPM, key, time sig
- [ ] Setlist navigation (prev/next)
- [ ] Full-screen mode for tablet on music stand
- [ ] No audio — display only

### S28+ — Recording/Video (defer)
- [ ] Front camera recording while practicing
- [ ] Spec properly when S27 complete

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

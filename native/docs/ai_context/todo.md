# TGT — Todo

> Current tasks, priorities, and backlog.
> Update after every task completion. See STATUS.md for instant context.

---

## Immediate Actions
- [x] **Big-picture realignment** — DONE. Port C++ from ClickTrack, single Oboe stream, aubio beat detection, SoundTouch time-stretch. Role-based song forms. Web stage prompter.
- [ ] **S26A: Audio Engine Foundation** — Expo Native Module + C++/Oboe metronome + mixer from ClickTrack. Schema migration (lyrics, chords, beat_offset_ms). Role-based song edit form.
- [ ] Sideload APK to Samsung device (103MB built 2026-03-06)
- [ ] User to verify 44 WhatsApp-confirmed fees, then batch-update

## Backlog — Performance & Practice Epic

### S26A — Audio Engine Foundation (NEXT)
- [ ] Prove Expo Module + C++ + Oboe with "hello beep" test
- [ ] Port metronome.h/cpp from ClickTrack (strip to essentials)
- [ ] Port mixer.h/cpp from ClickTrack
- [ ] Port wav_loader.h/cpp from ClickTrack
- [ ] Write stripped audio_engine.h/cpp (metronome + mixer only)
- [ ] Write Expo Native Module (Kotlin + JNI bridge)
- [ ] JS API: startEngine, stopEngine, setBpm, setTimeSignature, setSubdivision, setSwing, setAccentPattern, setClickSound, setCountIn, startClick, stopClick, getCurrentBeat, getCurrentBar
- [ ] loadSong(song) — configures engine from Song fields
- [ ] Supabase migration: ALTER songs ADD lyrics TEXT, chords TEXT, beat_offset_ms INTEGER
- [ ] Update shared types (Song: lyrics, chords, beat_offset_ms)
- [ ] Update shared queries (song CRUD with new fields)
- [ ] Role-based song edit form: Nathan sees metronome settings, others see simplified form
- [ ] Both tsc clean

### S26B — Live Mode UI (native)
- [ ] Full-screen stage view — dark, high-contrast, stage-readable
- [ ] Load setlist, navigate songs, engine auto-reconfigures
- [ ] Song metadata: name, BPM, key, time sig, notes
- [ ] Beat visualization (LED dots with downbeat accent)
- [ ] Transport: play/stop
- [ ] Swing slider with snap-to-middle
- [ ] Song position indicator (3 of 12)
- [ ] Wake lock (screen stays on)

### S26C — Track Player Engine (native, C++)
- [ ] MP3 decode: Kotlin MediaCodec -> PCM -> JNI -> C++ track_player
- [ ] track_player.h/cpp — plays PCM through same Oboe stream as metronome
- [ ] aubio integration — auto-detect BPM + beat positions from PCM
- [ ] SoundTouch integration — pitch-preserved time-stretch
- [ ] A-B loop: set start/end frames, region looping
- [ ] Speed control: one slider adjusts SoundTouch rate + metronome BPM together
- [ ] Position reporting to JS (current frame / total frames)
- [ ] Beat step/nudge — realign click to track (shift metronome phase)
- [ ] Mixer: click channel 0, track channel 1, master gain
- [ ] Auto-populate Song.bpm and beat_offset_ms from analysis

### S27A — Practice Mode UI (native)
- [ ] Practice screen — select song with attached MP3
- [ ] Waveform or progress bar
- [ ] Speed slider (50%-150%, pitch preserved)
- [ ] A-B loop marker setting
- [ ] Click volume + track volume sliders
- [ ] Count-in before playback
- [ ] Beat step/nudge button
- [ ] BPM display updates with speed changes

### S27B — Practice Tools (native)
- [ ] Speed trainer: auto-increment BPM every N bars (already in metronome.cpp)
- [ ] Tap tempo: measure intervals, set BPM, save to song
- [ ] Muted bars mode (already in metronome.cpp)
- [ ] Save all settings back to song in Supabase

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

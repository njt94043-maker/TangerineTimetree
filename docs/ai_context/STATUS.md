# TGT — Status (Instant Context)

> Single source of "where are we right now". Read this FIRST every session.
> Updated at end of every session. Keep under 60 lines.

---

## Current State
- **Phase**: S47 — Web parity. Library rebuilt, Player polished.
- **What works**: Web (full, V4 player + **rebuilt Library** matching Android layout — NeuCard cards, left accent border, big BPM, tap-to-expand launch buttons, key/time sig/duration/TRACK badges + sharing + recording + takes + View Mode + re-analyse + import from Capture), Android (full, V4 player with queue tabs + glow toggle + generalized queue + player persistence + auto-save beat analysis + close button + Now Playing drawer item, Library + SongForm + recording + takes + View Mode + processing triggers + splash + aligned calendar/library), Cloud Run (beats + stems + CORS + skip_stems + re-analyse endpoint, revision beat-analysis-00009-th7), Capture (category field + badges with teal/orange parity + filter + theme).
- **Last session (S49)**: Android mixer + mode dropdown + LiveScreen visual fill fix.
  1. **Android mode dropdown pill**: Replaced 3 small tab buttons with a dropdown pill (tap to open, shows Live/Practice/View). Matches web's pill-style mode switcher.
  2. **Android draggable mixer faders**: Mixer tracks now wider (44dp), taller (80dp), with vertical drag gesture for gain control. Mute state dims the fill bar.
  3. **Android track/stem mute toggles**: Added `isTrackMuted`, `stemMutes` state + `toggleTrackMute()`, `toggleStemMute()` in AppViewModel. Muting silences channel (gain→0) while preserving stored gain.
  4. **LiveScreen visual fill fix**: When no text content (no chords/lyrics/notes/drums), the visual hero now fills the full screen (Modifier.weight(1f)) instead of being capped at 180.dp. Matches PracticeScreen/ViewScreen behaviour.
  5. **Benchmarks captured**: Screenshots saved for all 3 modes (Live, Practice, View) in their perfected state.
- **Next action**: Port mixer interactivity to web (track mute handler, draggable faders). Then: Web Settings sections, Android Library dropdowns (D-128), Burst vis option. Full cross-platform parity audit.
- **Seed status**: 117 gigs (114 linked to venue_id) + 62 away dates. 29 clients, 65 venues. 4 songs.
- **Band roles**: All 4 profiles populated (Nathan=Drums, Neil=Bass, James=Lead Vocals, Adam=Guitar & Backing Vocals)

## Sprint Roadmap (S38–S44+Audit) — Revised for Full Ecosystem
| Sprint | Scope | Status |
|--------|-------|--------|
| S38 | **Visual Unification** — tokens + both player rebuilds to V4 | **Done** |
| S39 | **Foundation** — migration + shared types/queries + Cloud Run beats-only code | **Done** |
| S40 | **Library + SongForm (Both)** — dropdowns, categories, sharing | **Done** |
| S41 | **Recording + Takes (Both)** — recording flow, takes list, post-recording | **Done** |
| S42 | **View Mode (Both)** — 3rd player tab on both platforms | **Done** |
| S43 | **Capture Alignment + Cloud Run** — Capture category field, Cloud Run deploy (beats-only + re-analyse), web skip_stems/re-analyse | **Done** |
| S44 | **Import Pipeline + Android SongForm** — Capture→Web import, Android song editing + processing triggers | **Done** |
| Audit | Cross-platform + cross-app surgical audit (ALL 3 apps) before user testing | **Done** |

## Gaps Remaining (S45 Audit)

### Web — Calendar
> Web calendar IS the benchmark. No changes needed.

### Web — Library — DONE (S47)
> Rebuilt to match Android. NeuCard cards, left accent border, big BPM, tap-to-expand, full badge set.

### Web — Player — DONE (S47, deployed S48)
> Fullscreen gap fixed. Menu+Close buttons. Live BPM. Queue reorder. Always-active queue. Queue overlay fullscreen. Vercel deploy fixed (S48) — all changes now live.

### Web — Settings
- Missing Account section, Audio Engine status, About section
- Wrong form structure classes

### Android — Library
- Filter pills must become dropdowns (D-128)
- Queue NeuCard→flat rows

### Android — Player
- Vis switcher missing "Burst" option
- Mixer needs colour/size verification
- Between-songs screen may be incomplete

### Android — Settings
- Verify display prefs not duplicated (should be drawer-only per D-118)

### Android — Calendar
- Cell shadows need verification

### Other
- **Capture diagnostics**: Flakey but functional — needs real-world testing
- **Bulk import**: Single-track import only. No batch import yet.
- **Android signing**: Release keystore missing — debug APK only.

## Big Picture
- **Vision**: 3 live apps + 1 future, all one family (D-156). Same theme, shared metadata. Each app takes what it needs.
- **Pipeline**: Capture (entry point) → Web (import + manage) → Cloud Run (process) → Both apps (consume). Future: Capture → ClickTrack (practice tracks).
- **Architecture**: Monorepo (`shared/` + `web/` + `android/` + `capture/` + `native/` [shelved])
- **ClickTrack**: Future personal practice app. Not built yet but considered now (D-155). Capture's practice_category/instrument_focus/difficulty are ClickTrack-bound.

## What's Deployed
- **Web**: thegreentangerine.com (Vercel, auto-deploys from master)
- **Android**: Compose debug APK on Samsung RFCW113WZRM (2026-03-11)
- **Supabase**: jlufqgslgjowfaqmqlds.supabase.co (26 tables, 4 storage buckets)
- **Cloud Run**: beat-analysis service — revision beat-analysis-00009-th7 (S43: beats-only + re-analyse deployed)
- **Capture**: localhost:5174 (UI) + localhost:9123 (backend). Flakey but functional.

## Session Protocol (Quick Reference)
**Start**: Read STATUS.md → IMPACT_MAP.md → todo.md → SPRINT_PROMPTS.md (for current sprint)
**End**: Update STATUS.md → todo.md → SESSION_LOG.md → gotchas.md → decisions_log.md → IMPACT_MAP.md → schema_map.md. Provide next sprint prompt.
**EVERY CHANGE**: Ask "what else does this affect?" across ALL apps (D-156).

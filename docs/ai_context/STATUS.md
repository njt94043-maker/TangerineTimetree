# TGT — Status (Instant Context)

> Single source of "where are we right now". Read this FIRST every session.
> Updated at end of every session. Keep under 60 lines.

---

## Current State
- **Phase**: S50 — Cross-platform parity. Mixer interactive on both, vis switcher wired.
- **What works**: Web (full, V4 player + **interactive mixer** with draggable faders + mute dim + rebuilt Library with bigger action buttons + matching Android layout), Android (full, V4 player with **3 vis modes** Spectrum/Rings/Burst + interactive mixer + queue tabs + glow toggle + generalized queue + player persistence + auto-save beat analysis + close button + Now Playing drawer item + Library dropdowns), Cloud Run (beats + stems + CORS + skip_stems + re-analyse endpoint, revision beat-analysis-00009-th7), Capture (category field + badges with teal/orange parity + filter + theme).
- **Last session (S50)**: Web mixer parity + Android vis switcher + Library button upgrade.
  1. **Web mixer interactive**: Draggable faders (pointer events), wider channels (50px), taller faders (80px). Mute dims fill to 15% opacity, value text to 40%. Added setClickGain/setTrackGain/toggleTrackMute to hook.
  2. **Android vis switcher**: VisType enum (Spectrum/Rings/Burst) wired to state. Rings = concentric pulsing circles. Burst = radial expanding rings with center flash. Buttons now clickable.
  3. **Web Library buttons**: New Song/New Idea/Import upgraded from 32px icon buttons to 36px labeled action buttons with accent colours.
  4. **D-165/D-166 confirmed fixed**: Track loading and player persistence both working — marked done.
  5. **Web Settings + Android Library dropdowns**: Already implemented in prior sessions, confirmed and marked done.
- **Next action**: Android Library header gap bug. Between-songs screen completeness check. Full cross-platform parity audit. Android APK on phone (deployed S50).
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

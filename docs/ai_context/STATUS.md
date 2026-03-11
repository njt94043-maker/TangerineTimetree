# TGT — Status (Instant Context)

> Single source of "where are we right now". Read this FIRST every session.
> Updated at end of every session. Keep under 60 lines.

---

## Current State
- **Phase**: S46 — Stabilization. Critical bugs fixed. Player persistence + queue + auto-save.
- **What works**: Web (full, V4 player with queue tabs + glow toggle + browse songs, Library + sharing + recording + takes + View Mode + re-analyse + import from Capture), Android (full, V4 player with queue tabs + glow toggle + generalized queue + player persistence + auto-save beat analysis + close button + Now Playing drawer item, Library + SongForm + recording + takes + View Mode + processing triggers + splash + aligned calendar/library), Cloud Run (beats + stems + CORS + skip_stems + re-analyse endpoint, revision beat-analysis-00009-th7), Capture (category field + badges with teal/orange parity + filter + theme).
- **Last session (S46)**: Stabilization sprint — fix everything before new features:
  1. **System bar padding**: Replaced hardcoded/per-screen `statusBarsPadding()` with single `systemBarsPadding()` on NavHost. All 7 screens cleaned up. Gap above headers FIXED.
  2. **Android 12+ splash**: Added `values-v31/themes.xml` with dark splash background. No more white flash.
  3. **D-165 Track auto-load/release**: Added `resetTrack()` through C++→JNI→Kotlin chain. `selectSong()` now stops old track, resets engine, auto-loads new song's audio.
  4. **D-167 Auto-save beat analysis**: Analysis results saved to Supabase automatically on completion. No manual "Save" banner tap needed.
  5. **D-168 Queue = source list**: Generalized queue system. Selecting a song from any list (filtered songs, setlist) makes that list the queue for next/prev navigation. Queue overlay Songs/Setlists tabs update the queue on selection.
  6. **D-166 Player persistence**: Auth flicker protection (wasAuthenticated flag), splash skip on resume (splashDone in ViewModel), "Now Playing" drawer item to return to active player.
  7. **Close button**: X button on player header ends session (stops engine, clears state, navigates to Library). Menu hamburger button preserved alongside for drawer access.
  8. **Builds**: Android assembleDebug SUCCESSFUL.
- **Next action**: Web parity for D-165/D-166/D-167/D-168. Remaining cosmetic gaps (see todo.md). Full cross-platform parity audit.
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
- Cell min-height 48→44px, border-radius 6→4px, font-size 14→11px
- Day-num 13→11px, day-header 11→10px
- Today button: 10→12px font, 3px 14px→4px 10px padding, 10→8px radius, add background fill
- Cell background using wrong token

### Web — Library
- Missing filter labels above dropdowns
- Badges wrong structure (combined vs separate scope+type)
- Missing Cover/Original type badges
- Owner tag wrong styling
- Setlists using pills instead of dropdown
- Setlists missing type badge on cards
- Setlists missing song count + duration
- Setlists missing conditional action buttons

### Web — Player
- Vis button "Bars"→"Spectrum"
- Text panel 200→120px max-height
- Live transport: duplicate stop / missing restart
- Practice speed: 4→2 buttons
- A-B loop button placement
- Settings pills non-functional

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
- **Android**: Compose debug APK on Samsung RFCW113WZRM (2026-03-08)
- **Supabase**: jlufqgslgjowfaqmqlds.supabase.co (26 tables, 4 storage buckets)
- **Cloud Run**: beat-analysis service — revision beat-analysis-00009-th7 (S43: beats-only + re-analyse deployed)
- **Capture**: localhost:5174 (UI) + localhost:9123 (backend). Flakey but functional.

## Session Protocol (Quick Reference)
**Start**: Read STATUS.md → IMPACT_MAP.md → todo.md → SPRINT_PROMPTS.md (for current sprint)
**End**: Update STATUS.md → todo.md → SESSION_LOG.md → gotchas.md → decisions_log.md → IMPACT_MAP.md → schema_map.md. Provide next sprint prompt.
**EVERY CHANGE**: Ask "what else does this affect?" across ALL apps (D-156).

# TGT — Status (Instant Context)

> Single source of "where are we right now". Read this FIRST every session.
> Updated at end of every session. Keep under 60 lines.

---

## Current State
- **Phase**: S45 — Player audit fixes COMPLETE. Glow toggle + queue tabs done on both platforms.
- **What works**: Web (full, V4 player with queue tabs + glow toggle + browse songs, Library + sharing + recording + takes + View Mode + re-analyse + import from Capture), Android (full, V4 player with queue tabs + glow toggle + browse songs, Library + SongForm + recording + takes + View Mode + processing triggers + splash + aligned calendar/library), Cloud Run (beats + stems + CORS + skip_stems + re-analyse endpoint, revision beat-analysis-00009-th7), Capture (category field + badges with teal/orange parity + filter + theme).
- **Last session (S45 cont.)**: Completed player audit fixes across both platforms:
  1. **Transport**: ONLY ⏮ Restart | ▶ Play | ■ Stop (all modes, both platforms) — verified
  2. **Mixer paradigm**: Every sound source gets own mixer channel/fader (CLK, TRK, DRM, BAS, VOX) in bottom drawer — verified
  3. **Glow toggle**: Card-level beat glow = locked default (VisualHero). Fullscreen edge glow = experimental opt-in toggle in drawer DISPLAY section. Added to all 3 Android screens + web Player.tsx.
  4. **Queue tabs**: 3-tab overlay (Queue/Songs/Setlists) on both platforms. Queue = current setlist songs, Songs = all songs browse, Setlists = all setlists browse. Works with or without active setlist.
  5. **Browse Songs button**: Nav row shows "Browse Songs" when no setlist active (all modes, both platforms).
  6. **Settings pills**: Wired up in web drawer (already done previous session).
  7. **Mode switching**: Web already had onSwitchMode wired. Android has it via NavController.
  8. **Builds**: Android assembleDebug SUCCESSFUL. Web tsc -b clean.
- **Next action**: Remaining S45 calendar/library/settings cosmetic gaps (see todo.md). Library-as-queue (playing filtered songs) deferred as separate sprint item.
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

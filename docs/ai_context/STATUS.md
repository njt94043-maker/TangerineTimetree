# TGT — Status (Instant Context)

> Single source of "where are we right now". Read this FIRST every session.
> Updated at end of every session. Keep under 60 lines.

---

## Current State
- **Phase**: S51 — Bug fixes + stabilisation. User testing feedback.
- **What works**: Web (full, V4 player + interactive mixer confirmed working + rebuilt Library + matching Android layout), Android (full, V4 player with 3 vis modes + interactive mixer + queue tabs + glow toggle + generalized queue + player persistence + auto-save beat analysis + close button + Now Playing drawer item + Library dropdowns), Cloud Run (beats + stems + CORS + skip_stems + re-analyse endpoint, revision beat-analysis-00009-th7), Capture (category field + badges with teal/orange parity + filter + theme).
- **Last session (S50)**: Web mixer parity + Android vis switcher + Library button upgrade.
- **User testing feedback (S51)**:
  1. **Web mixer**: Works as intended (confirmed by Nathan)
  2. **Click alignment**: Still falls out of sync on web (APK is fine)
  3. **APK mixer bug**: Stem faders don't control the correct stems. Track fader should control master volume of all stems or not exist.
  4. **Visualisers**: Neither app's visualisers function correctly
  5. **PC webapp import**: Doesn't connect to TGT Capture (localhost:9123) — possible Windows permissions blocking. Nathan has allowed all permissions, testing if that fixes it.
  6. **Windows PWA**: Webapp installed on PC may have restricted permissions vs Chrome browser
- **Next action**: Deploy APK to device for testing. User to verify all 4 fixes. Then remaining parity items.
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

## Completed (S45 Audit → S50)
> Web Calendar (benchmark), Web Library (S47), Web Player (S47/S48), Web Settings (done), Android Library dropdowns (S50), Android header gap (fixed), Android vis switcher (S50), Android mixer rebuilt (S49/S50), Track loading + player persistence (D-165/D-166 confirmed).

## S51 Bug Fixes (All 4 addressed — PENDING USER TESTING)

### APK stem mixer — PENDING TESTING
- Root cause: C++ engine rendered both trackPlayer_ (ch1) AND stemPlayers_ (ch2+) simultaneously, doubling audio. Fix: mute ch1 gain when stems are loaded, hide TRK fader in PracticeScreen when stems present.

### Web click alignment — PENDING TESTING
- Root cause: 3 compounding issues — SoundTouchJS sourcePosition lag, setInterval jitter, beat map intervals not rescaled with speed changes. Fix: speed-scaled beat map intervals + periodic resync from track position with 30ms drift threshold.

### Visualisers (both platforms) — PENDING TESTING
- Root cause: Both platforms used hardcoded static bar heights with no real audio data. Fix: Web — AnalyserNode (fftSize=64) + FFT data driving bars. Android — RMS band energies computed in audio callback with smoothing, polled via JNI.

### PC webapp → Capture import — PENDING TESTING
- Root cause: Mixed content (HTTPS→HTTP) + CORS origin gaps. Fix: Capture server now binds 0.0.0.0 (was 127.0.0.1), added missing CORS origins, ImportPanel now tries both localhost and 127.0.0.1 as fallback with improved error message.

### Remaining Items
- [ ] Queue items: NeuCard → flat rows (Android)
- [ ] Between-songs screen completeness check
- [ ] Android Settings: verify display prefs not duplicated (D-118)
- [ ] Android Calendar: cell shadows verification
- **Bulk import**: Single-track only. No batch import yet.
- **Android signing**: Release keystore missing — debug APK only.

## Big Picture
- **Vision**: 3 live apps + 1 future, all one family (D-156). Same theme, shared metadata. Each app takes what it needs.
- **Pipeline**: Capture (entry point) → Web (import + manage) → Cloud Run (process) → Both apps (consume). Future: Capture → ClickTrack (practice tracks).
- **Architecture**: Monorepo (`shared/` + `web/` + `android/` + `capture/` + `native/` [shelved])
- **ClickTrack**: Future personal practice app. Not built yet but considered now (D-155). Capture's practice_category/instrument_focus/difficulty are ClickTrack-bound.

## What's Deployed
- **Web**: thegreentangerine.com (Vercel, auto-deploys from master)
- **Android**: Compose debug APK on Samsung RFCW113WZRM (2026-03-13)
- **Supabase**: jlufqgslgjowfaqmqlds.supabase.co (26 tables, 4 storage buckets)
- **Cloud Run**: beat-analysis service — revision beat-analysis-00009-th7 (S43: beats-only + re-analyse deployed)
- **Capture**: localhost:5174 (UI) + localhost:9123 (backend). Flakey but functional.

## Session Protocol (Quick Reference)
**Start**: Read STATUS.md → IMPACT_MAP.md → todo.md → SPRINT_PROMPTS.md (for current sprint)
**End**: Update STATUS.md → todo.md → SESSION_LOG.md → gotchas.md → decisions_log.md → IMPACT_MAP.md → schema_map.md. Provide next sprint prompt.
**EVERY CHANGE**: Ask "what else does this affect?" across ALL apps (D-156).

# TGT — Status (Instant Context)

> Single source of "where are we right now". Read this FIRST every session.
> Updated at end of every session. Keep under 60 lines.

---

## Current State
- **Phase**: Post-S44 Audit **DONE**. Ready for user testing.
- **What works**: Web (full, V4 player, Library + sharing + recording + takes + View Mode + re-analyse + import from Capture), Android (full, V4 player, Library + SongForm + recording + takes + View Mode + processing triggers), Cloud Run (beats + stems + CORS + skip_stems + re-analyse endpoint, revision beat-analysis-00009-th7), Capture (category field + badges with teal/orange parity + filter + theme).
- **Last session**: Post-S44 audit — tsc + vite build clean, assembleDebug clean, visual parity verified (3 apps), Capture badge fix (personal=orange), schema_map.md corrected (user_settings columns), RLS verified, edge cases reviewed, all features confirmed present.
- **Next action**: User testing handoff. Nathan tests all 3 apps end-to-end.
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

## Gaps Remaining (post-S44)
- **Capture diagnostics**: Flakey but functional — needs real-world testing (post-audit)
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

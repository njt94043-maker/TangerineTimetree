# TGT — Status (Instant Context)

> Single source of "where are we right now". Read this FIRST every session.
> Updated at end of every session. Keep under 60 lines.

---

## Current State
- **Phase**: S40 (Library + SongForm Both) COMPLETE. Dropdowns, categories, sharing, ownership UI on both platforms. Ready for S41.
- **What works**: Web (full, V4 player, Library dropdowns + sharing), Android (full, V4 player, Library dropdowns + owner tags), Cloud Run (beats + stems + CORS + beats-only skip_stems), Capture (built but untested end-to-end).
- **Last session**: S40 Library + SongForm — Web: Library.tsx rebuilt with two dropdowns (Scope: All/TGT/Mine/Shared; Type: All/Covers/Originals) replacing filter pills (D-128). Category badges (teal=TGT, orange=personal), owner name tags, lock icons on non-owned, Edit/Delete hidden for non-owned songs. SongForm.tsx: sharing section for personal_original (add/remove members), read-only mode for shared songs (all inputs disabled, banner). Android: Song.kt updated (tgt_* categories, canEdit(), SongShare model). LibraryScreen.kt rebuilt with FilterDropdown composables (Scope + Type), category badges, owner tags, lock icons. Profile.kt added. SongRepository sharing CRUD. AppViewModel loads profileNames + sharedSongIds. Both builds clean (tsc + vite build, assembleDebug).
- **Next action**: Sprint S41 — Recording + Takes on both platforms.
- **Seed status**: 117 gigs (114 linked to venue_id) + 62 away dates. 29 clients, 65 venues in Supabase. 4 songs (Cissy Strut, Sultans, War Pigs, Big Yellow Taxi).
- **Band roles**: All 4 profiles populated (Nathan=Drums, Neil=Bass, James=Lead Vocals, Adam=Guitar & Backing Vocals)

## Sprint Roadmap (S38–S43) — Revised for Cross-Platform Parity
| Sprint | Scope | Status |
|--------|-------|--------|
| S38 | **Visual Unification** — Android token correction (5 colors), both player rebuilds to V4 target design | **Done** |
| S39 | **Foundation** — Migration + shared types/queries + Cloud Run beats-only code | **Done** |
| S40 | **Library + SongForm (Both)** — Dropdowns, categories, sharing on web + Android together | **Done** |
| S41 | **Recording + Takes (Both)** — Recording flow, takes list, post-recording on web + Android together | **Next** |
| S42 | **View Mode (Both)** — View Mode + record from View Mode on web + Android together | Queued |
| S43 | **Cloud Run Deploy** — beats-only + re-analyse endpoints deployed + tested | Queued |
| Audit | Cross-platform surgical audit before user testing | After S43 |

## Key Design Artifacts
- **S39 Mockup**: `mockups/s39-categories-sharing-mockup.html` — 15 screens (categories/sharing/takes/recording)
- **S33 Mockups**: `mockups/player-live.html`, `practice-redesign.html`, `library-browser.html`, `player-queue.html` — last approved player designs
- **V4 Target**: `mockups/v4-mirror-target.html` — DONE: 17-screen unified design spec with canonical tokens + per-screen annotations
- **4-Way Comparison**: `mockups/four-way-comparison.html` — V1/V2/V3/V4 audit (Live, Practice, Queue)
- **Decisions**: D-124–D-153 in `decisions_log.md` — all locked
- **Sprint prompts**: `SPRINT_PROMPTS.md` — revised for cross-platform parity (S38-S43)
- **SOT docs**: `docs/ai_context/` (moved from `native/docs/ai_context/` — project-wide)

## Big Picture
- **Vision**: GigBooks (Android) = Nathan's stage + practice tool. Web = full band management + practice for all members. Mirror apps — full feature parity (D-153).
- **North star**: All 4 members have categories, sharing, recording, takes, View Mode on their platform. No testing until S39–S45 complete + audit passes.
- **Architecture**: Monorepo (`shared/` + `web/` + `android/` + `capture/` + `native/` [shelved])
- **Audio**: Android = C++ AudioEngine (Oboe + SoundTouch) via JNI. Web = Web Audio API + SoundTouchJS (S36).
- **Design**: Dark neumorphic — GigColors matching web CSS, Karla + JetBrains Mono.
- **Users**: Nathan (Android for stage, web for management), Neil/James/Adam (web only)

## What's Deployed
- **Web**: thegreentangerine.com (Vercel, auto-deploys from master)
- **Android**: Compose debug APK on Samsung RFCW113WZRM (2026-03-08)
- **Supabase**: jlufqgslgjowfaqmqlds.supabase.co (26 tables, 4 storage buckets)
- **Cloud Run**: beat-analysis service on GCP tangerine-time-tree (europe-west1)
- **Capture tool**: localhost:5174 (UI) + localhost:9123 (backend). Launch via start-silent.vbs or start.ps1.

## Session Protocol (Quick Reference)
**Start**: Read STATUS.md → IMPACT_MAP.md → todo.md → SPRINT_PROMPTS.md (for current sprint)
**End**: Update STATUS.md → todo.md → SESSION_LOG.md → gotchas.md (if learned) → decisions_log.md (if decided) → IMPACT_MAP.md (if coupling changed) → schema_map.md (if schema changed). Provide next sprint prompt.

# TGT — Status (Instant Context)

> Single source of "where are we right now". Read this FIRST every session.
> Updated at end of every session. Keep under 60 lines.

---

## Current State
- **Phase**: S41 (Recording + Takes Both) COMPLETE. Recording flow, takes list, post-recording on web + Android. Ready for S42.
- **What works**: Web (full, V4 player, Library + sharing + recording + takes), Android (full, V4 player, Library + recording + takes), Cloud Run (beats + stems + CORS + beats-only), Capture (built but untested end-to-end).
- **Last session**: S41 Recording + Takes — Web: IndexedDB local takes storage (takesDb.ts), useRecording hook (getUserMedia, MediaRecorder, device picker, camera toggle, level meter, count-in). SongForm.tsx: "My Takes" section (cloud + local, best star, delete, play). Player.tsx: recording mode (record button in transport, hero visualizer/camera, post-recording modal with 4 options + best take toggle). Library.tsx: "New Idea" button (D-138, quick-create song → practice → record). Android: LocalTakesStore (file-based JSON + audio), AudioRecorder (MediaRecorder AAC), StemRepository (getUserRecordedTakes, setBestTake, clearBestTake, deleteRecordedTake), SongRepository.createSong (D-138). AppViewModel: takes state + recording state (count-in, level meter, post-recording save). PlayerComponents.kt: TakeItem + TakesSection composable. PracticeScreen.kt: TakesSection wired, RecordingBanner, PostRecordingDialog, record button in transport. LibraryScreen.kt: "New Idea" button + NewIdeaDialog. Manifest: RECORD_AUDIO + CAMERA permissions. All builds clean (tsc + vite build + compileReleaseKotlin).
- **Next action**: Sprint S42 — View Mode on both platforms.
- **Seed status**: 117 gigs (114 linked to venue_id) + 62 away dates. 29 clients, 65 venues in Supabase. 4 songs (Cissy Strut, Sultans, War Pigs, Big Yellow Taxi).
- **Band roles**: All 4 profiles populated (Nathan=Drums, Neil=Bass, James=Lead Vocals, Adam=Guitar & Backing Vocals)

## Sprint Roadmap (S38–S43) — Revised for Cross-Platform Parity
| Sprint | Scope | Status |
|--------|-------|--------|
| S38 | **Visual Unification** — Android token correction (5 colors), both player rebuilds to V4 target design | **Done** |
| S39 | **Foundation** — Migration + shared types/queries + Cloud Run beats-only code | **Done** |
| S40 | **Library + SongForm (Both)** — Dropdowns, categories, sharing on web + Android together | **Done** |
| S41 | **Recording + Takes (Both)** — Recording flow, takes list, post-recording on web + Android together | **Done** |
| S42 | **View Mode (Both)** — View Mode + record from View Mode on web + Android together | **Next** |
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

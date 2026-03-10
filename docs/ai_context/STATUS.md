# TGT — Status (Instant Context)

> Single source of "where are we right now". Read this FIRST every session.
> Updated at end of every session. Keep under 60 lines.

---

## Current State
- **Phase**: PAUSED — design audit in progress. Player divergence discovered. V4 mirror target mockup needed before any build work.
- **What works**: Web (full), Android (full), Cloud Run (beats + stems + CORS), Capture (built but untested end-to-end).
- **Last session**: Design audit — discovered Android and Web players were built as 2 separate designs from one conversation. Android = NeuCard vertical scroll, Web = flat single-component, neither matches approved S33 mockups. Created `mockups/four-way-comparison.html` (V1-V4 comparison). User approved direction. V4 mirror target mockup (`mockups/v4-mirror-target.html`) started but not yet written — needs 17 screens at s39-mockup quality level. Practice mode confirmed to include chords/lyrics/notes/drums display (same as Live). SOT docs relocated from `native/docs/ai_context/` to `docs/ai_context/` (project-wide, not native-only). CLAUDE.md moved to project root.
- **Next action**: Build `mockups/v4-mirror-target.html` (17 screens). Then rebuild sprint plan for true cross-platform parity. S39-S45 sprint ordering needs revision (was web-first, should be interleaved).
- **Seed status**: 117 gigs (114 linked to venue_id) + 62 away dates. 29 clients, 65 venues in Supabase. 4 songs (Cissy Strut, Sultans, War Pigs, Big Yellow Taxi).
- **Band roles**: All 4 profiles populated (Nathan=Drums, Neil=Bass, James=Lead Vocals, Adam=Guitar & Backing Vocals)

## Sprint Roadmap (S39–S45)
| Sprint | Scope | Status |
|--------|-------|--------|
| S39 | Migration + shared types/queries + Cloud Run beats-only | **Next** |
| S40 | Web: Library dropdowns + SongForm categories + sharing UI | Queued |
| S41 | Web: Recording + takes + post-recording flow | Queued |
| S42 | Web: View Mode + record-from-View-Mode | Queued |
| S43 | Android: Categories + sharing + takes UI | Queued |
| S44 | Android: Recording + View Mode | Queued |
| S45 | Cloud Run: re-analyse from mixed master | Queued |
| Audit | Cross-platform surgical audit before user testing | After S45 |

## Key Design Artifacts
- **S39 Mockup**: `mockups/s39-categories-sharing-mockup.html` — 15 screens (categories/sharing/takes/recording)
- **S33 Mockups**: `mockups/player-live.html`, `practice-redesign.html`, `library-browser.html`, `player-queue.html` — last approved player designs
- **V4 Target**: `mockups/v4-mirror-target.html` — TODO: 17-screen unified design spec for both platforms
- **4-Way Comparison**: `mockups/four-way-comparison.html` — V1/V2/V3/V4 audit (Live, Practice, Queue)
- **Decisions**: D-124–D-153 in `decisions_log.md` — all locked
- **Sprint prompts**: `SPRINT_PROMPTS.md` — needs revision for cross-platform parity
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
- **Supabase**: jlufqgslgjowfaqmqlds.supabase.co (25 tables, 4 storage buckets)
- **Cloud Run**: beat-analysis service on GCP tangerine-time-tree (europe-west1)
- **Capture tool**: localhost:5174 (UI) + localhost:9123 (backend). Launch via start-silent.vbs or start.ps1.

## Session Protocol (Quick Reference)
**Start**: Read STATUS.md → IMPACT_MAP.md → todo.md → SPRINT_PROMPTS.md (for current sprint)
**End**: Update STATUS.md → todo.md → SESSION_LOG.md → gotchas.md (if learned) → decisions_log.md (if decided) → IMPACT_MAP.md (if coupling changed) → schema_map.md (if schema changed). Provide next sprint prompt.

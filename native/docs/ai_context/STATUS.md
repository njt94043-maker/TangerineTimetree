# TGT — Status (Instant Context)

> Single source of "where are we right now". Read this FIRST every session.
> Updated at end of every session. Keep under 60 lines.

---

## Current State
- **Phase**: S39–S45 design complete. 15-screen mockup approved. 30 decisions locked (D-124–D-153). Ready to build.
- **What works**: Web (full), Android (full), Cloud Run (beats + stems + CORS), Capture (built but untested end-to-end).
- **Last session**: S39–S45 design — Extended S39 design into full feature plan covering categories, sharing, takes, recording, View Mode, overdub, selfie video, USB interfaces, Cloud Run beats-only pipeline, re-analyse from mixed master. Split into 7 sprints (S39–S45) for web + Android parity. Mockup iterated to 15 screens. 30 decisions logged.
- **Next action**: S39 build — Migration SQL + shared types/queries + Cloud Run beats-only endpoint. See SPRINT_PROMPTS.md.
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
- **Mockup**: `mockups/s39-categories-sharing-mockup.html` — 15 screens approved
- **Decisions**: D-124–D-153 in `decisions_log.md` — all locked
- **Sprint prompts**: `SPRINT_PROMPTS.md` — copy-paste to kick off each sprint

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

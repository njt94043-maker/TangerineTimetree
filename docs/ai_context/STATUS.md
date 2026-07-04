# TGT — Status (Instant Context)

> Single source of "where are we right now". Read this FIRST every session.
> Updated at end of every session. Keep under 60 lines.

---

## Current State (2026-07-04, s260)
- **Phase**: Timetree reliability → 2026-UI programme (spec: `C:\apps\Dev Team\specs\tgt\s244-timetree-function-audit.md`). Order LOCKED: verify/prune first, humanise UI second. Nathan's driver: the boys still favour original Timetree — ours "feels clunky and toylike" despite covering every feature. Migration trust (get real bookings across accurately) is the adoption blocker.
- **Web (Tangerine Timetree) v1.8.0** — s260 TimeTree migration landing ground pushed to master: new `import_staging` table + Imports review UI (More → Imports) — scraped bookings/aways stage there and NOTHING auto-seeds; commit = explicit per-card/bulk approval; raw title+notes preserved verbatim. Away commits via staging-bound SECURITY DEFINER RPCs (away_dates policy untouched, D-174). Stager `web/scripts/stage_timetree_imports.py`; ClientOneBox (s244 one-box, reusable). Source-disappearance + drift flagging built (never auto-delete/update). 16th destination (guardrail test → 16). Builder gate green; **live migration applied + real stage run — see SESSION_LOG**. Authed commit-path/review = Architect + Nathan's product moment.
- **Prior — Web v1.7.0** — s258 slice A: bottom tab bar (Calendar/Gigs/Money/More) + calendar FAB + day-peek sheet replaced the drawer; truthful `__APP_VERSION__` (closed S254). Nav truth in `web/src/nav/navConfig.ts`.
- **Prior — Web v1.6.1** — S244 removal slice LIVE (bundle-verified): XR18 camera surface, AppTutorial, offline mutation queue (fail LOUD via ErrorAlert), 3 S41 orphans, QR-landing upload CTA removed. v1.6.0 booking notifications (bell + Web Push) verified on Nathan's Samsung.
- **What works**: Android APK (full — gig mode pause/resume overwrite CONFIRMED FIXED S222), Cloud Run, Capture, web invoicing/quotes/calendar/enquiries/notifications, practice mixer (`web/src/practice/` — ACTIVE, uses `web/src/audio/` engine).
- **Seed status** (as of S63, June): 117 gigs (114 venue-linked) + 62 away dates, 29 clients, 65 venues, 4 songs.

## Known-stale / open
- **Authed prod drive outstanding (s258+s260)** — v1.8.0: tab-bar nav walk incl. Imports (16 destinations) + day-peek + FAB + Imports review render + the s260 commit-path 7-point test (ONE far-future IMPORT-TEST gig + ONE cross-member IMPORT-TEST away → visible → removed via UI → residue zero). Needs a logged-in session; magic-link mint awaits Nathan's OK. Hub smoke.js is v2.1 (adds Imports); run once a session is minted.
- **s260 review is Nathan's product moment** — the actual accept/skip passes over the ~180 staged rows are his to do in the Imports UI once he's happy with the review surface.
- **Nathan device test (S243)**: lock-screen push on a Home-Screen iPhone (Samsung ✅).
- Root `CLAUDE.md` + this doc were purged of S118-dead components (Player/StagePrompter/SongList/SetlistList) in the S244 doc purge — if you find a reference to them anywhere, it's rot; fix it.

## What's Deployed
- **Web**: thegreentangerine.com v1.8.0 (Vercel, auto-deploys from master — s260 push)
- **Android**: release APK on Nathan's Samsung + band phones (S211 RigTargetStore build)
- **Supabase**: jlufqgslgjowfaqmqlds.supabase.co (26 tables + notifications/push_subscriptions, 4 storage buckets, notify-push edge fn)
- **Cloud Run**: beat-analysis service on GCP tangerine-time-tree (europe-west1)
- **Capture**: localhost only — backend :9123, UI :5174 (`capture/start-silent.vbs`)

## Session Protocol (Quick Reference)
**Start**: Read STATUS.md → todo.md (mandatory). Other docs on demand.
**End**: Update STATUS.md → todo.md → SESSION_LOG.md. Commit + push.
**TESTING**: Clear site data → close tab → fresh tab. One change per push.
**EVERY CHANGE**: Ask "what else does this affect?" across ALL apps (D-156).
**NO GUESSING**: Every code change must be backed by research or reference implementation.

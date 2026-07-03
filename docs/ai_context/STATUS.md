# TGT — Status (Instant Context)

> Single source of "where are we right now". Read this FIRST every session.
> Updated at end of every session. Keep under 60 lines.

---

## Current State (2026-07-03, hub S244)
- **Phase**: Timetree reliability → 2026-UI programme (spec: `C:\apps\Dev Team\specs\tgt\s244-timetree-function-audit.md`). Order LOCKED: verify/prune first, humanise UI second. Nathan's driver: the boys still favour original Timetree — ours "feels clunky and toylike" despite covering every feature.
- **Web (Tangerine Timetree) v1.6.1** — S244 removal slice LIVE on prod (bundle-verified): XR18 camera surface, AppTutorial, offline mutation queue (booking/away/gig flows now fail LOUD via ErrorAlert), 3 S41 orphans, QR-landing upload CTA all removed. v1.6.0 booking notifications (in-app bell + Web Push) verified on Nathan's Samsung.
- **What works**: Android APK (full — gig mode pause/resume overwrite CONFIRMED FIXED S222), Cloud Run, Capture, web invoicing/quotes/calendar/enquiries/notifications, practice mixer (`web/src/practice/` — ACTIVE, uses `web/src/audio/` engine).
- **Seed status** (as of S63, June): 117 gigs (114 venue-linked) + 62 away dates, 29 clients, 65 venues, 4 songs.

## Known-stale / open
- **Authed prod drive outstanding** — drawer nav walk + offline negative test (needs a logged-in session; magic-link mint awaits Nathan's OK, or 30s on his phone).
- **Nathan device test (S243)**: lock-screen push on a Home-Screen iPhone (Samsung ✅).
- Root `CLAUDE.md` + this doc were purged of S118-dead components (Player/StagePrompter/SongList/SetlistList) in the S244 doc purge — if you find a reference to them anywhere, it's rot; fix it.

## What's Deployed
- **Web**: thegreentangerine.com v1.6.1 (Vercel, auto-deploys from master)
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

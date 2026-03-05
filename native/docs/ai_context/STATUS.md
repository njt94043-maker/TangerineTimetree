# TGT — Status (Instant Context)

> Single source of "where are we right now". Read this FIRST every session.
> Updated at end of every session. Keep under 60 lines.

---

## Current State
- **Phase**: S19+ polish COMPLETE. Ready for S20 (branding/splash/icons) then S21 (APK build + device test).
- **Blocker**: APK build deferred — native app still crashes on device (Element type invalid — needs debug build for stack trace)
- **Last session**: 2026-03-05 — Calendar restyle, filter dropdowns, native/web parity push
- **Next action**: S20 — Logo swap (clear-bg image), animated splash screen, skeleton loaders, app icons
- **Remaining S11**: Run migration script (`native/scripts/migrate-sqlite-to-supabase.ts`) + manual testing on device
- **Seed data**: `C:\Apps\timetree-scrape\timetree_gigs.xlsx` — 116 gigs + 62 away dates (still pending import)

## Big Picture
- **Vision**: Unified Tangerine Timetree brand — BOTH apps get full feature parity (invoicing, quotes, calendar, clients)
- **North star**: 4 band members manage gigs, invoices, quotes, and public presence through one ecosystem
- **Architecture**: Monorepo (`shared/` + `native/` + `web/`) — Supabase replaces SQLite for ALL data (ROADMAP_V2 supersedes D-015)
- **Design**: Collapsible drawer nav on both apps (IMPLEMENTED S19). Unified theme. Mockups define end-state target.
- **Users**: Nathan (admin), Neil, James, Adam — The Green Tangerine

## Active Risks
1. Native app crashes on device ("Element type is invalid: got undefined") — GestureHandlerRootView fix applied but crash persists. Debug build needed for stack trace.
2. APK build deferred (cmake/datetimepicker) — will fix when native app is feature-complete
3. SQLite migration script not yet run — need SUPABASE_SERVICE_ROLE_KEY + NATHAN_USER_ID (f30962b3-2588-4b3d-827a-69b03bdfa6b1) env vars
4. S11 code changes untested on device (no working APK build)

## What's Deployed
- **Web**: thegreentangerine.com (Vercel, auto-deploys from master)
- **Native**: Last working APK predates datetimepicker addition
- **Supabase**: jlufqgslgjowfaqmqlds.supabase.co (production, 19 tables live)

## Supabase Tables (19 total)
- **Calendar**: profiles, gigs, away_dates, gig_changelog, away_date_changelog
- **Public site**: public_media, contact_submissions
- **Invoicing (S10)**: clients, venues, invoices, receipts, user_settings, band_settings
- **Quoting (S15 NEW)**: service_catalogue, quotes, quote_line_items, formal_invoices, formal_invoice_line_items, formal_receipts
- **RPC**: `next_invoice_number()`, `next_quote_number()` — atomic increments

## Session Protocol (Quick Reference)
**Start**: Read STATUS.md → todo.md → (deeper docs only if needed) → `npx tsc --noEmit`
**End**: Update STATUS.md → todo.md → SESSION_LOG.md → gotchas.md (if learned) → decisions_log.md (if decided)

## Sprint Roadmap
| Sprint | Focus | Status |
|--------|-------|--------|
| S1-S8 | Audit, fixes, public site, polish | ALL DONE |
| S9 | HTML mockups (design target) | DONE |
| S10 | Supabase invoicing schema + migration script | DONE |
| S11 | Native SQLite → Supabase swap | DONE |
| S12 | Shared PDF templates | DONE |
| S13 | Web invoicing + settings + clients | DONE |
| S14 | Dashboard + export + invoice polish | DONE |
| S15 | Quote system backend (schema + types + queries + templates) | DONE |
| S16 | Web quote wizard + service catalogue UI | DONE |
| S17 | Web quote lifecycle + formal invoicing | DONE |
| S18 | Native quote UI parity | DONE |
| S19 | Navigation + design unification (both apps) | DONE |
| S19+ | Calendar restyle + filter dropdowns + native/web parity | DONE |
| **S20** | **Logo swap, animated splash, skeleton loaders, app icons** | **NEXT** |
| S21 | APK build fix + full device testing | PLANNED |

Prompts: `native/docs/ai_context/SPRINT_PROMPTS.md` — Full plan: `.claude/plans/jaunty-nibbling-unicorn.md`

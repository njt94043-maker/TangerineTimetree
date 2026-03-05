# TGT — Status (Instant Context)

> Single source of "where are we right now". Read this FIRST every session.
> Updated at end of every session. Keep under 60 lines.

---

## Current State
- **Phase**: S21 complete. S22 next — **NATIVE VISUAL OVERHAUL** (top priority).
- **Blocker**: None. App runs on device, no crashes.
- **Last session**: 2026-03-05 — Fixed nav crash, iOS wheel time picker, field autocomplete, layout parity (dashboard/daysheet/clients/gig form). APK built + installed.
- **Next action**: **S22 — Pixel-perfect native visual parity with webapp.** The webapp is the design target. Every screen on native must look identical to its web counterpart: same spacing, same button styles, same card designs, same typography, same layouts. This is the #1 priority.
- **Seed status**: 117 gigs (116 seeded + 1 existing) + 62 away dates in Supabase. Only original timetree fees seeded. 44 WhatsApp-confirmed fees pending user verification.
- **Band roles**: All 4 profiles populated (Nathan=Drums, Neil=Bass, James=Lead Vocals, Adam=Guitar & Backing Vocals)

## Big Picture
- **Vision**: Unified Tangerine Timetree brand — BOTH apps get full feature parity (invoicing, quotes, calendar, clients)
- **North star**: 4 band members manage gigs, invoices, quotes, and public presence through one ecosystem
- **Architecture**: Monorepo (`shared/` + `native/` + `web/`) — Supabase replaces SQLite for ALL data (ROADMAP_V2 supersedes D-015)
- **Design**: Collapsible drawer nav on both apps (IMPLEMENTED S19). Unified theme. Mockups define end-state target.
- **Users**: Nathan (admin), Neil, James, Adam — The Green Tangerine

## Active Risks
1. **Native visual parity** — Native app is functional but doesn't match the webapp's polished look. User has flagged this as top priority. Webapp is the design target.
2. Disk space: C: drive monitored. APK builds work.
3. SQLite migration script not yet run — need SUPABASE_SERVICE_ROLE_KEY + NATHAN_USER_ID (f30962b3-2588-4b3d-827a-69b03bdfa6b1) env vars

## What's Deployed
- **Web**: thegreentangerine.com (Vercel, auto-deploys from master)
- **Native**: Release APK installed on Samsung RFCW113WZRM (2026-03-05)
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
| S20 | Logo swap, animated splash, skeleton loaders, app icons | DONE |
| S21 | APK build fix + device testing + layout parity | DONE |
| **S22** | **Native visual overhaul — pixel-perfect match webapp** | **NEXT** |

Prompts: `native/docs/ai_context/SPRINT_PROMPTS.md` — Full plan: `.claude/plans/jaunty-nibbling-unicorn.md`

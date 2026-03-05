# TGT — Status (Instant Context)

> Single source of "where are we right now". Read this FIRST every session.
> Updated at end of every session. Keep under 60 lines.

---

## Current State
- **Phase**: S21 complete. **S23 next — VENUE/CLIENT RESTRUCTURE** (4-session epic).
- **Blocker**: None. App runs on device, no crashes.
- **Last session**: 2026-03-05 — Review editor UX fixes (auto-grow textarea, mobile layout, touch targets). Designed venue/client data model. S22 (visual overhaul) deprioritised in favour of S23 venue/client restructure.
- **Next action**: **S23A — Database migration + types + queries.** See SPRINT_PROMPTS.md for full 4-session plan.
- **Seed status**: 117 gigs (116 seeded + 1 existing) + 62 away dates in Supabase. No real production data yet — clean restructure approved.
- **Band roles**: All 4 profiles populated (Nathan=Drums, Neil=Bass, James=Lead Vocals, Adam=Guitar & Backing Vocals)

## Big Picture
- **Vision**: Unified Tangerine Timetree brand — BOTH apps get full feature parity (invoicing, quotes, calendar, clients)
- **North star**: 4 band members manage gigs, invoices, quotes, and public presence through one ecosystem
- **Architecture**: Monorepo (`shared/` + `native/` + `web/`) — Supabase replaces SQLite for ALL data (ROADMAP_V2 supersedes D-015)
- **Design**: Collapsible drawer nav on both apps (IMPLEMENTED S19). Unified theme. Mockups define end-state target.
- **Users**: Nathan (admin), Neil, James, Adam — The Green Tangerine

## Active Risks
1. **Venue/client restructure** — 24-file blast radius across native + web + shared. Split into 4 sessions to manage risk.
2. **Native visual parity** — Still needed (S22), but deferred until after venue/client restructure.
3. Disk space: C: drive monitored. APK builds work.

## What's Deployed
- **Web**: thegreentangerine.com (Vercel, auto-deploys from master)
- **Native**: Release APK installed on Samsung RFCW113WZRM (2026-03-05)
- **Supabase**: jlufqgslgjowfaqmqlds.supabase.co (production, 19 tables live)

## Supabase Tables (19 → 20 after S23A)
- **Calendar**: profiles, gigs, away_dates, gig_changelog, away_date_changelog
- **Public site**: public_media, contact_submissions
- **Invoicing (S10)**: clients, venues, invoices, receipts, user_settings, band_settings
- **Quoting (S15)**: service_catalogue, quotes, quote_line_items, formal_invoices, formal_invoice_line_items, formal_receipts
- **S23 NEW**: venue_photos (new table), venues restructured (ratings + no client_id), gigs/quotes/invoices get venue_id FK
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
| S22 | Native visual overhaul — pixel-perfect match webapp | DEFERRED (after S23) |
| **S23A** | **Venue/client restructure: DB migration + types + queries** | **NEXT** |
| S23B | Venue management UI (both apps) + venue ratings/photos | PLANNED |
| S23C | Gig booking flow update (venue/client pickers, nav button) | PLANNED |
| S23D | Quote + Invoice flow update (venue pickers, full chain test) | PLANNED |

Prompts: `native/docs/ai_context/SPRINT_PROMPTS.md` — Full plan: `.claude/plans/jaunty-nibbling-unicorn.md`

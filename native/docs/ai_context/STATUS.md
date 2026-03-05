# TGT — Status (Instant Context)

> Single source of "where are we right now". Read this FIRST every session.
> Updated at end of every session. Keep under 60 lines.

---

## Current State
- **Phase**: S24B complete. **Bill-to flexibility: full UI shipped (both apps).**
- **Blocker**: None. Native APK needs rebuild.
- **Last session**: 2026-03-05 — S24B: Bill-to toggle on invoice+quote forms (both apps). Invoice/quote list views show billed-to name (client or venue). Removed "Client is the venue" toggle from gig forms. Create Invoice button on gig day views (both apps) with prefill. Invoiced badge on gigs with linked invoices. Venue contact fields on venue forms (both apps). Migration SQL pushed to Supabase. Both tsc clean.
- **Next action**: APK rebuild. User to verify 44 WhatsApp-confirmed fees, then batch-update.
- **Seed status**: 117 gigs (114 linked to venue_id) + 62 away dates. 29 clients, 65 venues in Supabase.
- **Band roles**: All 4 profiles populated (Nathan=Drums, Neil=Bass, James=Lead Vocals, Adam=Guitar & Backing Vocals)

## Big Picture
- **Vision**: Unified Tangerine Timetree brand — BOTH apps get full feature parity (invoicing, quotes, calendar, clients)
- **North star**: 4 band members manage gigs, invoices, quotes, and public presence through one ecosystem
- **Architecture**: Monorepo (`shared/` + `native/` + `web/`) — Supabase replaces SQLite for ALL data (ROADMAP_V2 supersedes D-015)
- **Design**: Collapsible drawer nav on both apps (IMPLEMENTED S19). Unified theme. Mockups define end-state target.
- **Users**: Nathan (admin), Neil, James, Adam — The Green Tangerine

## Active Risks
1. ~~Supabase service_role key leaked~~ — **RESOLVED**: legacy JWT keys disabled, new publishable/secret keys active. Old key rejected (verified).
2. **Native APK outdated** — S23 code + venue seeding not on device yet. Need APK rebuild.
3. Disk space: C: drive monitored. APK builds work.

## What's Deployed
- **Web**: thegreentangerine.com (Vercel, auto-deploys from master)
- **Native**: Release APK installed on Samsung RFCW113WZRM (2026-03-05)
- **Supabase**: jlufqgslgjowfaqmqlds.supabase.co (production, 20 tables live, S24A migration pushed)

## Supabase Tables (20 live)
- **Calendar**: profiles, gigs, away_dates, gig_changelog, away_date_changelog
- **Public site**: public_media, contact_submissions
- **Invoicing (S10)**: clients, venues, invoices, receipts, user_settings, band_settings
- **Quoting (S15)**: service_catalogue, quotes, quote_line_items, formal_invoices, formal_invoice_line_items, formal_receipts
- **S23A**: venue_photos (new table), venues restructured (ratings/postcode/notes, no client_id), gigs/quotes/invoices/formal_invoices have venue_id FK, gigs have client_id FK
- **Storage**: public-media, venue-photos (new S23A)
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
| **S22** | **Native visual overhaul — pixel-perfect match webapp** | **DONE** |
| **S23A** | **Venue/client restructure: DB migration + types + queries** | **DONE** |
| **S23B** | **Venue management UI (both apps) + venue ratings/photos** | **DONE** |
| **S23C** | **Gig booking flow update (venue/client pickers, nav button)** | **DONE** |
| **S23D** | **Quote + Invoice flow update (venue pickers, audit fixes)** | **DONE** |
| **S24A** | **Bill-to flexibility: schema + types + queries** | **DONE** |
| **S24B** | **Bill-to flexibility: UI (both apps) + gig→invoice shortcut** | **DONE** |

Prompts: `native/docs/ai_context/SPRINT_PROMPTS.md` — Full plan: `.claude/plans/jaunty-nibbling-unicorn.md`

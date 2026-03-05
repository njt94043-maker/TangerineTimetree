# TGT — Todo

> Current tasks, priorities, and backlog.
> Update after every task completion. See STATUS.md for instant context.

---

## Immediate Actions
- [ ] APK rebuild for S23 changes + venue/client seeding
- [ ] User to verify 44 WhatsApp-confirmed fees, then batch-update

## Next Up: S24 — Bill-To Flexibility (venue OR client invoicing)

### S24A — Schema + Types + Queries — DONE
- [x] DB migration: add email/phone/contact_name to venues
- [x] DB migration: make client_id nullable on invoices, quotes, formal_invoices
- [x] DB migration: add CHECK constraint (client_id OR venue_id must be set)
- [x] DB migration: add gig_id nullable FK on invoices (D-082)
- [x] Types: update Venue (add email/phone/contact_name), Invoice (add gig_id)
- [x] Types: make client_id nullable on Invoice, Quote, FormalInvoice
- [x] Types: add BillTo utility type
- [x] Types: update WithClient join types — added venue contact fields
- [x] Queries: update createInvoice (optional client_id + gig_id), createQuote (optional client_id)
- [x] Queries: all GET queries now LEFT JOIN venues for contact fields
- [x] Queries: added resolveBillTo() helper + getInvoiceByGigId()
- [x] Queries: getDashboardStats updated (uses shared mapInvoiceRow)
- [x] PDF templates: already bill-to agnostic (use toCompany/toContact/toAddress)
- [x] Native wrapper: updated (BillTo type, resolveBillTo, getInvoiceByGigId exports)
- [x] TypeScript clean: both apps pass
- [ ] **Push migration SQL to Supabase** (user action)

### S24B — UI (both apps)
- [ ] Gig form: remove "Client is the venue" toggle (both apps)
- [ ] Invoice form: add "Bill To" choice — venue or client (both apps)
- [ ] Quote form: same bill-to pattern (both apps)
- [ ] Invoice/Quote list views: "Billed To" column shows client OR venue name
- [ ] Venue form/detail: add email, phone, contact_name fields (both apps)
- [ ] Venue list: indicator for venues with invoicing contact info
- [ ] Gig day view: "Create Invoice" button at bottom of gig card (both apps)
  - Only shows for payment_type='invoice', non-practice gigs
  - Pre-fills venue, client, fee, date, description
  - "Invoiced" badge on gigs that already have a linked invoice (via gig_id FK)
- [ ] TypeScript clean + build both apps

## Backlog
- FreeAgent API integration — sync income/expenses for tax reporting (D-047, needs planning)

---

## Key Decisions
- Full feature parity between native and web (any member can do anything)
- Supabase replaces SQLite for ALL data
- Collapsible drawer navigation on BOTH apps (not tabs)
- PDFs generated on-demand, templates in shared/templates/
- Shared invoice number sequence (TGT-XXXX via RPC), separate quote sequence (QTE-XXX)
- Venues and clients are independent lists — no forced FK between them (D-072)
- Unified Tangerine Timetree brand — mockups define end-state target
- API keys: publishable (`sb_publishable_`) + secret (`sb_secret_`) — legacy JWT keys disabled

---

## Completed Sprints (Summary)

| Sprint | Focus | Date |
|--------|-------|------|
| S1-S3 | Audit, critical fixes, SOT redesign, docs, CI/CD | 2026-03-04 |
| S4-S6 | Public website (3 phases): profiles, public site, media/contact | 2026-03-04 |
| S7-S8 | Code dedup, validation, CSS extraction, ViewContext, error boundaries | 2026-03-04 |
| S9 | HTML mockups (design target) | 2026-03-04 |
| S10 | Supabase invoicing schema + migration | 2026-03-04 |
| S11 | Native SQLite → Supabase swap | 2026-03-04 |
| S12 | Shared PDF templates (28 styles) | 2026-03-04 |
| S13 | Web invoicing (6 components, 2 hooks) | 2026-03-04 |
| S14 | Dashboard + export + invoice polish | 2026-03-04 |
| S15 | Quote system backend (6 tables, 16 templates) | 2026-03-04 |
| S16 | Web quote wizard + service catalogue UI | 2026-03-04 |
| S17 | Web quote lifecycle + formal invoicing | 2026-03-04 |
| S18 | Native quote UI parity | 2026-03-04 |
| S19 | Navigation + design unification (drawer on both) | 2026-03-04 |
| S19+ | Calendar restyle + filter dropdowns + parity | 2026-03-05 |
| S20 | Logo, animated splash, skeleton loaders, app icons | 2026-03-05 |
| S21 | APK build fix + device testing + layout parity | 2026-03-05 |
| S22 | Native visual overhaul — pixel-perfect match webapp | 2026-03-05 |
| S23A | Venue/client restructure: DB migration + types + queries | 2026-03-05 |
| S23B | Venue management UI (both apps) + ratings/photos | 2026-03-05 |
| S23C | Gig booking flow update (EntityPickers, navigate button) | 2026-03-05 |
| S23D | Quote + Invoice flow update (venue pickers, audit fixes) | 2026-03-05 |
| — | Venue/client seeding (65 venues, 29 clients, 114 gigs linked) | 2026-03-05 |
| — | "Client is the venue" toggle (both apps) | 2026-03-05 |
| — | Key rotation: legacy JWT disabled, new publishable/secret keys | 2026-03-05 |

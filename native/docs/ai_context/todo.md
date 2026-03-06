# TGT — Todo

> Current tasks, priorities, and backlog.
> Update after every task completion. See STATUS.md for instant context.

---

## Immediate Actions
- [ ] S25B: Songs & Setlists UI (both apps) — song library CRUD, setlist builder with reorder
- [ ] S25C: Setlist PDF sharing — band-themed template, generate + share from both apps
- [ ] Web nav bug: edit gig back button goes to calendar instead of gig list
- [ ] APK rebuild for S23+ changes
- [ ] User to verify 44 WhatsApp-confirmed fees, then batch-update

## Completed: S24 — Bill-To Flexibility (venue OR client invoicing)

### S24A — Schema + Types + Queries — DONE
- [x] DB migration, types, queries, native wrapper — all complete
- [x] Migration SQL pushed to Supabase

### S24B — UI (both apps) — DONE
- [x] Gig form: removed "Client is the venue" toggle (both apps)
- [x] Invoice form: "Bill To" toggle — venue or client (both apps)
- [x] Quote form: same bill-to pattern (both apps)
- [x] Invoice/Quote list views: show client OR venue name (billed-to)
- [x] Venue form/detail: email, phone, contact_name fields (both apps)
- [x] Gig day view: "Create Invoice" button + "Invoiced" badge (both apps)
  - Only for payment_type='invoice', non-practice gigs
  - Pre-fills venue, client, fee, date, description
- [x] Web InvoiceForm: added prefill props for gig→invoice flow
- [x] TypeScript clean: both apps pass

## Completed: S25A — Songs & Setlists: Schema + Types + Queries — DONE
- [x] Supabase migration: songs, setlists, setlist_songs tables + practice-tracks bucket
- [x] Shared TypeScript types (Song, Setlist, SetlistSong, SetlistSongWithDetails, SetlistWithSongs, ClickSound)
- [x] Shared queries: 20 new functions (CRUD for songs, setlists, setlist songs, practice track upload)
- [x] Native query wrappers (re-exports from shared)
- [x] Migration pushed to Supabase
- [x] Both apps tsc clean

## Backlog — Songs & Setlists Epic
- [ ] S26A: Native audio engine — Expo Module wrapping Oboe/C++ metronome from ClickTrack
- [ ] S26B: Live Mode — song-driven click + beat visualizations (LED, numbers, circular, pendulum)
- [ ] S26C: Live Mode — setlist navigation, wake lock, full-screen
- [ ] S27A: Practice Mode — MP3 playback (expo-av) + click overlay
- [ ] S27B: Practice Mode — time-stretch + A-B loop + speed trainer
- [ ] S27C: Practice Mode — click assignment tools (tap tempo, save to song)
- [ ] S28+: Recording/video capture (front camera) — spec later

## Backlog — Other
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
| S24A | Bill-to flexibility: schema + types + queries | 2026-03-05 |
| S24B | Bill-to flexibility: UI (both apps) + gig→invoice shortcut | 2026-03-05 |
| S25A | Songs & Setlists: schema + types + queries + storage | 2026-03-06 |

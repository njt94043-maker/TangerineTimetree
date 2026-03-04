# Tangerine Timetree v2 — Roadmap

> **Last updated:** 2026-03-04
> **Status:** Planning

---

## Vision

Unify "GigBooks" (native) and "Tangerine Timetree" (web) into **one app brand: Tangerine Timetree**. Same features, same look, same backend — two frontends.

- **Nathan** uses the Android native app (React Native / Expo)
- **Other 3 band members** use the web app (React / Vite PWA), installable on iOS via "Add to Home Screen"
- **Supabase** is the single backend for everything — auth, data, realtime
- **SQLite retired** for invoicing (kept only if needed for offline edge cases)
- **PDFs generated on-demand** on each device — no cloud file storage needed
- **Calendar is home** for everyone

---

## Architecture

```
┌──────────────────┐     ┌──────────────────┐
│   Native App     │     │    Web App        │
│   (Nathan)       │     │    (Band)         │
│   React Native   │     │    React + Vite   │
│   Android APK    │     │    PWA (iOS ready) │
└────────┬─────────┘     └────────┬──────────┘
         │                        │
         │   ┌────────────────┐   │
         └──►│  shared/       │◄──┘
             │  - types.ts    │
             │  - queries.ts  │
             │  - templates/  │
             └───────┬────────┘
                     │
             ┌───────▼────────┐
             │   Supabase     │
             │   - Auth       │
             │   - Database   │
             │   - Realtime   │
             └────────────────┘
```

### What's shared (in `shared/`)

- TypeScript types (all data models)
- Supabase queries (all CRUD operations)
- Supabase client bridge
- HTML/CSS PDF templates (used by both frontends to render on-demand)

### What's per-frontend

- UI components (React vs React Native — can't share these)
- Navigation / routing
- PDF rendering mechanism (WebView on native, iframe/DOM on web)
- Share/download mechanism (Expo share sheet on native, browser download/share API on web)

### PDF Strategy: On-Demand Generation

No PDFs stored in the cloud. The data lives in Supabase; each device generates the PDF locally when needed.

- **Preview**: render the HTML template with data from Supabase, display in WebView (native) or iframe (web)
- **Share/Download**: generate the PDF file on-device, use platform share sheet or browser download
- **Bulk export**: user selects a tax year → app generates all receipts/invoices as PDFs → save to device
- **Template updates**: change a template in `shared/` → everyone's PDFs reflect it instantly, no migration

---

## Settings Model

### Personal Settings (per user, stored against their profile)

Each band member has their own:

| Field | Notes |
|---|---|
| name | Display name |
| email | Contact email |
| phone | Contact phone |
| bank_account_name | For their receipts/invoices |
| bank_name | |
| bank_sort_code | |
| bank_account_number | |
| payment_terms_days | Default payment terms |

### Shared Settings (one copy, managed by admins)

Applies to the whole band/business:

| Field | Notes |
|---|---|
| trading_as | "The Green Tangerine" |
| business_type | "Live Music Entertainment" |
| website | |
| pli_insurer | e.g., "Insure4Music" |
| pli_policy_number | |
| pli_cover_amount | e.g., "£10,000,000" |
| pli_expiry_date | With expiry warning |
| pli_certificate_uri | Uploaded certificate file (stored locally per device or as base64 in Supabase) |
| default_terms_and_conditions | Default T&Cs for quotes |
| default_quote_validity_days | e.g., 30 |
| next_invoice_number | Shared sequence |
| next_quote_number | Shared sequence |

---

## Navigation (both apps)

| Tab | Purpose |
|---|---|
| **Calendar** | Home screen. Month view, day details, gig form, away dates |
| **Gigs** | List view of upcoming/past gigs |
| **Invoices** | All invoicing — simple + formal, quotes, receipts |
| **Settings** | Personal settings + shared band settings |

### Invoices Tab Breakdown

- **Dashboard** — stats, totals, outstanding amounts
- **Simple Invoices** — existing pub gig flow (single line, single amount)
- **Quotes & Packages** — formal quoting system (itemised)
- **Receipts** — band member receipts across both types
- Filter by tax year for reporting

---

## Migration: SQLite → Supabase

### Tables to migrate

| SQLite Table | → Supabase Table | Notes |
|---|---|---|
| `settings` | Split into `user_settings` + `band_settings` | Personal vs shared |
| `clients` | `clients` | Shared across band |
| `venues` | `venues` | Linked to clients |
| `band_members` | Already `profiles` in Supabase | Map across |
| `invoices` | `invoices` | With `created_by` user field |
| `receipts` | `receipts` | Linked to invoices |

### Migration approach

1. Create new Supabase tables with RLS (row-level security)
2. Build a one-time migration script in the native app
3. Import existing SQLite data into Supabase
4. Verify data integrity
5. Switch native app to use Supabase queries
6. Remove SQLite invoicing code (keep schema as reference)

### RLS (Row-Level Security) considerations

- All authenticated band members can **read** all invoices, quotes, receipts
- Only the **creator** (or admins) can **create/edit/delete** invoices and quotes
- All members can generate PDFs from any record (read access = can generate)
- Shared settings editable by admins only
- Personal settings editable by the owning user only

---

## Phases

### Phase 0: Audit Fixes (NOW - in progress)

Complete the current audit fix work. No new features until this is done.

### Phase 1: Supabase Data Migration

Move invoicing from SQLite to Supabase. This is the foundation for everything else.

- Design and create Supabase tables (clients, invoices, receipts, settings split)
- Write Supabase queries in `shared/supabase/queries.ts`
- Add shared TypeScript types in `shared/supabase/types.ts`
- Build migration script (SQLite → Supabase one-time import)
- Update native app to use Supabase for all invoicing
- Move HTML/CSS PDF templates to `shared/templates/`
- Verify everything works on native before touching web
- **Native app still works exactly as before, just backed by Supabase now**

### Phase 2: Web Invoicing

Give the band access to invoices on the web app.

- Invoice list view (all simple invoices)
- Invoice detail view (same info as native, read-only or read-write depending on user)
- On-demand PDF preview in browser (render HTML template in iframe)
- Download PDF / share via browser share API
- Receipt viewing and generation
- Tax year filtering and bulk PDF export
- Dashboard stats

### Phase 3: Package Builder & Quoting System

The formal quoting flow. Built on Supabase from day one. See `native/FEATURE_SPEC_PACKAGE_BUILDER.md`.

- Service catalogue (in shared settings)
- PLI management (in shared settings, certificate stored locally + key details in Supabase)
- Quote wizard (4 steps: client & event → build package → extras/PLI → preview)
- Transaction detail screen (lifecycle management)
- Itemised invoice generation (from accepted quote)
- Receipt generation (same split logic)
- Quote + itemised invoice PDF templates in `shared/templates/`
- Build on native first, then web

### Phase 4: Design Unification

Unified "Tangerine Timetree" branding across both apps.

- Retire "GigBooks" name
- Shared colour palette, typography, spacing conventions
- Consistent component patterns (cards, lists, forms, modals)
- Calendar as home screen on both platforms (already is on web, update native)
- App icon and branding refresh
- Native app renamed in Play Store listing

> **Note:** Design updates can happen incrementally alongside Phases 1-3 rather than as a separate big-bang phase. Each phase is an opportunity to align the look.

### Phase 5: iOS Polish (future)

- Ensure PWA works well on iOS Safari (notifications, home screen icon, splash screen)
- Or evaluate Capacitor wrapper for a proper iOS app from the React web code
- Same Supabase backend, same features

---

## What Doesn't Change

- **Shared calendar** — stays exactly as it is (Supabase, realtime, works great)
- **Gig data model** — single fee field, perfect for the band's shared view
- **Away dates** — no changes
- **Changelog** — no changes
- **Auth** — existing Supabase auth, all 4 members already have accounts
- **Simple invoice flow** — same wizard, same single-line invoice, just backed by Supabase instead of SQLite

---

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Backend | Supabase only (retire SQLite) | Single source of truth, cross-platform |
| PDF storage | None — generated on-demand | No storage costs, templates always current |
| PLI certificate | Stored locally + key details in Supabase | Certificate is a file (local), policy details are data (cloud) |
| Invoice numbering | Shared sequence across all invoice types | Avoids confusion, sequential for HMRC |
| New features | Build on Supabase from day one | Don't build in SQLite just to migrate later |
| Brand | Unified "Tangerine Timetree" | One app, two frontends |
| Native app | Stays as Android native (React Native) | Nathan's primary tool |
| Web/iOS | React PWA, installable on iOS | Band members' access point |

---

## Related Docs

- `native/FEATURE_SPEC_PACKAGE_BUILDER.md` — detailed spec for the quoting system (Phase 3)

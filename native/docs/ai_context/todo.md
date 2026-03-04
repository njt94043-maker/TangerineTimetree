# GigBooks — Todo

> Current tasks, priorities, and backlog.
> Update after every task completion.

---

## Current Priority
- **Phase 4: In-App Change Summary** — away_date_changelog table, last_opened_at, change summary banner/alert
- **Push to GitHub** → Vercel deploys Phase 2 + 3 web changes
- **Build release APK** → test on device (scroll fix, count badges, toast)
- **Test Tangerine Timetree on band members' iPhones**: Share URL, test PWA install, verify login

## Recently Completed (Phase 3 remaining — 2026-03-04)
- [x] 3.4 — Day sheet scroll fix (flexGrow: 0 → 1)
- [x] 3.5 — Calendar gig count indicator (both apps, >1 gig shows count badge)
- [x] 3.6 — Success feedback on save (ToastAndroid on native)

## Backlog
- Test themed templates on device (7 invoice + 7 receipt styles, SVG decorations)
- Fix HTML mockups (mockups/ folder) — include real base64 logo, add 3 themed mockups, create index.html
- Test on device: preview carousel, receipt styling, receipt generation, share individual receipts
- FreeAgent API integration — sync income/expenses for tax reporting (D-047, needs planning)

## Known Limitations (Not Bugs — By Design)
- No invoice editing (use "Create Similar" instead) — D-016
- No custom split percentages (equal splits only) — D-011
- No multi-user support (single-user app) — D-005
- No cloud sync (local-only by design) — D-015
- No email/phone validation (single-user app) — audit decision
- Status flow not enforced (draft→sent→paid flexible) — audit decision

## Tech Debt
_None identified._

## Completed
- [x] Phase 2: Web Visual Redesign — safe areas, touch targets, fonts, contrast, spacing, accessibility (2026-03-04)
- [x] Phase 3 remaining: day sheet scroll, gig count badge, save toast (2026-03-04)
- [x] Phase 1: Critical data & sync fixes — realtime list sync, error handling, form validation, auth expiry (2026-03-04)
- [x] Native gig list ported from web + Cal/List toggle + web toggle moved below calendar (2026-03-03)
- [x] Comprehensive audit + 6-phase fix plan created and approved (2026-03-03)
- [x] Monorepo restructure — C:\Apps\TGT\ with shared/web/native, unified Supabase layer, both tsc clean (2026-03-03)
- [x] Timetree gig list view — GigList.tsx + Cal/List toggle + CSS + getUpcomingGigs query (2026-03-03)
- [x] GigBooks gig_type sync — types, queries, calendar, day sheet, gig form, colors all updated (2026-03-03)
- [x] Shared gig calendar — Supabase backend + Tangerine Timetree PWA + GigBooks CLAUDE.md updates (2026-03-03)
- [x] 3 seasonal themed templates — christmas, halloween, valentine (6 new .ts files, types + dispatchers updated) (2026-03-02)
- [x] UX polish — preview viewport fix, single-style detail preview, share→sent, paid→auto-receipts (2026-03-02)
- [x] Swipe/preview features — save before share, WebView swipe fix, calendar swipe, full-screen preview (2026-03-02)
- [x] Core app build (all screens, DB, PDF, navigation)
- [x] SOT docs created (2026-03-02)
- [x] Multiple invoice styles — 4 styles: classic, premium dark, clean professional, bold rock (2026-03-02)
- [x] Real TGT logo — circular-cropped base64 PNG replacing generated SVG (2026-03-02)
- [x] Venues tied to clients — venues table, VenuePicker, client edit venue management (2026-03-02)
- [x] Full-screen invoice preview — WebView carousel replaces text summary + StylePicker (2026-03-02)
- [x] Delete invoice — with confirmation dialog, cleans up PDF files + receipts (2026-03-02)
- [x] Full usability audit — 22 items, 14 fixes across 8 batches (2026-03-02):
  - Atomic createInvoice transaction, duplicate receipt guard, receipt rounding fix
  - HTML escape in all 5 PDF templates (prevents broken PDFs from & < > in data)
  - CSV export newline fix
  - Calendar dynamic year default
  - Modal backdrop dismiss (VenuePicker + new client modal)
  - Unsaved changes warning on client edit
  - Full invoice list tab with search + pull-to-refresh
  - Dashboard pull-to-refresh + "View All Invoices" link
  - Deleted dead StylePicker.tsx

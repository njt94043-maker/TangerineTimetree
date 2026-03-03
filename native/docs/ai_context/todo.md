# GigBooks — Todo

> Current tasks, priorities, and backlog.
> Update after every task completion.

---

## Current Priority
- **Monorepo setup**: Combine GigBooks + Tangerine Timetree into `C:\Apps\TGT\` with shared/web/native structure (plan at `~/.claude/plans/partitioned-nibbling-narwhal.md`)
- **GigBooks gig list view**: Port `GigList.tsx` from Timetree web to React Native (list view only exists in Timetree currently)
- **Build + install GigBooks APK**: Pending color/gig_type changes need building and testing on device
- **Test Tangerine Timetree on band members' iPhones**: Share URL, test PWA install, verify login

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

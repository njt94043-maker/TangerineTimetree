# TGT — Todo

> Current tasks, priorities, and backlog.
> Update after every task completion. See STATUS.md for instant context.

---

## Sprint S9 — HTML Mockups ✅ COMPLETE
- [x] Create `mockups/native-mockup.html` — 24 screens, phone-framed
- [x] Create `mockups/web-mockup.html` — 20+ screens, desktop layout
- [x] Create `mockups/responsive-mockup.html` — unified responsive mockup with collapsible drawer nav
- [x] User approved mockups + confirmed collapsible drawer for BOTH apps
- APK build deferred — no native builds until app is finished

## Sprint S10 — Supabase Invoicing Schema + Migration Script ✅ COMPLETE
- [x] Write migration SQL: `clients`, `venues`, `invoices`, `receipts`, `user_settings`, `band_settings`
- [x] RLS policies: auth read, creator/admin write, own-row for user_settings, admin for band_settings
- [x] RPC function `next_invoice_number()` — atomic increment via SECURITY DEFINER
- [x] Shared types: Client, Venue, Invoice, InvoiceWithClient, Receipt, ReceiptWithMember, UserSettings, BandSettings, DashboardStats
- [x] Shared queries: full CRUD for all new tables + dashboard stats + markInvoicePaid + searchClients
- [x] Migration script: `native/scripts/migrate-sqlite-to-supabase.ts` (better-sqlite3 → Supabase service role)
- [x] Push migration to live Supabase (13 tables total)
- [x] Added `rpc` to SupabaseClientLike interface
- [x] Web tsc clean compile verified

## Sprint S12 — Shared PDF Templates ✅ COMPLETE
- [x] Created `shared/templates/` directory with colors.ts, htmlEscape.ts utilities
- [x] Moved 17 template files from `native/src/pdf/` → `shared/templates/`
- [x] Created barrel export `shared/templates/index.ts`
- [x] Updated `invoiceStyles.ts` — imports `InvoiceStyle` from `../supabase/types` (no duplication)
- [x] Fixed all themed template imports for `verbatimModuleSyntax` (type-only imports)
- [x] Updated 4 native invoice screens to use `@shared/templates/*`
- [x] Updated `native/src/db/queries.ts` — consolidated `InvoiceStyle` import from shared types
- [x] Cleaned up `native/src/pdf/` — only `generatePdf.ts` remains (native-only expo-print)
- [x] TypeScript clean: both `native --noEmit` and `web -b` pass

## Sprint S11 — Native SQLite → Supabase Swap ✅ COMPLETE
- [x] Rewrote `native/src/db/queries.ts` as thin Supabase adapter (wraps shared/supabase/queries)
- [x] Updated `native/src/db/index.ts` — removed initDatabase, simplified re-exports
- [x] Created `LoginGate.tsx` component — full-app login gate in `_layout.tsx`
- [x] Updated invoice screens — removed pdf_uri references, on-demand PDF generation
- [x] Updated settings screen — band members read-only from Supabase profiles
- [x] Updated shared `InvoiceStyle` type — 7 styles matching native templates
- [x] Backed up SQLite files as `database.sqlite.ts` / `queries.sqlite.ts`
- [x] TypeScript clean: both `native --noEmit` and `web -b` pass
- [ ] **TODO**: Run SQLite migration script (`native/scripts/migrate-sqlite-to-supabase.ts`) — needs env vars
- [ ] **TODO**: Manual testing on device when APK build works

## Completed (Sprint S3 — 2026-03-04)
- [x] Document Supabase tables + RLS policies in schema_map.md (Part B added)
- [x] Create web/docs/blueprint.md (web app architecture doc)
- [x] Set up GitHub Actions CI/CD (.github/workflows/check.yml — tsc on PRs)
- [x] Create web/.env.example
- [x] Fix native blueprint.md (7 invoice styles, 6 tables, Supabase exception to D-015)

## Completed (Sprint S4 — 2026-03-04)
- [x] Supabase schema migration (is_public flag, band_role, public_media table + RLS)
- [x] Shared types updated (is_public on Gig, band_role on Profile, PublicMedia type)
- [x] Shared queries updated (getPublicGigs, getPublicMedia, updateProfile, is_public in createGig)
- [x] Web gig form "Show on Website" toggle
- [x] Native gig form "Show on Website" toggle (Switch component)
- [x] Web profile page (name, band_role, email read-only, save, sign out)
- [x] Both tsc checks pass (native --noEmit + web -b)
- **Test Tangerine Timetree on band members' iPhones**: Share URL, test PWA install, verify login

## Completed (Sprint S5 — 2026-03-04)
- [x] PublicSite component (hero, gigs, about, for venues, pricing, contact, footer)
- [x] LoginModal component (overlay replacing full-page LoginPage)
- [x] App.tsx routing: PublicSite for unauth, LoginModal on demand
- [x] SEO: OG tags, Twitter cards, Schema.org JSON-LD (MusicGroup + LocalBusiness)
- [x] Dynamic public gigs via getPublicGigs()
- [x] Band member profiles (dynamic via getPublicProfiles, with fallback)
- [x] getPublicProfiles() added to shared queries
- [x] Public site CSS (responsive, mobile hamburger, glass-morphism)
- [x] Both tsc checks pass (native --noEmit + web -b)

## Completed (Sprint S6 — 2026-03-04)
- [x] Media gallery section (public site — responsive grid, lightbox, video embeds)
- [x] Media management UI (authenticated — upload photos to Supabase Storage, add YouTube videos, toggle visibility, delete)
- [x] Contact form submitting to Supabase `contact_submissions` table (no external service needed)
- [x] Enquiry inbox for band members (read/reply/archive, unread badge)
- [x] Supabase migration: `public-media` Storage bucket + `contact_submissions` table + RLS policies (pushed live)
- [x] Gallery nav link (conditional — shows when media exists)
- [x] Shared media + contact CRUD queries
- [x] Both tsc checks pass (native --noEmit + web -b)
- **Manual step**: IONOS DNS pointing to Vercel

## Completed (Sprint S8 — 2026-03-04)
- [x] Extracted ~80 inline `style={{}}` to CSS classes across 8 web components (App, DayDetail, GigForm, AwayManager, GigList, Enquiries, MediaManager, ProfilePage, LoginModal)
- [x] Created `ViewProvider` + `useView()` context — navigation state extracted from MainView, eliminates 8 local handler functions
- [x] Added `ErrorBoundary` component (web + native) — wraps app-level rendering with graceful fallback
- [x] Added `prefers-color-scheme: light` CSS media query — full light theme with adjusted colours, shadows, glows
- [x] Configured Vite code splitting (`manualChunks` for PublicSite + Media/Enquiries)
- [x] IONOS DNS configured via API (A → 76.76.21.21, CNAME www → cname.vercel-dns.com) — propagated
- [x] Both tsc checks pass (native --noEmit + web -b)

## Completed (Sprint S7 — 2026-03-04)
- [x] Extracted date formatting utilities → `web/src/utils/format.ts` (fmt, fmtFee, formatDisplayDate, formatGroupDate, daysUntil, formatRange, formatRelative, formatShortDate)
- [x] Created `useMutationWithQueue` hook — reusable try/catch/isNetworkError/queueMutation pattern
- [x] Created shared `ErrorAlert` and `LoadingSpinner` components (web) — replaced 8+ inline error/loading patterns
- [x] Added skeleton loaders to GigList and DayDetail (animated pulse CSS)
- [x] Added input validation: bank sort code auto-format (XX-XX-XX), payment terms clamp (1-365), invoice amount round to 2dp on blur
- [x] Replaced all 5 browser `confirm()` calls with themed `ConfirmModal` component (GigForm ×2, DayDetail, AwayManager, MediaManager)
- [x] Both tsc checks pass (native --noEmit + web -b)

## Sprint S13 — Web Invoicing + Settings + Clients ✅ COMPLETE
- [x] Added format utilities to `web/src/utils/format.ts` — formatDateLong, formatGBP, todayISO, addDaysISO
- [x] Created `useInvoiceData` hook — getInvoices(), realtime subscription on invoices table
- [x] Created `useSettings` hook — getUserSettings() + getBandSettings(), merged CombinedSettings
- [x] Extended ViewContext — 6 new views + 7 nav helpers (goToInvoices, goToNewInvoice, goToEditInvoice, goToInvoiceDetail, goToInvoicePreview, goToSettings, goToClients)
- [x] Created Settings component — Your Details (bank info) + Band Settings (trading name, payment terms)
- [x] Created ClientList component — search, add/edit/delete, venue management modals
- [x] Created InvoiceList component — status filter tabs (All/Draft/Sent/Paid), stats bar, card list
- [x] Created InvoiceForm component — 3-step wizard (client → details → style carousel preview), iframe srcdoc preview
- [x] Created InvoiceDetail component — info card, status controls, receipts list, preview/duplicate/delete actions
- [x] Created InvoicePreview component — multi-page iframe (invoice + receipts), print via contentWindow.print()
- [x] Wired all into App.tsx — imports, conditional renders, nav buttons (Invoices, Clients, Settings)
- [x] Added ~250 lines invoice/settings/client CSS to App.css, added invoicing chunk to vite code splitting
- [x] TypeScript clean: both `web -b` and `native --noEmit` pass

## Sprint S14 — Dashboard + Export + Invoice Polish ✅ COMPLETE
- [x] Added `dashboard` view to ViewContext + `goToDashboard` nav helper, default authenticated view
- [x] Created Dashboard component — stats cards (total invoiced, outstanding, paid, tax year), overdue alerts, recent invoices, monthly breakdown, quick nav
- [x] Created `web/src/utils/export.ts` — CSV export with `exportInvoicesCSV()`, `filterByTaxYear()`, browser download
- [x] Dashboard export buttons — all invoices CSV + tax-year-filtered CSV
- [x] Extended InvoiceList with search bar (invoice number, client, venue, description) + sort options (date, amount, status)
- [x] Updated App.tsx — Dashboard wired as default view, Home/Cal/List view toggle, back targets point to dashboard
- [x] Added ~120 lines dashboard CSS + sort/search controls CSS + light theme overrides
- [x] Polish: text-overflow ellipsis on long client names (invoice cards + client cards)
- [x] Added Dashboard to vite code splitting (invoicing chunk)
- [x] TypeScript clean: `web -b` passes

## Sprint S15 — Quote System Backend ✅ COMPLETE
- [x] Migration SQL: service_catalogue, quotes, quote_line_items, formal_invoices, formal_invoice_line_items, formal_receipts
- [x] ALTER band_settings: pli_insurer, pli_policy_number, pli_cover_amount, pli_expiry_date, default_terms_and_conditions, default_quote_validity_days, next_quote_number
- [x] RLS policies for all 6 new tables + RPC next_quote_number()
- [x] Pushed migration to live Supabase (19 tables total)
- [x] Shared types: QuoteStatus, EventType, PLIOption, ServiceCatalogueItem, Quote, QuoteWithClient, QuoteLineItem, FormalInvoice, FormalInvoiceWithClient, FormalInvoiceLineItem, FormalReceipt, FormalReceiptWithMember + BandSettings extended
- [x] Shared queries: service catalogue CRUD, quote CRUD + line items, lifecycle (sendQuote, acceptQuote, declineQuote, expireQuote), formal invoices (get, getByQuote, send, markPaid → receipts), formal receipts, updateBandSettingsExtended
- [x] Quote PDF templates: quoteTemplate.ts (classic) + 6 themed variants + getQuoteHtml.ts router
- [x] Formal invoice PDF templates: formalInvoiceTemplate.ts (classic) + 6 themed variants + getFormalInvoiceHtml.ts router
- [x] Updated shared/templates/index.ts barrel export
- [x] TypeScript clean: both `web -b` and `native --noEmit` pass

## Sprint S16 — Web Quote Wizard + Service Catalogue UI ✅ COMPLETE
- [x] Extended ViewContext — 4 new views (quotes, quote-form, quote-detail, quote-preview) + 5 nav helpers + quoteId/editQuoteId state
- [x] Created `useQuoteData` hook — getQuotes() + realtime subscription on quotes table
- [x] Extended Settings component — Service Catalogue (CRUD, reorder), PLI Insurance (4 fields), Default T&Cs (textarea), Quote Defaults (validity days). Save via updateBandSettingsExtended().
- [x] Created QuoteList component — stats bar (quoted/pending/accepted), search, 6 filter tabs (all/draft/sent/accepted/declined/expired), sort, quote cards with status badges
- [x] Created QuoteForm component — 4-step wizard: Step 1 client & event (client select + event type/date/venue), Step 2 package builder (service catalogue picker + custom items + line item editing + discount + running total), Step 3 extras (PLI toggle + T&Cs + validity + notes), Step 4 preview carousel (7 styles, iframe, create quote)
- [x] Wired into App.tsx — imports, useQuoteData hook, quote views, Quotes nav button, handleQuoteSaved callback
- [x] Added ~150 lines CSS — service catalogue list, package builder, line items, running total, PLI toggle, extras
- [x] TypeScript clean: `web -b` passes

## Sprint S17 — Web Quote Lifecycle + Formal Invoicing ✅ COMPLETE
- [x] Created QuoteDetail component — 6-stage progressive lifecycle (Draft → Sent → Accepted → Invoice Sent → Paid), plus Declined/Expired. Progress tracker, line items table, formal invoice section, formal receipts, stage history
- [x] Created QuotePreview component — multi-page iframe: quote page, formal invoice (if accepted), receipt pages (if paid). Print support
- [x] Implemented Accept flow — acceptQuote() auto-generates formal invoice, copies line items, shows for review. Send Invoice and Mark Paid buttons
- [x] Calendar integration — on quote acceptance, ConfirmModal prompts to add gig via createGig() with date/venue/fee pre-filled
- [x] Wired QuoteDetail + QuotePreview into App.tsx (imports, view renderers, goToQuotePreview/goToEditQuote destructured)
- [x] Added handleAddGigFromQuote handler in MainView
- [x] Updated vite code splitting — QuoteList/QuoteForm/QuoteDetail/QuotePreview added to invoicing chunk
- [x] Added ~120 lines CSS — progress tracker, line items table, notes text, stage controls, light theme overrides
- [x] TypeScript clean: `web -b` passes

## Sprint S18 — Native Quote UI Parity ✅ COMPLETE
- [x] Extended StatusBadge to support quote statuses (accepted, declined, expired, invoice-sent)
- [x] Added quote adapter functions to native/src/db/queries.ts — service catalogue CRUD, quote CRUD + lifecycle, formal invoice + receipts, extended band settings
- [x] Created native/app/(tabs)/quotes.tsx — quote list with stats bar, search, 6 filter tabs, pull-to-refresh
- [x] Created native/app/quote/new.tsx — 4-step wizard: Step 1 client & event (client search/create + event type/date/venue), Step 2 package builder (service catalogue + custom items + line items + discount + totals), Step 3 extras (PLI toggle + T&Cs + validity + notes), Step 4 preview carousel (7 styles, WebView)
- [x] Created native/app/quote/[id].tsx — quote detail + lifecycle (progress tracker, line items, notes/T&Cs, history, formal invoice section, stage-dependent actions: send/accept/decline/expire/send invoice/mark paid/delete)
- [x] Created native/app/quote/preview.tsx — multi-page PDF preview carousel (quote + formal invoice + receipts), share PDF
- [x] Updated native/app/(tabs)/settings.tsx — service catalogue CRUD (add/edit/delete), PLI insurance (4 fields), default T&Cs textarea, quote defaults (validity days), extended save via updateBandSettingsExtended()
- [x] Updated native/app/(tabs)/_layout.tsx — added Quotes tab (📝 emoji, between Invoices and Clients)
- [x] TypeScript clean: `native --noEmit` passes

## Sprint S19 — Navigation + Design Unification ✅ COMPLETE
- [x] Unified native theme (COLORS, shadows, typography) to match web/mockup darker palette
- [x] Web: Created Drawer component with 3-mode responsive behavior (mobile overlay, tablet rail, desktop full)
- [x] Web: Integrated drawer into App.tsx — removed main-actions button list and view-toggle
- [x] Web: Added drawer CSS, hamburger, responsive breakpoints (@768, @1024, @1440), removed max-width:480px
- [x] Web: Updated header — fixed position, hamburger toggle, brand text, avatar, screen name
- [x] Native: Installed @react-navigation/drawer, renamed (tabs) to (drawer)
- [x] Native: Created custom drawer layout with neumorphic styling, section headers, green active indicator
- [x] Native: Updated all 6 screens — removed SafeAreaView/redundant headers (drawer header handles safe area)
- [x] TypeScript clean: both `web -b` and `native --noEmit` pass, `vite build` succeeds

## Sprint S19+ — Calendar Restyle + Filter Dropdowns + Native/Web Parity ✅ COMPLETE
- [x] Web: Calendar cells restyled from white circles to dark inset rectangles with colored glow
- [x] Web: Calendar made default landing page, back buttons go to calendar (not dashboard)
- [x] Web: Today button centered below month/year header
- [x] Native: Calendar cells restyled from circles to dark inset rectangles (borderRadius: 6, dark bg, colored glow)
- [x] Native: Gigs screen made default drawer route (swapped index/dashboard)
- [x] Web: Invoice + Quote filter tabs replaced with dropdown selects (matching sort dropdown style)
- [x] Native: Created reusable NeuSelect dropdown component (modal picker, neumorphic styling)
- [x] Native: Invoices screen — added stats bar, filter dropdown, sort dropdown (matching web)
- [x] Native: Quotes screen — replaced filter tabs with filter dropdown, added sort dropdown (matching web)
- [x] GestureHandlerRootView wrapper added to native root layout (drawer crash fix)
- [x] S9-S19 committed & pushed to master (Vercel auto-deployed)
- [x] TypeScript clean: both `web -b` and `native --noEmit` pass

## Sprint S20 — Branding + Polish ✅ COMPLETE
- [x] Clear-bg logo (`Main512 pic.png`) copied to web/public/ (logo-512, logo-192, logo) + native/assets/ (icon, adaptive-icon, splash-icon, favicon, logo-512)
- [x] Logo image added to web Drawer header + native Drawer header (alongside brand text)
- [x] SplashScreen component (animated "Juice Drop" — logo drop-in, juice splat particles, word reveal, loading dots) wired into App.tsx
- [x] SkeletonLoaders components (PageLoader, CardSkeleton, InlineSkeleton, DotLoader) — replaced LoadingSpinner in Dashboard, InvoiceList, QuoteList
- [x] Native app.json splash/adaptive-icon bg updated to #08080c (matching theme)
- [x] Service role key stored in .env (gitignored) with NATHAN_USER_ID
- [x] TypeScript clean: both `web -b` and `native --noEmit` pass, vite build passes

## Upcoming Sprints
| Sprint | Focus | Key Deliverables |
|--------|-------|------------------|
| S21 | APK build fix + device testing | Debug native crash, fix cmake error, install on Samsung, run migration, seed data, end-to-end test |

> Pickup prompts for each sprint: `native/docs/ai_context/SPRINT_PROMPTS.md`

## S21 — COMPLETE
- [x] Day detail swipe navigation + back-button fix
- [x] Fixed native crash (@react-navigation/native version mismatch)
- [x] iOS wheel time picker (WheelTimePicker.tsx)
- [x] Field autocomplete (venue/client/fee — frequency-sorted)
- [x] Layout parity pass: dashboard, daysheet, clients, gig form
- [x] APK built + installed on device
- [ ] User to verify 44 WhatsApp-confirmed fees, then batch-update

## S23 — Venue/Client Restructure (NEXT — 4-SESSION EPIC)

**Design decision**: Venues and clients are separate, independent lists. Gigs/quotes/invoices link to both via FKs. No forced venue→client relationship. See decisions_log.md D-072.

### S23A — Database + Types + Queries (Session 1) ✅ COMPLETE
- [x] Snapshot current data (JSON backup — `backups/snapshot-s23a-2026-03-05.json`)
- [x] Supabase migration SQL pushed (`20260305200000_s23a_venue_client_restructure.sql`):
  - ALTER venues: dropped client_id, added postcode, rating_atmosphere/crowd/stage/parking (1-5 CHECK), notes
  - CREATE venue_photos (id, venue_id FK CASCADE, file_url, storage_path, caption, created_by, created_at)
  - ALTER gigs: added venue_id (FK SET NULL), client_id (FK SET NULL)
  - ALTER quotes: added venue_id (FK SET NULL)
  - ALTER invoices: added venue_id (FK SET NULL)
  - ALTER formal_invoices: added venue_id (FK SET NULL)
  - RLS policies for venue_photos + updated venue policies
  - Storage bucket: venue-photos (public) + storage policies
- [x] Updated shared/supabase/types.ts — Venue (new fields), VenuePhoto, Gig (+venue_id, +client_id), Quote (+venue_id), Invoice (+venue_id), FormalInvoice (+venue_id)
- [x] Updated shared/supabase/queries.ts — getVenues, getVenue, searchVenues, createVenue (overloaded), updateVenue, venue photo CRUD, createGig/createInvoice/createQuote accept venue_id, acceptQuote carries venue_id to formal invoice
- [x] Updated native/src/db/queries.ts wrapper — new venue/photo exports, backwards-compat getVenuesForClient/addVenue
- [x] TypeScript clean: both `web -b` and `native --noEmit` pass

### S23B — Venue Management UI (Session 2) ✅ COMPLETE
- [x] Native: StarRating component (reusable, 1-5 stars, tap to set/clear)
- [x] Native: Venues drawer screen (list, search, add, avg rating on cards)
- [x] Native: venue/new.tsx (name, address, postcode form)
- [x] Native: venue/[id].tsx (edit + 4 star ratings + notes + photo gallery + upload)
- [x] Web: VenueList (list, search, add modal, cards with avg stars)
- [x] Web: VenueDetail (edit + ratings + notes + photo gallery + upload)
- [x] Web: ViewContext + Drawer wired (venues + venue-detail views)
- [x] Web: App.tsx + CSS + vite config updated
- [x] Decoupled venues from client screens (both apps — removed venue state/functions/UI)
- [x] TypeScript clean: both native --noEmit and web -b pass

### S23C — Gig Booking Flow (Session 3) ✅ COMPLETE
- [x] EntityPicker component (web: searchable dropdown + inline "Add New" form)
- [x] EntityPicker component (native: FlatList dropdown, neumorphic styling)
- [x] GigForm: venue/client pickers replace AutocompleteInput, save venue_id/client_id
- [x] Native gig/new.tsx: same venue/client picker changes
- [x] DayDetail (web): Navigate button — fetches venue address, opens map app
- [x] GigDaySheet (native): Navigate button — Linking.openURL to map app
- [x] Settings (web): Preferences section with Map App dropdown (localStorage)
- [x] settings.tsx (native): Preferences section with Map App NeuSelect (AsyncStorage)
- [x] Free-text entry still works (venue_id stays null for unlinked entries)
- [x] TypeScript clean: both native --noEmit and web -b pass, vite build passes

### S23D — Quote + Invoice Chain (Session 4) ✅ COMPLETE
- [x] Web QuoteForm: EntityPicker for venue, venue_id passed to createQuote, auto-fill address
- [x] Web InvoiceForm: EntityPicker replaces datalist, venue_id passed to createInvoice
- [x] Native quote/new.tsx: EntityPicker for venue, venue_id + auto-fill address
- [x] Native invoice/new.tsx: EntityPicker replaces VenuePicker, venue_id passed
- [x] Quote → Gig conversion: carries venue_id + client_id + client_name (web QuoteDetail + App.tsx + native quote/[id])
- [x] Native quote accept flow: added "Add Gig" prompt matching web UX
- [x] Surgical audit — 8 fixes:
  - EntityPicker dropdown visible on zero results (both apps — "Add New" was unreachable)
  - EntityPicker error handling on create (Alert on native, inline error on web)
  - EntityPicker debounce cleanup on unmount (both apps)
  - Native quote/[id] — formal invoice state cleared on re-navigate, try/catch on ALL 7 action handlers
  - Stale venue address cleared when user re-types venue (both QuoteForms)
  - NeuButton disabled prop + double-tap prevention on approve buttons
  - Native quote/new + invoice/new — init Promise.all + search wrapped in try/catch
- [x] TypeScript clean: both native --noEmit and web -b pass, vite build passes

## S22 — Native Visual Overhaul ✅ COMPLETE
- [x] Phase 1: Foundation — BODY/BODY_BOLD fontSize 13→14, NeuButton minHeight 48 + paddingH 20, NeuWell minHeight 44, NeuSelect trigger sizing, StatusBadge fontSize 10, GigDaySheet overlay 0.7 + card padding 16
- [x] Phase 2: List cards — left-border accents (invoices: paid=green/sent=orange/draft=muted, quotes: accepted/sent/declined/expired), stats row neuRaisedStyle shadows, addBtn text #000 on green bg, font bumps
- [x] Phase 3: GigDaySheet gigClient/awayName 14px, GigList card padding 16 + margin 12, EntityPicker input minHeight 44 + font bumps
- [x] Phase 4: Drawer item paddingV 12→10, gig/invoice/quote form font bumps, venue detail font bumps
- [x] ~20 files modified, all StyleSheet style-only changes, zero logic changes
- [x] TypeScript clean: both native --noEmit and web -b pass

## Backlog
- ~~Seed calendar from `C:\Apps\timetree-scrape\timetree_gigs.xlsx`~~ DONE (117 gigs + 62 away dates in Supabase)
- FreeAgent API integration — sync income/expenses for tax reporting (D-047, needs planning)

## Key Decisions (This Session)
- Full feature parity between native and web (any member can do anything)
- Supabase replaces SQLite for ALL data (ROADMAP_V2 supersedes D-015)
- Collapsible drawer navigation on BOTH apps (not tabs)
- PDFs generated on-demand (no cloud storage), templates in shared/templates/
- Shared invoice number sequence (TGT-XXXX via RPC), separate quote sequence (QTE-XXX)
- Unified Tangerine Timetree brand — mockups define the end-state target

## Recently Completed (This Session — 2026-03-04)
- [x] Sprint S13: Web invoicing — 6 components (InvoiceList, InvoiceForm, InvoiceDetail, InvoicePreview, Settings, ClientList), 2 hooks, ViewContext extended, ~250 lines CSS, vite code splitting, tsc clean
- [x] Sprint S12: Shared PDF templates — 17 files moved to shared/templates/, barrel export, native imports updated, tsc clean
- [x] Sprint S11: SQLite → Supabase swap — adapter, login gate, screen updates, pdf_uri removal, tsc clean
- [x] Sprint S10: Supabase invoicing schema, shared types/queries, migration script, pushed live
- [x] Sprint S8: CSS extraction, ViewContext, error boundaries, light theme, code splitting, DNS config
- [x] Sprint S7: Code dedup, shared components, skeleton loaders, validation, themed modals
- [x] Sprint S6: Media gallery, media manager, contact form → Supabase, enquiry inbox, Storage bucket + migration pushed
- [x] Sprint S5: PublicSite, LoginModal, SEO, public gigs, member profiles
- [x] Sprint S4: Schema migration, is_public toggle (web + native), profile page
- [x] Sprint S2 code fixes (type safety, error handling, offline improvements)
- [x] Spinner time picker (replaced analogue clock with digital spinner)
- [x] DayDetail delete button with offline queueing
- [x] Conflict detection in web offline queue (entity existence check before replay)

## Completed (Previous Session — 2026-03-04)
- [x] Full codebase audit (shared, native, web, SOT docs, config — 5 parallel agents)
- [x] Created STATUS.md instant-context document (SOT redesign)
- [x] Fixed CRITICAL: Added updateAwayDate to offline queues (native + web)
- [x] Fixed CRITICAL: Added session refresh to AuthContext (prevents expired JWT on mount)
- [x] Fixed CRITICAL: Wrapped createReceipts() in atomic transaction
- [x] Restructured todo.md (Blocked/Next/Planned/Backlog sections)
- [x] Updated CLAUDE.md session protocol to use STATUS.md
- [x] Defined sprint roadmap (S2-S8)

## Completed (Previous Sessions)
- [x] Phase 6: Polish & Remaining Items (2026-03-04)
- [x] Phase 5: Full Offline Support (2026-03-04)
- [x] Phase 4: In-App Change Summary (2026-03-04)
- [x] Phase 2: Web Visual Redesign (2026-03-04)
- [x] Phase 3 remaining: day sheet scroll, gig count badge, save toast (2026-03-04)
- [x] Phase 1: Critical data & sync fixes (2026-03-04)
- [x] Native gig list + Cal/List toggle (2026-03-03)
- [x] Comprehensive audit + 6-phase fix plan (2026-03-03)
- [x] Monorepo restructure (2026-03-03)
- [x] Shared gig calendar — Supabase backend + Timetree PWA (2026-03-03)
- [x] 3 seasonal themed templates (2026-03-02)
- [x] Core app build, SOT docs, multiple invoice styles, UX polish (2026-03-02)

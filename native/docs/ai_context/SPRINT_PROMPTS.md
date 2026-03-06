# TGT — Sprint Pickup Prompts

> Copy-paste the next sprint's prompt to start a fresh session.
> Each prompt gives the AI full context to pick up where we left off.

---

## Sprint S2 — APK Build Fix + HIGH Code Issues

```
Read native/docs/ai_context/STATUS.md and native/docs/ai_context/todo.md. This is Sprint S2.

Goals:
1. Fix the APK build failure — the cmake error from @react-native-community/datetimepicker JNI codegen. Try `npx expo prebuild --clean` first, then `cd android && ./gradlew assembleRelease`. If that doesn't work, debug the cmake output or try installing newer cmake via sdkmanager.
2. Fix HIGH code issues in shared/supabase/queries.ts — replace `any` casts in row mappings with typed interfaces, add error handling to changelog inserts.
3. Fix shared/supabase/clientRef.ts — improve SupabaseClientLike interface with proper return types instead of `any`.
4. Fix native/src/db/queries.ts — make getSettings() return `GigBooksSettings | null` and handle null in callers.
5. Fix web/src/hooks/useOfflineQueue.ts — add conflict detection (check if entity still exists before replaying).
6. Add offline mutation support to web/src/components/DayDetail.tsx.

Run `npx tsc --noEmit` (native) and `npx tsc -b` (web) after all changes. Update SOT docs at session end.
```

---

## Sprint S3 — Documentation + CI/CD

```
Read native/docs/ai_context/STATUS.md and native/docs/ai_context/todo.md. This is Sprint S3.

Goals:
1. Document all Supabase tables in native/docs/ai_context/schema_map.md — add profiles, gigs, away_dates, gig_changelog, away_date_changelog tables with full column definitions and RLS policies.
2. Create web/docs/blueprint.md — web app architecture document covering: routing, components, hooks, PWA config, styling approach, data flow, offline strategy.
3. Set up GitHub Actions CI/CD — create .github/workflows/check.yml that runs `npx tsc --noEmit` (native) and `npx tsc -b` (web) on pull requests.
4. Create web/.env.example with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY placeholders.
5. Update native/docs/ai_context/blueprint.md — fix "4 invoice styles" to "7 styles", fix "5 tables" to "6 tables", clarify Supabase exception to D-015.

Update SOT docs at session end.
```

---

## Sprint S4 — Public Website Sprint 1

```
Read native/docs/ai_context/STATUS.md and native/docs/ai_context/todo.md. This is Sprint S4 (Public Website Sprint 1).

Reference: C:\Apps\TGT\PLAN_PUBLIC_SITE.md has the full implementation plan.

Goals:
1. Supabase schema migration — add `is_public` boolean (default false) to gigs table, add `band_role` text to profiles table, create `public_media` table. Add RLS policies for anonymous read access on public data.
2. Update shared/supabase/types.ts — add is_public to Gig type, band_role to Profile type, add PublicMedia type.
3. Update shared/supabase/queries.ts — add getPublicGigs() query (anonymous, is_public=true only), add updateProfile() for band_role.
4. Add "Show on Website" toggle to web gig form (GigForm.tsx) — checkbox that sets is_public.
5. Add "Show on Website" toggle to native gig form (app/gig/new.tsx) — Switch component.
6. Create web profile page — editable name + band_role fields.

Run tsc checks on both apps. Test web changes in browser. Update SOT docs at session end.
```

---

## Sprint S5 — Public Website Sprint 2

```
Read native/docs/ai_context/STATUS.md and native/docs/ai_context/todo.md. This is Sprint S5 (Public Website Sprint 2).

Reference: C:\Apps\TGT\PLAN_PUBLIC_SITE.md for design specs.

Goals:
1. Build PublicSite component (web/src/components/PublicSite.tsx) — unauthenticated landing page with 7 sections: hero, upcoming gigs, about the band, for venues, pricing, gallery placeholder, contact.
2. Update web/src/App.tsx routing — show PublicSite for unauthenticated users instead of LoginPage. Add "Band Login" button that opens login modal.
3. Create LoginModal component — overlay modal replacing the full-page LoginPage.
4. Add SEO meta tags — OpenGraph, Twitter cards, structured data for band/events.
5. Fetch and display public gigs on the landing page using getPublicGigs().
6. Display band member profiles (names, roles, photos) from Supabase.

Run tsc checks. Test responsive layout (mobile + desktop). Update SOT docs at session end.
```

---

## Sprint S6 — Public Website Sprint 3

```
Read native/docs/ai_context/STATUS.md and native/docs/ai_context/todo.md. This is Sprint S6 (Public Website Sprint 3).

Reference: C:\Apps\TGT\PLAN_PUBLIC_SITE.md for design specs.

Goals:
1. Build media gallery section — fetch from public_media table, display photos/videos in responsive grid.
2. Add media upload UI for authenticated band members — upload to Supabase Storage, insert into public_media table.
3. Build contact form — email submission for booking enquiries (consider Formspree or similar service).
4. Set up IONOS domain → Vercel — A record (76.76.21.21) + CNAME (cname.vercel-dns.com). Add custom domain in Vercel project settings.
5. Final polish — test all public pages, verify SEO tags, check mobile responsiveness, test PWA install from custom domain.

Run tsc checks. Test on multiple devices. Update SOT docs at session end.
```

---

## Sprint S7 — MEDIUM Code Issues Batch

```
Read native/docs/ai_context/STATUS.md and native/docs/ai_context/todo.md. This is Sprint S7.

Goals — fix MEDIUM code issues identified in the audit:
1. Extract date formatting utilities — consolidate duplicated formatGroupDate/daysUntil/formatDisplayDate from web components into web/src/utils/format.ts.
2. Create useMutationWithQueue hook — extract duplicated form submit + offline queue pattern from GigForm.tsx and AwayManager.tsx.
3. Create shared ErrorAlert and LoadingSpinner components (web) — replace inline error/loading patterns.
4. Add loading states/skeleton loaders — replace "Loading..." text in GigList, DayDetail, Calendar.
5. Add input validation — bank sort code format, payment terms clamping, invoice amount rounding to 2 decimal places.
6. Replace browser confirm() dialogs with themed modals (web GigForm + AwayManager delete confirmations).

Run tsc checks on both apps. Update SOT docs at session end.
```

---

## Sprint S8 — Polish Pass

```
Read native/docs/ai_context/STATUS.md and native/docs/ai_context/todo.md. This is Sprint S8.

Goals — final polish:
1. Extract inline styles to CSS classes (web) — move style={{}} objects to App.css or component-scoped CSS.
2. Replace prop drilling with Context API (web) — create ViewContext for navigation state, reduce callback threading through MainView.
3. Add React error boundaries (web + native) — catch rendering errors gracefully.
4. Add prefers-color-scheme support (web CSS) — light theme variant.
5. Configure explicit code splitting (web vite.config.ts) — route-based chunks for Calendar, GigForm, GigList.
6. Test themed templates on device (7 invoice + 7 receipt styles).
7. Final pass: run both tsc checks, test web PWA, test native on device if APK working.

Update SOT docs at session end. Review STATUS.md — mark remaining items as complete or move to future backlog.
```

---

## Sprint S13 — Web Invoicing + Settings + Client Management

```
Read native/docs/ai_context/STATUS.md and native/docs/ai_context/todo.md. This is Sprint S13.

Goals — Web invoicing + settings + client management:
1. Add format utilities to web/src/utils/format.ts — formatDateLong, formatGBP, todayISO, addDaysISO.
2. Create useInvoiceData hook (web) — calls getInvoices(), realtime subscription on invoices table.
3. Create useSettings hook (web) — calls getUserSettings() + getBandSettings(), merges into flat CombinedSettings.
4. Extend ViewContext — add views: invoices, invoice-form, invoice-detail, invoice-preview, settings, clients. Add nav helpers: goToInvoices, goToNewInvoice, goToEditInvoice, goToInvoiceDetail, goToInvoicePreview, goToSettings, goToClients.
5. Create Settings component — two sections: Your Details (bank info via upsertUserSettings) + Band Settings (trading name, payment terms via updateBandSettings). Follow ProfilePage pattern.
6. Create ClientList component — list clients, add/edit/delete, venue management. Uses getClients, createClient, updateClient, deleteClient, searchClients from shared queries.
7. Create InvoiceList — status filter tabs (All/Draft/Sent/Paid), stats bar (total invoiced/outstanding/paid via getDashboardStats), card list with invoice number, client, amount, status badge, dates.
8. Create InvoiceForm — 3-step wizard mirroring native/app/invoice/new.tsx: Step 1 client selection/creation, Step 2 gig details (venue, date, amount, description), Step 3 style carousel preview. Uses getInvoiceHtml() from @shared/templates in iframe srcdoc. Approve saves via createInvoice().
9. Create InvoiceDetail — invoice info card, status controls (draft/sent/paid), receipts list, actions (preview, print, duplicate, delete). Uses getInvoice, updateInvoiceStatus, markInvoicePaid, deleteInvoice.
10. Create InvoicePreview — multi-page iframe (invoice + receipts). Print via iframe.contentWindow.print(). Uses getInvoiceHtml/getReceiptHtml from @shared/templates.
11. Wire all into App.tsx — imports, conditional renders, nav buttons (Invoices, Clients, Settings in main-actions).
12. Add ~250 lines invoice/settings/client CSS to App.css. Add invoicing chunk to vite.config.ts code splitting.

Run `npx tsc -b` (web) + `npx tsc --noEmit` (native). Update SOT docs at session end.
```

---

## Sprint S14 — Dashboard + Export + Invoice Polish

```
Read native/docs/ai_context/STATUS.md and native/docs/ai_context/todo.md. This is Sprint S14.

Goals — Dashboard + export + invoice polish:
1. Create Dashboard component (web) — stats cards (total invoiced, outstanding, paid from getDashboardStats), recent invoices list, monthly breakdown. Make dashboard the default authenticated view.
2. Create web/src/utils/export.ts — CSV export of invoices (filterable by tax year Apr-Mar), batch PDF download.
3. Add dashboard view to ViewContext, wire into App.tsx, add dashboard CSS.
4. Polish S13 work — fix any bugs, improve responsive layout, test edge cases (empty states, long client names, etc.).
5. Extend InvoiceList with sort options (date, amount, status) and search.

Run `npx tsc -b` (web). Update SOT docs at session end.
```

---

## Sprint S15 — Quote System Backend

```
Read native/docs/ai_context/STATUS.md and native/docs/ai_context/todo.md. This is Sprint S15. Read native/FEATURE_SPEC_PACKAGE_BUILDER.md for the full quoting system spec.

Goals — Quote system backend (no UI — schema + types + queries + templates):
1. Write Supabase migration SQL: service_catalogue, quotes, quote_line_items, formal_invoices, formal_invoice_line_items, formal_receipts. Add PLI + T&C + quote fields to band_settings. Add RLS policies. Add next_quote_number() RPC.
2. Push migration to live Supabase.
3. Add shared types to shared/supabase/types.ts: Quote, QuoteWithClient, QuoteLineItem, ServiceCatalogueItem, FormalInvoice, FormalInvoiceWithClient, FormalInvoiceLineItem, FormalReceipt, FormalReceiptWithMember, QuoteStatus, EventType, PLIOption.
4. Add shared queries to shared/supabase/queries.ts: full CRUD for service catalogue, quotes, quote line items. Lifecycle: sendQuote, acceptQuote (auto-creates formal invoice with line items), declineQuote, expireQuote. Formal invoices: getFormalInvoice, sendFormalInvoice, markFormalInvoicePaid (generate receipts). Formal receipts: getFormalReceipts.
5. Create quote PDF templates in shared/templates/: quoteTemplate.ts (classic) + 6 themed variants + getQuoteHtml.ts router. Create formalInvoiceTemplate.ts (classic) + 6 themed variants + getFormalInvoiceHtml.ts router. Update index.ts barrel.

Run `npx tsc -b` (web) + `npx tsc --noEmit` (native). Update SOT docs at session end.
```

---

## Sprint S16 — Web Quote Wizard + Service Catalogue UI

```
Read native/docs/ai_context/STATUS.md and native/docs/ai_context/todo.md. This is Sprint S16.

Goals — Web quote wizard + service catalogue UI:
1. Extend Settings component — add Service Catalogue section (add/edit/reorder/delete services), PLI section (insurer, policy number, cover, expiry), T&Cs section (default text editor), Quote Defaults (validity period).
2. Create useQuoteData hook — calls getQuotes(), realtime subscription.
3. Create QuoteList component — quote list with status filter (draft/sent/accepted/declined/expired), shows client, event type, date, total, status badge.
4. Create QuoteForm — 4-step wizard: Step 1 client & event (select/create client, event type, date, venue), Step 2 build package (select from service catalogue, adjust prices, custom items, quantity, discount, running total), Step 3 extras (PLI toggle, T&Cs, validity, notes), Step 4 preview (style carousel in iframe, "Create Quote" button).
5. Add quote views to ViewContext (quotes, quote-form, quote-detail, quote-preview). Wire into App.tsx. Add quote CSS to App.css.

Run `npx tsc -b` (web). Update SOT docs at session end.
```

---

## Sprint S17 — Web Quote Lifecycle + Formal Invoicing

```
Read native/docs/ai_context/STATUS.md and native/docs/ai_context/todo.md. This is Sprint S17.

Goals — Web quote lifecycle + formal invoicing:
1. Create QuoteDetail component — transaction detail screen with progressive stage buttons: Draft → Sent → Accepted → Invoice Sent → Paid → Complete. Also Declined/Expired. Shows client/event summary, total, current stage, linked documents, stage history.
2. Implement "Accept" flow — acceptQuote() auto-generates formal invoice with line items copied from quote. Show formal invoice for review/edit before sending.
3. Create QuotePreview component — multi-page iframe: quote page, formal invoice page (if exists), receipt pages (if paid). Same pattern as InvoicePreview.
4. Calendar integration — when quote is accepted, prompt to add gig to calendar. Pre-fill date, venue, fee from quote. Uses createGig().
5. Wire QuoteDetail and QuotePreview into App.tsx.

Run `npx tsc -b` (web). Update SOT docs at session end.
```

---

## Sprint S18 — Native Quote UI Parity

```
Read native/docs/ai_context/STATUS.md and native/docs/ai_context/todo.md. This is Sprint S18.

Goals — Native quote UI parity (mirror web S16+S17):
1. Create native/app/(tabs)/quotes.tsx — quote list tab with status filter.
2. Create native/app/quote/new.tsx — 4-step quote wizard (same flow as web QuoteForm).
3. Create native/app/quote/[id].tsx — transaction detail + lifecycle screen (same as web QuoteDetail).
4. Create native/app/quote/preview.tsx — quote PDF preview carousel (WebView, same pattern as invoice/preview.tsx).
5. Update native/app/(tabs)/settings.tsx — add service catalogue, PLI, T&Cs sections.
6. Update native/app/(tabs)/_layout.tsx — add Quotes tab.
7. Add quote adapter functions to native/src/db/queries.ts (wrapping shared queries, same pattern as invoice adapters).

Run `npx tsc --noEmit` (native). Update SOT docs at session end.
```

---

## Sprint S19 — Navigation + Design Unification

```
Read native/docs/ai_context/STATUS.md and native/docs/ai_context/todo.md. This is Sprint S19.

Reference: mockups/responsive-mockup.html for the target drawer nav design.

Goals — Navigation + design unification:
1. Web: Replace button-based main-actions with collapsible sidebar/drawer. Items: Dashboard, Calendar, Gig List, Invoices, Quotes, Clients, Away Dates, Media, Enquiries, Website, Settings, Profile. Hamburger on mobile, collapsible sidebar on desktop.
2. Native: Replace (tabs)/_layout.tsx tab navigation with drawer navigation. Same nav items as web. Neumorphic drawer styling.
3. Unified theme: verify COLORS, FONTS, spacing match across web + native. Consistent Tangerine Timetree branding (logo, header, accents).
4. Responsive polish: web drawer collapses correctly on mobile, invoice forms are usable on small screens.
5. Final visual QA pass on both apps.

Run `npx tsc -b` (web) + `npx tsc --noEmit` (native). Update SOT docs at session end.
```

---

## Sprint S20 — APK Build Fix + Full Device Testing

```
Read native/docs/ai_context/STATUS.md and native/docs/ai_context/todo.md. This is Sprint S20 — final sprint.

Goals — APK build fix + full device testing:
1. Fix APK build — cmake error from @react-native-community/datetimepicker. Try: npx expo prebuild --clean → cd android && ./gradlew assembleRelease. If stuck, try updating datetimepicker or cmake version.
2. Build APK, install on Samsung device (RFCW113WZRM).
3. Run SQLite migration script (native/scripts/migrate-sqlite-to-supabase.ts) — needs SUPABASE_SERVICE_ROLE_KEY + NATHAN_USER_ID env vars.
4. Seed calendar data — import 116 gigs + 62 away dates from C:\Apps\timetree-scrape\timetree_gigs.xlsx.
5. End-to-end testing on device: calendar CRUD, simple invoicing, quote lifecycle, client management, settings, PDF generation/sharing, dashboard, export, drawer nav.
6. Web PWA testing: install from thegreentangerine.com, offline mode, sync.
7. Final tsc checks: npx tsc -b (web) + npx tsc --noEmit (native).
8. Fix any bugs found during testing.

Update SOT docs — mark all sprints complete. Archive backlog items or move to future roadmap.
```

---

## Sprint S23A — Venue/Client Restructure: Database + Types + Queries

```
Read native/docs/ai_context/STATUS.md first, then todo.md (S23A section).

This is Session 1 of a 4-session venue/client restructure epic (S23A-D).

CONTEXT: We've redesigned venues and clients as two separate, independent lists:
- Venues = physical places (with ratings, notes, photos, addresses for navigation)
- Clients = people/companies who pay (with billing address, contact info)
- Gigs, quotes, and invoices link to BOTH via optional FKs (venue_id + client_id)
- No forced venue→client relationship
- Text fields (venue name, client_name) kept alongside IDs for denormalised display/PDF rendering
- No production data exists — clean restructure approved (snapshot first, then alter tables)

BLAST RADIUS (24 files total across S23A-D):
- shared/supabase/types.ts
- shared/supabase/queries.ts
- native/src/db/queries.ts
- 14 native app screens
- 10 web components
THIS SESSION only touches the first 3 (+ Supabase migration SQL).

TASKS FOR THIS SESSION (S23A):
1. Snapshot current data — dump clients, venues, gigs, quotes, invoices to a local JSON backup file
2. Write + push Supabase migration SQL:
   - ALTER venues: drop client_id FK + constraint, add postcode TEXT, rating_atmosphere SMALLINT (1-5), rating_crowd SMALLINT, rating_stage SMALLINT, rating_parking SMALLINT, notes TEXT
   - CREATE venue_photos (id UUID PK, venue_id UUID FK→venues ON DELETE CASCADE, file_url TEXT, storage_path TEXT, caption TEXT, created_by UUID FK→profiles, created_at TIMESTAMPTZ)
   - CREATE Supabase Storage bucket "venue-photos" (or reuse public-media if appropriate)
   - ALTER gigs: add venue_id UUID REFERENCES venues(id) ON DELETE SET NULL, add client_id UUID REFERENCES clients(id) ON DELETE SET NULL
   - ALTER quotes: add venue_id UUID REFERENCES venues(id) ON DELETE SET NULL
   - ALTER invoices: add venue_id UUID REFERENCES venues(id) ON DELETE SET NULL
   - ALTER formal_invoices: add venue_id UUID REFERENCES venues(id) ON DELETE SET NULL
   - RLS policies for venue_photos (same pattern as existing tables — auth read, creator write)
   - Update venue RLS if needed (remove client_id dependency)
3. Update shared/supabase/types.ts:
   - Venue: remove client_id, add postcode, rating_atmosphere, rating_crowd, rating_stage, rating_parking, notes
   - New: VenuePhoto interface
   - Gig: add venue_id (string | null), client_id (string | null)
   - Quote: add venue_id (string | null)
   - Invoice: add venue_id (string | null)
   - FormalInvoice: add venue_id (string | null)
4. Update shared/supabase/queries.ts:
   - Venue queries: decouple from clients (getVenues not getVenuesForClient), add searchVenues, updateVenue (with ratings), getVenue by ID
   - New: venue photo CRUD (getVenuePhotos, uploadVenuePhoto, deleteVenuePhoto)
   - Update createGig/updateGig to accept venue_id + client_id
   - Update createQuote to accept venue_id
   - Update createInvoice to accept venue_id
   - Keep all existing text-field params working (backwards compat for UI code not yet updated)
5. Update native/src/db/queries.ts wrapper — add/update venue functions, pass through new params
6. TypeScript clean: npx tsc -b (web) + npx tsc --noEmit (native) — MUST pass

DO NOT touch any UI files this session. Only: migration SQL, types, queries, native wrapper.
Update SOT docs when done (STATUS.md, todo.md, SESSION_LOG.md).
```

## Sprint S23B — Venue Management UI

```
Read native/docs/ai_context/STATUS.md first, then todo.md (S23B section).

This is Session 2 of the venue/client restructure epic. S23A (DB + types + queries) is complete.

TASKS:
1. Native: Add "Venues" to drawer nav (between Gigs and Clients)
2. Native: Create venues drawer screen — list with search, venue cards showing name + address + star ratings
3. Native: Create venue detail screen — edit name/address/postcode, star rating pickers (atmosphere/crowd/stage/parking), notes field, photo gallery with camera/gallery upload
4. Web: Create VenueList component — same features as native (search, cards, detail view)
5. Web: Add Venues to drawer nav + ViewContext
6. Remove venue sub-section from client edit screens (native client/[id].tsx + web ClientList.tsx) — venues are now independent
7. Photo upload: Supabase Storage "venue-photos" bucket, thumbnail display
8. TypeScript clean + build both apps

Update SOT docs when done.
```

## Sprint S23C — Gig Booking Flow

```
Read native/docs/ai_context/STATUS.md first, then todo.md (S23C section).

This is Session 3 of the venue/client restructure epic. S23A + S23B complete.

TASKS:
1. Gig form (BOTH native + web): Replace free-text venue input with searchable venue picker
   - Dropdown/autocomplete searching venues table
   - "Add New Venue" option that opens inline venue creation (name + address minimum)
   - On select: sets venue_id + writes venue name to text field
2. Gig form (BOTH): Replace free-text client_name with searchable client picker
   - Same pattern: dropdown, "Add New Client" inline
   - On select: sets client_id + writes client_name to text field
3. Day view (BOTH): Add "Navigate" button on gig cards
   - Reads venue address from venue_id lookup (or text field fallback)
   - Opens Google Maps / Waze / Apple Maps with address pre-filled
   - User preference for nav app stored in settings (default: Google Maps)
4. Settings: Add "Preferred Navigation App" picker
5. Practice sessions: venue picker works, client picker hidden/optional
6. TypeScript clean + build both apps

Update SOT docs when done.
```

## Sprint S23D — Quote + Invoice Chain

```
Read native/docs/ai_context/STATUS.md first, then todo.md (S23D section).

This is Session 4 (final) of the venue/client restructure epic. S23A-C complete.

TASKS:
1. Quote form (BOTH): Replace free-text venue_name/venue_address with venue picker
   - Same searchable dropdown as gig form
   - "Add New Venue" inline
   - On select: sets venue_id + writes venue_name + venue_address to text fields
2. Invoice form (BOTH): Replace free-text venue with venue picker (same pattern)
3. Quote → Gig conversion: carry venue_id + client_id from quote to new gig
4. Gig → Invoice creation: carry venue_id + client_id
5. Update detail views: show venue info from venue_id (with fallback to text)
6. Update list views: search still works on text fields
7. Update preview/PDF views: venue info renders from text fields (no change needed if denormalised)
8. Full chain smoke test: create venue → create client → create quote → accept → gig created → invoice → all linked correctly
9. TypeScript clean + build both apps + vite build

Final SOT docs update — mark S23 complete, update sprint roadmap.
```

---

## Sprint S24A — Bill-To Flexibility: Schema + Types + Queries

```
Read native/docs/ai_context/STATUS.md first, then todo.md (S24A section).

This is Session 1 of 2 for the bill-to flexibility epic (S24A-B).

CONTEXT: We're changing invoices/quotes so they can target a VENUE or a CLIENT (at least one required).
Currently client_id is NOT NULL on invoices/quotes/formal_invoices. We're making it nullable.
Venues need contact fields (email, phone, contact_name) so they can be invoiced directly.
We're also adding gig_id FK on invoices to link gigs to their invoices.

Key decisions: D-078 (venue OR client billing), D-079 (venue contact fields), D-081 (resolveBillTo), D-082 (gig_id FK).

Real-world cases driving this:
- Pub books you directly → invoice the venue (no client needed)
- Agency books you into a pub → invoice the client, venue is reference
- Same venue played 3 times via 3 different clients → venue_id same, client_id different
- Wedding at a venue → invoice the bride (client), venue is location context

TASKS FOR THIS SESSION (S24A):
1. Write + push Supabase migration SQL:
   - ALTER venues: add email TEXT DEFAULT '', phone TEXT DEFAULT '', contact_name TEXT DEFAULT ''
   - ALTER invoices: ALTER client_id DROP NOT NULL, ADD gig_id UUID REFERENCES gigs(id) ON DELETE SET NULL
   - ALTER quotes: ALTER client_id DROP NOT NULL
   - ALTER formal_invoices: ALTER client_id DROP NOT NULL
   - ADD CHECK constraints: (client_id IS NOT NULL OR venue_id IS NOT NULL) on invoices, quotes, formal_invoices
   - CREATE INDEX idx_invoices_gig_id ON invoices(gig_id)

2. Update shared/supabase/types.ts:
   - Venue: add email?, phone?, contact_name?
   - Invoice/Quote/FormalInvoice: client_id becomes string | null
   - Invoice: add gig_id (string | null)
   - Add BillTo type: { name: string; contact_name: string; address: string; email: string; phone: string }
   - Update InvoiceWithClient → make client fields optional (LEFT JOIN)
   - Same for QuoteWithClient, FormalInvoiceWithClient

3. Update shared/supabase/queries.ts:
   - createInvoice: client_id optional, accept gig_id
   - createQuote: client_id optional
   - createFormalInvoice: client_id optional
   - All getInvoice/getQuote/getFormalInvoice queries: LEFT JOIN clients (was INNER)
   - Add resolveBillTo(invoice/quote) helper — returns BillTo from client or venue
   - Add getInvoiceByGigId(gigId) — check if gig already has an invoice
   - Update getDashboardStats if needed

4. Update shared/templates/ utilities:
   - Update billTo rendering in PDF templates to use resolveBillTo()
   - All 28 templates use shared utility functions, so change propagates

5. Update native/src/db/queries.ts wrapper if needed

6. TypeScript clean: npx tsc -b (web) + npx tsc --noEmit (native) — MUST pass

DO NOT touch any UI files this session. Only: migration SQL, types, queries, templates, native wrapper.
Update SOT docs when done (STATUS.md, todo.md, SESSION_LOG.md, schema_map.md).
```

---

## Sprint S26A — Audio Engine Foundation (Expo Native Module + Schema)

```
Read native/docs/ai_context/STATUS.md first, then todo.md (S26A section).

This is Sprint S26A — the foundation for Live Mode and Practice Mode.

CONTEXT:
- GigBooks is becoming a band manager + live performance + practice tool
- The C++ audio engine comes from ClickTrack at C:\Apps\Click\app\src\main\cpp\
- We port metronome.h/cpp, mixer.h/cpp, wav_loader.h/cpp (strip samples/loops/poly/midi)
- Write a fresh audio_engine.h/cpp (metronome + mixer only, single Oboe stream)
- Wrap it in an Expo Native Module (Kotlin + JNI bridge)
- Also: schema migration (lyrics, chords, beat_offset_ms on songs) + role-based song form
- Nathan = drummer, sees full metronome settings. Other members see simplified song form.

PRE-FLIGHT (verified):
- NDK 27.1.12297006 installed
- CMake 3.22.1 installed
- expo-modules-core installed
- ndkVersion configured in build.gradle
- Both apps tsc clean
- 36GB free on C:

TASKS — PHASE 1: Prove the integration
1. Create native/modules/click-engine/ with Expo Module scaffolding
2. Add a minimal C++ file that generates a 440Hz sine beep via Oboe
3. Write minimal JNI bridge + Kotlin Expo Module exposing startBeep()/stopBeep()
4. Add Oboe dependency to build.gradle (com.google.oboe:oboe)
5. Add CMakeLists.txt, verify it builds (npx expo prebuild --clean, then gradlew assembleDebug)
6. Call startBeep() from a test button in JS — if audio comes out, the integration works

TASKS — PHASE 2: Port the engine
7. Copy metronome.h/cpp from C:\Apps\Click\app\src\main\cpp\ — keep as-is (proven code)
8. Copy mixer.h/cpp from C:\Apps\Click\app\src\main\cpp\ — keep as-is
9. Copy wav_loader.h/cpp from C:\Apps\Click\app\src\main\cpp\ — keep as-is
10. Write audio_engine.h/cpp — stripped version (only metronome + mixer, no sample/loop/poly/midi)
11. Write jni_bridge.cpp — Expo Module JNI naming convention, metronome + mixer functions
12. Update Kotlin Expo Module with full API surface:
    - startEngine(sampleRate, framesPerBuffer), stopEngine()
    - setBpm(bpm), setTimeSignature(top, bottom)
    - setSubdivision(divisor), setSwing(percent)
    - setAccentPattern(pattern[]), setClickSound(type)
    - setCountIn(bars, clickType)
    - startClick(), stopClick()
    - getCurrentBeat(), getCurrentBar(), isPlaying()
    - setChannelGain(channel, gain), setMasterGain(gain), setSplitStereo(enabled)
13. JS/TS wrapper module: native/src/audio/ClickEngine.ts — typed API matching the native module
14. loadSong(song: Song) helper — reads Song fields, calls setBpm/setTimeSignature/setSubdivision/setSwing/setAccentPattern/setClickSound/setCountIn

TASKS — PHASE 3: Schema + Song form updates
15. Write Supabase migration SQL:
    - ALTER songs ADD COLUMN lyrics TEXT DEFAULT ''
    - ALTER songs ADD COLUMN chords TEXT DEFAULT ''
    - ALTER songs ADD COLUMN beat_offset_ms INTEGER DEFAULT 0
    Push to live Supabase.
16. Update shared/supabase/types.ts: Song gets lyrics, chords, beat_offset_ms
17. Update shared/supabase/queries.ts: song CRUD includes new fields
18. Update SetlistSongWithDetails to include song_lyrics, song_chords
19. Update native song form: Nathan (profile.band_role === 'Drums') sees full metronome section (subdivision, swing, accent, click sound, count-in). Others see simplified form (name, artist, BPM, time sig, key, chords, lyrics, notes, practice track).
20. Update web song form: same role-based visibility
21. TypeScript clean: npx tsc -b (web) + npx tsc --noEmit (native) — MUST pass

IMPORTANT NOTES:
- ClickTrack's namespace is `clicktrack` — rename to `gigbooks` in the ported C++ files
- ClickTrack's JNI uses `Java_com_clicktrack_audio_AudioBridge_*` — our bridge uses Expo Module naming
- The metronome.cpp render() function is the audio callback heart — do NOT modify its logic, only strip out references to removed components
- Swing slider snap-to-middle is a UI concern (S26B), not engine — the engine just takes setSwing(float percent)

Update SOT docs when done (STATUS.md, todo.md, SESSION_LOG.md, decisions_log.md, schema_map.md).
```

---

## Sprint S26B — Live Mode UI

```
Read native/docs/ai_context/STATUS.md first, then todo.md (S26B section).

This is Sprint S26B — Live Mode user interface for native app.

CONTEXT:
- S26A complete: C++ audio engine working via Expo Native Module
- ClickEngine.ts provides typed JS API (setBpm, startClick, loadSong, etc.)
- Songs have all metronome fields + lyrics + chords
- Setlists have ordered songs with all details (SetlistWithSongs)

TASKS:
1. Create native Live Mode screen (app/(drawer)/live.tsx or stack route)
2. Add Live Mode to drawer navigation
3. Screen layout: full-screen, dark (#000000 bg), high-contrast, stage-readable
4. Setlist selector: pick a setlist to load
5. Song display: current song name, BPM (large, monospace), key, time sig, notes
6. Song position: "3 of 12" indicator
7. Beat visualization: LED dots (beat 1 = red/accent, others = teal/green), scale + glow on active beat
8. Transport: play/stop button (large, thumb-friendly)
9. Prev/next song: swipe or buttons, auto-calls loadSong() on the engine
10. Swing slider: range 50-75%, snap-to-middle at 50% (straight), visual indicator
11. Wake lock: keep screen on (expo-keep-awake)
12. Poll getCurrentBeat()/getCurrentBar() on requestAnimationFrame for beat viz updates
13. Count-in visual: show count-in beats before song starts
14. No manual BPM controls — everything song-driven, read-only on stage

Design reference: ClickTrack's Live Mode layout (compact metadata bar, viz-dominant).
Follow GigBooks neumorphic theme (COLORS, neuRaisedStyle, etc.) but adapt for stage readability.

TypeScript clean. Update SOT docs.
```

---

## Sprint S26C — Track Player + Beat Detection + Time-Stretch

```
Read native/docs/ai_context/STATUS.md first, then todo.md (S26C section).

This is Sprint S26C — the audio file playback engine for Practice Mode.

CONTEXT:
- S26A-B complete: C++ metronome engine working, Live Mode UI working
- Songs can have MP3 practice tracks attached (audio_url in Supabase Storage)
- Need: MP3 playback through same Oboe stream as metronome (zero drift)
- Need: beat detection (auto-detect BPM + downbeat from MP3)
- Need: time-stretch (slow down/speed up, preserve pitch)
- Need: A-B section looping

TASKS — Track Player (C++):
1. Write track_player.h/cpp — holds decoded PCM buffer, plays through Oboe callback
   - load(float* pcmData, int32_t numFrames, int32_t sampleRate, int32_t channels)
   - play(), pause(), stop(), seek(int64_t frame)
   - setLoopRegion(int64_t startFrame, int64_t endFrame), clearLoopRegion()
   - getPosition(), getTotalFrames()
   - Renders into the same output buffer as metronome in audio_engine's onAudioReady()
2. MP3 decode pipeline in Kotlin:
   - Download MP3 from Supabase Storage URL to local cache
   - Use Android MediaCodec/MediaExtractor to decode MP3 to PCM float array
   - Pass PCM to C++ via JNI (loadTrack function)

TASKS — SoundTouch Time-Stretch:
3. Add SoundTouch C++ library to the native module (source or prebuilt)
4. Integrate into track_player: setSpeed(float ratio) — 0.5 = half speed, 2.0 = double
5. SoundTouch processes PCM in the render callback (pitch preserved)
6. Speed control adjusts BOTH SoundTouch rate AND metronome BPM proportionally
7. JNI + JS API: setTrackSpeed(ratio)

TASKS — aubio Beat Detection:
8. Add aubio C library to the native module
9. Write beat_detector.h/cpp — analyse PCM buffer, return detected BPM + beat positions (frame numbers)
10. JNI function: analyseTrack(pcmData) -> { bpm: float, beatOffsetMs: int }
11. On track load: run analysis, auto-populate Song.bpm and Song.beat_offset_ms
12. JS API: analyseTrack() -> { bpm, beatOffsetMs }

TASKS — Beat Step/Nudge:
13. nudgeClick(int32_t direction) — shifts metronome phase forward/backward by one beat
    Implementation: adjust metronome's framePosition_ relative to track_player position
14. JNI + JS API: nudgeClick(direction)

TASKS — Integration:
15. Update audio_engine onAudioReady() to render track_player alongside metronome
16. Mixer: track on channel 1 (click already on channel 0)
17. Update CMakeLists.txt with new source files + SoundTouch + aubio
18. Update Kotlin Expo Module + JNI bridge with track player functions
19. Update ClickEngine.ts with track player API
20. TypeScript clean. Update SOT docs.

AUDIO RULES (from ClickTrack, non-negotiable):
- No system timers for scheduling — frame counting only
- No blocking/allocation in the audio callback
- One Oboe output stream — everything mixed in C++
- All timing from sample rate + frame position
```

---

## Sprint S27A — Practice Mode UI

```
Read native/docs/ai_context/STATUS.md first, then todo.md (S27A section).

This is Sprint S27A — Practice Mode user interface for native app.

CONTEXT:
- S26A-C complete: C++ engine has metronome + track player + beat detection + time-stretch
- ClickEngine.ts exposes full API: loadTrack, setTrackSpeed, analyseTrack, nudgeClick, setLoopRegion, etc.
- Songs have MP3 practice tracks in Supabase Storage

TASKS:
1. Create native Practice Mode screen (app/(drawer)/practice.tsx or stack route)
2. Add Practice Mode to drawer navigation
3. Song selector: pick any song that has an audio_url attached
4. On song select:
   - Download MP3 from Supabase Storage (cache locally)
   - Decode to PCM, pass to engine
   - Run aubio analysis — auto-set BPM if not already set
   - Call loadSong() to configure metronome
5. Waveform or progress bar showing playback position (poll getPosition/getTotalFrames)
6. Speed slider: 50% to 150%, drives setTrackSpeed() (adjusts both track + metronome)
7. A-B loop: tap A marker, tap B marker, track loops that region. Tap again to clear.
   - Visual markers on the progress bar
   - Can set while playing OR paused
8. Beat step/nudge button: tap to shift click alignment (nudgeClick)
9. Click volume slider (setChannelGain channel 0)
10. Track volume slider (setChannelGain channel 1)
11. Master volume (setMasterGain)
12. Split stereo toggle (setSplitStereo) — click in left ear, track in right ear (for IEMs)
13. Count-in: configurable bars, plays count before track starts
14. BPM display: shows current effective BPM (base BPM * speed ratio), monospace
15. Transport: play/pause/stop
16. Dark neumorphic styling consistent with rest of app

TypeScript clean. Update SOT docs.
```

---

## Sprint S27B — Practice Tools

```
Read native/docs/ai_context/STATUS.md first, then todo.md (S27B section).

This is Sprint S27B — advanced practice tools for native app.

CONTEXT:
- S27A complete: Practice Mode UI working with MP3 + click + speed control + A-B loop
- Metronome.cpp already has speed trainer + muted bars built in (from ClickTrack)

TASKS:
1. Speed trainer UI: enable/disable, set start BPM, end BPM, increment, bars per increment
   - Wire to setSpeedTrainer() already in C++ engine
   - Display current trainer BPM, "Complete!" when target reached
2. Tap tempo: tap a button repeatedly, measure intervals, calculate BPM
   - Display detected BPM live as you tap
   - "Apply" saves to engine (setBpm) + "Save to Song" writes to Supabase
3. Muted bars UI: enable/disable, set play bars count, mute bars count
   - Wire to setMutedBars() already in C++ engine
   - Visual indicator when current bar is muted
4. Save all current settings back to Song in Supabase:
   - BPM, subdivision, swing, accent pattern, click sound, count-in, beat_offset_ms
   - One "Save Settings" button
5. Song notes display in practice view (quick reference while practicing)

TypeScript clean. Update SOT docs.
```

---

## Sprint S27C — Web Stage Prompter

```
Read native/docs/ai_context/STATUS.md first, then todo.md (S27C section).

This is Sprint S27C — web stage prompter for all band members.

CONTEXT:
- Songs now have lyrics, chords, key, BPM, notes fields
- Setlists have ordered songs with all details
- This is for Neil, James, Adam (and Nathan) — view setlist on a tablet/phone on stage
- No audio — display only. The C++ engine is native-only.

TASKS:
1. Create web StagePrompter component — full-screen, dark, large text, stage-readable
2. Setlist selector: pick a setlist to display
3. Current song display:
   - Song name (large)
   - Key + BPM + time signature (info bar)
   - Chords display (large, readable from distance)
   - Lyrics display (scrollable or paged, large font)
   - Per-song notes
4. Navigation: prev/next song buttons (large, thumb-friendly)
   - Song position: "3 of 12"
   - Song list sidebar (collapsible) for quick jump
5. Full-screen mode (hide browser chrome, F11-style)
6. Auto-scroll option for lyrics (configurable speed)
7. Add to ViewContext + Drawer navigation (Stage Prompter nav item)
8. Responsive: works on phone, tablet, and desktop
9. Dark theme only (#000000 bg for stage readability)
10. ChordPro-style rendering if chords field uses [Am]lyrics[F]format — chords displayed above lyrics inline

TypeScript clean. Update SOT docs.
```

---


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

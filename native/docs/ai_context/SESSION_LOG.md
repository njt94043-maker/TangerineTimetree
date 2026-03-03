# GigBooks — Session Log

> What each session built, tested, and blocked.
> Append at the end of every session.

---

## Session: 2026-03-02 — SOT Docs Bootstrap

### What Was Done
- Created `docs/ai_context/` directory
- Created all 7 SOT documents:
  - `blueprint.md` — architecture north star
  - `schema_map.md` — full database schema + TypeScript interfaces
  - `decisions_log.md` — 20 locked decisions (D-001 to D-020)
  - `todo.md` — current tasks and backlog
  - `SESSION_LOG.md` — this file
  - `gotchas.md` — lessons learned (seeded with known patterns)
  - `pain_journal.md` — process improvements (empty, ready for entries)
- Updated `CLAUDE.md` with SOT protocol references (session start/end)

### What Was Tested
- N/A (documentation only, no code changes)

### What's Blocked
- Nothing

### Next Session Priorities
- Normal feature work — SOT infrastructure is now in place
- First real session should follow the full session start protocol

---

## Session: 2026-03-02 — Multiple Invoice Styles

### What Was Done
- **New feature: 4 invoice PDF styles** (classic, premium dark, clean professional, bold rock)
- Created `src/pdf/invoiceStyles.ts` — InvoiceStyle type + metadata constants
- Created 3 new HTML template files (converted from JSX designs):
  - `src/pdf/invoiceTemplatePremiumDark.ts` — dark luxury, Playfair Display + Cormorant Garamond
  - `src/pdf/invoiceTemplateCleanProfessional.ts` — warm cream, DM Serif Display + Libre Baskerville
  - `src/pdf/invoiceTemplateBoldRock.ts` — bold dark, Archivo Black + Bebas Neue + Syne
- Created `src/pdf/getInvoiceTemplate.ts` — dispatcher (Record lookup with classic fallback)
- Created `src/components/StylePicker.tsx` — horizontal scrollable NeuCard picker
- Updated `src/db/database.ts` — added `style` column to invoices table + ALTER TABLE migration
- Updated `src/db/queries.ts` — added `style` to Invoice type + createInvoice()
- Updated `app/invoice/new.tsx` — style picker in Step 2, style in createInvoice, dispatcher for HTML
- Updated `app/invoice/[id].tsx` — dispatcher for regenerate, style in "Create Similar", style in detail view
- Added decisions D-021 through D-025

### What Was Tested
- `npx tsc --noEmit` passes clean
- Built and installed APK on physical device (RFCW113WZRM)
- App stuck on splash screen — caused by Metro not running (port 8081 was occupied during build)
- Fixed by killing stale process on 8081 and starting `npx expo start`

### What's Blocked
- Nothing

### Next Session Priorities
- Verify app loads past splash screen and test all 4 styles on physical device
- Verify "Create Similar" carries style forward
- Verify existing invoices default to Classic

---

## Session: 2026-03-02 — Real Logo + Venues + Full-Screen Preview

### What Was Done
- **Fixed phantom emulator-5562**: Root cause = NTKDaemon.exe (Native Instruments) on port 5563. Fixed by setting service to manual start (`sc config NTKDaemonService start= demand`)
- **Real TGT logo**: Circular-cropped actual logo as base64 PNG, replacing generated SVG in `src/pdf/logo.ts`. All 5 templates (4 invoice + 1 receipt) auto-pick it up
- **Venues tied to clients**: New `venues` table with CASCADE FK to clients. `VenuePicker` component (modal dropdown) replaces free-text venue input in wizard Step 2. Venue management on client edit screen
- **Full-screen invoice preview**: `react-native-webview` added. Wizard Step 3 is now a horizontal paginated carousel of WebView-rendered invoices in all 4 styles. User swipes to browse, taps "Approve & Generate". Replaces old StylePicker + text summary
- New DB operations: `getVenuesForClient()`, `addVenue()`, `deleteVenue()`
- `PRAGMA foreign_keys = ON` added to getDb()
- Decisions D-026 through D-031 added
- Cleaned up stale `ANDROID_SERIAL` env var

### What Was Tested
- `npx tsc --noEmit` passes clean
- Built and installed APK on physical device (RFCW113WZRM)
- App launched via adb reverse + am start

### What's Blocked
- Nothing

### Next Session Priorities
- Test venue picker flow (select existing, add new, prefill from "Create Similar")
- Test full-screen preview carousel (swipe, arrows, approve)
- Test venue management on client edit screen
- Test logo appears correctly in generated PDFs

---

## Session: 2026-03-02 — Delete Invoice + Full Usability Audit

### What Was Done

**Delete Invoice Feature:**
- `deleteInvoice(id)` in queries.ts — collects PDF URIs, deletes receipts first (no CASCADE), then invoice
- `deletePdf(uri)` in generatePdf.ts — deletes file from disk via expo-file-system File API
- Delete button on invoice detail screen with confirmation dialog

**Comprehensive Usability Audit (22 findings, 14 fixed, 8 intentional no-action):**

1. **Data integrity (queries.ts):**
   - `createInvoice()` wrapped in `db.withExclusiveTransactionAsync()` — atomic insert + counter bump
   - `createReceipts()` duplicate guard — returns existing receipts if already generated
   - Receipt rounding fix — remainder pennies assigned to first receipt

2. **HTML safety (5 templates):**
   - New `src/utils/htmlEscape.ts` utility
   - Applied to all 5 PDF templates (classic, premium dark, clean professional, bold rock, receipt)
   - Prevents broken PDFs when client names contain `&`, `<`, `>`, `"`

3. **CSV export fix:** Newlines in company_name/venue fields replaced with spaces

4. **Calendar fix:** `useState(2026)` → `useState(() => new Date().getFullYear())`

5. **Modal backdrop dismiss:** VenuePicker + wizard new-client modal dismiss on backdrop tap

6. **Unsaved changes warning:** Client edit screen warns before discarding dirty form

7. **Invoice list + dashboard polish:**
   - New `app/(tabs)/invoices.tsx` — full searchable invoice list (FlatList, search, pull-to-refresh)
   - New Invoices tab in tab bar (between Dashboard and Clients)
   - Dashboard: pull-to-refresh + "View All Invoices" link

8. **Dead code cleanup:** Deleted `StylePicker.tsx` (replaced by WebView carousel last session)

**No-action items (intentional):**
- StatusBadge 8-digit hex colors (valid in RN)
- Dashboard outstanding = sent only (correct accounting)
- Status flow not enforced (flexibility needed for direct gig payments)
- Past dates selectable in calendar (invoices for past gigs)
- No email/phone validation (single-user app)
- Seed data stays as Nathan's (personal app)
- PDF colors hardcoded in templates (standalone HTML)

### What Was Tested
- `npx tsc --noEmit` passes clean
- Built and installed release APK on physical device (RFCW113WZRM)

### What's Blocked
- Nothing

### Next Session Priorities
- Test all audit fixes on device (invoice list, search, pull-to-refresh, backdrop dismiss, unsaved changes warning)
- Test delete invoice flow
- Test receipt duplicate guard
- Verify HTML escape in PDFs with `&` in client names

---

## Session: 2026-03-02 — Calendar Fix + Swipe/Preview Plan

### What Was Done
- **Fixed calendar day alignment bug**: Days were not aligned under correct column headers (Feb 1 showed under MON instead of SUN). Root cause: `flexWrap: 'wrap'` + `justifyContent: 'space-around'` on the grid didn't reliably align with the header row. Fixed by switching to explicit row-based rendering — each week is its own `<View style={{ flexDirection: 'row' }}>` with 7 `flex: 1` cells. Headers use the same layout. Alignment is now guaranteed.
- **Planned 4 features** (approved, not yet implemented):
  1. Calendar swipe (PanResponder for month navigation)
  2. WebView swipe fix (wizard Step 3 — `nestedScrollEnabled={false}`)
  3. Full-screen invoice preview (new route `app/invoice/preview.tsx`)
  4. Save PDF before sharing (decouple generate from share)
- Created HTML mockups for user review — all approved

### What Was Tested
- `npx tsc --noEmit` passes clean
- Built and installed release APK on physical device (RFCW113WZRM)
- Calendar alignment verified visually on device

### What's Blocked
- Nothing

### Next Session Priorities
- Implement the 4 planned features (plan at `~/.claude/plans/piped-munching-corbato.md`)
  1. Save Before Share (change `generateAndSharePdf` → `generatePdf` in wizard + detail)
  2. WebView Swipe Fix (`nestedScrollEnabled={false}` + CSS `overflow-x: hidden`)
  3. Calendar Swipe (PanResponder on grid area)
  4. Full-Screen Preview (new `preview.tsx` route + `updateInvoiceStyle` query + Preview button on detail)
- Build release APK + install + test on device
- Update SOT docs

---

## Session: 2026-03-02 — Swipe/Preview Feature Implementation

### What Was Done
- **Save Before Share**: `generateAndSharePdf` → `generatePdf` in wizard (`new.tsx`) and detail (`[id].tsx`). Invoice creation no longer opens share sheet — saves PDF and lands on detail screen. Button label changed to "Approve & Save". Share and Regenerate are now separate actions on the detail screen.
- **WebView Swipe Fix**: `nestedScrollEnabled={false}` on WebView in wizard Step 3 carousel. WebView no longer intercepts horizontal swipes, so FlatList paging works. Added `overflow-x: hidden; width: 100%` to classic invoice template body CSS as defensive measure.
- **Calendar Swipe**: Added `PanResponder` to CalendarPicker day grid. Swipe right → previous month, swipe left → next month. Arrow buttons remain. Uses refs for latest goToPrev/goToNext to avoid stale closures. Threshold: `|dx| > |dy|` and `|dx| > 10` to activate, `|dx| > 50` to trigger navigation.
- **Full-Screen Invoice Preview**: New `app/invoice/preview.tsx` route. Horizontal FlatList carousel with all 4 styles. Style name bar + counter overlay. Navigation arrows. "Use This Style" button — if different from current, updates style in DB, regenerates PDF, deletes old PDF, goes back. If same style, shows "Current Style" (dimmed) and just goes back.
- **Supporting changes**: `updateInvoiceStyle()` query in `queries.ts`. Detail screen switched from `useEffect` to `useFocusEffect` (from expo-router) so data reloads when returning from preview. "Preview Invoice" button added to detail screen above "Share Invoice PDF".
- Decisions D-039 through D-042 added.

### What Was Tested
- `npx tsc --noEmit` passes clean
- Built and installed release APK on physical device (RFCW113WZRM)
- App launched via adb reverse + am start

### What's Blocked
- Nothing

### Next Session Priorities
- Test all 4 features on device (swipe, preview, save before share, calendar swipe)

---

## Session: 2026-03-02 — UX Polish + Auto Receipts

### What Was Done
- **Preview viewport fix**: WebView previews now replace `width=device-width` with `width=800` in the viewport meta tag, so the HTML renders at A4 proportions and auto-scales to fit the phone screen. Preview now matches actual PDF output.
- **Detail preview simplified**: `preview.tsx` rewritten from a 4-style carousel to a single-style full-screen WebView showing only the invoice's saved style. Shows invoice number in header, style name, and a Share button at the bottom.
- **Share auto-marks as "sent"**: Sharing an invoice PDF now auto-updates status from "draft" to "sent". Only upgrades — never downgrades from "paid".
- **Paid auto-generates receipts**: New `markInvoicePaid()` in queries.ts wraps status change + receipt creation in `withExclusiveTransactionAsync`. Idempotent — if receipts already exist, just updates status. Button on detail screen changes to "View Receipts" when receipts exist.
- Decisions D-043 through D-047 added.

### What Was Tested
- `npx tsc --noEmit` passes clean
- Built and installed release APK on physical device (RFCW113WZRM)

### What's Blocked
- Nothing

### Next Session Priorities
- Test on device:
  1. Preview viewport — does it now match the actual PDF proportions?
  2. Share invoice → status changes to "sent"
  3. Mark as paid → receipts auto-generated → "View Receipts" button appears
  4. Wizard Step 3 preview viewport also correct
- Consider FreeAgent API integration for tax reporting (see D-047)

---

## Session: 2026-03-02 — Styled Receipt Templates + Swipeable Receipt Preview

### What Was Done
- **Swipeable receipt preview**: `preview.tsx` rewritten from single-page WebView to a horizontal FlatList carousel showing invoice + all attached receipts. Page label bar, counter, navigation arrows, and per-page Share button. Receipt pages generated in preview from receipt data.
- **Styled receipt templates**: Created 3 new receipt templates matching invoice styles:
  - `src/pdf/receiptTemplatePremiumDark.ts` — dark luxury, matches Premium Dark invoice
  - `src/pdf/receiptTemplateCleanProfessional.ts` — warm cream, matches Clean Professional invoice
  - `src/pdf/receiptTemplateBoldRock.ts` — bold dark, matches Bold Rock invoice
- **Receipt template dispatcher**: Created `src/pdf/getReceiptTemplate.ts` — same `Record<InvoiceStyle, fn>` pattern as invoice dispatcher with classic fallback
- **Updated call sites**: Both `receipts.tsx` and `preview.tsx` now use `getReceiptHtml(style, data)` instead of `generateReceiptHtml(data)`, so receipts match their parent invoice's visual style
- **Fixed receipt generation**: `receipts.tsx` now uses `generatePdf()` instead of `generateAndSharePdf()` — no more share dialog popping up for each receipt during batch generation
- Decision D-048 added (supersedes D-024)

### What Was Tested
- `npx tsc --noEmit` passes clean
- Built and installed release APK on physical device (RFCW113WZRM)

### What's Blocked
- Nothing

### Next Session Priorities
- Test on device:
  1. Preview carousel — swipe between invoice and receipts
  2. Receipt styling matches invoice style (try all 4 styles)
  3. Receipt generation still works (Generate All Receipts button)
  4. Share individual receipts from receipts screen
- Consider FreeAgent API integration for tax reporting (see D-047)

---

## Session: 2026-03-02 — Themed Templates Planning + JSX Polish

### What Was Done
- **Polished `themed-invoices-batch1.jsx`** (3 themed invoice prototypes):
  - Rewrote HollyCorner SVG — smooth bezier leaf shapes with bright red berries (replaced zigzag starburst paths)
  - Rebuilt Rose SVG — layered concentric petals (outer swoops, mid curls, inner bud, center dot)
  - Added CSS multi-layer radial-gradient paper-grain textures to all 3 templates:
    - Christmas: fine dot grid on dark green
    - Halloween: grunge texture on near-black
    - Valentine: linen crosshatch on warm cream
  - Boosted opacity on: pumpkin body/face, scattered hearts, bats, Christmas tree watermark, baubles, HeartCluster
- **Decided HTML-first prototyping workflow** (D-050): prototype as standalone .html files, iterate in browser, convert to .ts — avoids JSX→HTML conversion overhead
- **Planned app integration** (D-049): 3 new seasonal styles (christmas, halloween, valentine) — same dispatcher pattern as existing 4 styles, 6 new .ts template files + type/dispatcher updates
- **Created partial HTML mockups** in `mockups/` folder: 4 existing template mockups extracted from .ts files (placeholder logos — needs fixing)
- Updated `CLAUDE.md` file map, decisions log (D-049, D-050), todo.md

### What Was Tested
- No code changes to app — planning session only

### What's Blocked
- Nothing

### Next Session Priorities
1. **Primary**: Create 3 themed invoice + 3 receipt .ts template files from `themed-invoices-batch1.jsx`
2. Update `invoiceStyles.ts`, `getInvoiceTemplate.ts`, `getReceiptTemplate.ts`
3. `npx tsc --noEmit` + rebuild + test on device
4. **Secondary**: Fix mockups (real logo, 3 themed mockups, index.html)

---

## Session: 2026-03-02 — Themed Templates Implementation

### What Was Done
- **Created 6 new template files** from `themed-invoices-batch1.jsx` JSX prototype:
  - `src/pdf/invoiceTemplateChristmas.ts` — dark forest green, Cormorant Garamond + Outfit, holly/snowflake/tree/bauble SVG decorations, gold accents
  - `src/pdf/invoiceTemplateHalloween.ts` — near-black, Syne + Space Grotesk, pumpkin/bat/spider/candle SVG decorations, orange ember accents
  - `src/pdf/invoiceTemplateValentine.ts` — warm cream, Playfair Display + Lora, heart/rose SVG decorations, berry-pink accents
  - `src/pdf/receiptTemplateChristmas.ts` — matching Christmas receipt (reduced decorations)
  - `src/pdf/receiptTemplateHalloween.ts` — matching Halloween receipt (reduced decorations)
  - `src/pdf/receiptTemplateValentine.ts` — matching Valentine receipt (reduced decorations)
- All templates follow existing Bold Rock pattern: CSS classes (no inline styles), htmlEscape on all data fields, TGT_LOGO_SVG, Google Fonts via link tag
- `invoiceStyles.ts`, `getInvoiceTemplate.ts`, `getReceiptTemplate.ts` were already updated (from previous session planning)
- Updated `CLAUDE.md` file map with 6 new template files

### What Was Tested
- `npx tsc --noEmit` passes clean
- Built and installed release APK on physical device (RFCW113WZRM)
- App launched successfully

### What's Blocked
- Nothing

### Next Session Priorities
- Test all 7 invoice styles on device (especially SVG decorations in expo-print PDFs)
- Test all 7 receipt styles match their parent invoice
- Visual polish pass if any decorations look wrong at PDF scale
- Fix HTML mockups (real logo, 3 themed mockups, index.html)

---

## Session: 2026-03-03 — Shared Gig Calendar (Supabase + Tangerine Timetree PWA)

### What Was Done

**Supabase Backend:**
- Created Supabase project (jlufqgslgjowfaqmqlds) with 4 tables: profiles, gigs, away_dates, gig_changelog
- Row-Level Security policies: all authenticated read, own away_dates CRUD, any gig CRUD
- Database triggers: auto-create profile on signup, auto-update timestamps
- Created 4 user accounts (Nathan admin + Neil, James, Adam) — cleaned up 3 old "Last Minute" project users
- Migration: added `gig_type` column ('gig' | 'practice') to gigs table

**Tangerine Timetree PWA (new project at C:\Apps\TangerineTimetree\):**
- Full React + TypeScript + Vite web app — login, calendar, day detail, gig form, away manager
- Shared Supabase client + types + queries (same API shape as GigBooks)
- PWA manifest + Apple meta tags for installable iPhone web app
- Dark neon theme: near-black background (#08080c), gunmetal cards (#111118), neon green gigs (#00e676), purple practice (#bb86fc), red away (#ff5252), tangerine branding
- Neumorphic CSS with glow effects, backdrop blur overlay
- Deployed to Vercel at tangerine-timetree.vercel.app (GitHub: njt94043-maker/TangerineTimetree)

**UX Iterations (3 rounds of user feedback):**
1. Added practice sessions as separate gig_type — "Add Gig" and "Add Practice" as separate buttons in DayDetail
2. Simplified availability: any member away = band unavailable (removed "partial" status)
3. Complete dark theme overhaul: gigs = neon green (not gold), available = subtle dark grey, neon glow effects throughout

**GigBooks Updates:**
- Updated CLAUDE.md: 5 tabs, Supabase exception, 11 new gig-related files in file map

### What Was Tested
- `npx tsc --noEmit` passes clean (both GigBooks and Tangerine Timetree)
- `npx expo export --platform android` passes (GigBooks)
- Vite build passes (Tangerine Timetree)
- Deployed and live at tangerine-timetree.vercel.app

### What's Blocked
- Nothing

### Next Session Priorities
- Add "list view for all gigs" to Tangerine Timetree (user requested, deferred to next session)
- Sync GigBooks native app types/queries with gig_type changes
- Test GigBooks Gigs tab on physical device
- Test Tangerine Timetree on band members' iPhones

---

## Session: 2026-03-03 — Gig List + gig_type Sync + Monorepo Planning

### What Was Done

**Tangerine Timetree — Gig List View:**
- Added `getUpcomingGigs(limit=50)` to `src/supabase/queries.ts`
- Created `src/components/GigList.tsx` — chronological list grouped by date, countdown badges, practice/gig differentiation, fee/time/payment display
- Updated `src/App.tsx` — Cal/List toggle in header, `viewMode` state, `returnView` tracking
- Added ~120 lines of gig list CSS to `src/App.css`
- Fixed unused `formatFullDate` variable that broke Vercel build
- Committed and pushed — deployed on Vercel

**GigBooks — gig_type Sync:**
- Updated `src/supabase/types.ts` — added `GigType`, `gig_type` field, updated `isGigIncomplete` and `computeDayStatus` for practice support
- Updated `src/supabase/queries.ts` — added `gig_type` to `createGig`
- Updated `src/components/GigCalendar.tsx` — purple for practice, neon green for gig, updated legend and dot colors
- Updated `src/components/GigDaySheet.tsx` — practice badge, separate Add Gig/Add Practice buttons, conditional field display
- Updated `app/gig/new.tsx` — accepts `gigType` param, hides gig-only fields for practice
- Updated `app/(tabs)/gigs.tsx` — passes `gigType` when navigating
- Added `purple: '#bb86fc'` + calendar colors (`calGig`, `calPractice`, `calAvailable`, `calAway`) to `src/theme/colors.ts`
- Fixed AsyncStorage Maven dependency in `android/build.gradle`
- Built and installed release APK on device (RFCW113WZRM)

**Monorepo Planning (approved, not implemented):**
- Explored both codebases — confirmed 95%+ Supabase code duplication
- Plan approved: combine into `C:\Apps\TGT\` with `shared/`, `web/`, `native/` structure
- Plan saved at `~/.claude/plans/partitioned-nibbling-narwhal.md`

### Issues This Session
- Previous session accidentally worked on DevMirror instead of GigBooks (inherited mess)
- GigBooks gig list view was NOT added (only Timetree got it)
- GigBooks calendar still looks visually different from Timetree (neumorphic circles vs flat CSS grid)
- Color fixes applied in code but user reported calendar still didn't match Timetree

### What Was Tested
- `npx tsc --noEmit` passes (both projects)
- Vite build passes (Timetree) — deployed on Vercel
- GigBooks APK built and installed on device

### What's Blocked
- Nothing

### Next Session Priorities
1. **Monorepo setup**: Create `C:\Apps\TGT\` with shared/web/native structure, move both apps in
2. **GigBooks gig list view**: Port `GigList.tsx` from Timetree to React Native
3. **Build + install GigBooks APK** with all pending changes

---

## Session: 2026-03-03 — Monorepo Restructure

### What Was Done

**Monorepo setup at C:\Apps\TGT\:**
- Created `C:\Apps\TGT\` with `shared/`, `web/`, `native/` structure
- Moved TangerineTimetree `.git` to TGT root (preserves full commit history)
- Copied TangerineTimetree → `web/`, GigBooks → `native/`
- Root `package.json` with convenience scripts (no npm workspaces — avoids Metro symlink issues)
- Root `.gitignore` covering both projects

**Shared Supabase layer (shared/supabase/):**
- `types.ts` — unified from GigBooks version (has `'partial'` DayStatus, `totalMembers` param on `computeDayStatus`, practice validation in `isGigIncomplete`)
- `queries.ts` — merged: GigBooks base + Timetree's `getUpcomingGigs()`, uses `getSupabase()` bridge pattern
- `config.ts` — hardcoded URL + anon key (Metro can't use `import.meta.env`)
- `clientRef.ts` — new `initSupabase(client)` / `getSupabase()` bridge, uses `SupabaseClientLike` interface (avoids requiring `@supabase/supabase-js` in shared/)
- `index.ts` — barrel re-export

**Metro config for native/:**
- Created `metro.config.js` with `watchFolders: [shared/]` and `nodeModulesPaths: [native/node_modules/]`
- Updated `tsconfig.json` with `@shared/*` path alias and `include: [".", "../shared"]`

**Vite config for web/:**
- Updated `vite.config.ts` with `resolve.alias: { '@shared': '../shared' }`
- Updated `tsconfig.app.json` with `@shared/*` path alias and `include: ["src", "../shared"]`

**Import updates (both apps):**
- All supabase type/query/config imports changed to `@shared/supabase/*`
- Deleted 6 local copies (types.ts, queries.ts, config.ts in each app)
- Platform-specific files stay local: `client.ts` (AsyncStorage vs browser), `AuthContext.tsx` (native only), `useAuth.ts` (web only)
- Fixed web `Calendar.tsx` — added `totalMembers` prop to support partial availability from shared `computeDayStatus`

**Bug fixes during unification:**
- Web now has `'partial'` DayStatus (was missing)
- Web's `isGigIncomplete` now validates practice sessions (was always returning false)
- Web's `deleteGig` now logs complete changelog entries (was missing `field_changed`, `new_value`)
- Web's `computeDayStatus` now uses `totalMembers` for proper partial availability

### What Was Tested
- `npx tsc --noEmit` passes clean (native/)
- `npx tsc -b` passes clean (web/)
- Git commit successful (182 files, renames detected)

### What's Blocked
- Vercel deployment needs root directory updated to `web/` (manual dashboard change)
- Git push not done yet (pending user decision on repo name)

### Next Session Priorities
1. **Push to GitHub** — update remote if renaming repo, push monorepo commit
2. **Update Vercel** — set root directory to `web/`
3. **GigBooks gig list view** — port `GigList.tsx` from web to React Native
4. **Build + install GigBooks APK** — verify Metro resolves shared/ imports at runtime
5. **Test Timetree** on band members' iPhones

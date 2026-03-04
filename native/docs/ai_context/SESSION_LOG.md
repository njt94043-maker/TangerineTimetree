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

---

## Session: 2026-03-03 — Native Gig List + Web Toggle Move + Audit + Plan

### What Was Done
- **GigBooks gig list view**: Ported `GigList.tsx` from web to React Native (FlatList, grouped by date, countdown badges, neumorphic cards)
- **Web Cal/List toggle**: Moved from header to below calendar content (user feedback: too tight)
- **Cal/List toggle for native**: Added viewMode toggle + GigList component to `gigs.tsx`
- **Vercel deployment**: User set root directory to `web/`; committed and pushed to trigger deploy
- **Comprehensive fit-for-purpose audit**: 50+ issues across both apps, consolidated into prioritized list (7 CRITICAL, 8 HIGH, MEDIUM/LOW)
- **6-phase implementation plan**: Created and approved at `~/.claude/plans/ticklish-moseying-deer.md`

### What Was Tested
- `npx tsc --noEmit` passes clean (native)
- `npx tsc -b` passes clean (web)
- Built and installed release APK on device (RFCW113WZRM)
- Vercel deployed with `web/` root directory

### Next Session Priorities
- Phase 1: Critical Data & Sync Fixes

---

## Session: 2026-03-04 — Phase 1: Critical Data & Sync Fixes

### What Was Done

**1.1 — List view realtime sync (both apps):**
- Native `GigList.tsx`: Added Supabase realtime subscription (`gig-list` channel), refetches on any `gigs` table change
- Web `GigList.tsx`: Added Supabase realtime subscription (`gig-list-web` channel), refetches on any `gigs` table change
- Both list views now auto-update when other users add/edit/delete gigs

**1.2 — Error handling everywhere:**
- Native `GigList.tsx`: Added `error` state, retry UI ("Failed to load gigs. Tap to retry.")
- Native `gigs.tsx`: Added `calendarError` state, error banner with retry in calendar view
- Web `GigList.tsx`: Added `error` state, retry button
- Web `useCalendarData.ts`: Added `error` state, exposed in return value
- Web `App.tsx`: Error banner above calendar/list when `calendarError` is set
- Web `DayDetail.tsx`: Error state on `getGigsByDate()` failure with retry button

**1.3 — Form validation with warnings:**
- Web `GigForm.tsx`: Before save, checks `isGigIncomplete()` — shows `confirm()` dialog listing missing fields, user can save anyway (marked INCOMPLETE)
- Native `new.tsx`: Before save, checks `isGigIncomplete()` — shows `Alert.alert()` with "Save Anyway" / "Go Back", user can save anyway

**1.4 — Auth token expiry handling:**
- `shared/supabase/clientRef.ts`: Added `onAuthError()` callback registration + `handleAuthError()` trigger
- `shared/supabase/queries.ts`: Added `checkAuthError(error)` helper — detects PGRST301, 401, JWT expired, not authenticated; calls `handleAuthError()` before all `throw error` statements
- Web `useAuth.ts`: Registers `onAuthError` handler → signs out + clears state → shows login page
- Native `AuthContext.tsx`: Registers `onAuthError` handler → signs out + clears state → shows login gate

**Bonus Phase 3 items (implemented alongside GigList changes):**
- 3.1 — Add gig buttons in list view: Added `ListFooterComponent` with "Add Gig" + "Add Practice" buttons
- 3.2 — Pull-to-refresh on list view: Added `RefreshControl` to FlatList
- 3.3 — Long text overflow: Added `numberOfLines={2}` to venue, `numberOfLines={1}` to client

### What Was Tested
- `npx tsc --noEmit` passes clean (native)
- `npx tsc -b` passes clean (web)
- `npx expo export --platform android` — 1249 modules bundled successfully
- Release APK built and installed on device (RFCW113WZRM)

### What's Blocked
- Nothing

### Next Session Priorities
- Phase 2: Web Visual Redesign (safe areas, touch targets, font sizes, contrast, spacing, accessibility)
- Phase 3 remaining: day sheet scroll fix, calendar gig count indicator, success feedback on save

---

## Session: 2026-03-04 — Phase 2: Web Visual Redesign

### What Was Done

**2.1 — Safe areas:**
- Removed `user-scalable=no` from viewport meta (accessibility requirement)
- Added `env(safe-area-inset-*)` padding to `.app` (left/right), `.header` (top), `.day-sheet` (bottom), `.form-wrap` (bottom)

**2.2 — Touch targets (44px minimum):**
- Calendar arrows: 8px → 14px padding + 44×44 min + flex center
- View toggle buttons: 6px/12px → 10px/16px + 44px min-height
- Calendar cells: 40px → 44px min-height
- Away delete button: 8px → 14px padding + 44×44 min (converted from `<span>` to `<button>`)
- GigList cards: 14px → 16px padding
- DayDetail cards: 14px → 16px padding
- Toggle buttons: 12px → 14px padding + 44px min-height
- Changelog toggle: 44px min-height tap area
- Legend items: 32px min-height with padding
- All `.btn`: min-height 48px, `.btn-small`: min-height 44px
- Input fields: min-height 44px

**2.3 — Font sizes (11px minimum everywhere):**
- Day headers: 10px → 11px
- Legend labels: 10px → 11px
- View toggle: 11px → 12px
- Badges: 9px → 10px
- Changelog time: 9px → 11px
- Form labels: 10px → 11px
- Detail labels: 12px → 13px
- Detail values: 12px → 13px
- "Added by" text: 10px → 11px
- Changelog text: 11px → 12px

**2.4 — Color contrast (WCAG AA):**
- `--color-text-dim`: `#585870` → `#7a7a94` (~4.5:1 on dark bg)
- `--color-text-muted`: `#333344` → `#4a4a60` (~3:1 for secondary)
- `--color-available`: updated to match new muted value
- Input placeholder color: now uses `--color-text-dim` (improved contrast)

**2.5 — Visual hierarchy & spacing:**
- Header: added subtle bottom border, logo 36px → 40px
- Calendar: grid gap 2px → 3px, bolder today indicator (stronger glow)
- Day detail rows: padding 3px → 8px vertical
- GigList cards: margin 8px → 12px between cards
- Form labels: margin 14px → 16px top spacing
- Status dots: 5px → 7px diameter

**2.6 — Accessibility:**
- Added `:focus-visible` styling (2px tangerine outline, 2px offset)
- Added `.neu-inset:focus-within` highlight for focused inputs
- Converted header user `<div>` to `<button>`
- Converted header `<div>` to semantic `<header>`
- Converted calendar day cells from `<div>` to `<button>` with `aria-label`
- Added `aria-label="Previous month"` / `"Next month"` to calendar arrows
- Added `aria-label="Delete away date"` to away delete button
- Converted payment type toggles from `<div>` to `<button type="button">`
- Converted away-delete `<span>` to `<button>`
- Added `htmlFor`/`id` linking on all form labels (GigForm, AwayManager, LoginPage)
- Added `role="alert"` to all error messages (App.tsx, DayDetail, GigForm, AwayManager, GigList, LoginPage)
- Added `.error-banner` CSS class for consistent error styling
- Removed `-webkit-tap-highlight-color: transparent` from buttons and toggles

### What Was Tested
- `npx tsc -b` passes clean (web)
- `npx tsc --noEmit` passes clean (native)
- `npx vite build` passes (7 precache entries, 622 KiB)

### What's Blocked
- Nothing

### Next Session Priorities
- Phase 3 remaining: day sheet scroll fix (3.4), calendar gig count indicator (3.5), success feedback on save (3.6)
- Phase 4: In-App Change Summary (away_date_changelog, last_opened_at, change summary banner)
- Push to GitHub → Vercel deploys web changes
- Test on iPhone: touch targets, safe areas, focus states

---

## Session: 2026-03-04 — Phase 3 Remaining: Native UX Fixes

### What Was Done

**3.4 — Day sheet scroll fix:**
- `GigDaySheet.tsx` line 209: `scroll: { flexGrow: 0 }` → `flexGrow: 1`
- ScrollView now expands to fill available space, allowing scroll when 5+ gigs on a day

**3.5 — Calendar gig count indicator (both apps):**
- **Web** (`Calendar.tsx`): When `dateGigs.length > 1`, renders a `<span className="day-count">` badge showing the count
- **Web** (`App.css`): New `.day-count` class — 14px circle, 8px mono font, positioned top-right of calendar cell
- **Native** (`GigCalendar.tsx`): When `dateGigs.length > 1`, renders a `<View style={countBadge}>` with count text
- **Native**: New `countBadge` + `countText` styles — 14px circle, 8px mono font, top-right of day circle

**3.6 — Success feedback on save (native):**
- `new.tsx`: After successful save, shows `ToastAndroid.show()` with "Gig saved" / "Practice saved" / "Gig updated" / "Practice updated"
- Non-blocking toast (doesn't require dismiss), then navigates back
- Android-only (ToastAndroid), iOS has no equivalent used

### What Was Tested
- `npx tsc --noEmit` passes clean (native)
- `npx tsc -b` passes clean (web)
- `npx vite build` passes (7 precache entries, 623 KiB)

### What's Blocked
- Nothing

### Next Session Priorities
- Phase 4: In-App Change Summary (away_date_changelog, last_opened_at, change summary banner)
- Push to GitHub → Vercel deploys Phase 2 + 3 web changes
- Build release APK → test on device (scroll fix, count badges, toast feedback)
- Test web on iPhone (touch targets, safe areas, focus states)

---

## Session: 2026-03-04 — Phase 4: In-App Change Summary

### What Was Done

**4.1 — Supabase migration:**
- Added `last_opened_at TIMESTAMPTZ DEFAULT NOW()` column to `profiles` table
- Created `away_date_changelog` table (id, away_date_id, user_id, action, date_range, reason, created_at)
- RLS policies: authenticated read, own inserts
- Migration applied via `supabase db push` (Supabase CLI linked to project jlufqgslgjowfaqmqlds)
- Migration file: `supabase/migrations/20260304105634_phase4_change_summary.sql`

**4.2 — Shared queries (`shared/supabase/queries.ts`):**
- `updateLastOpened()`: Updates `profiles.last_opened_at` to NOW() for current user
- `getChangesSince(since)`: Queries both `gig_changelog` and `away_date_changelog` for entries after `since`, by other users only. JOINs profiles for names, gigs for venue/date context. Returns `ChangeSummaryItem[]` with human-readable descriptions, sorted by most recent, limited to 10
- `createAwayDate()`: Now logs to `away_date_changelog` (action: 'created', date_range, reason)
- `deleteAwayDate()`: Now fetches away date info before delete, logs to `away_date_changelog` (action: 'deleted')

**4.3 — Shared types (`shared/supabase/types.ts`):**
- Added `last_opened_at` to `Profile` interface
- Added `ChangeSummaryItem` type: `{ type, action, user_name, description, created_at }`
- Formatter logic inlined into `getChangesSince()` — no separate file needed

**4.4 — Web implementation (`web/src/App.tsx` + `web/src/App.css`):**
- On MainView mount, fetches changes since `profile.last_opened_at` (once per session via useRef flag)
- Dismissible banner with tangerine left border, dark card, lists changes with colored dots (green for gig, red for away)
- "Dismiss" button calls `updateLastOpened()` and clears banner
- New CSS classes: `.change-banner`, `.change-banner-header`, `.change-banner-title`, `.change-banner-dismiss`, `.change-banner-list`, `.change-banner-item`, `.change-dot`

**4.5 — Native implementation (`native/app/(tabs)/gigs.tsx`):**
- On first mount, fetches changes since `profile.last_opened_at` (once per session via useRef flag)
- Shows `Alert.alert("What's Changed", summary)` with formatted list
- On dismiss (OK button), calls `updateLastOpened()`
- `profile` prop passed from GigsTab to GigsMainView

**Decisions:** D-057 (in-app change summary), D-058 (away_date_changelog table), D-059 (last_opened_at tracking)

### What Was Tested
- `npx tsc --noEmit` passes clean (native)
- `npx tsc -b` passes clean (web)
- `npx vite build` passes (7 precache entries, 627 KiB)

### What's Blocked
- Nothing

### Next Session Priorities
- Push to GitHub → Vercel deploys Phase 2 + 3 + 4 web changes
- Build release APK → test on device (change summary alert, scroll fix, count badges, toast)
- Test web on iPhone (touch targets, safe areas, focus states, change banner)
- Phase 5: Full Offline Support (service worker caching, offline queue)

---

## Session: 2026-03-04 — Phase 5: Full Offline Support

### What Was Done

**5.1 — Web: Service worker offline caching (`web/vite.config.ts`):**
- Added Workbox `runtimeCaching` config with two strategies:
  - Supabase REST API: `NetworkFirst` with 10s timeout, 24h cache, 50 entries max
  - Google Fonts: `CacheFirst` with 1-year cache, 20 entries max
- Added offline indicator banner to `App.tsx` — "You're offline — showing cached data"
- Detects connectivity via `navigator.onLine` + `online`/`offline` events
- Auto-refreshes calendar data when connectivity returns
- New `.offline-banner` CSS class in `App.css`

**5.2 — Web: Offline mutation queue (`web/src/hooks/useOfflineQueue.ts`):**
- New file: localStorage-based mutation queue (5 mutation types: createGig, updateGig, deleteGig, createAwayDate, deleteAwayDate)
- `isNetworkError()`: detects fetch failures and offline state
- `queueMutation()`: adds mutation to localStorage queue
- `useOfflineQueue()` hook: tracks pending count, auto-replays queue on reconnect, calls `onSynced` callback
- Integrated into `GigForm.tsx`: catches network errors on save/delete, queues and treats as success
- Integrated into `AwayManager.tsx`: catches network errors on create/delete, queues mutations
- `App.tsx`: shows pending count in offline banner, shows "X changes syncing..." when back online

**5.3 — Native: AsyncStorage cache (`native/src/utils/offlineCache.ts`):**
- New file: caches gigs, away dates, and profiles in AsyncStorage keyed by year-month
- `cacheCalendarData()`: stores after each successful network fetch
- `getCachedCalendarData()`: retrieves cached data for given month
- `gigs.tsx` `fetchData()`: on network failure, falls back to cache and shows "Offline — showing cached data" banner
- New `offlineBanner` / `offlineBannerText` styles

**5.4 — Native: Offline mutation queue (`native/src/utils/offlineQueue.ts`):**
- New file: AsyncStorage-based mutation queue (same 5 mutation types as web)
- `isNetworkError()` / `queueMutation()`: detect and queue failed mutations
- `replayQueue()`: replays queued mutations when online, keeps failed items
- `startOfflineQueueListener()`: subscribes to NetInfo connectivity changes, auto-replays on reconnect
- Installed `@react-native-community/netinfo` package
- Integrated into `gig/new.tsx`: catches network errors on save/delete, queues with toast feedback
- Integrated into `gig/away.tsx`: catches network errors on create/delete away dates
- `gigs.tsx`: starts offline queue listener alongside realtime subscriptions

**Decisions:** D-060 (NetworkFirst SW caching), D-061 (offline mutation queue pattern), D-062 (AsyncStorage cache)

### What Was Tested
- `npx tsc --noEmit` passes clean (native)
- `npx tsc -b` passes clean (web)
- `npx vite build` passes (7 precache entries, 630 KiB)

### What's Blocked
- Nothing

### Next Session Priorities
- Push to GitHub → Vercel deploys Phase 2–5 web changes
- Build release APK → test on device (offline mode, change summary, all Phase 3 fixes)
- Test web on iPhone (offline indicator, change banner, touch targets, safe areas)
- Phase 6: Polish & Remaining Items (today button, time picker, calendar preservation, etc.)

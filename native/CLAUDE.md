# GigBooks — Project Constitution

## What Is This?
Mobile invoice and receipt generator for Nathan Thomas (sole trader, trading as The Green Tangerine). Creates professional PDF invoices for gigs and receipts for band member payment splits.

## Tech Stack (Locked)
- React Native + Expo SDK 55
- TypeScript (strict)
- expo-router (file-based navigation)
- expo-sqlite (local storage, WAL mode)
- expo-print + expo-sharing (PDF generation)
- expo-file-system (new API: File, Directory, Paths)
- Karla + JetBrains Mono fonts
- Dark neumorphic UI (same as Budget app)
- Supabase (Gigs tab only — shared calendar with band)

## Architecture
- **5 tabs:** Dashboard, Invoices, Clients, Gigs, Settings
- **Stack routes:** invoice/new (wizard), invoice/[id] (detail), invoice/receipts, client/new, client/[id]
- **Database:** 6 tables (settings, clients, venues, band_members, invoices, receipts)
- **PDF:** HTML templates rendered via expo-print, shared via expo-sharing
- **State:** useSettings hook, useFocusEffect for screen data loading

## Key Patterns
- Single-user SQLite (id = 'default' for settings)
- genId(): `Date.now().toString(36) + Math.random().toString(36).slice(2, 8)`
- Settings loaded via useSettings hook
- NeuCard/NeuWell/NeuButton for consistent neumorphic UI
- InvoiceWithClient JOIN type for list displays

## Non-Negotiable Rules
1. READ before WRITE — check what exists before modifying
2. No cloud / no Supabase / no network calls (except PDF sharing and the Gigs tab)
3. TypeScript strict — `npx tsc --noEmit` must pass clean
4. One change at a time, verify on device
5. Don't refactor unless explicitly asked
6. Follow the Sovereign Spec session protocol (see below)
7. Update SOT docs when significance threshold is met

## SOT (Source of Truth) Documents
All in `docs/ai_context/`:

| Document | Purpose | Update When |
|----------|---------|-------------|
| `blueprint.md` | Architecture north star | Architectural changes |
| `schema_map.md` | DB schema + TypeScript types | Data model changes |
| `decisions_log.md` | Locked ADRs (append-only) | New decisions made |
| `todo.md` | Tasks, priorities, backlog | After every task |
| `SESSION_LOG.md` | Session handoff notes | End of every session |
| `gotchas.md` | Lessons learned | When something bites us |
| `pain_journal.md` | Process improvements | When time is wasted |

### Significance Thresholds
- **CRITICAL** (update immediately): Architecture, schema, breaking changes, new dependencies, config files
- **MODERATE** (batch at session end): New utils, refactors, bug fixes, UI tweaks
- **TRIVIAL** (no update): Questions, code review, typos, formatting

## Session Start Protocol
Before writing ANY code:
1. Read `CLAUDE.md` (this file)
2. Read `docs/ai_context/SESSION_LOG.md` — where we left off
3. Read `docs/ai_context/todo.md` — current priorities
4. Read `docs/ai_context/decisions_log.md` — locked decisions
5. Run `npx tsc --noEmit` — verify clean state
6. **Declare scope** — "I will modify X, Y, Z. I will NOT touch A, B, C."
7. Get confirmation before writing code

## Session End Protocol
Before wrapping up:
1. Verify `npx tsc --noEmit` passes
2. Update `SESSION_LOG.md` — what was done, tested, blocked, next priorities
3. Update `todo.md` — mark done, add new items
4. Update `gotchas.md` — if lessons were learned
5. Update `decisions_log.md` — if new decisions were locked
6. Update this file — if locked rules changed

## Business Context
- Nathan Thomas, sole trader, trading as The Green Tangerine
- Invoices clients for live music gigs
- 4 band members split equally — Nathan pays the other 3
- Receipts prove Nathan paid each member their share
- Bank details entered in Settings (not hardcoded)

## Build Commands
```bash
npx expo start           # Dev server
npx tsc --noEmit        # Type check
```

## File Map
```
app/_layout.tsx          → Root (fonts, DB, splash)
app/(tabs)/index.tsx     → Dashboard (stats + pull-to-refresh)
app/(tabs)/invoices.tsx  → Full invoice list with search
app/(tabs)/clients.tsx   → Client list
app/(tabs)/settings.tsx  → Defaults config
app/invoice/new.tsx      → 3-step wizard
app/invoice/[id].tsx     → Invoice detail + delete + preview link
app/invoice/preview.tsx  → Invoice + receipt preview carousel
app/invoice/receipts.tsx → Receipt generation
app/client/new.tsx       → Add client
app/client/[id].tsx      → Edit client + unsaved changes warning
app/(tabs)/gigs.tsx      → Shared gig calendar (Supabase, login gate)
app/gig/new.tsx          → Add/edit gig form
app/gig/away.tsx         → Manage personal away dates
src/supabase/config.ts   → Supabase URL + anon key
src/supabase/client.ts   → Supabase client (AsyncStorage adapter)
src/supabase/types.ts    → Gig, AwayDate, Profile types
src/supabase/queries.ts  → Supabase CRUD for gigs/away/profiles
src/supabase/AuthContext.tsx → Auth provider (signIn/signOut/session)
src/components/GigCalendar.tsx → Month view with color-coded days
src/components/GigDaySheet.tsx → Day detail modal
src/db/database.ts       → Schema + seed
src/db/queries.ts        → All CRUD (atomic transactions)
src/pdf/invoiceTemplate.ts         → Classic HTML template
src/pdf/invoiceTemplatePremiumDark.ts → Premium Dark template
src/pdf/invoiceTemplateCleanProfessional.ts → Clean Professional template
src/pdf/invoiceTemplateBoldRock.ts → Bold Rock template
src/pdf/invoiceTemplateChristmas.ts → Christmas/New Year template
src/pdf/invoiceTemplateHalloween.ts → Halloween/Bonfire Night template
src/pdf/invoiceTemplateValentine.ts → Valentine's Day template
src/pdf/receiptTemplate.ts         → Classic receipt HTML template
src/pdf/receiptTemplatePremiumDark.ts → Premium Dark receipt template
src/pdf/receiptTemplateCleanProfessional.ts → Clean Professional receipt template
src/pdf/receiptTemplateBoldRock.ts → Bold Rock receipt template
src/pdf/receiptTemplateChristmas.ts → Christmas receipt template
src/pdf/receiptTemplateHalloween.ts → Halloween receipt template
src/pdf/receiptTemplateValentine.ts → Valentine receipt template
src/pdf/getReceiptTemplate.ts     → Receipt style dispatcher (matches getInvoiceTemplate)
src/pdf/generatePdf.ts   → expo-print + sharing + deletePdf
src/pdf/logo.ts          → TGT logo base64 PNG
src/utils/htmlEscape.ts  → HTML entity escaping for PDF templates
src/utils/csvExport.ts   → CSV export with newline escaping
```

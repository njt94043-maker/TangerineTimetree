# TGT — Project Constitution

## What Is This?
Monorepo for The Green Tangerine — a 4-piece live music band. Two apps sharing one Supabase backend:
- **GigBooks** (native/) — React Native/Expo mobile app for invoicing, quotes, gig management
- **Tangerine Timetree** (web/) — React/Vite PWA for shared calendar, invoicing, quotes, public website

## Tech Stack (Locked)
- **Native**: React Native + Expo SDK 55, expo-router (file-based), expo-print + expo-sharing (PDF)
- **Web**: React + Vite, PWA (vite-plugin-pwa)
- **Shared**: TypeScript (strict), Supabase (all data), `shared/` directory with types, queries, config, PDF templates
- **Auth**: Supabase Auth — native uses AsyncStorage, web uses localStorage
- **Fonts**: Karla + JetBrains Mono
- **UI**: Dark neumorphic theme, collapsible drawer navigation (both apps)

## Architecture
- **Navigation**: Collapsible drawer (both apps) — not tabs
- **Native screens**: `app/(drawer)/` — index (gigs), invoices, quotes, clients, venues, settings + stack routes for detail/new/edit
- **Web views**: ViewContext state machine — drawer triggers view changes, no router library
- **Database**: 20 Supabase tables (see STATUS.md for full list)
- **PDF**: HTML templates in `shared/templates/` (28 styles: 7 invoice + 7 receipt + 7 quote + 7 formal invoice), rendered on-demand
- **State**: useFocusEffect (native), realtime subscriptions (web), no Redux/Zustand

## Key Patterns
- `@shared/*` path alias imports types, queries, config, templates from `shared/`
- `SupabaseClientLike` interface in shared/ avoids direct npm dependency
- `neuRaisedStyle()` / `neuInsetStyle()` for neumorphic UI (native)
- EntityPicker: searchable dropdown with inline "Add New" (both apps)
- venue_id chain: gig → invoice → quote → formal_invoice all carry venue_id FK

## Non-Negotiable Rules
1. READ before WRITE — check what exists before modifying
2. TypeScript strict — `npx tsc --noEmit` (native) and `npx tsc -b` (web) must pass clean
3. NEVER hardcode API keys in committed files — use `.env` (gitignored)
4. Read SOT docs (STATUS.md → todo.md) at session start
5. Update SOT docs at session end
6. Don't refactor unless explicitly asked
7. Commit and push all work before session end

## SOT (Source of Truth) Documents
All in `docs/ai_context/`:

| Document | Purpose | Update When |
|----------|---------|-------------|
| `STATUS.md` | Instant context — read FIRST | Every session end |
| `todo.md` | Tasks, priorities, backlog | After every task |
| `SESSION_LOG.md` | Session handoff notes | End of every session |
| `gotchas.md` | Lessons learned | When something bites us |
| `decisions_log.md` | Locked ADRs (append-only) | New decisions made |
| `schema_map.md` | DB schema + TypeScript types | Data model changes |
| `SPRINT_PROMPTS.md` | Sprint pickup prompts | New sprint planned |

## Session Start Protocol
1. Read `STATUS.md` — instant context
2. Read `todo.md` — current priorities
3. Only read deeper docs if the task requires it
4. Run `npx tsc --noEmit` — verify clean state

## Session End Protocol
1. Verify `npx tsc --noEmit` (native) and `npx tsc -b` (web) pass
2. Update `STATUS.md`, `todo.md`, `SESSION_LOG.md`
3. Update `gotchas.md` / `decisions_log.md` if needed
4. Commit and push all changes

## Business Context
- Nathan Thomas, sole trader, trading as The Green Tangerine
- Band: Nathan (drums), Neil (bass), James (lead vocals), Adam (guitar & backing vocals)
- Booking email: bookings@thegreentangerine.com
- Invoices clients for live music gigs, 4-way equal split, receipts prove payment
- Bank details entered in Settings (not hardcoded)

## Build Commands
```bash
# Native
cd native && npx tsc --noEmit        # Type check
cd native/android && ./gradlew assembleRelease  # APK build

# Web
cd web && npx tsc -b                  # Type check
cd web && npx vite build              # Production build

# Seed scripts (from root, need SUPABASE_SERVICE_ROLE_KEY env var)
node --max-old-space-size=512 web/scripts/seed-venues-clients.cjs
node --max-old-space-size=512 web/scripts/fix-venue-text.cjs
```

## File Map
```
# Native — Drawer screens
app/(drawer)/_layout.tsx    → Drawer navigation layout
app/(drawer)/index.tsx      → Gigs calendar (default screen)
app/(drawer)/invoices.tsx   → Invoice list with filters/sort
app/(drawer)/quotes.tsx     → Quote list with filters/sort
app/(drawer)/clients.tsx    → Client list
app/(drawer)/venues.tsx     → Venue list with ratings
app/(drawer)/dashboard.tsx  → Stats dashboard
app/(drawer)/settings.tsx   → User/band settings, service catalogue, preferences

# Native — Stack routes
app/gig/new.tsx             → Add/edit gig (EntityPicker for venue/client)
app/invoice/new.tsx         → Invoice wizard (EntityPicker for venue/client)
app/invoice/[id].tsx        → Invoice detail + receipts
app/quote/new.tsx           → 4-step quote wizard
app/quote/[id].tsx          → Quote detail + lifecycle
app/quote/preview.tsx       → PDF preview carousel
app/client/[id].tsx         → Client detail
app/venue/new.tsx           → Add venue
app/venue/[id].tsx          → Venue detail (ratings, photos, notes)

# Shared
shared/supabase/config.ts   → Supabase URL + publishable key
shared/supabase/types.ts    → All TypeScript types (20+ interfaces)
shared/supabase/queries.ts  → All Supabase CRUD (~80 functions)
shared/supabase/clientRef.ts → SupabaseClientLike + initSupabase()
shared/supabase/index.ts    → Barrel export
shared/templates/           → 28 PDF templates + utilities

# Native — Local code
src/supabase/client.ts      → Supabase client (AsyncStorage adapter)
src/supabase/AuthContext.tsx → Auth provider
src/components/             → GigCalendar, GigList, GigDaySheet, EntityPicker, StarRating, NeuButton, NeuCard, NeuWell, NeuSelect, StatusBadge
src/db/queries.ts           → Thin adapter wrapping shared/supabase/queries
src/pdf/generatePdf.ts      → expo-print PDF generation + sharing
src/theme/                  → colors.ts, shadows.ts, typography.ts
```

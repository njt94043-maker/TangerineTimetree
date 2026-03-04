# GigBooks — Blueprint (North Star)

> Source of Truth for architecture, tech stack, and locked rules.
> Update ONLY on architectural changes. Never contradict CLAUDE.md.

---

## Purpose

Mobile invoice and receipt generator for **Nathan Thomas** (sole trader, trading as **The Green Tangerine**). Creates professional PDF invoices for live music gigs and receipts for band member payment splits.

## Tech Stack (Locked)

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React Native | 0.83.2 |
| Platform | Expo SDK | 55 |
| Language | TypeScript (strict) | ~5.9.2 |
| Navigation | expo-router (file-based) | ~55.0.3 |
| Database | expo-sqlite (WAL mode) | ~55.0.10 |
| PDF | expo-print + expo-sharing | ~55.0.5 |
| File System | expo-file-system (new API) | ~55.0.7 |
| Fonts | Karla + JetBrains Mono | Google Fonts |
| UI | Dark neumorphic (custom components) | — |

## Architecture

### Navigation Structure
```
app/_layout.tsx              → Root (fonts, DB init, splash)
app/(tabs)/
  ├── index.tsx              → Dashboard (stats + recent invoices + pull-to-refresh)
  ├── invoices.tsx           → Full invoice list with search + pull-to-refresh
  ├── clients.tsx            → Client list with search
  └── settings.tsx           → User/bank/invoice/band config
app/invoice/
  ├── new.tsx                → 3-step wizard (client → details → preview)
  ├── [id].tsx               → Invoice detail + status management
  └── receipts.tsx           → Receipt generation per band member
app/client/
  ├── new.tsx                → Add client
  └── [id].tsx               → Edit/delete client
```

### Data Layer
- **Single SQLite database** — opened once at startup via `getDb()` singleton
- **6 tables:** settings, clients, venues, band_members, invoices, receipts
- **No ORM** — raw SQL via expo-sqlite async API
- **ID generation:** `genId()` = `Date.now().toString(36) + Math.random().toString(36).slice(2, 8)`
- **Settings singleton:** `id = 'default'`

### State Management
- React hooks (`useState`, `useCallback`, `useEffect`)
- `useSettings()` custom hook — loads/saves settings with dirty tracking
- `useFocusEffect()` — refetch data when screen gains focus
- No Redux, no Context API — direct SQLite queries

### UI System
- **NeuCard** — raised card container
- **NeuWell** — inset input field
- **NeuButton** — interactive button with press-state inversion
- **StepIndicator** — 3-step progress (invoice wizard)
- **StatusBadge** — draft/sent/paid display
- **CalendarPicker** — date selection modal

### Theme
- **Colors:** Dark neumorphic — background `#1e1e2e`, teal `#1abc9c`, orange `#f39c12`
- **Fonts:** Karla (body), JetBrains Mono (monospace/numbers)
- **Shadows:** `neuRaisedStyle()` / `neuInsetStyle()` with intensity levels (subtle/normal/strong)

### PDF System
- HTML templates with inline CSS → `expo-print` → PDF file
- Saved to `Documents/pdfs/` directory
- Shared via `expo-sharing` native share sheet
- Professional layout: TGT logo PNG (base64), teal/orange brand colours
- All template data HTML-escaped via `htmlEscape()` utility

## Core Business Flow

```
1. Configure Settings → business details, bank info, band members
2. Add Clients → venue/company records
3. Create Invoice → 3-step wizard → generates PDF → shares
4. Track Status → draft → sent → paid (with paid date)
5. Generate Receipts → equal split for non-Nathan members → individual PDFs
6. Export → CSV of all invoices
```

## Locked Rules

1. **Local only for invoicing** — No cloud sync for invoices/receipts/clients (except PDF sharing). Gig calendar uses Supabase (shared with web app) — see schema_map.md Part B
2. **Single user** — `id = 'default'` settings, no auth
3. **Equal splits only** — invoice amount ÷ total members
4. **Receipts for others only** — Nathan doesn't get a receipt (is_self = 1)
5. **7 invoice styles** — classic, premium dark, clean professional, bold rock, autumn warmth, winter frost, summer breeze; HTML templates with htmlEscape
6. **4 band members fixed** — seeded at DB init, names editable
7. **Invoice numbers sequential** — INV-001 format, auto-incremented
8. **TypeScript strict** — `npx tsc --noEmit` must pass clean
9. **No emulators** — physical device testing only
10. **Dark neumorphic UI** — consistent with Budget app

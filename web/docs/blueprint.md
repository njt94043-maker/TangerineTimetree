# Tangerine Timetree — Web Blueprint

> Architecture document for the web PWA. Source of truth for routing, components, data flow, and offline strategy.

---

## Purpose

PWA gig calendar for **The Green Tangerine** band. 4 members manage gigs, practices, and availability through a shared calendar synced via Supabase realtime.

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React | 19.2.x |
| Build | Vite | 7.3.x |
| Language | TypeScript (strict) | ~5.9.3 |
| PWA | vite-plugin-pwa (Workbox) | 1.2.x |
| Backend | Supabase (auth + Postgres + realtime) | 2.98.x |
| Dates | date-fns | 4.1.x |
| UI | Dark neumorphic (single CSS file) | — |

## Architecture

### Routing

**No router library** — view state managed in `App.tsx` via `useState`.

```
type View = 'calendar' | 'list' | 'day-detail' | 'gig-form' | 'away';
```

Flow:
```
App.tsx
├── LoginPage (if !user)
└── MainView (authenticated)
    ├── Calendar view (month grid, swipe nav, date tap → DayDetail)
    ├── GigList view (upcoming gigs grouped by date)
    └── Overlays
        ├── DayDetail (bottom sheet — gigs for selected date)
        ├── GigForm (create/edit gig or practice)
        └── AwayManager (manage away date ranges)
```

### Components

| Component | File | Purpose |
|-----------|------|---------|
| App | `App.tsx` | Root — auth check, view state, offline detection, change summary |
| LoginPage | `components/LoginPage.tsx` | Email/password auth form |
| Calendar | `components/Calendar.tsx` | Month grid with gig dots, swipe support |
| GigList | `components/GigList.tsx` | Upcoming gigs list with "days until" |
| DayDetail | `components/DayDetail.tsx` | Bottom sheet — gigs, changelog, away info |
| GigForm | `components/GigForm.tsx` | Create/edit gig or practice, offline queueing |
| AwayManager | `components/AwayManager.tsx` | Manage user's away date ranges |

### Hooks

| Hook | File | Purpose |
|------|------|---------|
| useAuth | `hooks/useAuth.ts` | Auth state, sign in/out, profile fetch |
| useCalendarData | `hooks/useCalendarData.ts` | Fetch gigs/away dates/profiles + realtime subscription |
| useOfflineQueue | `hooks/useOfflineQueue.ts` | localStorage mutation queue, replay on reconnect |

### Data Flow

```
useAuth() → supabase.auth.getSession()
useCalendarData(year, month) → shared/supabase/queries
  ├── getGigsForMonth(), getAwayDatesForMonth(), getProfiles()
  └── supabase.channel().on('postgres_changes') → auto-refetch
useOfflineQueue() → localStorage('timetree-offline-queue')
  └── window 'online' event → replayQueue()
```

Mutations route through `shared/supabase/queries`. If network error detected, `queueMutation()` saves to localStorage for later replay.

### Offline Strategy

- **Storage:** localStorage key `'timetree-offline-queue'`
- **Detection:** `!navigator.onLine`, fetch TypeError, "Failed to fetch" message
- **UI:** Offline banner with pending count; syncing indicator during replay
- **Replay:** On `window.online` event — iterates queue, checks entity existence before update/delete, removes successful items
- **Caching:** Workbox `NetworkFirst` for Supabase REST API (10s timeout, 24h cache), `CacheFirst` for Google Fonts (1yr)

### PWA Config

- **Manifest:** `public/manifest.json` — standalone display, `#08080c` background, `#f39c12` theme
- **Icons:** 192px + 512px PNGs
- **Workbox:** Auto-update registration, glob patterns for static assets
- **Apple:** `apple-mobile-web-app-capable=yes`, `black-translucent` status bar

### Styling

**Single CSS file:** `src/App.css` (~765 lines). No CSS-in-JS, no Tailwind.

**Design system:**
- Background: `#08080c` (near-black)
- Cards: `#111118` with neumorphic shadows
- Inputs: `#0c0c12` inset shadows
- Accent: `#f39c12` (tangerine), `#00e676` (green/success)
- Status colors: green (gig), purple (practice), red (unavailable/danger)
- Fonts: Karla (body), JetBrains Mono (numbers)
- Max width: 480px (phone-first)
- Safe areas: `env(safe-area-inset-*)` for notched devices

### Auth

1. `useAuth()` calls `supabase.auth.getSession()` on mount
2. Listens to `onAuthStateChange` for session updates
3. On sign-in → fetches profile from `profiles` table
4. `onAuthError()` listener catches expired JWTs → auto sign-out
5. No signup UI — accounts created via Supabase dashboard

### State Management

React hooks only — no Redux, Context, or Zustand.

- **Auth state:** `useAuth()` returns user/profile/session/loading
- **View state:** `useState` in App.tsx (view, selectedDate, editGigId)
- **Data state:** `useCalendarData()` returns gigs/awayDates/profiles
- **Offline state:** `useOfflineQueue()` returns pendingCount/syncing

## File Structure

```
web/
├── src/
│   ├── App.tsx, App.css, main.tsx
│   ├── components/
│   │   ├── LoginPage.tsx
│   │   ├── Calendar.tsx
│   │   ├── GigList.tsx
│   │   ├── DayDetail.tsx
│   │   ├── GigForm.tsx
│   │   └── AwayManager.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useCalendarData.ts
│   │   └── useOfflineQueue.ts
│   └── supabase/
│       └── client.ts
├── public/
│   ├── manifest.json
│   └── logo*.png
├── vite.config.ts
├── tsconfig.json, tsconfig.app.json
└── package.json
```

## Build & Deploy

- **Dev:** `npm run dev` (Vite HMR)
- **Type check:** `npx tsc -b`
- **Build:** `npx vite build` → `dist/`
- **Deploy:** Vercel auto-deploys from `master` (root dir = `web/`)
- **Env vars:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

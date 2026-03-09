# TGT — Blueprint (North Star)

> Source of Truth for architecture, tech stack, and locked rules.
> Update ONLY on architectural changes. Never contradict CLAUDE.md.

---

## Purpose

Band management platform for **The Green Tangerine** (Nathan Thomas, sole trader, CIS carpenter). Two apps + one capture tool sharing one backend:
- **GigBooks** (Android/Compose) — Nathan's personal stage performance + practice tool (click tracks via IEMs, setlists, beat-locked MP3 practice). Nathan only — sideloaded APK.
- **Tangerine Timetree** (Web/React PWA) — Full band management (invoicing, quotes, calendar, stage prompter, practice) for all 4 members. Primary interface for Neil, Adam, James.
- **TGT Capture** (Chrome extension + FastAPI + React) — WASAPI loopback audio capture for YouTube practice references. Nathan only.

## Band Context

- **Genre**: Mix of everything — covers + originals, no genre lean. Function/wedding band trajectory. BPM range 80-180+.
- **Members**: Nathan (drums, IEMs, management), Neil (bass), Adam (guitar + backing vocals, customer-facing), James (lead vocals)
- **Side projects**: Everyone plays in other bands — hence `other_band` setlist type and `personal` song category
- **Rehearsal**: Regular band rehearsals + individual practice. Apps serve both use cases.
- **Goal**: Regular wedding/event bookings for higher pay. Building towards making TGT their job.
- **Tech comfort**: Nathan builds with AI. One or two others are techy. Rest need things to just work via web.
- **Infrastructure**: All free tiers (Supabase, GCP, Vercel). No Google Play account — APK sideloaded.

## Tech Stack

### Android — GigBooks
| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Jetpack Compose | BOM 2025.05 |
| Language | Kotlin | 2.1.20 |
| Build | Gradle | 9.0.0 |
| Audio | C++/Oboe + SoundTouch (JNI) | Oboe 1.9.3 |
| Beat detection | madmom (server-side, Cloud Run) | 0.16.1 |
| Stem separation | Demucs (server-side, Cloud Run) | 4.0.1 |
| Backend | Supabase Kotlin SDK | 3.1.4 |
| NDK | Android NDK | 27.1.12297006 |

### Web — Tangerine Timetree
| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React (Vite PWA) | 19.x |
| Language | TypeScript (strict) | ~5.9 |
| Audio (S36) | Web Audio API + SoundTouchJS | TBD |
| Backend | Supabase JS SDK | 2.x |
| Deploy | Vercel (auto-deploy from master) | — |
| Domain | thegreentangerine.com | IONOS DNS → Vercel |

### Shared
| Layer | Technology |
|-------|-----------|
| Database | Supabase (Postgres, 25 tables, RLS) |
| Storage | Supabase Storage (4 buckets) |
| Auth | Supabase Auth (publishable/secret keys) |
| Types/Queries | `shared/supabase/` (TypeScript, `@shared/*` alias) |
| PDF | 28 HTML templates (inline CSS, 7 per type: invoice/receipt/quote/formal) |
| Processing | Google Cloud Run (europe-west1) — madmom + Demucs |

## Architecture

### Monorepo Layout (`C:\Apps\TGT\`)
```
shared/           — Supabase types, queries, config, PDF templates
web/              — Tangerine Timetree (Vite + React PWA)
android/          — GigBooks (Jetpack Compose + C++/Oboe)
native/           — React Native/Expo (SHELVED, archived)
native/docs/      — SOT documentation (shared across all apps)
```

### Android App Structure
```
android/app/src/main/
  java/.../gigbooks/
    ui/screens/     — CalendarScreen, LibraryScreen, LiveScreen, PracticeScreen, SettingsScreen, LoginScreen
    ui/components/  — NeuCard, NeuWell, MetronomeComponents
    ui/theme/       — GigColors, GigTypography, GigBooksTheme
    data/           — SupabaseProvider, AuthRepository, SongRepository, SetlistRepository
    audio/          — AudioEngineBridge.kt (JNI)
    AppViewModel.kt — Shared state + engine wiring
    GigBooksApp.kt  — ModalNavigationDrawer (Calendar/Library/Settings)
  cpp/              — AudioEngine (C++/Oboe): metronome, track_player, mixer, SoundTouch, BTrack
```

### Web App Structure
```
web/src/
  components/       — Shared UI components
  views/            — Calendar, Dashboard, Invoices, Quotes, Venues, Clients, Songs, Setlists, StagePrompter, Settings, PublicSite
  hooks/            — useAuth, useSettings, useOfflineQueue, etc.
  utils/            — Helpers, formatters
```

### Navigation
- **Android**: ModalNavigationDrawer — Calendar, Library, Settings. Live/Practice launched from Library.
- **Web**: Collapsible drawer — Calendar, Library, Invoices, Quotes, Venues, Clients, Dashboard, Settings, Public Site, Stage Prompter.

### Data Layer
- **Supabase** for ALL data (no local SQLite)
- **25 tables**: profiles, gigs, away_dates, songs, setlists, setlist_songs, song_stems, beat_maps, clients, venues, invoices, receipts, quotes, formal_invoices, etc.
- **4 storage buckets**: public-media, venue-photos, practice-tracks, song-stems
- **RPC**: `next_invoice_number()`, `next_quote_number()` — atomic auto-increment
- **Android**: Supabase Kotlin SDK (direct queries)
- **Web**: Shared TypeScript queries from `shared/supabase/queries.ts` (91+ functions)

### Audio Engine
- **Android (C++)**: Single Oboe stream — metronome (ch0) + track (ch1) + stems (ch2..7). SoundTouch time-stretch. Beat maps from Supabase (madmom server). BTrack offline fallback.
- **Web (S36)**: Web Audio API — AudioContext, GainNodes, SoundTouchJS for speed. Same beat map data from Supabase.

### Processing Pipeline
```
Upload MP3 → Supabase Storage → POST /process (Cloud Run, 202) →
  Cloud Tasks queue → /process-worker:
    1. madmom RNN+DBN → beat_maps table (timestamps + BPM)
    2. Demucs htdemucs → 4 stems (drums/bass/other/vocals) → song_stems table + storage
```

## Theme
- **Colors**: Dark neumorphic — background `#1e1e2e` / `#08080c`, teal `#1abc9c`, orange `#f39c12`, green gigs `#00e676`, purple practice `#bb86fc`, red away `#ff5252`
- **Fonts**: Karla (body), JetBrains Mono (numbers/data)
- **Shadows**: Neumorphic raised/inset with border simulation (Android NeuCard/NeuWell, web CSS)
- **Dark mode only** (web: `color-scheme: dark only`)

## Core Business Flows

### Band Management (Web)
```
Configure Settings → Add Clients/Venues → Book Gigs (calendar) →
  Create Invoice → Track Status (draft→sent→paid) → Generate Receipts →
  Create Quotes → Accept → Formal Invoice → Export CSV
```

### Performance (Android)
```
Library → Browse songs/setlists (filter by category/type) →
  Launch Live Mode (click + setlist nav + lyrics) or Practice Mode (tracks + stems + speed) →
  Queue overlay (reorder mid-set) → Set Complete screen
```

### Practice (Web, S36/S37)
```
Library → Browse songs → Launch Practice Mode →
  Web Audio playback (track + stems + click) → SoundTouchJS speed control →
  A-B loop → Per-user prefs (click/lyrics/chords toggles)
```

## Locked Rules

1. **Supabase for ALL data** — no local SQLite (supersedes D-003/D-015)
2. **4 band members fixed** — Nathan (Drums), Neil (Bass), James (Vocals), Adam (Guitar). Count not editable.
3. **Equal payment splits only** — invoice amount / total members
4. **Receipts for other members only** — Nathan doesn't get a receipt (is_self)
5. **Dark neumorphic UI** — consistent across both apps
6. **NEVER hardcode API keys** — use env vars, `.env` is gitignored
7. **API keys: publishable + secret** — legacy JWT keys disabled (D-077)
8. **TypeScript strict** — `npx tsc --noEmit` must pass clean (web)
9. **Android build must pass** — `./gradlew assembleDebug` clean
10. **Library as launchpad** — Live/Practice launch from Library, not separate nav (D-110)
11. **1 setlist = 1 gig** — no multi-set. Player waits between songs. Set Complete at end (D-114)
12. **Stage prompter merges into Live Mode** — per-user display toggles (D-113)
13. **Server-side beat detection** — madmom on Cloud Run, not on-device (D-104/D-105)
14. **Card-level beat glow** — not full-screen (D-119)
15. **Git commit + push at end of every session**

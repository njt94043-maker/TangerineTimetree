# TGT — Project Constitution

## What Is This?
Monorepo for The Green Tangerine — a 4-piece live music band. Three live apps + one future + one shelved, sharing one Supabase backend. **All apps are one family** — same dark neumorphic theme, same fonts, same visual language. Different features but shared metadata must be consistent (D-156).
- **GigBooks** (android/) — Jetpack Compose + C++/Oboe native app for calendar, songs, setlists, live mode, practice mode
- **Tangerine Timetree** (web/) — React/Vite PWA for full band management (invoicing, quotes, calendar, stage prompter, public site)
- **TGT Capture** (capture/) — FastAPI + React local tool for capturing YouTube/system audio as practice material. **Entry point for the whole ecosystem** — feeds songs into web app via import pipeline, practice tracks into future ClickTrack. Capture is the metadata superset (D-154).
- **ClickTrack** (future, not yet in repo) — Personal practice tool for Nathan. Techniques, sticking patterns, fills, polyrhythms, limb independence. Will consume Capture's practice_category, instrument_focus, difficulty fields. **Not built yet but integration points must be considered now** (D-155).
- **Native** (native/) — **SHELVED**. Former React Native/Expo app. Archived at `D:/tgt/gigbooks-react-native-backup-2026-03-08.7z`. Still in git history.

## Tech Stack (Locked)
- **Android**: Kotlin 2.1.20, Jetpack Compose BOM 2025.05, Supabase Kotlin SDK 3.1.4, Oboe 1.9.3 (C++ audio), NDK 27.1.12297006, CMake 3.22.1, Gradle 9.0.0
- **Web**: React + Vite, PWA (vite-plugin-pwa), dark-mode only (`color-scheme: dark only`)
- **Capture**: Python 3 (FastAPI + uvicorn), React 19 + Vite 7, SQLite, WASAPI loopback (pyaudiowpatch), librosa (BPM/key), mutagen (ID3), FFmpeg (LAME V0 encoding), Chrome extension (MV3 side panel)
- **Shared**: TypeScript (strict), Supabase (all data), `shared/` directory with types, queries, config, PDF templates
- **Auth**: Supabase Auth — Android uses Supabase Kotlin SDK session, web uses localStorage
- **Fonts**: Karla + JetBrains Mono
- **UI**: Dark neumorphic theme — GigColors (Android), CSS variables (web)

## Architecture
- **Android navigation**: Compose ModalNavigationDrawer (3 items: Calendar, Library, Settings)
- **Web navigation**: Collapsible drawer — ViewContext state machine, no router library
- **Database**: 25 Supabase tables, 4 storage buckets (see schema_map.md)
- **PDF**: HTML templates in `shared/templates/` (28 styles: 7 invoice + 7 receipt + 7 quote + 7 formal invoice), rendered on-demand (web only)
- **Audio**: Android = C++ AudioEngine (Oboe + SoundTouch) via JNI. Web = Web Audio API + SoundTouchJS (S36, built).
- **State**: Android = AppViewModel (single ViewModel). Web = hooks + realtime subscriptions.
- **Cloud Run**: `beat-analysis` service — madmom beats + Demucs stems via Cloud Tasks (GCP tangerine-time-tree, europe-west1)
- **Capture**: SQLite DB (local), WASAPI loopback or Chrome extension WebSocket capture, FFmpeg encoding pipeline, librosa analysis. Runs on Nathan's machine only (localhost:9123 backend, localhost:5174 UI).

## Key Patterns
- `@shared/*` path alias imports types, queries, config, templates from `shared/`
- `SupabaseClientLike` interface in shared/ avoids direct npm dependency
- Android: NeuCard/NeuWell composables for neumorphic UI
- Web: `neuRaisedStyle()` / `neuInsetStyle()` CSS helpers
- EntityPicker: searchable dropdown with inline "Add New" (web)
- venue_id chain: gig → invoice → quote → formal_invoice all carry venue_id FK
- Android JNI: `AudioEngineBridge.kt` → C++ `AudioEngine` singleton (package `com.thegreentangerine.gigbooks.audio`)
- Kotlin numeric gotcha: Postgres `numeric` → Kotlin `Double`, never `Int`

## Non-Negotiable Rules
1. READ before WRITE — check what exists before modifying
2. TypeScript strict — `npx tsc -b` (web) must pass clean
3. NEVER hardcode API keys in committed files — use `.env` (gitignored)
4. Read SOT docs at session start (see protocol below)
5. Update SOT docs at session end
6. Don't refactor unless explicitly asked
7. Commit and push all work before session end

## SOT (Source of Truth) Documents
All in `docs/ai_context/` (project root level):

| Document | Purpose | Update When |
|----------|---------|-------------|
| `STATUS.md` | Instant context — read FIRST | Every session end |
| `IMPACT_MAP.md` | Ripple chains — read SECOND | When coupling changes |
| `todo.md` | Tasks, priorities, backlog | After every task |
| `SESSION_LOG.md` | Session handoff notes | End of every session |
| `gotchas.md` | Lessons learned + audit findings | When something bites us |
| `decisions_log.md` | Locked ADRs (append-only) | New decisions made |
| `schema_map.md` | DB schema + TypeScript types | Data model changes |
| `pain_journal.md` | Root cause analysis of real failures | After significant debugging |
| `SPRINT_PROMPTS.md` | Sprint pickup prompts | New sprint planned |

## Session Start Protocol
1. Read `STATUS.md` — instant context
2. Read `IMPACT_MAP.md` — coupling awareness
3. Read `todo.md` — current priorities
4. Only read deeper docs if the task requires it

## Session End Protocol
1. Verify `npx tsc -b` (web) passes clean
2. Update `STATUS.md` → `todo.md` → `SESSION_LOG.md`
3. Update `gotchas.md` / `decisions_log.md` if needed
4. Update `IMPACT_MAP.md` if coupling changed
5. Update `schema_map.md` if schema changed
6. Commit and push all changes

## App Scope Split
| Feature | Android (GigBooks) | Web (Tangerine Timetree) | Capture (TGT Capture) | ClickTrack (future) |
|---------|-------------------|-------------------------|----------------------|-------------------|
| Calendar | Yes | Yes | No | No |
| Songs / Setlists | Yes | Yes | Tracks (pre-import) | No |
| Song `category` (tgt_cover etc) | Yes | Yes | **Yes** (D-154) | No |
| `practice_category` | No | No | **Yes** (D-154) | **Yes** |
| `instrument_focus` / `difficulty` | No | No | **Yes** (D-154) | **Yes** |
| Live Mode | Yes | Yes (S36) | No | No |
| Practice Mode | Yes | Yes (S36) | No | Yes (different UX) |
| Invoicing / Quotes | No | Yes | No | No |
| PDF generation | No | Yes | No | No |
| Clients / Venues | No | Yes | No | No |
| Dashboard | No | Yes | No | No |
| Public site | No | Yes | No | No |
| Stage Prompter | No | Yes | No | No |
| Settings | Yes (player only) | Yes (full) | No | Yes (practice) |
| Audio capture (WASAPI/Chrome) | No | No | Yes | No |
| BPM/key analysis (librosa) | No | No | Yes | No |
| Waveform generation | No | No | Yes | No |
| Import to web | No | Pulls from Capture | Serves tracks | No |
| Import to ClickTrack | No | No | Serves practice tracks | Pulls from Capture |

### How the apps connect
- **Capture → Web**: Capture records audio, analyses BPM/key, encodes MP3, tags with Song `category`. Import pipeline lets web pull tracks from Capture server (localhost:9123), map metadata to Supabase Song fields, upload MP3 to `practice-tracks` bucket, trigger Cloud Run processing (madmom beats + Demucs stems).
- **Capture → ClickTrack** (future): ClickTrack imports Capture's practice-specific tracks using `practice_category`, `instrument_focus`, `difficulty` fields. Different import flow from TGT — personal practice only.
- **Web → Android**: Both read/write same Supabase tables. Songs created via web import appear in Android automatically.
- **Capture is the metadata superset** (D-154): Carries ALL categories for ALL consuming apps. Each consumer takes what it needs, ignores the rest. Song `category` for TGT apps, `practice_category` for ClickTrack.

### Cross-app rules (D-156, D-157)
- **Every field/schema change must be evaluated against ALL apps** — web, Android, Capture, and future ClickTrack.
- **Sprint-scoped decisions expire** after that sprint. Don't cite old scoping to avoid work.
- **Never cut scope without explicit user approval** (gotchas.md: "Feature dismissal pattern").

## Business Context
- Nathan Thomas, sole trader, trading as The Green Tangerine
- Band: Nathan (drums), Neil (bass), James (lead vocals), Adam (guitar & backing vocals)
- Booking email: bookings@thegreentangerine.com
- Invoices clients for live music gigs, 4-way equal split, receipts prove payment
- Bank details entered in Settings (not hardcoded)

### How the band operates (DO NOT second-guess this)
- **All 4 members are admin** (`is_admin = true`). There is NO role distinction for business features.
- **Everyone needs full app access** — invoicing, quotes, clients, venues, everything. Do NOT add role-based UI filtering.
- **Nathan handles ~90% of invoicing** (his bank account, his name on invoices). James invoices some gigs into his own bank.
- **Adam messages venues/clients** with invoices in Nathan's name. He needs the app to share pre-prepared PDFs via whatever messenger he's using — avoids filling phones with WhatsApp PDFs.
- **The booking wizard is intentionally comprehensive** — it trains the band to capture all booking data Nathan needs for invoicing. Don't simplify it.
- **Receipt split (÷4 but 3 receipts)**: Nathan pays himself, so only 3 receipts are generated for the other members. First gets rounding remainder. This is correct by design.

### Audit rule
Before flagging a feature as "over-engineered", "unnecessary", or "missing role-based guards" — check this section first. The business model has been explained multiple times. If a design seems wrong, ask the user before recommending changes.

## Build Commands
```bash
# Android
cd android && ./gradlew assembleRelease  # APK build

# Web
cd web && npx tsc -b                     # Type check
cd web && npx vite build                 # Production build

# Capture (from capture/ dir)
cd capture/backend && .venv/Scripts/python.exe -m uvicorn main:app --host 127.0.0.1 --port 9123 --reload  # Backend
cd capture/ui && npx vite --port 5174      # Frontend
# Or use launcher: capture/start-silent.vbs (both backend + UI)

# Seed scripts (from root, need SUPABASE_SERVICE_ROLE_KEY env var)
node --max-old-space-size=512 web/scripts/seed-venues-clients.cjs
node --max-old-space-size=512 web/scripts/fix-venue-text.cjs
```

## What's Deployed
- **Web**: thegreentangerine.com (Vercel, auto-deploys from master)
- **Android**: Compose debug APK on Samsung RFCW113WZRM
- **Supabase**: jlufqgslgjowfaqmqlds.supabase.co (25 tables, 4 storage buckets)
- **Cloud Run**: beat-analysis service on GCP tangerine-time-tree (europe-west1), revision beat-analysis-00008-dn2 (with CORS)
- **Capture**: localhost only — backend :9123, UI :5174. Launch via `capture/start-silent.vbs` or `capture/start.ps1`

## File Map
```
# Android — Screens
android/.../ui/screens/CalendarScreen.kt   → Gig calendar (default screen)
android/.../ui/screens/LibraryScreen.kt    → Songs + Setlists (filter pills, inline launch)
android/.../ui/screens/LiveScreen.kt       → Live performance (transport, queue, set complete)
android/.../ui/screens/PracticeScreen.kt   → Practice (stems, speed, A-B loop, waveform)
android/.../ui/screens/SettingsScreen.kt   → Player settings
android/.../ui/screens/LoginScreen.kt      → Auth screen

# Android — Core
android/.../ui/GigBooksApp.kt             → Root composable + drawer navigation
android/.../ui/AppViewModel.kt            → Single ViewModel (state, engine, data)
android/.../audio/AudioEngineBridge.kt    → JNI bridge to C++ engine
android/.../data/supabase/SupabaseClient.kt → Supabase Kotlin SDK client
android/.../data/supabase/AuthRepository.kt → Sign in/out, session
android/.../data/supabase/GigRepository.kt  → Gig queries
android/.../data/supabase/SongRepository.kt → Song + beat map queries
android/.../data/supabase/SetlistRepository.kt → Setlist queries
android/.../data/supabase/StemRepository.kt → Stem queries
android/.../data/supabase/models/          → Kotlin data classes (Song, Setlist, etc.)

# Android — C++ Audio Engine
android/app/src/main/cpp/audio_engine.h/cpp → AudioEngine singleton (Oboe stream)
android/app/src/main/cpp/metronome.*       → Click track scheduling
android/app/src/main/cpp/track_player.*    → MP3/stem playback
android/app/src/main/cpp/mixer.*           → Gain mixing, stem channels
android/app/src/main/cpp/CMakeLists.txt    → Build config (SoundTouch + Oboe)

# Web — Views
web/src/components/Calendar.tsx            → Gig calendar with day dots
web/src/components/DayDetail.tsx           → Day sheet (gig list, add booking)
web/src/components/BookingWizard.tsx       → Quick + full booking flow
web/src/components/GigHub.tsx              → Gig pipeline (quote/invoice generation)
web/src/components/InvoiceList.tsx         → Invoice list with filters
web/src/components/InvoiceForm.tsx         → 3-step invoice wizard
web/src/components/QuoteList.tsx           → Quote list
web/src/components/QuoteForm.tsx           → Quote builder
web/src/components/Library.tsx             → Tabbed Songs/Setlists with filter pills + launch
web/src/components/Player.tsx              → Live/Practice player (transport, lyrics, stems, queue)
web/src/components/SongList.tsx            → Song library (legacy, still routable)
web/src/components/SetlistList.tsx         → Setlist library (legacy, still routable)
web/src/components/StagePrompter.tsx       → Lyrics/chords display for stage
web/src/components/Dashboard.tsx           → Stats overview
web/src/components/Drawer.tsx              → Collapsible navigation drawer
web/src/components/Settings.tsx            → User/band settings
web/src/components/PublicSite.tsx          → Public-facing website

# Web — Audio Engine (S36)
web/src/audio/AudioEngine.ts              → Singleton: AudioContext + master gain + tick loop
web/src/audio/ClickScheduler.ts           → Frame-accurate metronome (5 sounds, beat map, swing)
web/src/audio/TrackPlayer.ts              → SoundTouchJS pitch-preserved playback + A-B loop
web/src/audio/StemMixer.ts                → Per-stem TrackPlayer + gain/mute/solo
web/src/audio/soundtouchjs.d.ts           → Type declarations for soundtouchjs
web/src/audio/index.ts                    → Barrel exports
web/src/hooks/useAudioEngine.ts           → React hook bridging audio engine to UI

# Shared
shared/supabase/config.ts                 → Supabase URL + publishable key
shared/supabase/types.ts                  → All TypeScript types (60+ interfaces)
shared/supabase/queries.ts                → All Supabase CRUD (~100 functions)
shared/supabase/clientRef.ts              → SupabaseClientLike + initSupabase()
shared/supabase/index.ts                  → Barrel export
shared/templates/                         → 28 PDF templates + utilities

# Capture — Backend (Python FastAPI)
capture/backend/main.py                   → FastAPI app + admin endpoints
capture/backend/config.py                 → Paths, ports, FFmpeg, encoding settings
capture/backend/db/database.py            → SQLite CRUD (tracks, tags, sessions)
capture/backend/api/routes_capture.py     → WASAPI start/stop/confirm, encoding pipeline
capture/backend/api/routes_library.py     → Track CRUD, file import, tags
capture/backend/api/routes_waveform.py    → Waveform JSON + thumbnail PNG
capture/backend/api/ws.py                 → WebSocket for Chrome extension tab capture
capture/backend/capture/wasapi_capture.py → WASAPI loopback (armed mode, writer thread)
capture/backend/capture/encoder.py        → FFmpeg WAV/WebM → MP3 encoding
capture/backend/metadata/analyzer.py      → librosa BPM + key detection
capture/backend/metadata/tagger.py        → Mutagen ID3 tagging
capture/backend/metadata/waveform.py      → 800-point amplitude + PNG thumbnail
capture/backend/storage/file_manager.py   → Library paths, filename sanitization

# Capture — UI (React + Vite)
capture/ui/src/App.tsx                    → View router (library, detail, capture, server)
capture/ui/src/api.ts                     → Fetch wrapper for localhost:9123
capture/ui/src/components/CapturePanel.tsx → WASAPI device selector, recording controls
capture/ui/src/components/TrackDetail.tsx  → Waveform canvas, audio player, metadata form
capture/ui/src/components/TrackList.tsx    → Track grid with search + favorites
capture/ui/src/components/TrackCard.tsx    → Thumbnail, meta tags, tag chips
capture/ui/src/components/ServerPanel.tsx  → Backend status, logs, restart

# Capture — Chrome Extension (MV3)
capture/extension/manifest.json           → Side panel, tab permissions, localhost access
capture/extension/background.js           → Tab info relay to backend
capture/extension/sidepanel.js            → Recording UI (armed/recording/review states)
```

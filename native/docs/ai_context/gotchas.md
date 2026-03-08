# TGT — Gotchas

> Lessons learned and pitfalls. Update when something bites us.

---

## Beat Detection / Audio Engine

### Uniform grid (regrid) fails on real music
- Attempted to replace BTrack per-beat positions with a constant-IBI uniform grid to eliminate BTrack's causal latency. This drifts on any track with real tempo variation (which is all real tracks). Do NOT re-introduce.
- Reference: Rec'n'Share / Moises use actual per-beat timestamps, not projected grids.

### loadBeatMap must skip past beats immediately
- When analysis completes mid-playback, `applyBeatMap` calls `loadBeatMap`. If `beatMapIdx_=0` and `framePosition_` is already at e.g. frame 190000, the render loop rapid-fires all past beats (one per frame) causing an audible burst then a phase discontinuity.
- Fix: `loadBeatMap` now advances `beatMapIdx_` / `beatMapBeatCount_` past all beats < `startMetroFrame`. `applyBeatMap` passes current `trackPlayer_.getPosition()` and `metronome_.getFramePosition()`.

### BTrack has 44100 Hz hardcoded in 5 places
- Default `sampleRate_` is 44100 in BTrack.cpp. Fixed by adding `sampleRate_` member, `setSampleRate()` method, and replacing all 5 hardcoded values. Must call `bt.setSampleRate(sampleRate)` before `bt.setTempo()`.

### Two-pass BTrack analysis needed for accurate BPM
- BTrack defaults to 120 BPM. Running a 30s pass first (pass 1), computing median IBI, then seeding pass 2 with `setTempo(roughBpm)` gives correct beat positions from beat 1. Without this, first ~25 beats are wrong.

### Always test beat alignment from ⏮ (restart), not mid-song
- If analysis completes after playback starts, there's a constant-BPM→beat-map transition. Any phase mismatch at transition point will confuse feedback. Always restart from frame 0 for clean test.

### ANALYSIS_SECONDS must cover full song length
- Was capped at 180s (3 min). Sultans of Swing is 5:47 — beat map ran out, fell back to constant-BPM, drifted. Now 900s (15 min). After beat map exhaustion, metronome falls back to constant-BPM mode (metronome.cpp:368-373) which drifts on any real recording.

### BTrack struggles with syncopated/funky grooves
- Cissy Strut: click never settled to a solid tempo. BTrack's onset detection may fire on wrong subdivisions in heavily syncopated music. Not a silence gap issue — a fundamental tracking issue.

### BTrack struggles with tempo changes
- War Pigs: tempo changes mid-song + sections of silence. Pass 1 BPM seed may force BTrack to lock onto one tempo. Research needed — may need to not seed, or use sectional analysis, or a different beat tracker entirely.

### Research before patching
- S30A lost context by patching blind (regrid). S30B confirmed the simple fix (catch-up burst) was the real issue all along. Lesson: confirm root cause before adding complexity. Plan before coding.

## Database (Supabase)

### Settings are singletons
- `user_settings` keyed by user ID, `band_settings` has one row.
- `getSettings()` / `getBandSettings()` returns one row, not an array.

### Band members are fixed at 4
- Profiles: Nathan (drums), Neil (bass), James (lead vocals), Adam (guitar & backing vocals).
- Names are editable but count is not. Don't try to add/remove members.
- Nathan is admin (`f30962b3-2588-4b3d-827a-69b03bdfa6b1`).

### Invoice/quote numbers auto-increment via RPC
- `next_invoice_number()` and `next_quote_number()` are Supabase RPC functions (SECURITY DEFINER).
- Format: `TGT-XXXX` (invoices), `QTE-XXX` (quotes).
- Don't manually set numbers — let the RPC handle atomicity.

### venues/clients tables require created_by
- `created_by` is NOT NULL on venues and clients tables.
- All seed scripts and create functions must pass `created_by`.

### gig_type column defaults to 'gig'
- CHECK constraint: only valid gig_type values accepted.
- Always pass `gig_type` explicitly when creating gigs.

### RLS hides data from publishable key
- The publishable (anon) key only sees rows matching RLS policies (e.g., gigs with `visibility = 'public'` return only 4 of 117).
- To query ALL data (admin scripts), use the secret (service_role) key which bypasses RLS.
- Never use the publishable key to count or inspect production data.

## Security

### NEVER hardcode API keys in committed files
- Always use `process.env.SUPABASE_SERVICE_ROLE_KEY` in scripts. The `.env` file is gitignored.
- **Incident 2026-03-05**: service_role key was hardcoded in seed scripts and committed to a PUBLIC repo. Key was rotated — legacy JWT keys disabled, new publishable/secret keys now active.
- GitHub secret scanning will flag leaked keys. Alert was resolved.

### API key types
- **Publishable** (`sb_publishable_...`): safe for client-side, respects RLS.
- **Secret** (`sb_secret_...`): bypasses RLS, never expose in client code or committed files.
- Legacy JWT-based keys (`eyJhbG...`) have been **disabled** as of 2026-03-05.

## PDF

### HTML templates use inline CSS only
- No external stylesheets — everything is inline in the template strings.
- PDF rendering via `expo-print` doesn't support all CSS (no flexbox in print).
- Templates live in `shared/templates/` (7 invoice + 7 receipt + 7 quote + 7 formal invoice styles).

### HTML escape required for template data
- All string fields injected into PDF HTML must be escaped: `& < > "`.
- Use `htmlEscape()` from `shared/templates/htmlEscape.ts`.
- Without this, client names like "Young & Co's Brewery" break the HTML.

### PDFs are generated on-demand
- No persistent PDF URIs or files. `generatePdf()` in `native/src/pdf/generatePdf.ts` creates a temp file each time.
- Web uses iframe srcdoc for preview, `contentWindow.print()` for printing.

## UI

### useFocusEffect for data loading (native)
- Every native screen that shows data uses `useFocusEffect` to reload on focus.
- Navigating back to a screen refreshes its data automatically.

### Neumorphic shadows
- `neuRaisedStyle()` and `neuInsetStyle()` accept intensity: 'subtle' | 'normal' | 'strong'.
- Shadows use border colours to simulate depth — not standard `elevation`.
- Press-state on NeuButton inverts raised → inset.

### Backdrop dismiss pattern
- Outer `Pressable` with `onPress={close}` covers the full overlay.
- Inner `Pressable` with `onPress={() => {}}` wraps modal content to prevent propagation.

### Debug APK needs Metro running
- `npx expo run:android` builds a **debug** APK that loads JS from Metro bundler.
- If port 8081 is occupied, Expo skips the dev server silently → app stuck on splash.
- Check port: `netstat -ano | grep 8081` — kill stale processes if needed.

## Data Integrity

### Receipt rounding
- Equal split of odd amounts loses pennies (e.g., £100 ÷ 3 = £33.33 × 3 = £99.99).
- First receipt gets the remainder to ensure totals balance exactly.

### createReceipts is idempotent
- Calling `createReceipts()` twice returns existing receipts — no duplicates.
- Guard at top of function checks `getReceiptsForInvoice()`.

## Architecture — Monorepo (C:\Apps\TGT\)

### Two apps, one backend, shared code
- **GigBooks** (native/ — React Native/Expo) and **Tangerine Timetree** (web/ — React/Vite PWA) share the same Supabase project.
- Types, queries, config, and PDF templates live in `shared/` — imported via `@shared/*` TypeScript path alias.
- GigBooks uses `@react-native-async-storage/async-storage` for auth persistence; web uses browser localStorage.

### shared/ code can't import npm packages
- `shared/supabase/` has no `node_modules/`. It relies on the consuming app's node_modules.
- `clientRef.ts` uses a `SupabaseClientLike` interface to avoid importing `@supabase/supabase-js` directly.

### Metro cache after monorepo changes
- After changing `metro.config.js`, `watchFolders`, or shared/ file structure, run `npx expo start -c`.
- Without `-c`, Metro may use stale resolution.

### npm install in native/ needs --legacy-peer-deps
- Expo 55 pins react 19.2.0 vs react-dom 19.2.4. Use `npm install --legacy-peer-deps`.

### Vercel root directory for web/
- Vercel root is set to `web/` in project settings.
- `../shared` path in vite.config.ts works because Vercel clones the full repo.
- No Vercel env vars needed — config.ts has the publishable key directly.

### No npm workspaces — by design
- Avoided npm workspaces to prevent Metro symlink issues on Windows.
- Each app manages its own `node_modules/` independently.

### Offline queue must include ALL mutation types
- If a new mutation is added, it must be added to BOTH `native/src/utils/offlineQueue.ts` AND `web/src/hooks/useOfflineQueue.ts`.
- **Checklist**: 1) Add import, 2) Add to type union, 3) Add case to replayOne switch.

### AuthContext must refresh session on mount
- `supabase.auth.getSession()` returns a cached JWT — does NOT validate if still valid.
- Fix: always call `supabase.auth.refreshSession()` after `getSession()`.

### Seed scripts must use .cjs extension
- `web/` has `"type": "module"` in package.json, so `.js` files are ESM.
- Scripts using `require()` need `.cjs` extension.
- Run with `--max-old-space-size=512` if OOM occurs.

## Build

### Supabase CLI quirks
- `supabase db execute --linked` doesn't exist in all CLI versions. Use migration files + `supabase db push`.

### Tangerine Timetree deployment
- Vite builds enforce TypeScript strictly — unused imports cause build failures on Vercel.

### @react-native-community/datetimepicker cmake failure
- Adding `@react-native-community/datetimepicker@8.6.0` causes cmake error on `assembleRelease`.
- Workaround: avoid this package. Use custom WheelTimePicker instead (built in S21).

### Oboe version: use 1.9.0 or 1.9.3 (NOT 1.9.2)
- `com.google.oboe:oboe:1.9.2` does NOT exist on Google Maven. Build fails silently during config.
- Use 1.9.3 (latest as of 2026-03).

### SoundTouch vendored source: include ALL .cpp files
- CMakeLists must include `cpu_detect_x86.cpp`, `mmx_optimized.cpp`, `sse_optimized.cpp`.
- Without these: linker errors (`undefined symbol: detectCPUextensions`, `TDStretchSSE`, `FIRFilterSSE`).
- On ARM these files compile to no-ops but symbols must still be present.

### Expo Modules AsyncFunction is NOT suspend
- `AsyncFunction` lambda in Expo SDK 55 is NOT a suspend function.
- Cannot use `withContext()` directly — use `runBlocking(Dispatchers.IO)` instead.
- `withContext` requires suspend context; `runBlocking` creates one.

## Android Compose (android/)

### Postgres `numeric` type serializes with decimals
- Postgres `numeric` columns (bpm, swing_percent, time_signature_top/bottom, subdivision, count_in_bars, duration_seconds, beat_offset_ms, position) serialize as `150.00` not `150`.
- Kotlin model fields declared as `Int` will throw: `Unexpected symbol '.' in numeric literal`.
- Fix: declare ALL Postgres numeric fields as `Double`. Use `.toInt()` for display.

### Supabase publishable key format changed
- Legacy JWT keys (`eyJhbG...`) were disabled 2026-03-05. Use publishable key from `shared/supabase/config.ts`.
- Format: `sb_publishable_...`. When rotating keys, update `SupabaseClient.kt` immediately.

### JVM setter clash in AndroidViewModel with `by mutableStateOf()`
- `var practiceSpeed by mutableStateOf(1f)` auto-generates `setPracticeSpeed(Float)` JVM setter.
- Adding `fun setPracticeSpeed(x: Float)` method causes: `Platform declaration clash: ... has the same JVM signature`.
- Fix: rename the method (e.g., `applySpeed(Float)`, `applySubdivision(Int)`).

### `remember {}` required for `mutableStateOf` in composables
- `var x by mutableStateOf<Foo?>(null)` in a composable function body (not ViewModel) MUST be wrapped with `remember`.
- Without `remember`, the state is recreated on every recomposition — values reset to null, type inference also breaks.
- Fix: `var x by remember { mutableStateOf<Foo?>(null) }`. Don't forget the `import androidx.compose.runtime.remember`.

### `skipPartialExpansion` removed in Compose BOM 2025.05
- `rememberModalBottomSheetState(skipPartialExpansion = true)` throws unresolved parameter.
- Fix: use `rememberModalBottomSheetState()` with no arguments.

### App not refreshing on first launch after install
- First cold-start after install may show stale state. Close and reopen the app to get fresh data.
- Normal behaviour — ViewModel init loads data from Supabase on first composition.

### PCM decode: never use `mutableListOf<Short>()` for large audio files
- Each boxed `Short` costs 16 bytes of JVM overhead → 5-min track = 423MB → OOM crash.
- Use `mutableListOf<ByteArray>()` for chunks, then convert via `ByteBuffer.wrap(chunk).asShortBuffer()` (primitive, no boxing).

### Oboe sample rate vs MP3 sample rate mismatch
- Oboe opens at device native rate (48000Hz on Samsung). MP3 is often 44100Hz.
- Loading 44100Hz PCM into 48000Hz Oboe stream plays 8.8% too fast.
- Fix: after decoding, call `nativeGetSampleRate()` and linear-interpolation resample if rates differ.

### C++ metronome beat offset: apply at start(), not per-beat
- `Metronome::render()` used to add `beatDisplacementFrames_` to every `nextBeatFrame_` computation.
- This caused effective BPM = `sampleRate*60/(fpb+offset)` instead of the target BPM. Audible as very slow random-seeming clicks.
- **Fix**: apply offset ONCE at `Metronome::start()` as initial `nextBeatFrame_`. Render loop uses `nextBeatFrame_ = framePosition_ + fpb`.
- Nudge uses `pendingPhaseShift_` atomic: accumulated from main thread, applied once at the next beat boundary in the audio thread.

### enableEdgeToEdge needs explicit inset handling in Compose
- `enableEdgeToEdge()` in Activity makes app draw behind status bar and nav bar.
- Without inset handling, content appears under the status bar.
- Fix: add `Modifier.safeDrawingPadding()` to NavHost content, `statusBarsPadding()` to drawer header Row.

# TGT — Gotchas

> Lessons learned and pitfalls. Update when something bites us.

---

## Web Audio: Timing engines ALWAYS run (S59)

**Never** conditionally start/stop the ClickScheduler based on UI state (mute, prefs, etc.). The scheduler must ALWAYS run when the track is playing. Mute/unmute controls audibility (skip OscillatorNode creation), not scheduling. Beat events and timing tracking continue regardless.

**Why**: S54 debugging persisted `player_click_enabled=false` to DB. `play()` checked this and skipped `clickRef.start()`. Click was silent on play. Mute/unmute toggled start/stop mid-playback = out of time.

**Rule**: If you're about to write `if (somePref) scheduler.start()` — it's wrong. Scheduler starts unconditionally. Pref controls `scheduler.setMuted()`.

---

## Web Audio: SoundTouch position has ~93ms latency (S60)

**Never** use raw SoundTouch position for drift correction without compensating for the ~93ms ScriptProcessorNode buffer latency (4096 samples / 44100Hz).

**Why**: `resyncToPosition()` used raw `mixer.getPosition()` to find the "next beat after current position" in the beat map. But the reported position was ~93ms ahead of actual audio. This made resync see the track past each beat, pushing `nextBeatTime` to the NEXT beat. With a 100ms lookahead and ~350ms beat intervals (166.7 BPM), the scheduler could never catch up — zero clicks were ever created.

**Rule**: Any position-based calculation using SoundTouch must use `compensatedPos = trackPos - (4096 / sampleRate)`. Drift threshold must be >150ms (not 30ms). Currently disabled — natural scheduling works without drift correction for ~60s.

---

## Capture Tool (WASAPI Loopback)

### WASAPI doesn't fire callbacks during silence
- When no system audio is playing, WASAPI loopback delivers zero callbacks. `duration` and `peak_level` stay at 0.0 on the server.
- **Impact**: Server-polled duration is unreliable during recording. Use client-side wall clock timer instead. Server duration only used for final review display.
- Armed mode relies on this: no callbacks = no audio = stays armed. Threshold check only fires when audio actually plays.

### Writer thread required for glitch-free capture
- `wave.writeframes()` in the audio callback thread gets preempted by OS disk I/O scheduling, causing audible micro-pauses in captured audio.
- **Fix**: Audio callback pushes frames to a `queue.Queue`. Dedicated writer thread drains to WAV. Callback never touches disk.
- Combined with `HIGH_PRIORITY_CLASS` (via `ctypes.windll.kernel32.SetPriorityClass`) and 40ms buffer (up from 20ms default).

### Backend restart kills active capture session
- If uvicorn reloads while a capture session is active (armed or recording), the in-memory `WasapiCapture` instance is destroyed. The WASAPI stream dies, partial WAV may be corrupt.
- **Current state**: No graceful handling. User must restart recording manually.
- **Future fix**: Detect orphaned WAVs on startup, offer recovery via sidepanel.

### Armed mode pre-roll is ~200ms (10 frames × 20ms)
- `PRE_ROLL_FRAMES = 10` with default 20ms frame size = ~200ms. This captures the audio just before the threshold trigger so the start of the recording isn't clipped.
- If the first audio event is very brief (<200ms), the pre-roll may not capture the full onset. Acceptable for music capture.

### Process priority must be restored on all exit paths
- `_set_process_priority(high=True)` is called at `start()`. Must call `_set_process_priority(high=False)` in both `stop()` and `cleanup()`, and in the error path if stream open fails.
- Forgetting to restore leaves the Python process at HIGH priority, which can starve other user processes.

## Cloud Run / madmom

### madmom 0.16.1 Python compatibility
- **Python 3.11+**: `collections.MutableSequence` removed — import error. Fix: monkey-patch `collections` from `collections.abc` before importing madmom.
- **numpy 1.24+**: `np.float` removed — runtime error. Fix: pin `numpy==1.23.5`.
- **scipy 1.14+**: requires Python 3.10+. Pin `scipy==1.10.1` for Python 3.10.
- **Cython**: must be pre-installed before `pip install madmom` (madmom's `setup.py` imports Cython at metadata time). Split the pip install: `pip install cython numpy` first, then `pip install -r requirements.txt`.
- **Working combo**: Python 3.10, numpy 1.23.5, scipy 1.10.1, cython 3.0.12, madmom 0.16.1.

### Cold start is ~90s (with Demucs)
- PyTorch + Demucs model loading on first request. madmom RNN models load too.
- If this is too slow, set `--min-instances 1` on Cloud Run (costs ~$5/month idle).
- Hidden by Cloud Tasks pattern — user sees 202 immediately, worker runs async.

### Demucs requires torchaudio + soundfile
- `demucs==4.0.1` uses `torchaudio` for audio I/O. Without it: exit code 1, no useful error.
- `torchaudio` needs `soundfile` (PySoundFile) as its backend for saving WAV files. Without it: `RuntimeError: Couldn't find appropriate backend to handle uri`.
- Install both from CPU index: `pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu` + `soundfile==0.12.1` in requirements.txt.

### Cloud Run worker has no user context
- `/process-worker` runs with service role key — no authenticated user.
- `song_stems.created_by` was NOT NULL → worker inserts fail.
- Fix: make `created_by` nullable (`ALTER TABLE song_stems ALTER COLUMN created_by DROP NOT NULL`).

### Demucs stderr capture needs text=True
- `subprocess.run(capture_output=True)` without `text=True` captures stderr as bytes, not logged properly.
- Add `text=True` to get readable error messages in Cloud Run logs.

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

### BTrack is architecturally limited — don't try to tune it
- **Tempo transition matrix**: 41×41 Gaussian, limits change to ~5% between adjacent beats. War Pigs (140→110 BPM = 21% change) is impossible.
- **Onset-based detection**: equates "loud transient" = "beat". Syncopated music (Cissy Strut) puts accents off the beat — BTrack fires on ghost notes/hi-hats instead.
- **Alpha=0.9**: 90% momentum from past score, 10% new input. Highly sticky, resists abrupt changes.
- **Tuning (ODF type, alpha, tightness) gives 10-20% improvement at best** — architectural limits remain.
- **Solution**: Replace with server-side madmom (RNN+DBN). Beat map = array of timestamps in Supabase. C++ engine just reads them.

### madmom is Python-only
- No C++ port exists. Can't run in Supabase Edge Functions (Deno/JS). Needs a Python runtime — Cloud Run, Lambda, or local worker.
- Essentia (C++) is the best on-device alternative but AGPL license and ~80% accuracy vs madmom's ~95%+.

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

### Debug APK: GigBooks is pure Kotlin/Compose
- GigBooks (android/) is a native Kotlin/Compose app — no Metro, no Expo, no React Native.
- Build with `./gradlew assembleRelease` or `assembleDebug`. No JS bundler needed.

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

## Android Compose (android/) — Patterns & Traps

> These are ACTIVE patterns — still relevant even after fixes. Don't re-introduce the anti-patterns.

### Postgres `numeric` type → always use Double in Kotlin
- Postgres `numeric` columns serialize as `150.00` not `150`.
- Kotlin `Int` throws: `Unexpected symbol '.' in numeric literal`.
- **Rule**: ALL Postgres numeric fields = `Double` in Kotlin data classes. Use `.toInt()` for display.
- Applies to: bpm, swing_percent, time_signature_top/bottom, subdivision, count_in_bars, duration_seconds, beat_offset_ms, position.

### Supabase key must match between web and Android
- Publishable key is in `shared/supabase/config.ts` (web) AND `SupabaseClient.kt` (Android).
- Format: `sb_publishable_...`. If key rotates, update BOTH immediately.

### JVM setter clash with `by mutableStateOf()`
- `var practiceSpeed by mutableStateOf(1f)` auto-generates `setPracticeSpeed(Float)`.
- Adding `fun setPracticeSpeed(x: Float)` → `Platform declaration clash`.
- **Rule**: always rename custom setter methods (e.g., `applySpeed()`, `applySubdivision()`).

### `remember {}` required for `mutableStateOf` in composables
- Without `remember`, state resets on every recomposition.
- **Rule**: `var x by remember { mutableStateOf<Foo?>(null) }` — always.

### `skipPartialExpansion` removed in Compose BOM 2025.05
- Use `rememberModalBottomSheetState()` with no arguments.

### PCM decode: never use `mutableListOf<Short>()` for large audio
- Boxed `Short` = 16 bytes → 5-min track = 423MB → OOM.
- **Rule**: `mutableListOf<ByteArray>()` chunks → `ByteBuffer.wrap(chunk).asShortBuffer()`.

### Oboe sample rate vs MP3 sample rate mismatch
- Oboe = device native (48000Hz on Samsung). MP3 = often 44100Hz.
- **Rule**: after decode, call `nativeGetSampleRate()` and resample if rates differ.

### C++ metronome beat offset: apply at start(), not per-beat
- Offset in render loop causes BPM drift. Apply ONCE at `Metronome::start()`.
- Nudge uses `pendingPhaseShift_` atomic, applied at next beat boundary.

### enableEdgeToEdge needs explicit inset handling
- `Modifier.safeDrawingPadding()` on NavHost, `statusBarsPadding()` on drawer header.

## Audit Findings (2026-03-09)

> Issues found during full codebase audit. Triaged 2026-03-09.

### Offline queue conflict detection is missing
- Web `useOfflineQueue.ts` has no optimistic concurrency — last-write-wins.
- **Status**: DEFERRED. Near-zero real risk (4 users, 117 gigs, Nathan is primary editor). Revisit if conflicts actually happen.

### ~~No forgot-password flow~~ DONE (S36)
- Built in S36: useAuth resetPassword + LoginModal password reset flow.

### ~~No role-based UI filtering~~ CLOSED
- All 4 band members are admin. Everyone needs full access to invoicing, quotes, clients, venues.
- Nathan invoices ~90%, James invoices some, Adam shares prepared PDFs with clients on Nathan's behalf.
- **This is intentional. Do NOT add role-based drawer filtering.**

### ~~Band Settings errors for non-admin~~ CLOSED
- All members are admin. RLS allows all admins to update band_settings. No guard needed.

### ~~Changelog depends on its own fetch in updateGig~~ CLOSED
- Verified: changelog is best-effort (silent catch). Fetch failure does NOT block gig update. Already safe by design.

### Realtime failures are silent
- `useCalendarData.ts` logs `console.warn()` on subscription failure. User sees stale data.
- **Status**: DEFERRED. Realtime is stable in practice. Add polling fallback if users report stale data.

### AppViewModel errors silently swallowed (Android)
- Most Supabase calls in `catch (_: Exception) {}` with no UI feedback.
- **Status**: DEFERRED. Low priority at current scale. Add toast/banner when it hurts.

## Business Model — Why Things Are The Way They Are

> **READ THIS before flagging any feature as "over-engineered" or "needs role guards".**

- **All 4 members are admin.** There are no non-admin users. There never will be. Do NOT add role-based UI filtering.
- **Everyone needs full business features.** Nathan handles ~90% of invoicing (his bank, his name). James invoices some gigs. Adam messages clients with PDFs on Nathan's behalf. Filtering the drawer would break the band's workflow.
- **The booking wizard is intentionally comprehensive.** It trains band members to capture all data Nathan needs. Don't simplify it.
- **Receipt split (÷4 creates 3 receipts)** is correct. Nathan pays himself — no receipt needed for the admin. First of 3 gets rounding remainder.

## AI Process Mistakes

> **ARCHIVED**: Full list at `D:/tgt/sot-backup-s60/gotchas.md` (lines 346-480).
> Key rules are in CLAUDE.md and `.claude/projects/` memory files.
> Summary of critical rules below — see CLAUDE.md for full enforcement.

### Critical Rules (from 20+ logged mistakes)
- **Never change locked decisions** — check decisions_log.md BEFORE modifying any behavior
- **Never cut scope without explicit approval** — 16+ instances of premature feature dismissal
- **Both apps = ONE app** — every change must be applied to web AND Android (D-153, D-164)
- **Never replace functionality when adding** — always ADD alongside existing
- **One change per push during debugging** — never bundle changes when isolating issues
- **No guessing** — every audio/scheduling change must be backed by research (Chris Wilson, Tone.js, etc.)
- **Log every decision immediately** — if Nathan says how something should work, log it before coding
---

## Web App Testing Protocol (S56)

> Foolproof method for verifying deployed code during debugging.
> Three cache layers can serve stale code: Vercel CDN, Service Worker, Browser HTTP cache.
> Hard refresh alone does NOT clear the Service Worker cache.

### Before Every Test (Mandatory)

**PC Chrome:**
1. Wait ~2 min after push (Vercel build + deploy time)
2. Open DevTools (F12) → Application tab → Storage section
3. Tick ALL boxes → click "Clear site data"
4. Close the tab completely (not just refresh)
5. Open a NEW tab → navigate to thegreentangerine.com

**Mobile Chrome:**
1. Wait ~2 min after push
2. Go to Chrome → Settings → Site settings → thegreentangerine.com → Clear & reset
   (OR: long-press PWA icon → App info → Storage → Clear storage)
3. Close the app completely (swipe away from recents)
4. Reopen the app

### Why This Works
- "Clear site data" removes: Service Worker registration, SW cache, HTTP cache, localStorage, IndexedDB
- Closing the tab ensures no in-memory AudioContext persists from the old version
- New tab creates a fresh AudioContext, downloads fresh JS, registers fresh SW

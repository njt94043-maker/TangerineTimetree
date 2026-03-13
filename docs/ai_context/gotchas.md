# TGT — Gotchas

> Lessons learned and pitfalls. Update when something bites us.

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

### No forgot-password flow
- Neither app has a password reset UI. Supabase `resetPasswordForEmail()` exists but isn't wired.
- **Status**: Open. Quick fix — bundle into S36 (~30 min).

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

## AI Process Mistakes (2026-03-10 Audit)

> Mistakes logged by the user. These MUST NOT be repeated.

### Player divergence — 2 separate designs from 1 conversation
- **What happened**: Android LiveScreen/PracticeScreen (NeuCard vertical scroll) and Web Player.tsx (flat single-component) were built independently without cross-referencing. Neither fully matches the approved S33 mockup designs (visual hero + text panel + bottom sheet drawer). The S39-S45 mockups then introduced a THIRD design (tab-based with 16:9 hero).
- **Root cause**: D-106 reframed Android as "stage performance client" without user requesting it. Web was then built in S36-S37 without comparing to what Android already had. No cross-platform design review step existed.
- **Impact**: User discovered 2 separate apps from what they thought was one continuous build. Significant rework needed.
- **Fix**: V4 Mirror Target mockup (17 screens) as the single design spec. Both platforms rebuild to match it. D-153 (mirror apps) enforces parity going forward.

### Feature dismissal pattern — 16+ instances
- **What happened**: Features were cut, deferred, or dismissed without the user explicitly requesting it. Examples: Android invoicing lost in Compose rewrite, capture metadata fields dismissed, Android treated as afterthought in sprint ordering, web missing features Android had (subdivision, count-in, nudge UI).
- **Root cause**: AI making scope decisions disguised as technical decisions. D-106 scope reduction was the pivotal example.
- **Fix**: Never cut scope without explicit user approval. If something seems "too big", explain the cost and let the user decide.

### Player layout built wrong TWICE (2026-03-10)
- **What happened**: Two separate attempts at fixing player layout, both wrong. Second attempt still had Click+Record in transport (user says they belong in drawer), and AI kept asking questions instead of just following the mockups + user messages.
- **User's spec (mockups + messages combined)**:
  - **Transport bottom (ALL modes)**: ONLY ⏮ Restart | ▶ Play | ■ Stop
  - **CLICK toggle + RECORD button → bottom drawer** (not transport row)
  - **Live nav row**: ◀ Prev | ☰ Queue | Next ▶ (above transport, setlist only)
  - **Practice/View transport top**: Speed (-5/+5) LEFT + A-B loop RIGHT
  - **Live**: NO speed, NO A-B loop, NO waveform
  - **Practice**: Waveform strip, mixer in drawer
  - **View**: Same as Practice layout but teal accent
  - **Drawer content**: Display toggles, Click toggle + volume, Record button, Mixer (practice/view only), Settings
  - **Mode switching from player** (Live↔Practice↔View, pick song/setlist from drawer): PLANNED in mockups, NEVER BUILT. Not a regression.
- **Root cause**: AI summarized mockups instead of reading them. Then when user gave corrections, AI asked clarifying questions instead of just doing the work. User said "the mock ups show everything my message say everything."
- **Fix**: Read mockup HTML line by line. User messages override mockups. Don't ask — do. Complete ALL screens in one pass, don't half-finish.

### SOT docs buried in shelved app folder
- **What happened**: All project-wide SOT docs (STATUS.md, todo.md, SESSION_LOG.md, etc.) were in `native/docs/ai_context/` — a folder belonging to the shelved React Native app. CLAUDE.md was in `native/` instead of project root.
- **Root cause**: Docs were created when native was the primary app. When native was shelved, docs weren't moved.
- **Fix**: Moved to `docs/ai_context/` (project root level). CLAUDE.md moved to project root. Old copies in native/ kept as reference but the canonical versions are now at root level.

### Practice mode missing text panel
- **What happened**: S33 practice-redesign.html didn't include chords/lyrics/notes/drums display toggles. User confirmed practice mode absolutely should have them — you want to see chords while practicing.
- **Fix**: V4 target includes display toggles (Visuals/Chords/Lyrics/Notes/Drums) in BOTH Live and Practice mode drawers. Practice just has additional mixer + speed/loop sections.

### Capture dismissed as "doesn't need alignment" (S43, 2026-03-10)
- **What happened**: At S43 start, AI cited D-152 ("Capture unchanged for S39") to dismiss Capture needing the Song `category` field. User had to explain forcefully that D-152 was S39-scoped, Capture is the 3rd app in the family, and all apps need consistent metadata.
- **Root cause**: Same pattern as feature dismissal — AI treating one app in isolation, citing stale sprint-scoped decisions to avoid work. Not thinking about the full pipeline (Capture → Web → Android) or future consumers (ClickTrack).
- **Fix**: D-154 (Capture is metadata superset), D-156 (all apps are one family), D-157 (sprint-scoped decisions expire). Memory updated with ecosystem rules. EVERY field change must be evaluated against ALL apps.

### AI loses big picture every session (recurring, logged S43)
- **What happened**: User reports explaining the same things every session — how apps connect, why certain fields exist, how decisions affect other apps. AI focuses on one app at a time, forgets the others exist, and keeps cutting scope without permission.
- **Root cause**: AI optimises for completing the immediate task in the immediate app, not maintaining ecosystem awareness. Half-mentioned ideas get lost. Cross-app impact not evaluated.
- **Fix**: Memory file `ecosystem-rules.md` created. MEMORY.md rewritten with "How Nathan Works With AI" section at top. Every change must trigger "what else does this affect?" check across all apps. Half-ideas must be logged immediately and chased up.

### "The mockup" is not the only spec — search SOT docs for every detail (S45, 2026-03-10)
- **What happened**: AI treated `mockups/v4-mirror-target.html` as the ONLY design spec and kept saying "the mockup" (singular). In reality, Nathan gave detailed visual instructions across many conversations that were captured in SOT docs (SESSION_LOG.md, decisions_log.md, gotchas.md). The mockup is the final pixel target, but the SOT docs contain the reasoning, constraints, and detail behind every element.
- **Root cause**: AI skimming for shortcuts instead of doing thorough searches. When asked about a specific element (e.g. drawer design), AI would check only the mockup HTML rather than searching SESSION_LOG for all references to "drawer", decisions_log for drawer-related decisions, etc.
- **Impact**: Features were built functionally correct but visually wrong — CSS values not matching mockup, elements structured differently, missing sub-elements. User had to explain the same things repeatedly.
- **Fix**: For EVERY screen element being implemented, search ALL SOT docs (SESSION_LOG, decisions_log, gotchas) for related instructions and context. Don't rely on a single source. The docs were updated FROM Nathan's instructions — they ARE the spec. If detail is missing from one doc, search the others.

### "Both apps" means web AND Android — never assume one (S45, 2026-03-10)
- **What happened**: AI started S45 screen-for-screen lockdown but only audited/fixed web. Nathan had to correct: "you got the 'both apps' bit wrong not me". D-153 (mirror apps) explicitly requires full parity.
- **Root cause**: AI defaulting to web-only because it's easier (TypeScript vs Kotlin). Android gets treated as an afterthought.
- **Fix**: Every visual change must be evaluated and applied to BOTH platforms. When auditing, launch parallel agents for web AND Android. Never mark a screen as "done" until both platforms match the mockup.

### Decision bulldozing — AI overrides locked decisions without checking (S45, 2026-03-11)
- **What happened**: In a single session, AI violated 4 decisions: added accent click on beat 1 (D-159), kept orange/larger beat 1 dot (D-160), broke beat sync timing (D-161), and needed multiple iterations to fix each because it kept applying "fixes" that introduced new violations.
- **Root cause**: AI sees code that looks "wrong" (e.g. `currentClickIsDownbeat_ = false` with comment "no accent — all clicks sound identical") and "fixes" it without understanding it's an intentional decision. Comments in code ARE decisions — if code says "no accent", that's deliberate.
- **Impact**: User had to re-explain the same locked decisions repeatedly within one session. Each "fix" broke something else. Trust eroded.
- **Fix**: Before modifying ANY behavioral code: (1) Read decisions_log.md for related decisions. (2) If code has a comment explaining WHY something is a certain way, DO NOT CHANGE IT without asking. (3) Log every new decision IMMEDIATELY in decisions_log.md before writing code. (4) When user says "X was working before", the first action is `git log` + `git diff` to find what changed, not to theorize about what's wrong.

### Library parity failure — web and Android diverged AGAIN (S45, 2026-03-11)
- **What happened**: S45 todo listed Web Library fixes (badge restructure, filter labels, etc.) that refined web's EXISTING layout. But the web layout was wrong — it didn't match Android. Android Library (NeuCard cards, big BPM, tap-to-expand, badges) was the correct design all along. The todo was making web "better" but in the wrong direction.
- **Root cause**: Same as player divergence — improvements made to one platform without checking if the other platform already had the correct version. No "which is the reference?" check before writing tasks.
- **Impact**: S45 Web Library todo items are INVALID as written. Need to be rewritten to target "match Android Library layout" instead.
- **Fix**: D-163 (Android Library is reference), D-164 (every UI change must specify both platforms). Before writing any screen-level todo, screenshot BOTH platforms and explicitly declare which is correct.

### Beat sync: polling vs event-driven (S45, 2026-03-11)
- **What happened**: C++ metronome stored `currentBeat_` as 0-indexed (0,1,2,3). UI used 0 as "idle". So beat 0 (first beat of every bar) was invisible — no flash, no dot. Additionally, raw 40ms polling caused visual drift from the click sound.
- **Root cause**: No change-detection mechanism. UI polled raw `currentBeat_` which had dual meaning (0 = idle AND 0 = first beat). No way to distinguish "no beat fired yet" from "beat 0 just fired".
- **Fix**: Added `beatTick_` atomic counter in C++ that only increments when a beat fires in the audio thread. Kotlin polls every 16ms but only updates UI when `beatTick` changes AND > 0. `currentBeat` converted to 1-indexed (1..N) at the single Kotlin conversion point. 0 = idle only. See D-161.

### AI editing files without user approval (S46, 2026-03-11)
- **What happened**: System notifications said a file was "modified by a linter". AI treated this as confirmation to proceed without checking with the user. The user had to call it out.
- **Root cause**: AI assumed linter changes = automatic approval. But ANY file modification notification should prompt a check-in with the user, not silent continuation.
- **Rule**: When a file is flagged as externally modified, ALWAYS ask the user before continuing edits. Never assume silent approval.

### AI narrowing entry points without user approval (S46, 2026-03-11)
- **What happened**: AI changed the player screens so the ONLY way to enter them was through Library → song selection. Original design had players as standalone navigable destinations. User lost the ability to return to a running player from the drawer.
- **Root cause**: AI optimised for one flow (fresh song launch) and removed the ability to return to an existing session. Didn't consider the user's original design where players are always accessible.
- **Rule**: Never remove entry points or navigation paths without explicitly confirming the change with the user. If the original design supports multiple ways to reach a screen, preserve ALL of them.

### AI replacing functionality instead of adding to it (S46, 2026-03-11)
- **What happened**: User asked for a close/exit button on the player. AI replaced the existing menu/hamburger button with the close button, removing the ability to open the drawer from within the player. User had to point out they need BOTH — menu to browse mid-session, close to end session.
- **Root cause**: AI treated "add X" as "replace existing with X". This is the same pattern as narrowing entry points — removing existing functionality when adding new functionality.
- **Rule**: When adding a new button/action, NEVER remove or replace existing ones unless explicitly told to. Always ADD alongside. Ask "does the existing button stay?" if unsure. Think about what the user could do BEFORE the change and make sure they can still do ALL of it AFTER.

### S54 Click Debug — Wrong approach compounded the problem (2026-03-13)
- **What happened**: Web click broken since S51. In S54, AI made 3 mistakes that made things worse:
  1. **Assumed DB setting was the cause** without checking — guessed `player_click_enabled` might be false in DB. Nathan had to correct: "click on in settings" and "there shouldnt even be an option in the setting."
  2. **Changed AnalyserNode routing** (moved analyser to parallel tap instead of inline) as a blind guess. AnalyserNode passes audio through by spec — this change was wrong and broke stem audio too. Nathan: "no, i still have no click and no drums?"
  3. **Failed to backtrack** when the known-good S51 code was available. Nathan had to explicitly say "have you tried backtracking" before AI reverted to S51 files.
- **Root cause**: AI guessed at causes and applied speculative fixes instead of using git history to find what changed. The S51 commit (c95537b) was the last known-good state — reverting to it should have been step 1, not step 3.
- **Impact**: Stems broke (fixed by reverting AudioEngine.ts to S51). Click still broken — but now the audio files are back to S51 baseline, so the bug is isolated to useAudioEngine.ts S54 additions or the call path.
- **Rule**: When user reports "X was working at time T and isn't now": (1) `git diff` from time T to find ALL changes. (2) Revert to known-good state FIRST. (3) Re-apply changes one at a time to isolate the break. Do NOT guess. Do NOT make speculative routing changes.
- **Nathan's words**: "why did you blind guess without looking back when you knew the exact point what was working before stopped working" and "why did i have to tell you to retrace steps?"

### S55 Web click: audible in background, silent in foreground (2026-03-13)
- **What happened**: Web click has been broken since S51. Through S52-S55, both AudioBuffer and OscillatorNode approaches produce click sound when the app is minimised/backgrounded, but are completely silent when foregrounded. Test beep button (OscillatorNode triggered by user click gesture) works fine in foreground.
- **Key diagnostic**: Background = click audible. Foreground = click silent. User gesture sound = always works.
- **What this tells us**: The AudioContext and audio output chain (masterGain → analyser → destination) work. The issue is specific to sounds scheduled from `setInterval` in the ClickScheduler while the rAF tick loop is active.
- **Leading theory**: The rAF tick loop (running at 60fps when foregrounded, stopped when backgrounded) is interfering with scheduled audio. Suspects: (1) `setCurrentTime(pos)` triggering 60 React re-renders/sec, (2) `resyncToPosition()` modifying the scheduler's `nextBeatTime` every frame, (3) `getFrequencyData()` locking the AnalyserNode every frame.
- **Next step**: Comment out `AudioEngine.startTick(...)` in `play()`. If click plays in foreground, the tick loop is confirmed as the culprit. Then isolate which callback is the problem by stripping the tick to just `pollBeats()` and adding back parts one at a time.
- **Root cause NOT yet confirmed** — the above is the strongest hypothesis based on S55 testing.

### S54 Settings page had Player prefs it shouldn't have (2026-03-13)
- **What happened**: Web Settings.tsx had a "Player Settings" section with click/flash/lyrics toggles. APK didn't have this. D-118 already said display toggles belong in the drawer. AI had to be told AGAIN.
- **Nathan's words**: "why was webapp still setup like that? apk isnt.. you shouldnt have needed to update what i said, ive said it before"
- **Root cause**: D-118 was logged but never enforced on web. When building web Settings, the toggles were added there instead of only in the drawer.
- **Fix**: Removed Player Settings section entirely from Settings.tsx (D-171). Player prefs are controlled exclusively from the drawer on both platforms.

### S56 Multiple changes per push contaminated isolation testing (2026-03-13)
- **What happened**: Debugging web click (foreground-silent). Had a clear step-by-step plan. AI kept skipping steps — jumped from diagnostic straight to throttled full restore (2 changes), then later pushed AnalyserNode fix + full tick loop together (2 changes). When results were unclear, AI doubted user's testing instead of trusting the data.
- **Nathan's words**: "are we just doing random things now? instead of following strict guided instructions from our research and work so far?" / "you've broke something by not listening to me again"
- **Root cause**: AI prioritised speed over discipline. Bundled changes to save pushes instead of strictly one-at-a-time.
- **Fix**: NEVER change more than one thing per push during debugging. If the plan says "one at a time", that means ONE. Trust user test results — don't suggest caching issues when user confirms hard refresh. Add version hash to UI so deployed version can be verified.

### S56 AnalyserNode in series may permanently damage AudioContext (2026-03-13)
- **What happened**: Adding `getByteFrequencyData()` to the tick loop broke click audio permanently. Even reverting to previously-working code didn't fix it. The AnalyserNode was wired in series (masterGain → analyser → destination), meaning all audio flowed through it.
- **Root cause theory**: Once the AnalyserNode was activated by `getByteFrequencyData()`, it entered a state that interfered with scheduled OscillatorNode playback. Since AudioContext is a singleton that persists across code reloads, the damage survived.
- **Fix attempted**: Moved AnalyserNode to parallel branch (masterGain → destination + masterGain → analyser). NOT YET CONFIRMED — was pushed alongside other changes.
- **Lesson**: AnalyserNode should NEVER be in the audio output path. Always connect it as a parallel observer branch.

---

## Web App Testing Protocol (S56)

> Foolproof method for verifying deployed code during debugging.
> Three cache layers can serve stale code: Vercel CDN, Service Worker, Browser HTTP cache.
> Hard refresh alone does NOT clear the Service Worker cache.

### Build Verification
- A `__BUILD_TIME__` timestamp is injected by Vite at build time (vite.config.ts `define`)
- Displayed as cyan `BUILD: YYYY-MM-DD HH:MM:SS` in the Player debug banner
- AI will provide expected timestamp after each push — if it doesn't match, cache is stale

### Before Every Test (Mandatory)

**PC Chrome:**
1. Wait ~2 min after AI pushes (Vercel build + deploy time)
2. Open DevTools (F12) → Application tab → Storage section
3. Tick ALL boxes → click "Clear site data"
4. Close the tab completely (not just refresh)
5. Open a NEW tab → navigate to thegreentangerine.com
6. Open a song → check BUILD timestamp in debug banner matches expected

**Mobile Chrome:**
1. Wait ~2 min after AI pushes
2. Go to Chrome → Settings → Site settings → thegreentangerine.com → Clear & reset
   (OR: long-press PWA icon → App info → Storage → Clear storage)
3. Close the app completely (swipe away from recents)
4. Reopen the app
5. Open a song → check BUILD timestamp in debug banner matches expected

### Why This Works
- "Clear site data" removes: Service Worker registration, SW cache, HTTP cache, localStorage, IndexedDB
- Closing the tab ensures no in-memory AudioContext persists from the old version
- New tab creates a fresh AudioContext, downloads fresh JS, registers fresh SW
- BUILD timestamp proves the exact version running

### Quick Version (Same Session, Subsequent Tests)
If you've already done the full clear once and just need to test the next push:
1. DevTools → Application → Clear site data (all boxes)
2. Close tab, open new tab
3. Verify BUILD timestamp changed

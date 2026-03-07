# TGT — Gotchas

> Lessons learned and pitfalls. Update when something bites us.

---

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

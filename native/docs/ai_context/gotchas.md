# GigBooks — Gotchas

> Lessons learned and pitfalls. Update when something bites us.

---

## Database

### Settings is a singleton
- `id = 'default'` — always. Never insert a second row.
- `getSettings()` returns one row, not an array.

### Band members are fixed at 4
- IDs are `member_1` through `member_4` — hardcoded at seed time.
- Names are editable but count is not. Don't try to add/remove members.
- `is_self = 1` for Nathan (member_1) — receipts skip this member.

### Invoice numbers auto-increment
- `settings.next_invoice_number` is bumped on `createInvoice()`.
- Format: `INV-001`, `INV-042`, etc. via `formatInvoiceNumber()`.
- Don't manually set invoice numbers — let the system handle it.

## PDF

### HTML templates use inline CSS only
- No external stylesheets — everything is inline in the template strings.
- PDF rendering via `expo-print` doesn't support all CSS (no flexbox in print).
- Logo is an inline SVG string from `src/pdf/logo.ts`.

### PDF URIs are local file paths
- Stored in `invoices.pdf_uri` and `receipts.pdf_uri`.
- Path: `Documents/pdfs/filename.pdf`.
- If the file is deleted from disk, the URI becomes stale.

### Debug APK needs Metro running
- `npx expo run:android` builds a **debug** APK that loads JS from Metro bundler.
- If port 8081 is occupied, Expo skips the dev server silently → app stuck on splash.
- Always ensure `npx expo start` is running before launching the debug APK on device.
- Check port: `netstat -ano | grep 8081` — kill stale processes if needed.

## UI

### useFocusEffect for data loading
- Every screen that shows data uses `useFocusEffect` to reload on focus.
- This means navigating back to a screen refreshes its data automatically.
- Don't add manual refresh mechanisms — focus-based reload handles it.

### Neumorphic shadows
- `neuRaisedStyle()` and `neuInsetStyle()` accept intensity: 'subtle' | 'normal' | 'strong'.
- Shadows use border colours to simulate depth — not standard `elevation`.
- Press-state on NeuButton inverts raised → inset.

### Backdrop dismiss pattern
- Outer `Pressable` with `onPress={close}` covers the full overlay.
- Inner `Pressable` with `onPress={() => {}}` wraps modal content to prevent propagation.
- Used in VenuePicker and wizard new client modal.

## PDF

### HTML escape required for template data
- All string fields injected into PDF HTML must be escaped: `& < > "`.
- Use `htmlEscape()` from `src/utils/htmlEscape.ts`.
- Applied to all 5 templates (4 invoice + 1 receipt).
- Without this, client names like "Young & Co's Brewery" break the HTML.

## Data Integrity

### Receipt rounding
- Equal split of odd amounts loses pennies (e.g., £100 ÷ 3 = £33.33 × 3 = £99.99).
- First receipt gets the remainder to ensure totals balance exactly.
- Pattern: `perPerson = Math.round(amount / count * 100) / 100`, then `remainder = amount - (perPerson * count)`.

### createReceipts is idempotent
- Calling `createReceipts()` twice returns existing receipts — no duplicates.
- Guard at top of function checks `getReceiptsForInvoice()`.

### createInvoice uses exclusive transaction
- INSERT + counter bump wrapped in `db.withExclusiveTransactionAsync()`.
- Prevents invoice number gaps if app crashes between the two queries.

## Supabase / Shared Gig Calendar

### Two separate projects, one backend
- **GigBooks** (React Native/Expo) and **Tangerine Timetree** (React/Vite PWA) share the same Supabase project.
- Supabase types and queries are duplicated in each project (not a shared package). Keep them in sync manually.
- GigBooks uses `@react-native-async-storage/async-storage` for Supabase auth persistence; Timetree uses browser localStorage (default).

### Supabase user accounts — pre-existing users
- Nathan's account existed from old "Last Minute" project. Had to use `admin.updateUserById()` to update metadata + manually INSERT profile row (the auto-create trigger only fires on INSERT to auth.users, not UPDATE).
- Always check if an email already exists before calling `admin.createUser()`.

### gig_type column defaults to 'gig'
- Added via ALTER TABLE migration with `DEFAULT 'gig'` and CHECK constraint.
- Existing gigs created before the migration automatically get `gig_type = 'gig'`.
- When creating gigs, always pass `gig_type` explicitly to avoid confusion.

### Tangerine Timetree deployment
- Vercel project names must be lowercase (no uppercase letters).
- Vite builds enforce TypeScript strictly — unused imports cause build failures on Vercel even if they pass locally.
- Environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) must be set in Vercel project settings.

### Supabase CLI quirks
- `supabase db execute --linked` doesn't exist in all CLI versions. Use migration files + `supabase db push` instead.
- Service role key is needed for admin operations (user creation/deletion). Never expose it in client code.

## Monorepo (C:\Apps\TGT\)

### shared/ code can't import npm packages
- `shared/supabase/` has no `node_modules/`. It relies on the consuming app's node_modules for resolution.
- `clientRef.ts` uses a `SupabaseClientLike` interface instead of `import type { SupabaseClient } from '@supabase/supabase-js'` to avoid this.
- If you add new shared code that needs an npm type, either use a structural type or move the import to the app-specific code.

### Metro cache after monorepo changes
- After changing `metro.config.js`, `watchFolders`, or shared/ file structure, run `npx expo start -c` (clear cache flag).
- Without `-c`, Metro may use stale resolution from before the config change.

### npm install in native/ needs --legacy-peer-deps
- react-dom 19.2.4 wants react ^19.2.4 but Expo 55 pins react 19.2.0. Use `npm install --legacy-peer-deps` in native/.

### Vercel root directory for web/
- After monorepo restructure, Vercel must have its root directory set to `web/` in project settings.
- The `../shared` path in vite.config.ts resolve alias works because Vercel clones the full repo; root directory only changes cwd.

### No npm workspaces — by design
- We deliberately avoided npm workspaces to prevent Metro symlink issues on Windows.
- Each app manages its own `node_modules/` independently.
- Shared code is imported via `@shared/*` TypeScript path alias, not through symlinked packages.

### Offline queue must include ALL mutation types
- The offline queue type union (`QueuedMutation['type']`) and switch statement must match ALL mutation functions.
- If a new mutation is added (e.g., `updateAwayDate`), it must be added to BOTH `native/src/utils/offlineQueue.ts` AND `web/src/hooks/useOfflineQueue.ts`.
- Missing entries cause "Unknown mutation type" crashes when users try to perform that action offline.
- **Checklist for new mutations**: 1) Add import, 2) Add to type union, 3) Add case to replayOne switch.

### AuthContext must refresh session on mount
- `supabase.auth.getSession()` returns a cached JWT — it does NOT validate whether the token is still valid.
- If the device was idle/offline for hours, the cached session appears valid but API calls fail with 401.
- Fix: always call `supabase.auth.refreshSession()` after `getSession()` to validate + extend TTL.

### @react-native-community/datetimepicker cmake build failure
- Adding `@react-native-community/datetimepicker@8.6.0` causes `assembleRelease` to fail with cmake error.
- Error: `Process 'command cmake.exe' finished with non-zero exit value 1` — cmake 3.22.1 in Android SDK.
- The package generates JNI codegen with CMakeLists.txt (`cmake_minimum_required(VERSION 3.13)`) — version should be compatible.
- Likely fix: `npx expo prebuild --clean` to regenerate the android native project with the new dependency properly linked, then rebuild.
- Alternative: install newer cmake via `sdkmanager --install "cmake;3.31.0"` or check full cmake output for actual C++ compilation error.

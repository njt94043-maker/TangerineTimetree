# TGT — Todo

> Current tasks, priorities, and backlog.
> Update after every task completion. See STATUS.md for instant context.

---

## Blocked
- **Fix APK build failure** — cmake error from `@react-native-community/datetimepicker` JNI codegen. Try: `npx expo prebuild --clean` then `./gradlew assembleRelease`, or install newer cmake via sdkmanager
- **Test release APK on device** — blocked by APK build above

## Next Up (Sprint S2 — code done, APK pending)
- Fix HIGH code issues:
  - [x] Type-safe row mappings in shared/supabase/queries.ts (replace `any` casts)
  - [x] Improve SupabaseClientLike interface typing (clientRef.ts — auth typed, from/channel kept loose)
  - [x] Add error handling to changelog inserts (shared/supabase/queries.ts — best-effort try/catch)
  - [x] Make getSettings() return nullable + handle null in callers (native/src/db/queries.ts)
  - [x] Add conflict detection to offline queue (web useOfflineQueue.ts — entity existence check)
  - [x] Add offline mutation support to DayDetail.tsx (delete button + offline-aware fetch)
  - [x] Switch time picker to spinner display (native/app/gig/new.tsx)
  - [x] Both tsc checks pass (native --noEmit + web -b)

## Completed (Sprint S3 — 2026-03-04)
- [x] Document Supabase tables + RLS policies in schema_map.md (Part B added)
- [x] Create web/docs/blueprint.md (web app architecture doc)
- [x] Set up GitHub Actions CI/CD (.github/workflows/check.yml — tsc on PRs)
- [x] Create web/.env.example
- [x] Fix native blueprint.md (7 invoice styles, 6 tables, Supabase exception to D-015)

## Completed (Sprint S4 — 2026-03-04)
- [x] Supabase schema migration (is_public flag, band_role, public_media table + RLS)
- [x] Shared types updated (is_public on Gig, band_role on Profile, PublicMedia type)
- [x] Shared queries updated (getPublicGigs, getPublicMedia, updateProfile, is_public in createGig)
- [x] Web gig form "Show on Website" toggle
- [x] Native gig form "Show on Website" toggle (Switch component)
- [x] Web profile page (name, band_role, email read-only, save, sign out)
- [x] Both tsc checks pass (native --noEmit + web -b)
- **Test Tangerine Timetree on band members' iPhones**: Share URL, test PWA install, verify login

## Completed (Sprint S5 — 2026-03-04)
- [x] PublicSite component (hero, gigs, about, for venues, pricing, contact, footer)
- [x] LoginModal component (overlay replacing full-page LoginPage)
- [x] App.tsx routing: PublicSite for unauth, LoginModal on demand
- [x] SEO: OG tags, Twitter cards, Schema.org JSON-LD (MusicGroup + LocalBusiness)
- [x] Dynamic public gigs via getPublicGigs()
- [x] Band member profiles (dynamic via getPublicProfiles, with fallback)
- [x] getPublicProfiles() added to shared queries
- [x] Public site CSS (responsive, mobile hamburger, glass-morphism)
- [x] Both tsc checks pass (native --noEmit + web -b)

## Completed (Sprint S6 — 2026-03-04)
- [x] Media gallery section (public site — responsive grid, lightbox, video embeds)
- [x] Media management UI (authenticated — upload photos to Supabase Storage, add YouTube videos, toggle visibility, delete)
- [x] Contact form submitting to Supabase `contact_submissions` table (no external service needed)
- [x] Enquiry inbox for band members (read/reply/archive, unread badge)
- [x] Supabase migration: `public-media` Storage bucket + `contact_submissions` table + RLS policies (pushed live)
- [x] Gallery nav link (conditional — shows when media exists)
- [x] Shared media + contact CRUD queries
- [x] Both tsc checks pass (native --noEmit + web -b)
- **Manual step**: IONOS DNS pointing to Vercel

## Completed (Sprint S8 — 2026-03-04)
- [x] Extracted ~80 inline `style={{}}` to CSS classes across 8 web components (App, DayDetail, GigForm, AwayManager, GigList, Enquiries, MediaManager, ProfilePage, LoginModal)
- [x] Created `ViewProvider` + `useView()` context — navigation state extracted from MainView, eliminates 8 local handler functions
- [x] Added `ErrorBoundary` component (web + native) — wraps app-level rendering with graceful fallback
- [x] Added `prefers-color-scheme: light` CSS media query — full light theme with adjusted colours, shadows, glows
- [x] Configured Vite code splitting (`manualChunks` for PublicSite + Media/Enquiries)
- [x] IONOS DNS configured via API (A → 76.76.21.21, CNAME www → cname.vercel-dns.com) — propagated
- [x] Both tsc checks pass (native --noEmit + web -b)

## Completed (Sprint S7 — 2026-03-04)
- [x] Extracted date formatting utilities → `web/src/utils/format.ts` (fmt, fmtFee, formatDisplayDate, formatGroupDate, daysUntil, formatRange, formatRelative, formatShortDate)
- [x] Created `useMutationWithQueue` hook — reusable try/catch/isNetworkError/queueMutation pattern
- [x] Created shared `ErrorAlert` and `LoadingSpinner` components (web) — replaced 8+ inline error/loading patterns
- [x] Added skeleton loaders to GigList and DayDetail (animated pulse CSS)
- [x] Added input validation: bank sort code auto-format (XX-XX-XX), payment terms clamp (1-365), invoice amount round to 2dp on blur
- [x] Replaced all 5 browser `confirm()` calls with themed `ConfirmModal` component (GigForm ×2, DayDetail, AwayManager, MediaManager)
- [x] Both tsc checks pass (native --noEmit + web -b)

## Backlog
- Test themed templates on device (7 invoice + 7 receipt styles, SVG decorations)
- Fix HTML mockups (mockups/ folder) — include real base64 logo, add 3 themed mockups, create index.html
- Test on device: preview carousel, receipt styling, receipt generation, share individual receipts
- FreeAgent API integration — sync income/expenses for tax reporting (D-047, needs planning)
- Add thegreentangerine.com domain in Vercel project settings (DNS already pointed)

## Known Limitations (Not Bugs — By Design)
- No invoice editing (use "Create Similar" instead) — D-016
- No custom split percentages (equal splits only) — D-011
- No multi-user support (single-user app) — D-005
- No cloud sync for invoicing (local-only by design) — D-015
- No email/phone validation (single-user app) — audit decision
- Status flow not enforced (draft to sent to paid flexible) — audit decision

## Recently Completed (This Session — 2026-03-04)
- [x] Sprint S8: CSS extraction, ViewContext, error boundaries, light theme, code splitting, DNS config
- [x] Sprint S7: Code dedup, shared components, skeleton loaders, validation, themed modals
- [x] Sprint S6: Media gallery, media manager, contact form → Supabase, enquiry inbox, Storage bucket + migration pushed
- [x] Sprint S5: PublicSite, LoginModal, SEO, public gigs, member profiles
- [x] Sprint S4: Schema migration, is_public toggle (web + native), profile page
- [x] Sprint S2 code fixes (type safety, error handling, offline improvements)
- [x] Spinner time picker (replaced analogue clock with digital spinner)
- [x] DayDetail delete button with offline queueing
- [x] Conflict detection in web offline queue (entity existence check before replay)

## Completed (Previous Session — 2026-03-04)
- [x] Full codebase audit (shared, native, web, SOT docs, config — 5 parallel agents)
- [x] Created STATUS.md instant-context document (SOT redesign)
- [x] Fixed CRITICAL: Added updateAwayDate to offline queues (native + web)
- [x] Fixed CRITICAL: Added session refresh to AuthContext (prevents expired JWT on mount)
- [x] Fixed CRITICAL: Wrapped createReceipts() in atomic transaction
- [x] Restructured todo.md (Blocked/Next/Planned/Backlog sections)
- [x] Updated CLAUDE.md session protocol to use STATUS.md
- [x] Defined sprint roadmap (S2-S8)

## Completed (Previous Sessions)
- [x] Phase 6: Polish & Remaining Items (2026-03-04)
- [x] Phase 5: Full Offline Support (2026-03-04)
- [x] Phase 4: In-App Change Summary (2026-03-04)
- [x] Phase 2: Web Visual Redesign (2026-03-04)
- [x] Phase 3 remaining: day sheet scroll, gig count badge, save toast (2026-03-04)
- [x] Phase 1: Critical data & sync fixes (2026-03-04)
- [x] Native gig list + Cal/List toggle (2026-03-03)
- [x] Comprehensive audit + 6-phase fix plan (2026-03-03)
- [x] Monorepo restructure (2026-03-03)
- [x] Shared gig calendar — Supabase backend + Timetree PWA (2026-03-03)
- [x] 3 seasonal themed templates (2026-03-02)
- [x] Core app build, SOT docs, multiple invoice styles, UX polish (2026-03-02)

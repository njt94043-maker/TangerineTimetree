# TGT — Sprint Pickup Prompts

> Copy-paste the next sprint's prompt to start a fresh session.
> Each prompt gives the AI full context to pick up where we left off.

---

## Sprint S2 — APK Build Fix + HIGH Code Issues

```
Read native/docs/ai_context/STATUS.md and native/docs/ai_context/todo.md. This is Sprint S2.

Goals:
1. Fix the APK build failure — the cmake error from @react-native-community/datetimepicker JNI codegen. Try `npx expo prebuild --clean` first, then `cd android && ./gradlew assembleRelease`. If that doesn't work, debug the cmake output or try installing newer cmake via sdkmanager.
2. Fix HIGH code issues in shared/supabase/queries.ts — replace `any` casts in row mappings with typed interfaces, add error handling to changelog inserts.
3. Fix shared/supabase/clientRef.ts — improve SupabaseClientLike interface with proper return types instead of `any`.
4. Fix native/src/db/queries.ts — make getSettings() return `GigBooksSettings | null` and handle null in callers.
5. Fix web/src/hooks/useOfflineQueue.ts — add conflict detection (check if entity still exists before replaying).
6. Add offline mutation support to web/src/components/DayDetail.tsx.

Run `npx tsc --noEmit` (native) and `npx tsc -b` (web) after all changes. Update SOT docs at session end.
```

---

## Sprint S3 — Documentation + CI/CD

```
Read native/docs/ai_context/STATUS.md and native/docs/ai_context/todo.md. This is Sprint S3.

Goals:
1. Document all Supabase tables in native/docs/ai_context/schema_map.md — add profiles, gigs, away_dates, gig_changelog, away_date_changelog tables with full column definitions and RLS policies.
2. Create web/docs/blueprint.md — web app architecture document covering: routing, components, hooks, PWA config, styling approach, data flow, offline strategy.
3. Set up GitHub Actions CI/CD — create .github/workflows/check.yml that runs `npx tsc --noEmit` (native) and `npx tsc -b` (web) on pull requests.
4. Create web/.env.example with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY placeholders.
5. Update native/docs/ai_context/blueprint.md — fix "4 invoice styles" to "7 styles", fix "5 tables" to "6 tables", clarify Supabase exception to D-015.

Update SOT docs at session end.
```

---

## Sprint S4 — Public Website Sprint 1

```
Read native/docs/ai_context/STATUS.md and native/docs/ai_context/todo.md. This is Sprint S4 (Public Website Sprint 1).

Reference: C:\Apps\TGT\PLAN_PUBLIC_SITE.md has the full implementation plan.

Goals:
1. Supabase schema migration — add `is_public` boolean (default false) to gigs table, add `band_role` text to profiles table, create `public_media` table. Add RLS policies for anonymous read access on public data.
2. Update shared/supabase/types.ts — add is_public to Gig type, band_role to Profile type, add PublicMedia type.
3. Update shared/supabase/queries.ts — add getPublicGigs() query (anonymous, is_public=true only), add updateProfile() for band_role.
4. Add "Show on Website" toggle to web gig form (GigForm.tsx) — checkbox that sets is_public.
5. Add "Show on Website" toggle to native gig form (app/gig/new.tsx) — Switch component.
6. Create web profile page — editable name + band_role fields.

Run tsc checks on both apps. Test web changes in browser. Update SOT docs at session end.
```

---

## Sprint S5 — Public Website Sprint 2

```
Read native/docs/ai_context/STATUS.md and native/docs/ai_context/todo.md. This is Sprint S5 (Public Website Sprint 2).

Reference: C:\Apps\TGT\PLAN_PUBLIC_SITE.md for design specs.

Goals:
1. Build PublicSite component (web/src/components/PublicSite.tsx) — unauthenticated landing page with 7 sections: hero, upcoming gigs, about the band, for venues, pricing, gallery placeholder, contact.
2. Update web/src/App.tsx routing — show PublicSite for unauthenticated users instead of LoginPage. Add "Band Login" button that opens login modal.
3. Create LoginModal component — overlay modal replacing the full-page LoginPage.
4. Add SEO meta tags — OpenGraph, Twitter cards, structured data for band/events.
5. Fetch and display public gigs on the landing page using getPublicGigs().
6. Display band member profiles (names, roles, photos) from Supabase.

Run tsc checks. Test responsive layout (mobile + desktop). Update SOT docs at session end.
```

---

## Sprint S6 — Public Website Sprint 3

```
Read native/docs/ai_context/STATUS.md and native/docs/ai_context/todo.md. This is Sprint S6 (Public Website Sprint 3).

Reference: C:\Apps\TGT\PLAN_PUBLIC_SITE.md for design specs.

Goals:
1. Build media gallery section — fetch from public_media table, display photos/videos in responsive grid.
2. Add media upload UI for authenticated band members — upload to Supabase Storage, insert into public_media table.
3. Build contact form — email submission for booking enquiries (consider Formspree or similar service).
4. Set up IONOS domain → Vercel — A record (76.76.21.21) + CNAME (cname.vercel-dns.com). Add custom domain in Vercel project settings.
5. Final polish — test all public pages, verify SEO tags, check mobile responsiveness, test PWA install from custom domain.

Run tsc checks. Test on multiple devices. Update SOT docs at session end.
```

---

## Sprint S7 — MEDIUM Code Issues Batch

```
Read native/docs/ai_context/STATUS.md and native/docs/ai_context/todo.md. This is Sprint S7.

Goals — fix MEDIUM code issues identified in the audit:
1. Extract date formatting utilities — consolidate duplicated formatGroupDate/daysUntil/formatDisplayDate from web components into web/src/utils/format.ts.
2. Create useMutationWithQueue hook — extract duplicated form submit + offline queue pattern from GigForm.tsx and AwayManager.tsx.
3. Create shared ErrorAlert and LoadingSpinner components (web) — replace inline error/loading patterns.
4. Add loading states/skeleton loaders — replace "Loading..." text in GigList, DayDetail, Calendar.
5. Add input validation — bank sort code format, payment terms clamping, invoice amount rounding to 2 decimal places.
6. Replace browser confirm() dialogs with themed modals (web GigForm + AwayManager delete confirmations).

Run tsc checks on both apps. Update SOT docs at session end.
```

---

## Sprint S8 — Polish Pass

```
Read native/docs/ai_context/STATUS.md and native/docs/ai_context/todo.md. This is Sprint S8.

Goals — final polish:
1. Extract inline styles to CSS classes (web) — move style={{}} objects to App.css or component-scoped CSS.
2. Replace prop drilling with Context API (web) — create ViewContext for navigation state, reduce callback threading through MainView.
3. Add React error boundaries (web + native) — catch rendering errors gracefully.
4. Add prefers-color-scheme support (web CSS) — light theme variant.
5. Configure explicit code splitting (web vite.config.ts) — route-based chunks for Calendar, GigForm, GigList.
6. Test themed templates on device (7 invoice + 7 receipt styles).
7. Final pass: run both tsc checks, test web PWA, test native on device if APK working.

Update SOT docs at session end. Review STATUS.md — mark remaining items as complete or move to future backlog.
```

# TGT — Status (Instant Context)

> Single source of "where are we right now". Read this FIRST every session.
> Updated at end of every session. Keep under 60 lines.

---

## Current State
- **Phase**: Sprint S8 complete (Polish pass).
- **Blocker**: APK cmake build failure (`@react-native-community/datetimepicker` JNI codegen). Try: `npx expo prebuild --clean` → `./gradlew assembleRelease`.
- **Last session**: 2026-03-04 — Sprint S8 (CSS extraction, ViewContext, error boundaries, light theme, code splitting)
- **Next action**: Test web PWA + add thegreentangerine.com domain in Vercel. Fix APK build if possible.

## Big Picture
- **Vision**: Unified Tangerine Timetree brand — native invoicing (GigBooks) + web calendar (Timetree) + public website
- **North star**: 4 band members manage gigs, invoices, and public presence through one ecosystem
- **Architecture**: Monorepo (`shared/` + `native/` + `web/`) with Supabase backend for shared calendar, SQLite for local invoicing
- **Users**: Nathan (admin), Neil, James, Adam — The Green Tangerine

## Active Risks
1. APK build broken (cmake/datetimepicker) — blocks native deployment
2. DNS pointed (IONOS → Vercel), but domain not yet added in Vercel project settings (add thegreentangerine.com + www)
3. No CI/CD live yet — GitHub Actions workflow created, needs first PR to validate

## What's Deployed
- **Web**: tangerine-timetree.vercel.app (Vercel, auto-deploys from master)
- **Native**: Last working APK predates datetimepicker addition
- **Supabase**: jlufqgslgjowfaqmqlds.supabase.co (production)

## Session Protocol (Quick Reference)
**Start**: Read STATUS.md → todo.md → (deeper docs only if needed) → `npx tsc --noEmit`
**End**: Update STATUS.md → todo.md → SESSION_LOG.md → gotchas.md (if learned) → decisions_log.md (if decided)

## Sprint Roadmap
| Sprint | Focus | Status |
|--------|-------|--------|
| S1 | Audit critical fixes + SOT redesign | DONE |
| S2 | Fix APK build + HIGH code issues (type safety, error handling) | DONE (code done, APK pending reboot) |
| S3 | Supabase docs + web blueprint + CI/CD pipeline | DONE |
| S4 | Public Website Sprint 1 (schema migration, is_public toggle, profile page) | DONE |
| S5 | Public Website Sprint 2 (public site component, login modal, SEO) | DONE |
| S6 | Public Website Sprint 3 (media gallery, contact form, IONOS domain) | DONE |
| S7 | MEDIUM issues batch (code duplication, loading states, validation) | DONE |
| S8 | Polish pass (CSS extraction, ViewContext, error boundaries, light theme, code splitting) | DONE |

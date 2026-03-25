# TGT — Status (Instant Context)

> Single source of "where are we right now". Read this FIRST every session.
> Updated at end of every session. Keep under 60 lines.

---

## Current State
- **Phase**: UX Simplification — GigHub merged into DayDetail as expandable accordion cards. Deployed.
- **What works**: Android (full), Cloud Run, Capture. Web stems/mixer work. Web time display works. **Web click plays consistently**. **Invoice/receipt/quote PDF templates fixed for print**. **Gig Day is now a full-screen unified view**.
- **What was done (S63)**: Merged GigHub into DayDetail — gig cards expand in-place (accordion) to reveal pipeline tracker, deposit, linked docs, actions. Removed `gig-hub` as standalone view from ViewContext. Navigation reduced from 3-4 hops to 1-2.
- **Seed status**: 117 gigs (114 linked to venue_id) + 62 away dates. 29 clients, 65 venues. 4 songs.

## S63 UX Consolidation
- **New component**: `GigCardExpanded.tsx` — extracted from GigHub, renders inline in accordion cards
- **DayDetail.tsx**: Full-screen view (was bottom sheet), accordion gig cards, mini pipeline dots on collapsed cards
- **Removed**: `gig-hub` view from ViewContext, GigHub rendering from App.tsx, `goToGigHub`/`gigHubGigId` state
- **Navigation**: Edit Booking, View Quote/Invoice, Create Invoice, Generate Quote all wired through DayDetail props
- **Nathan chose**: Full-screen from the start (not bottom sheet). Deployed to Vercel.
- **Nathan will test next session** and list UX tweaks needed.

## NEXT SESSION: UX Tweaks + PDF Template Rollout
**Part 1 — UX Tweaks (Nathan's list)**
Nathan will provide specific issues/tweaks for the new Gig Day view after testing the deployed version.

**Part 2 — PDF Template Rollout (Carried Over)**
Apply the same print/clarity fixes from Premium Dark template to remaining 27 templates:
- @page { margin: 0 } + background preservation
- Bank details in JetBrains Mono, 15px, bright
- Consistent BILL TO fallback (venue name + address when no client linked)
- document.title set correctly on preview

**Also remaining**: Drift correction (S61), parity items — see todo.md

## Remaining Items
- [ ] **Drift correction** — re-enable resyncToPosition with ~93ms latency compensation
- [ ] **Evaluate FFT necessity** — D-169 says vis is beat-synced only, may not need FFT
- [ ] Web set-complete modal (Android has it, web doesn't)
- [ ] Web waveform strip with loop region (Android has it)
- [ ] Verify calendar cell shadows match mockup
- [ ] Queue items: NeuCard → flat rows (already done per audit)

## What's Deployed
- **Web**: thegreentangerine.com (PDF print fixes + bank detail clarity deployed)
- **Android**: Compose debug APK on Samsung RFCW113WZRM (2026-03-13, S52)
- **Supabase**: jlufqgslgjowfaqmqlds.supabase.co (26 tables, 4 storage buckets)
- **Cloud Run**: beat-analysis service — revision beat-analysis-00009-th7

## Session Protocol (Quick Reference)
**Start**: Read STATUS.md → todo.md (mandatory). Other docs on demand.
**End**: Update STATUS.md → todo.md → SESSION_LOG.md. Commit + push.
**TESTING**: Clear site data → close tab → fresh tab. One change per push.
**EVERY CHANGE**: Ask "what else does this affect?" across ALL apps (D-156).
**NO GUESSING**: Every code change must be backed by research or reference implementation.

# TGT — Status (Instant Context)

> Single source of "where are we right now". Read this FIRST every session.
> Updated at end of every session. Keep under 60 lines.

---

## Current State
- **Phase**: PDF template fix session — Invoice PDF print flow diagnosed and fixed.
- **What works**: Android (full), Cloud Run, Capture. Web stems/mixer work. Web time display works. **Web click plays consistently**. **Invoice/receipt/quote PDF templates fixed for print**.
- **What was fixed (this session)**: PDF print output was broken — missing BILL TO data (venue fallback), no print styles, Chrome headers/footers, 2-page overflow, wrong filename, dim bank details. All fixed across Premium Dark template. Bank details now use JetBrains Mono for digit clarity.
- **Seed status**: 117 gigs (114 linked to venue_id) + 62 away dates. 29 clients, 65 venues. 4 songs.

## S60 Fix (Click Silence Root Cause)
- **Symptom**: Zero clicks ever played despite scheduler being active.
- **Root cause**: `resyncToPosition()` ran every 25ms in `schedule()`. SoundTouch reports position ~93ms ahead (4096-sample ScriptProcessorNode buffer). Resync saw the track "past" each beat and pushed `nextBeatTime` to the NEXT beat. The 100ms lookahead could never catch up → `while (nextBeatTime < deadline)` never entered → zero OscillatorNodes created.
- **Fix**: Disabled resync entirely. Natural beat map scheduling (advanceBeat() using madmom timestamps + Chris Wilson pattern) works accurately without drift correction.
- **Result**: Consistent click for ~60 seconds, then gradual drift. Drift correction needs re-enabling with SoundTouch latency compensation (~93ms subtracted from reported position).
- **Also fixed**: Added `osc.onended` GainNode cleanup (was leaking).

## S60 Cleanup
- Removed debug UI (banner, test beep, console.logs, __BUILD_TIME__)
- Pruned SOT docs (SESSION_LOG -95%, SPRINT_PROMPTS -98%, gotchas -26%)
- Created WEB_AUDIO_REFERENCE.md (stored 8 sessions of audio research)

## NEXT SESSION: UX Simplification — Screen/Flow Consolidation
1. **Audit gig day navigation** — DayDetail → GigHub → Invoice/Quote has too many hops. Nathan wants ONE "do all" screen per gig day. No features removed — just fewer landing pages.
2. **Map all multi-hop flows** across the app and identify consolidation opportunities.
3. **Both platforms** — any screen simplification must apply to web AND Android (D-153).
4. **Also remaining**: Drift correction (S61), parity items — see todo.md

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

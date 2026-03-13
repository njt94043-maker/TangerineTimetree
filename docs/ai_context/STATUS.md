# TGT — Status (Instant Context)

> Single source of "where are we right now". Read this FIRST every session.
> Updated at end of every session. Keep under 60 lines.

---

## Current State
- **Phase**: S60 complete — Click WORKS. Consistent beat for ~60s, then drifts. Drift correction needs latency-compensated resync (next session).
- **What works**: Android (full), Cloud Run, Capture. Web stems/mixer work. Web time display works. **Web click plays consistently**.
- **What was fixed (S60)**: `resyncToPosition()` was preventing ALL clicks from ever scheduling. SoundTouch's ~93ms position latency made resync push `nextBeatTime` past the 100ms lookahead window every 25ms — zero OscillatorNodes were ever created. Fix: disabled resync, natural beat map scheduling works. Drift correction needs re-enabling with latency compensation.
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

## NEXT SESSION (S61): Drift correction + remaining items
1. **Re-enable resync with latency compensation** — subtract ~93ms from SoundTouch position before comparing to beat map
2. **Test drift** — play 3+ minutes, verify click stays in time
3. **Evaluate FFT necessity** — D-169 says vis is beat-synced, may not need FFT
4. **Remaining parity items** — see todo.md

## Remaining Items
- [ ] **Drift correction** — re-enable resyncToPosition with ~93ms latency compensation
- [ ] **Evaluate FFT necessity** — D-169 says vis is beat-synced only, may not need FFT
- [ ] Web set-complete modal (Android has it, web doesn't)
- [ ] Web waveform strip with loop region (Android has it)
- [ ] Verify calendar cell shadows match mockup
- [ ] Queue items: NeuCard → flat rows (already done per audit)

## What's Deployed
- **Web**: thegreentangerine.com (S60 — click works, resync disabled, diagnostics removed)
- **Android**: Compose debug APK on Samsung RFCW113WZRM (2026-03-13, S52)
- **Supabase**: jlufqgslgjowfaqmqlds.supabase.co (26 tables, 4 storage buckets)
- **Cloud Run**: beat-analysis service — revision beat-analysis-00009-th7

## Session Protocol (Quick Reference)
**Start**: Read STATUS.md → todo.md (mandatory). Other docs on demand.
**End**: Update STATUS.md → todo.md → SESSION_LOG.md. Commit + push.
**TESTING**: Clear site data → close tab → fresh tab. One change per push.
**EVERY CHANGE**: Ask "what else does this affect?" across ALL apps (D-156).
**NO GUESSING**: Every code change must be backed by research or reference implementation.

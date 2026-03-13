# TGT — Status (Instant Context)

> Single source of "where are we right now". Read this FIRST every session.
> Updated at end of every session. Keep under 60 lines.

---

## Current State
- **Phase**: S56 complete — Web click foreground fix partially done, needs remaining isolation.
- **What works**: Android (full), Cloud Run, Capture. Web stems/mixer work. Web time display works. **Web click NOW WORKS IN FOREGROUND** (confirmed with build hash `2026-03-13 15:50:40`).
- **What's missing from tick loop**: resyncToPosition, beat intensity, FFT — not yet re-added after isolation.
- **Seed status**: 117 gigs (114 linked to venue_id) + 62 away dates. 29 clients, 65 venues. 4 songs.

## S56 Confirmed Fixes
- **AudioEngine.ts**: AnalyserNode moved from series to parallel branch — **CONFIRMED working** after clear site data + fresh tab.
- **useAudioEngine.ts**: Tick loop at step 2c (pollBeats + position + loop + setCurrentTime). Click works in foreground.
- **Testing infrastructure**: BUILD timestamp visible in debug banner, testing protocol in gotchas.md.

## S56 Isolation Results (CLEAN — build-hash verified)
| Step | Tick loop contents | Click? |
|------|--------------------|--------|
| Baseline | pollBeats only | **WORKS** ✓ |
| 2b | + position + loop | **WORKS** ✓ |
| 2c | + setCurrentTime + emitTimeUpdate | **WORKS** ✓ |
| 2d | + resyncToPosition | **WORKS** ✓ (drifts) |
| 2e | + FFT + beat intensity | **BROKE** ✗ (permanent until clear site data) |
| **Current** | **2c + parallel AnalyserNode** | **WORKS** ✓ (build-hash confirmed) |

## ROOT CAUSE: AnalyserNode in series killed scheduled audio
AnalyserNode was wired masterGain → analyser → destination. Once `getByteFrequencyData()` activated it, scheduled OscillatorNodes went silent. Persisted across code reloads (AudioContext singleton). Fixed by wiring analyser as parallel observer. Clearing site data resets AudioContext.

## NEXT SESSION (S57): Continue tick loop restoration
**Testing protocol**: Clear site data → close tab → fresh tab → verify BUILD timestamp. One change per push.
1. Add back `resyncToPosition` → push → test (was safe at step 2d)
2. Add back beat intensity decay → push → test
3. Add back `getFrequencyData()` → push → test (this is the risky one — with parallel analyser it should be safe now)
4. If all pass: full tick loop restored. Move to click timing/drift fix.
5. **Click timing/drift is SEPARATE** — don't conflate with foreground silence.

## Remaining Items
- [ ] **Restore remaining tick loop features** (resync, beat intensity, FFT) — 3 isolated pushes
- [ ] **Fix click timing/drift** — separate from foreground silence
- [ ] Remove debug banner + test beep + console.log after click fixed
- [ ] Web visualisers: user testing (blocked by click timing)
- [ ] Queue items: NeuCard → flat rows (Android)
- [ ] Between-songs screen completeness check

## What's Deployed
- **Web**: thegreentangerine.com (Vercel, BUILD timestamp in debug banner)
- **Android**: Compose debug APK on Samsung RFCW113WZRM (2026-03-13, S52)
- **Supabase**: jlufqgslgjowfaqmqlds.supabase.co (26 tables, 4 storage buckets)
- **Cloud Run**: beat-analysis service — revision beat-analysis-00009-th7

## Session Protocol (Quick Reference)
**Start**: Read STATUS.md → IMPACT_MAP.md → todo.md → SPRINT_PROMPTS.md (for current sprint)
**End**: Update STATUS.md → todo.md → SESSION_LOG.md. Commit + push.
**TESTING**: Clear site data → close tab → fresh tab → verify BUILD timestamp. One change per push.
**EVERY CHANGE**: Ask "what else does this affect?" across ALL apps (D-156).

# TGT — Session Log

> What each session built, tested, and blocked.
> Append at the end of every session.
> For instant context, read STATUS.md first.
> **Full history archived at `D:/tgt/sot-backup-s60/SESSION_LOG.md`**

## Latest Sessions (Quick Index)
| Date | Focus | Key Outcome |
|------|-------|-------------|
| 2026-03-13 | S59 — Click always-runs fix | Scheduler ALWAYS starts with track, muted flag controls audibility only. Deployed, untested. |
| 2026-03-13 | S58 — Research-backed drift fix | Moved resyncToPosition into ClickScheduler's 25ms timer. Beat intensity in rAF (safe). |
| 2026-03-13 | S57 — resyncToPosition breaks click | resyncToPosition in rAF kills click. Reverted. No more guessing — research required. |
| 2026-03-13 | S56 — Web click foreground fix | rAF tick loop was culprit. AnalyserNode moved to parallel branch. |
| 2026-03-13 | S55 — Web click diagnostics | KEY: click plays backgrounded, silent foregrounded. OscillatorNode rewrite. |
| 2026-03-13 | S54 — Web click debug | Reverted to S51 audio files. Settings cleanup (D-171). Debug logging added. |
| 2026-03-13 | S53 — Web click rewrite + mobile fix | ClickScheduler rewritten to real-time OscillatorNode. Mobile black screen fixed. |
| 2026-03-13 | S52 — Beat-synced vis + click debug | Visualisers reworked to beat-driven (D-169). Web click still broken. SW auto-update. |
| 2026-03-13 | S51 — 4 bug fixes | APK mixer, web click drift, visualisers, Capture import CORS. |
| 2026-03-11 | S50 — Web mixer parity | Draggable faders, mute dim, click/track gain. Android vis wired. |
| 2026-03-11 | S49 — Android mixer + mode dropdown | Mode dropdown pill, draggable mixer faders, track/stem mute. |
| 2026-03-11 | S46 — Stabilization | D-165/166/167/168 on Android. System bar fix. Queue = source list. Player persistence. |
| 2026-03-10 | S42 — View Mode both platforms | Web + Android View Mode. Mode tabs. Video/visualiser hero. |
| 2026-03-05 | Review UX + Venue/Client Design | Review editor fixes. Venue/client two-list model designed. |

---

## Session: 2026-03-05 — Review UX + Venue/Client Design

### What Was Done
1. **Review editor UX audit + fixes** (web PWA)
   - Auto-growing review text textarea, rating/source/date grid responsive, full-width action buttons on mobile, URL input type, close button 44x44px
   - Committed + pushed to Vercel: `045e58f`

2. **Venue/Client data model design** (discussion + planning, no code)
   - Two-list model: venues (physical places) and clients (people who pay) — independent, no forced link
   - 8 real-world booking flows confirmed. 24-file blast radius. Split into S23A-D epic.
   - Decisions: D-072, D-073, D-074

---

## Session: 2026-03-10 — S42: View Mode Both Platforms

### What Was Done
1. **Web View Mode** — PlayerMode expanded, goToPlayer accepts 'view', Library View button, Player mode tabs + view hero + video sync, ~90 lines CSS
2. **Android View Mode** — ViewScreen.kt (NEW), Screen.View route, Library View launch buttons, PracticeScreen 5 functions private→internal
3. Builds verified: tsc + vite + Kotlin all clean

---

## S46 — Stabilization (2026-03-11)

### What Got Done
1. System bar padding fix (single systemBarsPadding on NavHost)
2. Android 12+ splash fix (windowSplashScreenBackground)
3. D-165 Track auto-load/release (resetTrack in C++)
4. D-167 Auto-save beat analysis
5. D-168 Queue = source list
6. D-166 Player persistence (wasAuthenticated, splashDone, Now Playing drawer item)
7. Player close button (X on PlayerHeader)
8. Decisions logged: D-165, D-166, D-167, D-168

### What's NOT Done (web parity pending)
- Web: D-165, D-166, D-167, D-168 web sides
- Web: Library rebuild to match Android (D-163)

---

## S56 — Web Click Foreground Fix (Isolation) — 2026-03-13

### What Was Done
1. Confirmed rAF tick loop is the culprit (pollBeats-only = click works)
2. Isolated tick loop features one at a time — FFT + beat intensity broke click permanently
3. Moved AnalyserNode from series to parallel branch
4. Current deploy: parallel analyser + step 2c tick loop (no resync/FFT/beat intensity)

### Key Finding
AnalyserNode in series kills OscillatorNode audio. Something in AudioContext state persists across code reloads. Parallel AnalyserNode fix addresses this.

---

## S51–S55: Web Click Debugging Saga (2026-03-13)

### Summary
S51: Click drift fixed with speed-scaled beat map + resync. S52: Visualisers reworked to beat-synced (D-169). PWA standalone import warning (D-170). SW auto-update added. S53: ClickScheduler rewritten from AudioBuffer to OscillatorNode + gain envelope. Mobile black screen fixed (stale SW). S54: Reverted audio files to S51. Settings cleanup (D-171). Debug logging added — all diagnostics correct but no sound. S55: KEY FINDING — click plays in background, silent in foreground. Test beep works. OscillatorNode in foreground confirmed as the issue.

---

## S57–S59: Research-Backed Click Fix (2026-03-13)

### Summary
S57: resyncToPosition in rAF kills click (contradicts S56 step 2d — difference is parallel AnalyserNode). Reverted immediately. Nathan: "no more guessing." S58: Researched Chris Wilson + Tone.js. Root cause: race condition between rAF writes and setInterval reads. Fix: moved resyncToPosition into ClickScheduler's own 25ms timer via trackPositionGetter callback. S59: Click didn't start with track — scheduler was gated behind `player_click_enabled` DB pref (set false during S54 debug). Fix: scheduler ALWAYS starts, muted flag controls audibility only. Pain journal logged.

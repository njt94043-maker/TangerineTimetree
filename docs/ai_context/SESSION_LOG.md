# TGT — Session Log

> What each session built, tested, and blocked.
> Append at the end of every session.
> For instant context, read STATUS.md first.
> **Full history archived at `D:/tgt/sot-backup-s60/SESSION_LOG.md`**

## 2026-07-04 — s258 slice A: calendar-first shell (web v1.7.0)

### What Was Done (Builder)
1. New `web/src/nav/navConfig.ts` — single source of nav truth: `TAB_ITEMS` (Calendar/Gigs/Money/More), `MORE_SECTIONS` (12 non-tab destinations), `VIEW_TO_NAV` (typed `Record<View, View>` — compiler guarantees every View has a nav home), `ALL_TOP_DESTINATIONS`.
2. New components: `TabBar.tsx` (fixed bottom bar, 4 tabs, active = `VIEW_TO_NAV[view]`, Drawer's nav semantics), `MoreMenu.tsx` (grouped overflow list, view `'more'`), `DayPeek.tsx` (Timetree-style bottom sheet over the calendar — gigs/away rows, +Add booking / Open day, Escape+overlay close).
3. App shell: added `'more'` to the View union; retired the hamburger + `<Drawer>` + `drawerOpen`/`toggleDrawer`/`closeDrawer`; day tap now opens the peek (`peekDate` state) instead of leaving the month; FAB (`.fab-add`) on calendar only → booking wizard; `headerTitle` case `'more'`. Deleted `Drawer.tsx`. Removed the calendar legend + `LegendItem`.
4. App.css: removed all `.drawer*`/`.hamburger*`/`.legend*` rules + both drawer media queries (the desktop rail that phantom-indented `.main-content`/`.header`); added `.tab-bar`/`.tab-item`, `.fab-add`, `.more-*`, `.day-peek*`, and `.main-content` bottom padding (tab bar + `safe-area-inset-bottom`).
5. Truthful `__APP_VERSION__` (closes S254 "reports 1.0.0"): `vite.config.ts` define from package.json version, `env.d.ts` declare, `main.tsx` assigns `window.__APP_VERSION__`. package.json → **1.7.0**.
6. Tests: `navConfig.test.ts` (the 15-destination guardrail + no tab/More overlap + VIEW_TO_NAV covers every View) and `TabBar.test.tsx` (4 tabs, active follows view, click Gigs → list).
7. Hub `scripts/prod-drive/smoke.js` → v2: `openNavTo` (tabs + More) replaces `openDrawerTo`, `.tab-bar` ready signal, new `day-peek` check + `.fab-add` assertions (committed in hub, NOT pushed — Architect's lane).

### Verified (Builder gate — green)
- `npx tsc -b` clean · `npx vitest run` 122 pass (incl. 2 new files, 6 tests) · `npx vite build` clean, `__APP_VERSION__="1.7.0"` in the bundle · quality_gate.py tgt-web (see commit).
- **Deviations (documented):** (a) smoke uses `:has-text` not the spec's literal `:text-is` — tab/More buttons carry an emoji icon beside the label, so exact-text match would miss them. (b) `TabBar.test.tsx` drives raw `react-dom/client` + React 19 `act()` instead of `@testing-library/react` — RTL's required peer `@testing-library/dom` is NOT installed, so RTL `render()` fails at runtime; kept the slice dependency-free.

### Left for the Architect
- Authed 390×844 prod visual (tab bar / FAB / day-peek / all 15 destinations / no overflow / back-button history) — mint-needs-Nathan; run smoke v2 once a session exists. Hub commit is unpushed (Architect wraps the hub).

## 2026-06-13 - Gig/Take hotspot connectivity incident

### What Was Done
1. Logged Nathan's exact incident report in `NATHAN_VERBATIM.md`.
2. Reproduced the rig on the S23 hotspot: PC WiFi `10.117.252.228`, S23 gateway `10.117.252.187`.
3. Verified local rig health: Reaper listening on UDP 8000, Tangerine Media Server listening on TCP 9200, firewall rules enabled.
4. Verified Media Server bridge through hotspot IP: `http://10.117.252.228:9200/take/songs` returned 200 with song data.
5. Found `tgt-host.local` advertising stale home/link-local addresses after hotspot switch.
6. Added Android `ACCESS_NETWORK_STATE` and guarded candidate network enumeration in `GigCommandClient`.
7. Verified `:app:assembleDebug` and `:app:assembleRelease` pass.
8. Rebuilt the release APK and installed `app-release.apk` to both connected phones: `SM_S918B` (`R3CW30N241L`) and `SM_S911B` (`RFCW81GEPWM`).
9. Live Gig Mode test showed the app still targeting stale home-WiFi discovery `192.168.1.90:8000`.
10. Added emergency release field pin: `GIG_HOST_DEFAULT=10.117.252.228`, Reaper OSC defaults to the same host, and auto-discovery now defaults off so stale mDNS cannot overwrite the hotspot target.
11. Rebuilt release APK, installed it to both phones, relaunched Gig Mode, and verified the visible target is now `10.117.252.228:8000`.
12. Verified both phones are on the S23 hotspot subnet and can reach the laptop bridge: `SM_S911B=10.117.252.187`, `SM_S918B=10.117.252.173`, both `nc -z 10.117.252.228 9200` exit 0.
13. Nathan reported pause/resume is unsafe: after pausing, resume starts recording from the beginning of the Reaper project and can overwrite. Decision for tonight: do not pause; do not change/reinstall before the gig.

### Still Unsafe
- Actual capture fanout test still pending; Codex did not press `Start gig` because that starts Reaper/camera capture.
- Pause/resume overwrite bug must be fixed after tonight. Candidate fix: replace the generic OSC `/action/40043 + /action/1013` continue path with a Reaper-side script/custom action that explicitly seeks to true project end and starts record, then bind/call that stable command from the APK.
- Targeted `GigCommandQueueTest` local JVM run is blocked by existing Android `org.json` not-mocked failures; build verification is green.
- Emergency build is pinned to today's laptop hotspot IP. Replace with persistent/manual target storage and a non-mDNS peer fallback before treating hotspot gigs as generally solved.
- Peer camera pairing still relies on mDNS only; add manual/QR direct-connect fallback before treating hotspot gigs as proven.

## Latest Sessions (Quick Index)
| Date | Focus | Key Outcome |
|------|-------|-------------|
| 2026-03-25 | S63 — UX consolidation | Merged GigHub into DayDetail as expandable accordion cards. Full-screen Gig Day view. Removed gig-hub standalone view. 3-4 hops → 1-2. Nathan testing next session. |
| 2026-03-25 | PDF template fix | Invoice print: BILL TO fallback, print styles, @page margin 0, compact spacing, document.title for filename, JetBrains Mono bank details. Next: UX simplification. |
| 2026-03-13 | S60 — Click silence root cause + cleanup | resyncToPosition was preventing ALL clicks. SoundTouch 93ms latency. Click works, drifts after ~60s. |
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

---

## S60 — Click Silence Root Cause + Cleanup (2026-03-13)

### What Was Done
1. **Removed debug UI** — debug banner (CLK/CTX/GAIN/BPM/ENG/BUILD), test beep button, console.logs from Player/useAudioEngine, __BUILD_TIME__ from vite config
2. **Pruned SOT docs** — SESSION_LOG -95%, SPRINT_PROMPTS -98%, gotchas -26%. Created WEB_AUDIO_REFERENCE.md.
3. **Found and fixed click silence root cause** — resyncToPosition() ran every 25ms and pushed nextBeatTime past the 100ms lookahead window. SoundTouch reports position ~93ms ahead (4096-sample buffer). Resync always saw the track "past" each beat → pushed to next beat → scheduler chased beat map forward but never caught up → while loop never entered → zero OscillatorNodes created.
4. **Fix**: Disabled resyncToPosition entirely. Natural beat map scheduling (advanceBeat using madmom timestamps) works accurately.
5. **Result**: Consistent click for ~60 seconds, then gradual drift. Drift correction needs re-enabling with latency compensation.
6. **Added osc.onended cleanup** to prevent GainNode accumulation.

### Debugging Approach (one change per push)
- Commit 1: console.log in play() — all diagnostics green (ctx running, gain 1, enabled, not muted)
- Commit 2: console.log in schedule() while loop — NO output (loop never entered)
- Commit 3: console.log at schedule() entry — confirmed nextBeatTime > deadline always
- Commit 4: console.log in startScheduler/setInterval — timer fires, isPlaying=true
- Commit 5: SCHEDULE ENTRY diagnostic — nextBeatTime stayed ahead, resync was pushing it forward
- Commit 6: Skip resync for first 4 beats — click plays! But resync still skips beats after grace period
- Commit 7: Disable resync entirely — consistent click, drifts after ~60s

### Key Learning
SoundTouch's ScriptProcessorNode has ~93ms position reporting latency (4096/44100Hz). Any drift correction using SoundTouch position must compensate for this offset. The previous 30ms drift threshold was within the uncertainty window. Next session: re-enable resync with `trackPos - 0.093` compensation.

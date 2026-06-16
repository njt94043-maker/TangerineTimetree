# TGT — Pain Journal

> Root cause analysis of real failures. Update after significant debugging.

---

## 2026-06-13: Gig Mode / Take Mode hotspot connection failed at gig

**Symptom**: At a gig, the APK orchestrator could not connect to Reaper or the S23 peer path over Nathan's mobile hotspot. Nathan later noted that Gig Mode and Takes had only been proven on home WiFi.

**Facts from live repro after switching the PC to the S23 hotspot**:
- PC hotspot IP: `10.117.252.228`; S23 gateway: `10.117.252.187`.
- Reaper was running and listening on UDP 8000.
- Tangerine Media Server was running and listening on TCP 9200.
- `http://10.117.252.228:9200/take/songs` returned 200 with song data.
- `tgt-host.local` still advertised stale home/link-local addresses (`192.168.1.90`, `192.168.15.10`, `169.254.x.x`) instead of a clean hotspot-only target.
- Android manifest did not request `ACCESS_NETWORK_STATE` even though the hotspot path depends on `ConnectivityManager` enumeration and callbacks.

**Root cause**: Not a Reaper or Media Server process failure. The field gap is hotspot LAN targeting/discovery: home-WiFi mDNS/name resolution hid the fact that the APK needs a reliable direct hotspot target. Missing `ACCESS_NETWORK_STATE` also made the APK's explicit network-binding fallback unsafe.

**Fix in this session**: Added `ACCESS_NETWORK_STATE` and guarded `GigCommandClient.collectCandidateNetworks()` so a permission/OS denial cannot crash the send coroutine before queueing/fallback logic runs.

**Live follow-up**: After installing the first release fix, Gig Mode still visibly targeted stale `192.168.1.90:8000`. Emergency field patch pinned release `GIG_HOST_DEFAULT` to the laptop hotspot IP (`10.117.252.228`), made Reaper OSC use the same build default, and defaulted auto-discovery off. Rebuilt release APK installed to both phones. Gig Mode then showed `10.117.252.228:8000`; both phones could reach `10.117.252.228:9200`.

**Additional live defect**: Pause/resume is unsafe. Nathan observed that after pausing, resume starts recording from the beginning of the project again and can overwrite. Do not change tonight's installed build before the gig; workaround is no pauses. Post-gig fix should make continue/resume call a stable Reaper-side "record at true project end" script/custom action instead of the current generic OSC `/action/40043 + /action/1013` path.

**Remaining risk**: Peer pairing is still mDNS-only (`_tgt-orchestrator._tcp.`). Add a manual/QR direct-connect fallback before calling hotspot gigs proven.

## S59: Click scheduler gated by preference flag (2026-03-13)

**Symptom**: Click didn't play on track start. Mute/unmute from mixer would start the click, but out of time.

**Root cause**: `play()` checked `clickEnabledRef.current` (loaded from DB `player_click_enabled`) and conditionally called `clickRef.current.start()`. During S54 debugging, the pref was persisted as `false` to the DB. So click scheduler never started. `toggleClick` then called `start()` mid-playback with no position context — out of time.

**Why this was wrong**: The research from Chris Wilson ("A Tale of Two Clocks") and Tone.js already established the pattern — the timing engine (scheduler) must ALWAYS run. Mute/unmute is a gain control, not a start/stop of the scheduler. Every real audio app works this way. The research was done in S58 but wasn't fully applied — the scheduler was still conditionally started.

**Fix**: ClickScheduler always starts with the track. Added `muted` flag that controls whether OscillatorNodes are created. Beat events and timing always run regardless of mute state. `toggleClick` calls `setMuted()` instead of `start()`/`stop()`.

**Lesson**: When research gives us a pattern, apply it COMPLETELY — not just to the specific bug that prompted the research. The "all scheduling in one timer" principle also implies "scheduler always runs." These are connected implications of the same design principle.

**Prevention**: Before writing audio code, check: "Does this conditionally start/stop a timing engine based on UI state?" If yes, it's wrong. Timing engines run. UI controls gain/mute.

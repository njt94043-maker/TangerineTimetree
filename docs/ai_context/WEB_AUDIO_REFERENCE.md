# Web Audio Reference — Proven Patterns

> **Read this before touching ANY web audio code.**
> These patterns are from authoritative sources (Chris Wilson, Tone.js, MDN).
> They were learned through 8 debugging sessions (S52-S59). Do not deviate.

---

## 1. The Chris Wilson Lookahead Scheduling Pattern

**Source**: Chris Wilson, "A Tale of Two Clocks" (HTML5 Rocks / web.dev)

### The Problem
JavaScript timers (`setTimeout`, `setInterval`, `requestAnimationFrame`) are not precise enough for audio. They jitter by 1-50ms depending on browser load. But `AudioContext.currentTime` is a hardware-backed clock running on the audio thread — sample-accurate.

### The Solution: Schedule Ahead
Use a JavaScript timer to LOOK AHEAD and schedule audio events using `AudioContext.currentTime`.

```
setInterval(schedule, 25ms)  ←  JS timer (imprecise, but frequent enough)
  │
  ├─ Look 100ms into the future
  ├─ For each beat that falls within that window:
  │   └─ osc.start(audioContext.currentTime + offset)  ←  sample-accurate
  └─ Advance beat pointer
```

### Why These Numbers
- **25ms interval**: Fires ~40 times/sec. Even if one callback is 20ms late, the next one catches up before the 100ms window expires.
- **100ms lookahead**: Large enough that scheduling always happens before playback time. Small enough that gain/mute changes feel responsive (<100ms latency).

### Critical Rules
1. **AudioContext.currentTime is the ONLY clock** — never use `Date.now()` or `performance.now()` for scheduling
2. **Schedule writes happen in setInterval** — never in `requestAnimationFrame`
3. **rAF is for READS only** — poll beat events, update UI, read positions
4. **Never modify scheduling state from rAF** — this causes race conditions (S57 root cause)

---

## 2. OscillatorNode Usage (One-Shot Pattern)

**Source**: MDN Web Audio API, confirmed by Tone.js source

### Rules
- OscillatorNodes are **single-use**: create → start → stop → garbage collected
- You CANNOT restart a stopped OscillatorNode — create a new one
- Always create a fresh OscillatorNode + GainNode pair for each click sound
- Use `osc.start(time)` and `osc.stop(time + duration)` for precise timing
- **Cleanup**: Set `osc.onended = () => { gainNode.disconnect(); }` to prevent GainNode accumulation

### Our Click Sound
```javascript
const osc = ctx.createOscillator();
const envGain = ctx.createGain();
osc.frequency.value = 880;  // A5
envGain.gain.setValueAtTime(gain, time);
envGain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
osc.connect(envGain);
envGain.connect(masterGain);
osc.start(time);
osc.stop(time + 0.03);
osc.onended = () => envGain.disconnect();
```

### What NOT To Do
- Do NOT use AudioBufferSourceNode for click sounds (S53 found this approach was silent in some contexts)
- Do NOT pre-render click buffers — OscillatorNode synthesis is more reliable cross-browser

---

## 3. AnalyserNode — ALWAYS Parallel

**Source**: S56 root cause analysis, confirmed by Web Audio spec

### The Rule
AnalyserNode must be wired as a **parallel observer**, never in the audio output path.

```
CORRECT:
  masterGain → destination
  masterGain → analyser  (parallel branch, read-only)

WRONG:
  masterGain → analyser → destination  (series — breaks OscillatorNodes)
```

### Why
When AnalyserNode is in series and `getByteFrequencyData()` is called from rAF at 60fps, it interferes with scheduled OscillatorNode playback. The damage persists across code reloads because AudioContext is a singleton. This was the root cause of the S56 "click only plays in background" bug.

### Current Implementation
`AudioEngine.ts` lines 55-61: masterGain connects to BOTH destination and analyser in parallel.

---

## 4. Timing Engine Architecture: Always Run, Mute = Gain

**Source**: Tone.js Transport architecture, Chris Wilson pattern, confirmed S59

### The Principle
Timing engines (schedulers, transport) should **always run** when playback is active. Muting should control **gain/audibility**, not **start/stop the scheduling loop**.

### Why
If you stop/start a timing engine mid-playback:
- Position sync is lost (engine doesn't know where the track is)
- Beat counter resets (visual flash loses sync)
- Resuming requires expensive resync calculation
- User hears the first beat at the wrong time

### Our Implementation
- `ClickScheduler.start()` is called EVERY time `play()` is called, regardless of mute state
- `ClickScheduler.setMuted(true/false)` controls whether OscillatorNodes are created
- Beat events are ALWAYS emitted (for visual sync) even when muted
- `toggleClick()` calls `setMuted()`, never `start()`/`stop()`

### The S59 Bug
`play()` was gated behind `player_click_enabled` DB pref (set to `false` during S54 debugging). Scheduler never started → no beat events → no sync. Fix: scheduler always starts, mute flag from DB controls gain only.

---

## 5. AudioContext Lifecycle

### Creation
- Created lazily on first use (user gesture requirement)
- `AudioEngine.getContext()` creates if needed
- Never destroyed — "expensive to recreate" (reuses across songs)

### States
- `suspended` → call `resume()` before any audio (requires user gesture on mobile)
- `running` → normal operation
- `closed` → cannot be reopened (we never close it)

### Mobile Considerations
- iOS Safari: AudioContext starts suspended, requires `resume()` on user touch/click
- Background tabs: browser may suspend AudioContext (our click plays in background because setInterval still fires, but OscillatorNodes may be delayed)
- Our `play()` always calls `AudioEngine.resume()` first

---

## 6. rAF Tick Loop — What's Safe, What's Not

### SAFE in rAF (read-only operations)
- `AudioEngine.pollBeats()` — reads beat queue, emits events
- `mixerRef.current.getPosition()` — reads SoundTouchJS position
- `setCurrentTime(pos)` — React state update
- `AudioEngine.emitTimeUpdate(pos, duration)` — observer notification
- `mixerRef.current.checkLoop()` — reads position, seeks if past loop end
- Beat intensity decay — reads beat events, writes to a ref

### DANGEROUS in rAF (DO NOT DO)
- `clickRef.current.resyncToPosition()` — modifies `nextBeatTime` on the scheduler (S57 root cause)
- `getByteFrequencyData()` when AnalyserNode is in series (S56 root cause)
- Any write to ClickScheduler state (`nextBeatTime`, `currentBeat`, `currentBar`)

### The Fix (S58)
`resyncToPosition` moved into ClickScheduler's own `schedule()` timer via `trackPositionGetter` callback. Scheduling writes only happen in the scheduling thread. rAF only reads.

---

## 7. SoundTouchJS / ScriptProcessorNode

### Current Architecture
- `TrackPlayer.ts` uses SoundTouchJS `PitchShifter` for pitch-preserved speed control
- Internally creates a `ScriptProcessorNode` with 4096-sample buffer
- At 44.1kHz: 4096 / 44100 = ~93ms latency
- Position reporting (`sourcePosition / sampleRate`) has this ~93ms offset

### Implications
- Click-to-track drift correction has inherent ~93ms uncertainty
- The 30ms drift threshold in `resyncToPosition` is within this uncertainty window
- Speed changes are applied via `PitchShifter.tempo` (not `playbackRate`)

### Future
- `ScriptProcessorNode` is deprecated — may need AudioWorklet migration eventually
- For now it works and SoundTouchJS doesn't offer an AudioWorklet version

---

## 8. Known Interaction Bugs (Avoid These Combinations)

| Combination | Result | Session |
|---|---|---|
| AnalyserNode in series + getByteFrequencyData in rAF | Click permanently silent | S56 |
| resyncToPosition in rAF + parallel AnalyserNode | Click silent in foreground | S57 |
| ClickScheduler.start() gated by DB preference | Click never starts | S59 |
| AudioBuffer click (vs OscillatorNode) | Silent in some contexts | S53 |
| Full tick loop (all features) with series AnalyserNode | Click only in background | S55 |

---

## 9. Debugging Checklist

When click is silent, check in this order:
1. **AudioContext state** — is it `running`? (call `resume()`)
2. **DB preference** — is `player_click_enabled` set to `true` in `user_settings`?
3. **Mute state** — is `ClickScheduler.muted` set correctly?
4. **Scheduler running** — is `schedulerTimer` non-null? (check `isPlaying`)
5. **masterGain value** — is it > 0?
6. **AnalyserNode routing** — is it parallel (not series)?
7. **rAF writes** — is anything in the tick loop modifying scheduler state?
8. **Beat map** — does the song have one? If not, is manual BPM set?

When click drifts:
1. **resyncToPosition** — is it running inside the scheduler timer (not rAF)?
2. **trackPositionGetter** — is it wired before `start()`?
3. **Speed scaling** — when speed changes, is BPM reconfigured too?
4. **Beat map quality** — are madmom timestamps accurate for this song?

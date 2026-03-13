/**
 * ClickScheduler — Frame-accurate Web Audio API metronome.
 *
 * Uses the lookahead scheduling pattern:
 *   - A setInterval timer runs every ~25ms
 *   - It schedules click sounds up to LOOKAHEAD seconds in the future
 *   - AudioContext hardware clock ensures sample-accurate timing
 *
 * Mirrors the C++ Metronome's feature set:
 *   - BPM, time signature, subdivisions, swing, accent patterns
 *   - Click sounds: default (880/440), high, low, wood, rimshot
 *   - Count-in bars
 *   - Beat map mode (pre-computed beat timestamps from madmom)
 *   - Beat offset (click-to-track alignment)
 *
 * Does NOT handle track playback — that's TrackPlayer's job.
 */

import { AudioEngine, type BeatEvent } from './AudioEngine';

export type ClickSound = 'default' | 'high' | 'low' | 'wood' | 'rim';

export interface ClickConfig {
  bpm: number;
  timeSignatureTop: number;
  timeSignatureBottom: number;
  subdivision: number;      // 1=off, 2=8ths, 3=triplets, 4=16ths
  swingPercent: number;     // 50=straight, up to 75
  accentPattern: number[];  // per-beat levels, 0=silent
  clickSound: ClickSound;
  countInBars: number;
  beatOffsetMs: number;     // click-to-track alignment offset
  gain: number;             // 0-1
}

export const DEFAULT_CLICK_CONFIG: ClickConfig = {
  bpm: 120,
  timeSignatureTop: 4,
  timeSignatureBottom: 4,
  subdivision: 1,
  swingPercent: 50,
  accentPattern: [],
  clickSound: 'default',
  countInBars: 0,
  beatOffsetMs: 0,
  gain: 0.7,
};

// Scheduling constants
const LOOKAHEAD_SEC = 0.1;    // Schedule 100ms ahead
const SCHEDULE_INTERVAL = 25; // Check every 25ms

// Click sound parameters (matching C++ metronome.cpp)
const CLICK_DURATION = 0.030; // 30ms click

const CLICK_FREQS: Record<ClickSound, { down: number; up: number }> = {
  default: { down: 880, up: 440 },
  high:    { down: 1760, up: 880 },
  low:     { down: 440, up: 220 },
  wood:    { down: 800, up: 650 },
  rim:     { down: 1200, up: 1000 },
};

export class ClickScheduler {
  private config: ClickConfig = { ...DEFAULT_CLICK_CONFIG };
  private schedulerTimer: ReturnType<typeof setInterval> | null = null;
  private nextBeatTime = 0;
  private currentBeat = 0;
  private currentBar = 0;
  private isPlaying = false;
  private muted = false; // Mute controls audibility, NOT scheduling. Scheduler always runs.

  // Beat map mode
  private beatMap: number[] | null = null; // seconds (float array from Supabase)
  private beatMapIndex = 0;

  // Speed tracking — beat map intervals must be scaled by 1/speed
  private speed = 1.0;

  // Count-in tracking
  private isCountingIn = false;
  private countInBeatsRemaining = 0;

  // Track position callback — called inside schedule() for drift correction.
  // Lives here (not in rAF) to avoid race condition between two timers writing nextBeatTime.
  // Research: Chris Wilson + Tone.js both confirm scheduling writes must be in ONE timer.
  private trackPositionGetter: (() => number) | null = null;

  configure(partial: Partial<ClickConfig>): void {
    Object.assign(this.config, partial);
  }

  getConfig(): Readonly<ClickConfig> {
    return this.config;
  }

  /**
   * Mute/unmute click audio. Scheduler keeps running (beat events still fire).
   * Click always starts with the track — mute just silences the oscillator.
   */
  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  /**
   * Load a beat map (array of beat timestamps in seconds).
   * When loaded, clicks fire at these exact times instead of constant BPM.
   */
  loadBeatMap(beats: number[]): void {
    this.beatMap = beats;
    this.beatMapIndex = 0;
  }

  clearBeatMap(): void {
    this.beatMap = null;
    this.beatMapIndex = 0;
  }

  /**
   * Set playback speed. Beat map intervals are scaled by 1/speed.
   * Mirrors C++ Metronome::resyncBeatMap — rescales remaining beat times.
   */
  setSpeed(speed: number): void {
    this.speed = speed;
  }

  /**
   * Set a callback that returns the current track position in seconds.
   * Called inside schedule() (25ms timer) for drift correction.
   * This keeps all scheduling writes in ONE timer — no race conditions.
   */
  setTrackPositionGetter(getter: (() => number) | null): void {
    this.trackPositionGetter = getter;
  }

  /**
   * Resync click to the track's actual position. Called from schedule()
   * (inside the 25ms setInterval) — NOT from rAF.
   *
   * Research finding: calling this from rAF (60fps) caused a race condition
   * where nextBeatTime was written by rAF while read by setInterval,
   * killing OscillatorNode audio. Moving it here eliminates the race.
   *
   * Finds the beat map entry closest to trackPositionSec and realigns
   * nextBeatTime so the next click fires at the correct moment.
   */
  private resyncToPosition(trackPositionSec: number): void {
    if (!this.beatMap || this.beatMap.length === 0 || !this.isPlaying) return;

    const ctx = AudioEngine.getContext();
    const now = ctx.currentTime;
    const offsetSec = this.config.beatOffsetMs / 1000;

    // Find the beat map entry just ahead of the current track position
    let newIdx = this.beatMapIndex;
    for (let i = 0; i < this.beatMap.length; i++) {
      if (this.beatMap[i] > trackPositionSec) {
        newIdx = i;
        break;
      }
      if (i === this.beatMap.length - 1) {
        newIdx = i; // past end
      }
    }

    // Compute where the next beat should fire based on track position + speed
    const nextBeatInTrackTime = this.beatMap[newIdx] ?? this.beatMap[this.beatMap.length - 1];
    const timeUntilNextBeat = (nextBeatInTrackTime - trackPositionSec) / this.speed;
    const correctedNextBeatTime = now + timeUntilNextBeat + offsetSec;

    // Only resync if drift exceeds 30ms (avoid constant micro-corrections)
    const drift = Math.abs(this.nextBeatTime - correctedNextBeatTime);
    if (drift > 0.030) {
      this.nextBeatTime = correctedNextBeatTime;
      this.beatMapIndex = newIdx;
    }
  }

  start(startTime?: number): void {
    const ctx = AudioEngine.getContext();
    this.isPlaying = true;
    this.currentBeat = 0;
    this.currentBar = 0;

    const now = startTime ?? ctx.currentTime;
    const offsetSec = this.config.beatOffsetMs / 1000;

    // Count-in
    if (this.config.countInBars > 0) {
      this.isCountingIn = true;
      this.countInBeatsRemaining = this.config.countInBars * this.config.timeSignatureTop;
    } else {
      this.isCountingIn = false;
      this.countInBeatsRemaining = 0;
    }

    // If we have a track position getter and beat map, start from current track position
    // (e.g. click enabled mid-playback via mixer toggle)
    const trackPos = this.trackPositionGetter?.() ?? 0;

    if (this.beatMap && this.beatMap.length > 0) {
      if (trackPos > 0) {
        // Mid-playback start: find the next beat after current track position
        let idx = 0;
        for (let i = 0; i < this.beatMap.length; i++) {
          if (this.beatMap[i] > trackPos) {
            idx = i;
            break;
          }
          if (i === this.beatMap.length - 1) idx = i;
        }
        this.beatMapIndex = idx;
        const nextBeatInTrackTime = this.beatMap[idx];
        const timeUntilNextBeat = (nextBeatInTrackTime - trackPos) / this.speed;
        this.nextBeatTime = now + timeUntilNextBeat + offsetSec;
      } else {
        // Start from beginning: first beat at beatMap[0] + offset
        this.beatMapIndex = 0;
        this.nextBeatTime = now + this.beatMap[0] + offsetSec;
      }
    } else {
      // Constant BPM mode
      this.nextBeatTime = now + offsetSec;
    }

    this.startScheduler();
  }

  stop(): void {
    this.isPlaying = false;
    this.stopScheduler();
    this.trackPositionGetter = null;
  }

  isActive(): boolean {
    return this.isPlaying;
  }

  getCurrentBeat(): number {
    return this.currentBeat;
  }

  getCurrentBar(): number {
    return this.currentBar;
  }

  private startScheduler(): void {
    this.stopScheduler();
    this.schedulerTimer = setInterval(() => this.schedule(), SCHEDULE_INTERVAL);
  }

  private stopScheduler(): void {
    if (this.schedulerTimer !== null) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  private schedule(): void {
    if (!this.isPlaying) return;

    // Drift correction — runs in the SAME timer as scheduling (no race condition).
    // Only when we have a beat map AND a track position source.
    if (this.trackPositionGetter && this.beatMap && this.beatMap.length > 0) {
      const trackPos = this.trackPositionGetter();
      if (trackPos > 0) {
        this.resyncToPosition(trackPos);
      }
    }

    const ctx = AudioEngine.getContext();
    const deadline = ctx.currentTime + LOOKAHEAD_SEC;

    while (this.nextBeatTime < deadline) {
      this.scheduleClick(this.nextBeatTime);
      this.advanceBeat();
    }
  }

  private scheduleClick(time: number): void {
    const ctx = AudioEngine.getContext();
    const masterGain = AudioEngine.getMasterGain();
    const { subdivision, swingPercent, accentPattern } = this.config;
    const isDownbeat = this.currentBeat === 0;

    // Check accent pattern — 0 means silent
    let shouldSound = true;
    if (accentPattern.length > 0 && this.currentBeat < accentPattern.length) {
      shouldSound = accentPattern[this.currentBeat] > 0;
    }

    // Schedule primary click — use OscillatorNode directly (S55 fix: BufferSource was silent)
    // Muted = skip audio but still fire beat events (scheduler always runs)
    if (shouldSound && !this.muted) {
      const freq = CLICK_FREQS[this.config.clickSound]?.up ?? 440; // D-159: all beats identical (up pitch)
      const osc = ctx.createOscillator();
      osc.frequency.value = freq;
      const envGain = ctx.createGain();
      envGain.gain.setValueAtTime(this.config.gain * 0.7, time);
      envGain.gain.exponentialRampToValueAtTime(0.001, time + CLICK_DURATION);
      osc.connect(envGain);
      envGain.connect(masterGain);
      osc.start(time);
      osc.stop(time + CLICK_DURATION);
    }

    // Queue beat event for frame-accurate UI sync (D-161 pattern)
    // Instead of setTimeout (4-8ms jitter), queue the event with its scheduled time.
    // The rAF tick loop polls and emits when ctx.currentTime passes the beat time,
    // giving 0-16ms visual jitter (one frame) — same as Android's atomic counter polling.
    const beatEvent: BeatEvent = {
      beat: this.currentBeat,
      bar: this.currentBar,
      isDownbeat,
      time,
    };
    AudioEngine.queueBeat(time, beatEvent);

    // Schedule subdivision clicks (skip when muted)
    if (subdivision > 1 && !this.muted) {
      this.scheduleSubdivisions(time, subdivision, swingPercent, masterGain);
    }
  }

  private scheduleSubdivisions(
    beatTime: number,
    divisor: number,
    swingPct: number,
    destination: AudioNode,
  ): void {
    const ctx = AudioEngine.getContext();
    const beatDuration = this.getSecondsPerBeat();
    const applySwing = swingPct !== 50 && divisor !== 3 && divisor !== 5;

    for (let i = 1; i < divisor; i++) {
      let subTime: number;
      if (applySwing && i % 2 === 1) {
        // Swing: odd subdivisions are delayed
        const pairBase = i - 1;
        const pairStart = beatTime + (pairBase * beatDuration) / divisor;
        const pairDuration = (2 * beatDuration) / divisor;
        subTime = pairStart + pairDuration * (swingPct / 100);
      } else {
        subTime = beatTime + (i * beatDuration) / divisor;
      }

      const freq = CLICK_FREQS[this.config.clickSound]?.up ?? 440;
      const osc = ctx.createOscillator();
      osc.frequency.value = freq;
      const envGain = ctx.createGain();
      envGain.gain.setValueAtTime(this.config.gain * 0.4 * 0.7, subTime); // 40% of main (matches C++ SUB_CLICK_GAIN)
      envGain.gain.exponentialRampToValueAtTime(0.001, subTime + CLICK_DURATION);
      osc.connect(envGain);
      envGain.connect(destination);
      osc.start(subTime);
      osc.stop(subTime + CLICK_DURATION);
    }
  }

  private advanceBeat(): void {
    const { timeSignatureTop } = this.config;

    if (this.isCountingIn) {
      this.countInBeatsRemaining--;
      if (this.countInBeatsRemaining <= 0) {
        this.isCountingIn = false;
        this.currentBeat = 0;
        this.currentBar = 0;
      } else {
        this.currentBeat = (this.currentBeat + 1) % timeSignatureTop;
        if (this.currentBeat === 0) this.currentBar++;
      }
    } else {
      this.currentBeat++;
      if (this.currentBeat >= timeSignatureTop) {
        this.currentBeat = 0;
        this.currentBar++;
      }
    }

    // Compute next beat time
    if (this.beatMap && this.beatMapIndex < this.beatMap.length - 1) {
      // Beat map mode — scale intervals by 1/speed (mirrors C++ resyncBeatMap)
      this.beatMapIndex++;
      if (this.beatMapIndex < this.beatMap.length) {
        const prevBeatSec = this.beatMap[this.beatMapIndex - 1];
        const nextBeatSec = this.beatMap[this.beatMapIndex];
        this.nextBeatTime += (nextBeatSec - prevBeatSec) / this.speed;
      } else {
        // Beat map exhausted — fall back to constant BPM
        this.beatMap = null;
        this.nextBeatTime += this.getSecondsPerBeat();
      }
    } else {
      // Constant BPM mode
      if (this.beatMap) {
        // Just passed the last beat map entry
        this.beatMap = null;
      }
      this.nextBeatTime += this.getSecondsPerBeat();
    }
  }

  private getSecondsPerBeat(): number {
    const bpm = this.config.bpm || 120; // safety: avoid Infinity from 0/null
    return 60 / bpm;
  }

}

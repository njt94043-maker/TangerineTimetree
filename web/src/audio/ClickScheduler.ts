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

  // Beat map mode
  private beatMap: number[] | null = null; // seconds (float array from Supabase)
  private beatMapIndex = 0;

  // Count-in tracking
  private isCountingIn = false;
  private countInBeatsRemaining = 0;

  // Pre-rendered click buffers (lazily created per AudioContext sample rate)
  private clickBuffers: Map<string, AudioBuffer> = new Map();
  private lastSampleRate = 0;

  configure(partial: Partial<ClickConfig>): void {
    Object.assign(this.config, partial);
  }

  getConfig(): Readonly<ClickConfig> {
    return this.config;
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

    if (this.beatMap && this.beatMap.length > 0) {
      // Beat map mode: first beat at beatMap[0] + offset
      this.beatMapIndex = 0;
      this.nextBeatTime = now + this.beatMap[0] + offsetSec;
    } else {
      // Constant BPM mode
      this.nextBeatTime = now + offsetSec;
    }

    this.ensureClickBuffers(ctx);
    this.startScheduler();
  }

  stop(): void {
    this.isPlaying = false;
    this.stopScheduler();
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

    // Schedule primary click
    if (shouldSound) {
      const buffer = this.getClickBuffer(ctx, isDownbeat);
      if (buffer) {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const gainNode = ctx.createGain();
        gainNode.gain.value = this.config.gain;
        source.connect(gainNode);
        gainNode.connect(masterGain);
        source.start(time);
      }
    }

    // Emit beat event for UI (flash, beat counter)
    const beatEvent: BeatEvent = {
      beat: this.currentBeat,
      bar: this.currentBar,
      isDownbeat,
      time,
    };
    // Schedule the emit close to the actual beat time
    const delay = Math.max(0, (time - ctx.currentTime) * 1000);
    setTimeout(() => AudioEngine.emitBeat(beatEvent), delay);

    // Schedule subdivision clicks
    if (subdivision > 1) {
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

      const buffer = this.getClickBuffer(ctx, false);
      if (buffer) {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const gainNode = ctx.createGain();
        gainNode.gain.value = this.config.gain * 0.4; // Subdiv at 40% (matches C++ SUB_CLICK_GAIN)
        source.connect(gainNode);
        gainNode.connect(destination);
        source.start(subTime);
      }
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
      // Beat map mode
      this.beatMapIndex++;
      if (this.beatMapIndex < this.beatMap.length) {
        const prevBeatSec = this.beatMap[this.beatMapIndex - 1];
        const nextBeatSec = this.beatMap[this.beatMapIndex];
        this.nextBeatTime += (nextBeatSec - prevBeatSec);
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
    return 60 / this.config.bpm;
  }

  // --- Click sound generation ---

  private ensureClickBuffers(ctx: AudioContext): void {
    if (ctx.sampleRate === this.lastSampleRate && this.clickBuffers.size > 0) return;
    this.lastSampleRate = ctx.sampleRate;
    this.clickBuffers.clear();

    // Pre-render all click types at both pitches
    for (const [name, freqs] of Object.entries(CLICK_FREQS)) {
      this.clickBuffers.set(`${name}-down`, this.renderClick(ctx, freqs.down, name as ClickSound, true));
      this.clickBuffers.set(`${name}-up`, this.renderClick(ctx, freqs.up, name as ClickSound, false));
    }
  }

  private renderClick(ctx: AudioContext, freq: number, type: ClickSound, _isDownbeat: boolean): AudioBuffer {
    const sr = ctx.sampleRate;
    const frames = Math.ceil(CLICK_DURATION * sr);
    const buffer = ctx.createBuffer(1, frames, sr);
    const data = buffer.getChannelData(0);
    const twoPi = 2 * Math.PI;
    const amplitude = 0.7;

    for (let i = 0; i < frames; i++) {
      const t = i / frames; // 0-1 progress
      const si = i;

      let sample: number;
      switch (type) {
        case 'wood': {
          const f1 = freq;
          const f2 = f1 * 1.63;
          const f3 = f1 * 2.67;
          const s1 = Math.sin(twoPi * f1 * si / sr);
          const s2 = Math.sin(twoPi * f2 * si / sr) * 0.6;
          const s3 = Math.sin(twoPi * f3 * si / sr) * 0.3;
          sample = s1 + s2 + s3;
          let env = Math.exp(-8 * t);
          if (t < 0.02) env *= t / 0.02;
          sample *= env * amplitude * 0.4;
          break;
        }
        case 'rim': {
          const f1 = freq;
          const f2 = f1 * 2.4;
          const tone = Math.sin(twoPi * f1 * si / sr) * 0.5
                     + Math.sin(twoPi * f2 * si / sr) * 0.3;
          const noise = Math.sin(twoPi * 3517 * si / sr) * 0.3
                      + Math.sin(twoPi * 5471 * si / sr) * 0.2
                      + Math.sin(twoPi * 7919 * si / sr) * 0.1;
          sample = tone + noise;
          let env = Math.exp(-12 * t);
          if (t < 0.01) env *= t / 0.01;
          sample *= env * amplitude * 0.5;
          break;
        }
        default: {
          // default, high, low — pure sine with envelope
          sample = Math.sin(twoPi * freq * si / sr);
          let env = 1.0;
          if (t < 0.05) env = t / 0.05;
          else if (t > 0.7) env = 1.0 - (t - 0.7) / 0.3;
          sample *= env * amplitude;
          break;
        }
      }
      data[i] = sample;
    }
    return buffer;
  }

  private getClickBuffer(ctx: AudioContext, isDownbeat: boolean): AudioBuffer | null {
    this.ensureClickBuffers(ctx);
    const key = `${this.config.clickSound}-${isDownbeat ? 'down' : 'up'}`;
    return this.clickBuffers.get(key) ?? null;
  }
}

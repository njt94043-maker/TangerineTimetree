/**
 * AudioEngine — Web Audio API core for Tangerine Timetree.
 *
 * Singleton that owns the AudioContext and coordinates:
 *   - ClickScheduler (metronome)
 *   - TrackPlayer (practice track playback via SoundTouchJS)
 *   - StemMixer (per-stem gain nodes)
 *
 * All timing derives from AudioContext.currentTime (hardware clock).
 * Created on first user gesture (play button), resumed/suspended as needed.
 */

export type EngineState = 'idle' | 'playing' | 'paused';

export interface BeatEvent {
  beat: number;       // 0-based beat in bar
  bar: number;        // 0-based bar count
  isDownbeat: boolean;
  time: number;       // AudioContext time of this beat
}

export type EngineListener = {
  onBeat?: (event: BeatEvent) => void;
  onStateChange?: (state: EngineState) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onSongComplete?: () => void;
};

class AudioEngineImpl {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private fftData: Uint8Array<ArrayBuffer> | null = null;
  private state: EngineState = 'idle';
  private listeners: Set<EngineListener> = new Set();

  // Tick loop for UI updates
  private tickRaf: number = 0;

  // Beat event queue — frame-accurate visual sync (matches Android D-161 pattern)
  // Beats are queued with their scheduled AudioContext time, then emitted in the
  // rAF tick loop when ctx.currentTime passes their time. This gives 0-16ms visual
  // jitter (one frame), matching Android's atomic counter polling approach.
  private pendingBeats: Array<{ time: number; event: BeatEvent }> = [];

  getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 1.0;

      // AnalyserNode for real-time FFT data (visualiser)
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64; // 32 frequency bins — enough for 16-bar spectrum
      this.analyser.smoothingTimeConstant = 0.7;
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      this.fftData = new Uint8Array(this.analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;
    }
    return this.ctx;
  }

  getMasterGain(): GainNode {
    this.getContext();
    return this.masterGain!;
  }

  /**
   * Get current FFT frequency data (0-255 per bin).
   * Returns null if no audio context exists.
   */
  getFrequencyData(): Uint8Array | null {
    if (!this.analyser || !this.fftData) return null;
    this.analyser.getByteFrequencyData(this.fftData);
    return this.fftData;
  }

  getState(): EngineState {
    return this.state;
  }

  setState(newState: EngineState): void {
    if (this.state === newState) return;
    this.state = newState;
    for (const l of this.listeners) l.onStateChange?.(newState);
  }

  addListener(listener: EngineListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emitBeat(event: BeatEvent): void {
    for (const l of this.listeners) l.onBeat?.(event);
  }

  /**
   * Queue a beat event for frame-accurate emission.
   * Called by ClickScheduler when scheduling a click sound.
   * The event is emitted in the rAF tick loop when ctx.currentTime >= time.
   */
  queueBeat(time: number, event: BeatEvent): void {
    this.pendingBeats.push({ time, event });
  }

  /**
   * Poll queued beats — emit any whose scheduled time has passed.
   * Called from the rAF tick loop for frame-accurate visual sync.
   */
  pollBeats(): void {
    if (!this.ctx || this.pendingBeats.length === 0) return;
    const now = this.ctx.currentTime;
    while (this.pendingBeats.length > 0 && this.pendingBeats[0].time <= now) {
      const { event } = this.pendingBeats.shift()!;
      this.emitBeat(event);
    }
  }

  emitTimeUpdate(currentTime: number, duration: number): void {
    for (const l of this.listeners) l.onTimeUpdate?.(currentTime, duration);
  }

  emitSongComplete(): void {
    for (const l of this.listeners) l.onSongComplete?.();
  }

  async resume(): Promise<void> {
    const ctx = this.getContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
  }

  async suspend(): Promise<void> {
    if (this.ctx && this.ctx.state === 'running') {
      await this.ctx.suspend();
    }
  }

  startTick(callback: () => void): void {
    this.stopTick();
    const tick = () => {
      callback();
      this.tickRaf = requestAnimationFrame(tick);
    };
    this.tickRaf = requestAnimationFrame(tick);
  }

  stopTick(): void {
    if (this.tickRaf) {
      cancelAnimationFrame(this.tickRaf);
      this.tickRaf = 0;
    }
    // Clear any queued beats that haven't fired yet
    this.pendingBeats.length = 0;
  }

  /**
   * Full teardown — call when navigating away from player.
   * Does NOT destroy the AudioContext (expensive to recreate).
   * Just stops the tick loop and resets state.
   */
  reset(): void {
    this.stopTick();
    this.setState('idle');
    this.pendingBeats.length = 0;
  }
}

// Singleton
export const AudioEngine = new AudioEngineImpl();

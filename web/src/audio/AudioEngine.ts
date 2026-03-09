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
  private state: EngineState = 'idle';
  private listeners: Set<EngineListener> = new Set();

  // Tick loop for UI updates
  private tickRaf: number = 0;

  getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 1.0;
      this.masterGain.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  getMasterGain(): GainNode {
    this.getContext();
    return this.masterGain!;
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
  }

  /**
   * Full teardown — call when navigating away from player.
   * Does NOT destroy the AudioContext (expensive to recreate).
   * Just stops the tick loop and resets state.
   */
  reset(): void {
    this.stopTick();
    this.setState('idle');
  }
}

// Singleton
export const AudioEngine = new AudioEngineImpl();

/**
 * TrackPlayer — Practice track playback with pitch-preserved speed control.
 *
 * Uses SoundTouchJS PitchShifter for time-stretch without pitch change.
 * Handles: fetch + decode audio, speed control, A-B loop, position tracking.
 *
 * Audio graph:
 *   PitchShifter (ScriptProcessor) → GainNode → destination (master gain)
 */

import { PitchShifter } from 'soundtouchjs';
import { AudioEngine } from './AudioEngine';

export interface LoopRegion {
  start: number; // seconds
  end: number;   // seconds
}

export class TrackPlayer {
  private buffer: AudioBuffer | null = null;
  private shifter: PitchShifter | null = null;
  private gainNode: GainNode | null = null;
  private speed = 1.0;
  private loop: LoopRegion | null = null;
  private playing = false;
  private startOffset = 0;   // Track time offset at start

  // Cache decoded buffers by URL to avoid re-fetching
  private static bufferCache = new Map<string, AudioBuffer>();

  async load(url: string): Promise<void> {
    const ctx = AudioEngine.getContext();

    // Check cache
    let buffer = TrackPlayer.bufferCache.get(url);
    if (!buffer) {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch audio: ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      buffer = await ctx.decodeAudioData(arrayBuffer);
      TrackPlayer.bufferCache.set(url, buffer);
    }

    this.buffer = buffer;
  }

  isLoaded(): boolean {
    return this.buffer !== null;
  }

  getBuffer(): AudioBuffer | null {
    return this.buffer;
  }

  getDuration(): number {
    return this.buffer?.duration ?? 0;
  }

  getSpeed(): number {
    return this.speed;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  /**
   * Get current playback position in seconds (accounting for speed).
   */
  getPosition(): number {
    if (!this.shifter || !this.playing) return this.startOffset;
    const ctx = AudioEngine.getContext();
    // PitchShifter tracks sourcePosition in samples
    return this.shifter.sourcePosition / ctx.sampleRate;
  }

  setSpeed(speed: number): void {
    this.speed = Math.max(0.25, Math.min(2.0, speed));
    if (this.shifter) {
      this.shifter.tempo = this.speed;
    }
  }

  setLoop(region: LoopRegion | null): void {
    this.loop = region;
  }

  setGain(value: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, value));
    }
  }

  play(fromPosition?: number): void {
    if (!this.buffer) return;
    this.stop();

    const ctx = AudioEngine.getContext();
    const masterGain = AudioEngine.getMasterGain();

    // Create gain node
    this.gainNode = ctx.createGain();
    this.gainNode.gain.value = 1.0;
    this.gainNode.connect(masterGain);

    // Create PitchShifter
    this.shifter = new PitchShifter(ctx, this.buffer, 4096, () => {
      // onEnd callback — track finished
      this.playing = false;
      AudioEngine.emitSongComplete();
    });
    this.shifter.tempo = this.speed;
    this.shifter.connect(this.gainNode);

    // Seek to position if specified
    if (fromPosition !== undefined && fromPosition > 0) {
      this.shifter.percentagePlayed = (fromPosition / this.buffer.duration) * 100;
      this.startOffset = fromPosition;
    } else {
      this.startOffset = 0;
    }

    this.playing = true;
  }

  pause(): void {
    if (!this.playing || !this.shifter) return;
    this.startOffset = this.getPosition();
    this.destroyShifter();
    this.playing = false;
  }

  stop(): void {
    this.destroyShifter();
    this.playing = false;
    this.startOffset = 0;
  }

  /**
   * Seek to a position in seconds.
   * If playing, restarts from that position.
   */
  seek(positionSec: number): void {
    const wasPlaying = this.playing;
    this.stop();
    this.startOffset = Math.max(0, Math.min(positionSec, this.getDuration()));
    if (wasPlaying) {
      this.play(this.startOffset);
    }
  }

  /**
   * Check loop boundaries — call from tick loop.
   * Returns true if a loop jump occurred.
   */
  checkLoop(): boolean {
    if (!this.loop || !this.playing) return false;
    const pos = this.getPosition();
    if (pos >= this.loop.end) {
      this.seek(this.loop.start);
      return true;
    }
    return false;
  }

  /**
   * Release all audio resources.
   */
  dispose(): void {
    this.stop();
    this.buffer = null;
  }

  private destroyShifter(): void {
    if (this.shifter) {
      this.shifter.disconnect();
      this.shifter = null;
    }
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
  }

  /**
   * Clear the buffer cache (call when navigating away from player to free memory).
   */
  static clearCache(): void {
    TrackPlayer.bufferCache.clear();
  }
}

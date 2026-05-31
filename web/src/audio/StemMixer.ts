/**
 * StemMixer — Per-stem gain control for practice mode.
 *
 * Each stem (drums, bass, vocals, guitar, keys, other) gets its own
 * TrackPlayer + GainNode. All stems play in sync at the same speed.
 *
 * Audio graph per stem:
 *   PitchShifter → StemGainNode → MixerOutput (master gain)
 */

import { TrackPlayer, type LoopRegion } from './TrackPlayer';

// S191 batch B (D-batchB-schema-1): widened with 'lead' + 'bv' so the practice mixer's
// multitrack grade (drums / bass / guitar / lead / bv / other — matches the S190 mockup)
// can flow through the same loadStems()/setStemGain() surface as Demucs. Additive only —
// the base labels (drums / bass / vocals / guitar / keys / other) keep working unchanged.
export type StemLabel = 'drums' | 'bass' | 'vocals' | 'guitar' | 'keys' | 'backing' | 'other' | 'lead' | 'bv';

export interface StemChannel {
  label: StemLabel;
  url: string;
  player: TrackPlayer;
  gain: number;    // 0-1
  muted: boolean;
  solo: boolean;
}

export class StemMixer {
  private channels: StemChannel[] = [];
  private speed = 1.0;
  private semitones = 0;
  private loop: LoopRegion | null = null;

  /**
   * Load stems from URLs. Call before play().
   * Loads in parallel for speed. Only loads stems that have URLs.
   */
  async loadStems(stems: Array<{ label: StemLabel; url: string }>): Promise<void> {
    this.dispose();

    const channels: StemChannel[] = stems.map(s => ({
      label: s.label,
      url: s.url,
      player: new TrackPlayer(),
      gain: 1.0,
      muted: false,
      solo: false,
    }));

    // Load all stems in parallel
    await Promise.all(
      channels.map(ch => ch.player.load(ch.url))
    );

    this.channels = channels;
  }

  getChannels(): ReadonlyArray<Readonly<StemChannel>> {
    return this.channels;
  }

  isLoaded(): boolean {
    return this.channels.length > 0 && this.channels.every(ch => ch.player.isLoaded());
  }

  getDuration(): number {
    if (this.channels.length === 0) return 0;
    return Math.max(...this.channels.map(ch => ch.player.getDuration()));
  }

  /** Get the audio buffer of the first stem (for waveform rendering). */
  getBuffer(): AudioBuffer | null {
    if (this.channels.length === 0) return null;
    return this.channels[0].player.getBuffer();
  }

  getPosition(): number {
    if (this.channels.length === 0) return 0;
    return this.channels[0].player.getPosition();
  }

  isPlaying(): boolean {
    return this.channels.length > 0 && this.channels[0].player.isPlaying();
  }

  setSpeed(speed: number): void {
    this.speed = speed;
    for (const ch of this.channels) {
      ch.player.setSpeed(speed);
    }
  }

  getSpeed(): number {
    return this.speed;
  }

  /**
   * Set pitch shift in semitones, independent of tempo. Applied to every
   * stem so the mix stays balanced.
   */
  setSemitones(n: number): void {
    this.semitones = n;
    for (const ch of this.channels) {
      ch.player.setSemitones(n);
    }
  }

  getSemitones(): number {
    return this.semitones;
  }

  /**
   * Read per-stem peak level in dB for meter rendering.
   * Returns -Infinity when the stem isn't playing or has no signal.
   */
  getMeterDb(label: StemLabel): number {
    const ch = this.channels.find(c => c.label === label);
    return ch ? ch.player.getMeterDb() : -Infinity;
  }

  setLoop(region: LoopRegion | null): void {
    this.loop = region;
    for (const ch of this.channels) {
      ch.player.setLoop(region);
    }
  }

  /**
   * Set gain for a specific stem. Respects mute/solo state.
   */
  setStemGain(label: StemLabel, gain: number): void {
    const ch = this.channels.find(c => c.label === label);
    if (!ch) return;
    ch.gain = Math.max(0, Math.min(1, gain));
    this.applyGains();
  }

  /**
   * Toggle mute for a stem.
   */
  toggleMute(label: StemLabel): void {
    const ch = this.channels.find(c => c.label === label);
    if (!ch) return;
    ch.muted = !ch.muted;
    ch.solo = false; // mute cancels solo
    this.applyGains();
  }

  /**
   * Toggle solo for a stem. Only one stem can be solo at a time.
   */
  toggleSolo(label: StemLabel): void {
    const ch = this.channels.find(c => c.label === label);
    if (!ch) return;

    if (ch.solo) {
      // Unsolo — restore all
      ch.solo = false;
    } else {
      // Solo this one — unsolo others
      for (const c of this.channels) c.solo = false;
      ch.solo = true;
      ch.muted = false;
    }
    this.applyGains();
  }

  /**
   * Auto-mute a stem by label (used for player_drums_enabled pref).
   */
  setMuted(label: StemLabel, muted: boolean): void {
    const ch = this.channels.find(c => c.label === label);
    if (!ch) return;
    ch.muted = muted;
    this.applyGains();
  }

  play(fromPosition?: number): void {
    for (const ch of this.channels) {
      ch.player.play(fromPosition);
    }
    this.applyGains();
  }

  pause(): void {
    for (const ch of this.channels) {
      ch.player.pause();
    }
  }

  stop(): void {
    for (const ch of this.channels) {
      ch.player.stop();
    }
  }

  seek(positionSec: number): void {
    for (const ch of this.channels) {
      ch.player.seek(positionSec);
    }
  }

  /**
   * Check loop boundaries on all stems — call from tick loop.
   */
  checkLoop(): boolean {
    if (!this.loop) return false;
    const pos = this.getPosition();
    if (pos >= this.loop.end) {
      this.seek(this.loop.start);
      return true;
    }
    return false;
  }

  dispose(): void {
    for (const ch of this.channels) {
      ch.player.dispose();
    }
    this.channels = [];
  }

  private applyGains(): void {
    const hasSolo = this.channels.some(c => c.solo);

    for (const ch of this.channels) {
      let effectiveGain: number;
      if (hasSolo) {
        effectiveGain = ch.solo ? ch.gain : 0;
      } else {
        effectiveGain = ch.muted ? 0 : ch.gain;
      }
      ch.player.setGain(effectiveGain);
    }
  }
}

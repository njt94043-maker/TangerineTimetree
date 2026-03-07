import * as ClickEngineNative from '../../modules/click-engine';
import type { Song, ClickSound } from '@shared/supabase/types';
import type { TrackLoadResult, BeatAnalysisResult } from '../../modules/click-engine';

export { ClickEngineNative };
export type { TrackLoadResult, BeatAnalysisResult };

const CLICK_SOUND_MAP: Record<ClickSound, number> = {
  default: ClickEngineNative.CLICK_DEFAULT,
  high: ClickEngineNative.CLICK_HIGH,
  low: ClickEngineNative.CLICK_LOW,
  wood: ClickEngineNative.CLICK_WOOD,
  rim: ClickEngineNative.CLICK_RIM,
};

/**
 * Configure the click engine from a Song's stored settings.
 * Call after startEngine() and before startClick().
 */
export function loadSong(song: Song): void {
  ClickEngineNative.setBpm(song.bpm);
  ClickEngineNative.setTimeSignature(song.time_signature_top, song.time_signature_bottom);
  ClickEngineNative.setSubdivision(song.subdivision);
  ClickEngineNative.setSwing(song.swing_percent);
  ClickEngineNative.setClickSound(CLICK_SOUND_MAP[song.click_sound] ?? 0);
  ClickEngineNative.setCountIn(song.count_in_bars, ClickEngineNative.CLICK_HIGH);

  if (song.accent_pattern) {
    const pattern = song.accent_pattern.split(',').map(Number);
    ClickEngineNative.setAccentPattern(pattern);
  }
}

/**
 * Load a practice track for a song.
 * Downloads from Supabase Storage URL, decodes MP3 to PCM, loads into C++ engine.
 * Also runs beat analysis and returns detected BPM + beat offset.
 */
export async function loadPracticeTrack(audioUrl: string): Promise<TrackLoadResult & BeatAnalysisResult> {
  const trackInfo = await ClickEngineNative.loadTrackFromUrl(audioUrl);
  const analysis = await ClickEngineNative.analyseTrack();
  return { ...trackInfo, ...analysis };
}

/**
 * Set playback speed — adjusts both track tempo (pitch-preserved) and metronome BPM.
 * @param ratio 0.5 = half speed, 1.0 = normal, 2.0 = double
 */
export function setSpeed(ratio: number): void {
  ClickEngineNative.setTrackSpeed(ratio);
}

/**
 * Nudge the click forward or backward by one beat.
 * For manual click-to-track alignment.
 */
export function nudgeClickForward(): void {
  ClickEngineNative.nudgeClick(1);
}

export function nudgeClickBackward(): void {
  ClickEngineNative.nudgeClick(-1);
}

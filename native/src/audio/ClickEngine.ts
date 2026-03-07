import * as ClickEngineNative from '../../modules/click-engine';
import type { Song, ClickSound } from '@shared/supabase/types';

export { ClickEngineNative };

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

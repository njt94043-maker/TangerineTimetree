import ClickEngineModule from './src/ClickEngineModule';

// --- Engine lifecycle ---

export function startEngine(sampleRate: number, framesPerBuffer: number): boolean {
  return ClickEngineModule.startEngine(sampleRate, framesPerBuffer);
}

export function stopEngine(): void {
  ClickEngineModule.stopEngine();
}

// --- Metronome ---

export function setBpm(bpm: number): void {
  ClickEngineModule.setBpm(bpm);
}

export function setTimeSignature(beatsPerBar: number, beatUnit: number): void {
  ClickEngineModule.setTimeSignature(beatsPerBar, beatUnit);
}

export function setAccentPattern(pattern: number[]): void {
  ClickEngineModule.setAccentPattern(pattern);
}

export function setClickSound(type: number): void {
  ClickEngineModule.setClickSound(type);
}

export function setCountIn(bars: number, clickType: number): void {
  ClickEngineModule.setCountIn(bars, clickType);
}

export function startClick(): void {
  ClickEngineModule.startClick();
}

export function stopClick(): void {
  ClickEngineModule.stopClick();
}

export function getCurrentBeat(): number {
  return ClickEngineModule.getCurrentBeat();
}

export function getCurrentBar(): number {
  return ClickEngineModule.getCurrentBar();
}

export function isPlaying(): boolean {
  return ClickEngineModule.isPlaying();
}

// --- Practice mode ---

export function setSubdivision(divisor: number): void {
  ClickEngineModule.setSubdivision(divisor);
}

export function setSwing(percent: number): void {
  ClickEngineModule.setSwing(percent);
}

// --- Mixer ---

export function setChannelGain(channel: number, gain: number): void {
  ClickEngineModule.setChannelGain(channel, gain);
}

export function setMasterGain(gain: number): void {
  ClickEngineModule.setMasterGain(gain);
}

export function setSplitStereo(enabled: boolean): void {
  ClickEngineModule.setSplitStereo(enabled);
}

// Click sound type constants
export const CLICK_DEFAULT = 0;
export const CLICK_HIGH = 1;
export const CLICK_LOW = 2;
export const CLICK_WOOD = 3;
export const CLICK_RIM = 4;

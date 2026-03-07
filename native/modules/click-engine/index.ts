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

// --- Track Player ---

export interface TrackLoadResult {
  numFrames: number;
  sampleRate: number;
  channels: number;
  durationMs: number;
}

export interface BeatAnalysisResult {
  bpm: number;
  beatOffsetMs: number;
}

export async function loadTrackFromUrl(url: string): Promise<TrackLoadResult> {
  return ClickEngineModule.loadTrackFromUrl(url);
}

export async function loadTrackFromFile(filePath: string): Promise<TrackLoadResult> {
  return ClickEngineModule.loadTrackFromFile(filePath);
}

export function playTrack(): void {
  ClickEngineModule.playTrack();
}

export function pauseTrack(): void {
  ClickEngineModule.pauseTrack();
}

export function stopTrack(): void {
  ClickEngineModule.stopTrack();
}

export function seekTrack(frame: number): void {
  ClickEngineModule.seekTrack(frame);
}

export function setLoopRegion(startFrame: number, endFrame: number): void {
  ClickEngineModule.setLoopRegion(startFrame, endFrame);
}

export function clearLoopRegion(): void {
  ClickEngineModule.clearLoopRegion();
}

export function getTrackPosition(): number {
  return ClickEngineModule.getTrackPosition();
}

export function getTrackTotalFrames(): number {
  return ClickEngineModule.getTrackTotalFrames();
}

export function isTrackLoaded(): boolean {
  return ClickEngineModule.isTrackLoaded();
}

export function setTrackSpeed(ratio: number): void {
  ClickEngineModule.setTrackSpeed(ratio);
}

export function getTrackSpeed(): number {
  return ClickEngineModule.getTrackSpeed();
}

export function nudgeClick(direction: number): void {
  ClickEngineModule.nudgeClick(direction);
}

export async function analyseTrack(): Promise<BeatAnalysisResult> {
  return ClickEngineModule.analyseTrack();
}

// Click sound type constants
export const CLICK_DEFAULT = 0;
export const CLICK_HIGH = 1;
export const CLICK_LOW = 2;
export const CLICK_WOOD = 3;
export const CLICK_RIM = 4;

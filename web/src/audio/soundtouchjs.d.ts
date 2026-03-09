declare module 'soundtouchjs' {
  export class SoundTouch {
    tempo: number;
    rate: number;
    pitch: number;
    pitchSemitones: number;
    clear(): void;
  }

  export class SimpleFilter {
    constructor(source: WebAudioBufferSource, pipe: SoundTouch, onEnd?: () => void);
    sourcePosition: number;
    extract(target: Float32Array, numFrames: number): number;
  }

  export class WebAudioBufferSource {
    constructor(buffer: AudioBuffer);
    position: number;
    extract(target: Float32Array, numFrames: number, position: number): number;
  }

  export class PitchShifter {
    constructor(context: AudioContext, buffer: AudioBuffer, bufferSize: number, onEnd?: () => void);
    tempo: number;
    rate: number;
    pitch: number;
    pitchSemitones: number;
    duration: number;
    sampleRate: number;
    timePlayed: number;
    sourcePosition: number;
    percentagePlayed: number;
    formattedDuration: string;
    formattedTimePlayed: string;
    connect(destination: AudioNode): void;
    disconnect(): void;
    on(event: string, callback: () => void): void;
    off(event: string, callback: () => void): void;
  }

  export function getWebAudioNode(
    context: AudioContext,
    filter: SimpleFilter,
    sourcePositionCallback?: (position: number) => void,
    bufferSize?: number,
  ): ScriptProcessorNode;
}

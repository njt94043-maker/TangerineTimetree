package com.thegreentangerine.gigbooks.audio

/**
 * JNI bridge to C++ AudioEngine (Oboe + SoundTouch).
 * Direct JNI — no React Native / Expo bridge overhead.
 */
object AudioEngineBridge {

    init {
        System.loadLibrary("clickengine")
    }

    // --- Engine lifecycle ---
    external fun nativeStartEngine(sampleRate: Int, framesPerBuffer: Int): Boolean
    external fun nativeStopEngine()

    // --- Metronome ---
    external fun nativeSetBpm(bpm: Float)
    external fun nativeSetTimeSignature(beatsPerBar: Int, beatUnit: Int)
    external fun nativeSetAccentPattern(pattern: IntArray)
    external fun nativeSetClickSound(type: Int)
    external fun nativeSetCountIn(bars: Int, clickType: Int)
    external fun nativeStartClick()
    external fun nativeStopClick()
    external fun nativeGetCurrentBeat(): Int
    external fun nativeGetCurrentBar(): Int
    external fun nativeIsPlaying(): Boolean

    // --- Practice mode ---
    external fun nativeSetSubdivision(divisor: Int)
    external fun nativeSetSwing(percent: Float)

    // --- Mixer ---
    external fun nativeSetChannelGain(channel: Int, gain: Float)
    external fun nativeSetMasterGain(gain: Float)
    external fun nativeSetSplitStereo(enabled: Boolean)

    // --- Track Player ---
    external fun nativeLoadTrack(pcmData: FloatArray, numFrames: Int, sampleRate: Int, channels: Int)
    external fun nativePlayTrack()
    external fun nativePauseTrack()
    external fun nativeStopTrack()
    external fun nativeSeekTrack(frame: Long)
    external fun nativeSetLoopRegion(startFrame: Long, endFrame: Long)
    external fun nativeClearLoopRegion()
    external fun nativeGetTrackPosition(): Long
    external fun nativeGetTrackTotalFrames(): Long
    external fun nativeIsTrackLoaded(): Boolean
    external fun nativeSetTrackSpeed(ratio: Float)
    external fun nativeGetTrackSpeed(): Float
    external fun nativeNudgeClick(direction: Int)

    // --- Stem Players (ch2..ch7; idx: 0=DRUMS 1=BASS 2=GUITAR 3=KEYS 4=VOCALS 5=OTHER) ---
    external fun nativeLoadStem(idx: Int, pcmData: FloatArray, numFrames: Int, sampleRate: Int, channels: Int)
    external fun nativeClearStem(idx: Int)
    external fun nativeClearAllStems()

    // --- Beat Detection ---
    external fun nativeAnalyseTrack(): FloatArray // [bpm, beatOffsetMs]
}

package com.tgtent.gigbooks.clickengine

/**
 * JNI bridge to the C++ audio engine.
 * All native methods are static — the C++ engine is a singleton.
 */
object ClickEngineBridge {
    init {
        System.loadLibrary("clickengine")
    }

    @JvmStatic external fun nativeStartEngine(sampleRate: Int, framesPerBuffer: Int): Boolean
    @JvmStatic external fun nativeStopEngine()

    @JvmStatic external fun nativeSetBpm(bpm: Float)
    @JvmStatic external fun nativeSetTimeSignature(beatsPerBar: Int, beatUnit: Int)
    @JvmStatic external fun nativeSetAccentPattern(pattern: IntArray)
    @JvmStatic external fun nativeSetClickSound(type: Int)
    @JvmStatic external fun nativeSetCountIn(bars: Int, clickType: Int)

    @JvmStatic external fun nativeStartClick()
    @JvmStatic external fun nativeStopClick()

    @JvmStatic external fun nativeGetCurrentBeat(): Int
    @JvmStatic external fun nativeGetCurrentBar(): Int
    @JvmStatic external fun nativeIsPlaying(): Boolean

    @JvmStatic external fun nativeSetSubdivision(divisor: Int)
    @JvmStatic external fun nativeSetSwing(percent: Float)

    @JvmStatic external fun nativeSetChannelGain(channel: Int, gain: Float)
    @JvmStatic external fun nativeSetMasterGain(gain: Float)
    @JvmStatic external fun nativeSetSplitStereo(enabled: Boolean)

    // Track player
    @JvmStatic external fun nativeLoadTrack(pcmData: FloatArray, numFrames: Int, sampleRate: Int, channels: Int)
    @JvmStatic external fun nativePlayTrack()
    @JvmStatic external fun nativePauseTrack()
    @JvmStatic external fun nativeStopTrack()
    @JvmStatic external fun nativeSeekTrack(frame: Long)
    @JvmStatic external fun nativeSetLoopRegion(startFrame: Long, endFrame: Long)
    @JvmStatic external fun nativeClearLoopRegion()
    @JvmStatic external fun nativeGetTrackPosition(): Long
    @JvmStatic external fun nativeGetTrackTotalFrames(): Long
    @JvmStatic external fun nativeIsTrackLoaded(): Boolean
    @JvmStatic external fun nativeSetTrackSpeed(ratio: Float)
    @JvmStatic external fun nativeGetTrackSpeed(): Float
    @JvmStatic external fun nativeNudgeClick(direction: Int)
    @JvmStatic external fun nativeAnalyseTrack(): FloatArray
}

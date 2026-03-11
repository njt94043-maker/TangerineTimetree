#include <jni.h>
#include <android/log.h>
#include "audio_engine.h"

#define LOG_TAG "GigBooks"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)

/**
 * JNI bridge — connects Kotlin ClickEngineBridge to C++ AudioEngine.
 * Naming convention: Java_com_thegreentangerine_gigbooks_audio_AudioEngineBridge_<methodName>
 */

using namespace gigbooks;

extern "C" {

// --- Engine lifecycle ---

JNIEXPORT jboolean JNICALL
Java_com_thegreentangerine_gigbooks_audio_AudioEngineBridge_nativeStartEngine(
        JNIEnv*, jclass,
        jint sampleRate, jint framesPerBuffer) {
    return AudioEngine::getInstance().start(sampleRate, framesPerBuffer);
}

JNIEXPORT void JNICALL
Java_com_thegreentangerine_gigbooks_audio_AudioEngineBridge_nativeStopEngine(
        JNIEnv*, jclass) {
    AudioEngine::getInstance().stop();
}

// --- Metronome ---

JNIEXPORT void JNICALL
Java_com_thegreentangerine_gigbooks_audio_AudioEngineBridge_nativeSetBpm(
        JNIEnv*, jclass, jfloat bpm) {
    LOGI("nativeSetBpm: %.1f", bpm);
    AudioEngine::getInstance().setBpm(bpm);
}

JNIEXPORT void JNICALL
Java_com_thegreentangerine_gigbooks_audio_AudioEngineBridge_nativeSetTimeSignature(
        JNIEnv*, jclass, jint beatsPerBar, jint beatUnit) {
    AudioEngine::getInstance().setTimeSignature(beatsPerBar, beatUnit);
}

JNIEXPORT void JNICALL
Java_com_thegreentangerine_gigbooks_audio_AudioEngineBridge_nativeSetAccentPattern(
        JNIEnv* env, jclass, jintArray pattern) {
    jsize length = env->GetArrayLength(pattern);
    jint* elements = env->GetIntArrayElements(pattern, nullptr);
    if (elements != nullptr) {
        AudioEngine::getInstance().setAccentPattern(elements, length);
        env->ReleaseIntArrayElements(pattern, elements, JNI_ABORT);
    }
}

JNIEXPORT void JNICALL
Java_com_thegreentangerine_gigbooks_audio_AudioEngineBridge_nativeSetClickSound(
        JNIEnv*, jclass, jint type) {
    AudioEngine::getInstance().setClickSound(type);
}

JNIEXPORT void JNICALL
Java_com_thegreentangerine_gigbooks_audio_AudioEngineBridge_nativeSetCountIn(
        JNIEnv*, jclass, jint bars, jint clickType) {
    AudioEngine::getInstance().setCountIn(bars, clickType);
}

JNIEXPORT void JNICALL
Java_com_thegreentangerine_gigbooks_audio_AudioEngineBridge_nativeStartClick(
        JNIEnv*, jclass) {
    auto& engine = AudioEngine::getInstance();
    LOGI("nativeStartClick: sampleRate=%d", engine.getSampleRate());
    engine.startClick();
}

JNIEXPORT void JNICALL
Java_com_thegreentangerine_gigbooks_audio_AudioEngineBridge_nativeStopClick(
        JNIEnv*, jclass) {
    AudioEngine::getInstance().stopClick();
}

JNIEXPORT jint JNICALL
Java_com_thegreentangerine_gigbooks_audio_AudioEngineBridge_nativeGetCurrentBeat(
        JNIEnv*, jclass) {
    return AudioEngine::getInstance().getCurrentBeat();
}

JNIEXPORT jint JNICALL
Java_com_thegreentangerine_gigbooks_audio_AudioEngineBridge_nativeGetCurrentBar(
        JNIEnv*, jclass) {
    return AudioEngine::getInstance().getCurrentBar();
}

JNIEXPORT jint JNICALL
Java_com_thegreentangerine_gigbooks_audio_AudioEngineBridge_nativeGetBeatTick(
        JNIEnv*, jclass) {
    return AudioEngine::getInstance().getBeatTick();
}

JNIEXPORT jboolean JNICALL
Java_com_thegreentangerine_gigbooks_audio_AudioEngineBridge_nativeIsPlaying(
        JNIEnv*, jclass) {
    return AudioEngine::getInstance().isClickPlaying();
}

// --- Practice mode ---

JNIEXPORT void JNICALL
Java_com_thegreentangerine_gigbooks_audio_AudioEngineBridge_nativeSetSubdivision(
        JNIEnv*, jclass, jint divisor) {
    AudioEngine::getInstance().setSubdivision(divisor);
}

JNIEXPORT void JNICALL
Java_com_thegreentangerine_gigbooks_audio_AudioEngineBridge_nativeSetSwing(
        JNIEnv*, jclass, jfloat percent) {
    AudioEngine::getInstance().setSwing(percent);
}

// --- Mixer ---

JNIEXPORT void JNICALL
Java_com_thegreentangerine_gigbooks_audio_AudioEngineBridge_nativeSetChannelGain(
        JNIEnv*, jclass, jint channel, jfloat gain) {
    AudioEngine::getInstance().setChannelGain(channel, gain);
}

JNIEXPORT void JNICALL
Java_com_thegreentangerine_gigbooks_audio_AudioEngineBridge_nativeSetMasterGain(
        JNIEnv*, jclass, jfloat gain) {
    AudioEngine::getInstance().setMasterGain(gain);
}

JNIEXPORT void JNICALL
Java_com_thegreentangerine_gigbooks_audio_AudioEngineBridge_nativeSetSplitStereo(
        JNIEnv*, jclass, jboolean enabled) {
    AudioEngine::getInstance().setSplitStereo(enabled);
}

// --- Track Player ---

JNIEXPORT void JNICALL
Java_com_thegreentangerine_gigbooks_audio_AudioEngineBridge_nativeLoadTrack(
        JNIEnv* env, jclass, jfloatArray pcmData, jint numFrames,
        jint sampleRate, jint channels) {
    jsize len = env->GetArrayLength(pcmData);
    jfloat* elements = env->GetFloatArrayElements(pcmData, nullptr);
    if (elements != nullptr) {
        // Copy into a vector (takes ownership via move)
        std::vector<float> data(elements, elements + len);
        AudioEngine::getInstance().loadTrack(std::move(data), numFrames, sampleRate, channels);
        env->ReleaseFloatArrayElements(pcmData, elements, JNI_ABORT);
    }
}

JNIEXPORT void JNICALL
Java_com_thegreentangerine_gigbooks_audio_AudioEngineBridge_nativeResetTrack(
        JNIEnv*, jclass) {
    AudioEngine::getInstance().resetTrack();
}

JNIEXPORT void JNICALL
Java_com_thegreentangerine_gigbooks_audio_AudioEngineBridge_nativePlayTrack(
        JNIEnv*, jclass) {
    AudioEngine::getInstance().playTrack();
}

JNIEXPORT void JNICALL
Java_com_thegreentangerine_gigbooks_audio_AudioEngineBridge_nativePauseTrack(
        JNIEnv*, jclass) {
    AudioEngine::getInstance().pauseTrack();
}

JNIEXPORT void JNICALL
Java_com_thegreentangerine_gigbooks_audio_AudioEngineBridge_nativeStopTrack(
        JNIEnv*, jclass) {
    AudioEngine::getInstance().stopTrack();
}

JNIEXPORT void JNICALL
Java_com_thegreentangerine_gigbooks_audio_AudioEngineBridge_nativeSeekTrack(
        JNIEnv*, jclass, jlong frame) {
    AudioEngine::getInstance().seekTrack(static_cast<int64_t>(frame));
}

JNIEXPORT void JNICALL
Java_com_thegreentangerine_gigbooks_audio_AudioEngineBridge_nativeSetLoopRegion(
        JNIEnv*, jclass, jlong startFrame, jlong endFrame) {
    AudioEngine::getInstance().setLoopRegion(
        static_cast<int64_t>(startFrame), static_cast<int64_t>(endFrame));
}

JNIEXPORT void JNICALL
Java_com_thegreentangerine_gigbooks_audio_AudioEngineBridge_nativeClearLoopRegion(
        JNIEnv*, jclass) {
    AudioEngine::getInstance().clearLoopRegion();
}

JNIEXPORT jlong JNICALL
Java_com_thegreentangerine_gigbooks_audio_AudioEngineBridge_nativeGetTrackPosition(
        JNIEnv*, jclass) {
    return static_cast<jlong>(AudioEngine::getInstance().getTrackPosition());
}

JNIEXPORT jlong JNICALL
Java_com_thegreentangerine_gigbooks_audio_AudioEngineBridge_nativeGetTrackTotalFrames(
        JNIEnv*, jclass) {
    return static_cast<jlong>(AudioEngine::getInstance().getTrackTotalFrames());
}

JNIEXPORT jboolean JNICALL
Java_com_thegreentangerine_gigbooks_audio_AudioEngineBridge_nativeIsTrackLoaded(
        JNIEnv*, jclass) {
    return AudioEngine::getInstance().isTrackLoaded();
}

JNIEXPORT void JNICALL
Java_com_thegreentangerine_gigbooks_audio_AudioEngineBridge_nativeSetTrackSpeed(
        JNIEnv*, jclass, jfloat ratio) {
    AudioEngine::getInstance().setTrackSpeed(ratio);
}

JNIEXPORT jfloat JNICALL
Java_com_thegreentangerine_gigbooks_audio_AudioEngineBridge_nativeGetTrackSpeed(
        JNIEnv*, jclass) {
    return AudioEngine::getInstance().getTrackSpeed();
}

JNIEXPORT void JNICALL
Java_com_thegreentangerine_gigbooks_audio_AudioEngineBridge_nativeNudgeClick(
        JNIEnv*, jclass, jint direction) {
    AudioEngine::getInstance().nudgeClick(direction);
}

JNIEXPORT void JNICALL
Java_com_thegreentangerine_gigbooks_audio_AudioEngineBridge_nativeNudgeClickHalf(
        JNIEnv*, jclass, jint direction) {
    AudioEngine::getInstance().nudgeClickHalf(direction);
}

// --- Stem Players ---

JNIEXPORT void JNICALL
Java_com_thegreentangerine_gigbooks_audio_AudioEngineBridge_nativeLoadStem(
        JNIEnv* env, jclass, jint idx, jfloatArray pcmData, jint numFrames,
        jint sampleRate, jint channels) {
    jsize len = env->GetArrayLength(pcmData);
    jfloat* elements = env->GetFloatArrayElements(pcmData, nullptr);
    if (elements != nullptr) {
        std::vector<float> data(elements, elements + len);
        AudioEngine::getInstance().loadStem(idx, std::move(data), numFrames, sampleRate, channels);
        env->ReleaseFloatArrayElements(pcmData, elements, JNI_ABORT);
    }
}

JNIEXPORT void JNICALL
Java_com_thegreentangerine_gigbooks_audio_AudioEngineBridge_nativeClearStem(
        JNIEnv*, jclass, jint idx) {
    AudioEngine::getInstance().clearStem(idx);
}

JNIEXPORT void JNICALL
Java_com_thegreentangerine_gigbooks_audio_AudioEngineBridge_nativeClearAllStems(
        JNIEnv*, jclass) {
    AudioEngine::getInstance().clearAllStems();
}

// --- Beat Detection ---
// Returns float array: [bpm, beatOffsetMs]
JNIEXPORT jfloatArray JNICALL
Java_com_thegreentangerine_gigbooks_audio_AudioEngineBridge_nativeAnalyseTrack(
        JNIEnv* env, jclass) {
    auto result = AudioEngine::getInstance().analyseTrack();
    jfloatArray out = env->NewFloatArray(2);
    if (out != nullptr) {
        float values[2] = { result.bpm, static_cast<float>(result.beatOffsetMs) };
        env->SetFloatArrayRegion(out, 0, 2, values);
    }
    return out;
}

// Apply the beat map from the last analyseTrack() to the metronome.
// The metronome fires at each detected beat position rather than a fixed BPM.
// Call immediately after nativeAnalyseTrack() returns a valid result.
JNIEXPORT void JNICALL
Java_com_thegreentangerine_gigbooks_audio_AudioEngineBridge_nativeApplyBeatMap(
        JNIEnv*, jclass, jint beatsPerBar) {
    AudioEngine::getInstance().applyBeatMap(static_cast<int32_t>(beatsPerBar));
}

// Apply an external beat map (from server-side madmom analysis).
// beatSeconds: float array of beat times in seconds.
JNIEXPORT void JNICALL
Java_com_thegreentangerine_gigbooks_audio_AudioEngineBridge_nativeApplyExternalBeatMap(
        JNIEnv* env, jclass, jfloatArray beatSeconds, jint beatsPerBar, jint sampleRate) {
    jsize count = env->GetArrayLength(beatSeconds);
    jfloat* elements = env->GetFloatArrayElements(beatSeconds, nullptr);
    if (elements != nullptr) {
        AudioEngine::getInstance().applyExternalBeatMap(
            elements, static_cast<size_t>(count),
            static_cast<int32_t>(beatsPerBar),
            static_cast<int32_t>(sampleRate));
        env->ReleaseFloatArrayElements(beatSeconds, elements, JNI_ABORT);
    }
}

// Set absolute beat offset in ms — aligns click grid to first beat of the loaded track.
// Converts ms to frames using the engine's sample rate and calls setBeatDisplacement().
// Call once after nativeLoadTrack to phase-lock the click.
JNIEXPORT void JNICALL
Java_com_thegreentangerine_gigbooks_audio_AudioEngineBridge_nativeSetBeatOffsetMs(
        JNIEnv*, jclass, jint ms) {
    auto& engine = AudioEngine::getInstance();
    int32_t frames = static_cast<int32_t>((int64_t)engine.getSampleRate() * ms / 1000);
    engine.setBeatDisplacement(frames);
}

JNIEXPORT jint JNICALL
Java_com_thegreentangerine_gigbooks_audio_AudioEngineBridge_nativeGetSampleRate(
        JNIEnv*, jclass) {
    return static_cast<jint>(AudioEngine::getInstance().getSampleRate());
}

} // extern "C"

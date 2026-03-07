#include <jni.h>
#include "audio_engine.h"

/**
 * JNI bridge — connects Kotlin ClickEngineBridge to C++ AudioEngine.
 * Naming convention: Java_com_tgtent_gigbooks_clickengine_ClickEngineBridge_<methodName>
 */

using namespace gigbooks;

extern "C" {

// --- Engine lifecycle ---

JNIEXPORT jboolean JNICALL
Java_com_tgtent_gigbooks_clickengine_ClickEngineBridge_nativeStartEngine(
        JNIEnv*, jclass,
        jint sampleRate, jint framesPerBuffer) {
    return AudioEngine::getInstance().start(sampleRate, framesPerBuffer);
}

JNIEXPORT void JNICALL
Java_com_tgtent_gigbooks_clickengine_ClickEngineBridge_nativeStopEngine(
        JNIEnv*, jclass) {
    AudioEngine::getInstance().stop();
}

// --- Metronome ---

JNIEXPORT void JNICALL
Java_com_tgtent_gigbooks_clickengine_ClickEngineBridge_nativeSetBpm(
        JNIEnv*, jclass, jfloat bpm) {
    AudioEngine::getInstance().setBpm(bpm);
}

JNIEXPORT void JNICALL
Java_com_tgtent_gigbooks_clickengine_ClickEngineBridge_nativeSetTimeSignature(
        JNIEnv*, jclass, jint beatsPerBar, jint beatUnit) {
    AudioEngine::getInstance().setTimeSignature(beatsPerBar, beatUnit);
}

JNIEXPORT void JNICALL
Java_com_tgtent_gigbooks_clickengine_ClickEngineBridge_nativeSetAccentPattern(
        JNIEnv* env, jclass, jintArray pattern) {
    jsize length = env->GetArrayLength(pattern);
    jint* elements = env->GetIntArrayElements(pattern, nullptr);
    if (elements != nullptr) {
        AudioEngine::getInstance().setAccentPattern(elements, length);
        env->ReleaseIntArrayElements(pattern, elements, JNI_ABORT);
    }
}

JNIEXPORT void JNICALL
Java_com_tgtent_gigbooks_clickengine_ClickEngineBridge_nativeSetClickSound(
        JNIEnv*, jclass, jint type) {
    AudioEngine::getInstance().setClickSound(type);
}

JNIEXPORT void JNICALL
Java_com_tgtent_gigbooks_clickengine_ClickEngineBridge_nativeSetCountIn(
        JNIEnv*, jclass, jint bars, jint clickType) {
    AudioEngine::getInstance().setCountIn(bars, clickType);
}

JNIEXPORT void JNICALL
Java_com_tgtent_gigbooks_clickengine_ClickEngineBridge_nativeStartClick(
        JNIEnv*, jclass) {
    AudioEngine::getInstance().startClick();
}

JNIEXPORT void JNICALL
Java_com_tgtent_gigbooks_clickengine_ClickEngineBridge_nativeStopClick(
        JNIEnv*, jclass) {
    AudioEngine::getInstance().stopClick();
}

JNIEXPORT jint JNICALL
Java_com_tgtent_gigbooks_clickengine_ClickEngineBridge_nativeGetCurrentBeat(
        JNIEnv*, jclass) {
    return AudioEngine::getInstance().getCurrentBeat();
}

JNIEXPORT jint JNICALL
Java_com_tgtent_gigbooks_clickengine_ClickEngineBridge_nativeGetCurrentBar(
        JNIEnv*, jclass) {
    return AudioEngine::getInstance().getCurrentBar();
}

JNIEXPORT jboolean JNICALL
Java_com_tgtent_gigbooks_clickengine_ClickEngineBridge_nativeIsPlaying(
        JNIEnv*, jclass) {
    return AudioEngine::getInstance().isClickPlaying();
}

// --- Practice mode ---

JNIEXPORT void JNICALL
Java_com_tgtent_gigbooks_clickengine_ClickEngineBridge_nativeSetSubdivision(
        JNIEnv*, jclass, jint divisor) {
    AudioEngine::getInstance().setSubdivision(divisor);
}

JNIEXPORT void JNICALL
Java_com_tgtent_gigbooks_clickengine_ClickEngineBridge_nativeSetSwing(
        JNIEnv*, jclass, jfloat percent) {
    AudioEngine::getInstance().setSwing(percent);
}

// --- Mixer ---

JNIEXPORT void JNICALL
Java_com_tgtent_gigbooks_clickengine_ClickEngineBridge_nativeSetChannelGain(
        JNIEnv*, jclass, jint channel, jfloat gain) {
    AudioEngine::getInstance().setChannelGain(channel, gain);
}

JNIEXPORT void JNICALL
Java_com_tgtent_gigbooks_clickengine_ClickEngineBridge_nativeSetMasterGain(
        JNIEnv*, jclass, jfloat gain) {
    AudioEngine::getInstance().setMasterGain(gain);
}

JNIEXPORT void JNICALL
Java_com_tgtent_gigbooks_clickengine_ClickEngineBridge_nativeSetSplitStereo(
        JNIEnv*, jclass, jboolean enabled) {
    AudioEngine::getInstance().setSplitStereo(enabled);
}

// --- Track Player ---

JNIEXPORT void JNICALL
Java_com_tgtent_gigbooks_clickengine_ClickEngineBridge_nativeLoadTrack(
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
Java_com_tgtent_gigbooks_clickengine_ClickEngineBridge_nativePlayTrack(
        JNIEnv*, jclass) {
    AudioEngine::getInstance().playTrack();
}

JNIEXPORT void JNICALL
Java_com_tgtent_gigbooks_clickengine_ClickEngineBridge_nativePauseTrack(
        JNIEnv*, jclass) {
    AudioEngine::getInstance().pauseTrack();
}

JNIEXPORT void JNICALL
Java_com_tgtent_gigbooks_clickengine_ClickEngineBridge_nativeStopTrack(
        JNIEnv*, jclass) {
    AudioEngine::getInstance().stopTrack();
}

JNIEXPORT void JNICALL
Java_com_tgtent_gigbooks_clickengine_ClickEngineBridge_nativeSeekTrack(
        JNIEnv*, jclass, jlong frame) {
    AudioEngine::getInstance().seekTrack(static_cast<int64_t>(frame));
}

JNIEXPORT void JNICALL
Java_com_tgtent_gigbooks_clickengine_ClickEngineBridge_nativeSetLoopRegion(
        JNIEnv*, jclass, jlong startFrame, jlong endFrame) {
    AudioEngine::getInstance().setLoopRegion(
        static_cast<int64_t>(startFrame), static_cast<int64_t>(endFrame));
}

JNIEXPORT void JNICALL
Java_com_tgtent_gigbooks_clickengine_ClickEngineBridge_nativeClearLoopRegion(
        JNIEnv*, jclass) {
    AudioEngine::getInstance().clearLoopRegion();
}

JNIEXPORT jlong JNICALL
Java_com_tgtent_gigbooks_clickengine_ClickEngineBridge_nativeGetTrackPosition(
        JNIEnv*, jclass) {
    return static_cast<jlong>(AudioEngine::getInstance().getTrackPosition());
}

JNIEXPORT jlong JNICALL
Java_com_tgtent_gigbooks_clickengine_ClickEngineBridge_nativeGetTrackTotalFrames(
        JNIEnv*, jclass) {
    return static_cast<jlong>(AudioEngine::getInstance().getTrackTotalFrames());
}

JNIEXPORT jboolean JNICALL
Java_com_tgtent_gigbooks_clickengine_ClickEngineBridge_nativeIsTrackLoaded(
        JNIEnv*, jclass) {
    return AudioEngine::getInstance().isTrackLoaded();
}

JNIEXPORT void JNICALL
Java_com_tgtent_gigbooks_clickengine_ClickEngineBridge_nativeSetTrackSpeed(
        JNIEnv*, jclass, jfloat ratio) {
    AudioEngine::getInstance().setTrackSpeed(ratio);
}

JNIEXPORT jfloat JNICALL
Java_com_tgtent_gigbooks_clickengine_ClickEngineBridge_nativeGetTrackSpeed(
        JNIEnv*, jclass) {
    return AudioEngine::getInstance().getTrackSpeed();
}

JNIEXPORT void JNICALL
Java_com_tgtent_gigbooks_clickengine_ClickEngineBridge_nativeNudgeClick(
        JNIEnv*, jclass, jint direction) {
    AudioEngine::getInstance().nudgeClick(direction);
}

// --- Beat Detection ---
// Returns float array: [bpm, beatOffsetMs]
JNIEXPORT jfloatArray JNICALL
Java_com_tgtent_gigbooks_clickengine_ClickEngineBridge_nativeAnalyseTrack(
        JNIEnv* env, jclass) {
    auto result = AudioEngine::getInstance().analyseTrack();
    jfloatArray out = env->NewFloatArray(2);
    if (out != nullptr) {
        float values[2] = { result.bpm, static_cast<float>(result.beatOffsetMs) };
        env->SetFloatArrayRegion(out, 0, 2, values);
    }
    return out;
}

} // extern "C"

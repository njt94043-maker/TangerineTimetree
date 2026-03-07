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

} // extern "C"

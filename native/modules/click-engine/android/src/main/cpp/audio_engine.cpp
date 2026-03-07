#include "audio_engine.h"
#include <android/log.h>

#define LOG_TAG "GigBooks"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGW(...) __android_log_print(ANDROID_LOG_WARN, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

namespace gigbooks {

AudioEngine& AudioEngine::getInstance() {
    static AudioEngine instance;
    return instance;
}

bool AudioEngine::start(int32_t sampleRate, int32_t framesPerBuffer) {
    if (isRunning_.load()) {
        LOGI("AudioEngine already running");
        return true;
    }

    sampleRate_ = sampleRate;
    metronome_.setSampleRate(sampleRate);

    if (!openStream(sampleRate, framesPerBuffer)) {
        LOGE("Failed to open audio stream");
        return false;
    }

    LOGI("AudioEngine started: sampleRate=%d, framesPerBuffer=%d",
         sampleRate, framesPerBuffer);
    return true;
}

void AudioEngine::stop() {
    if (!isRunning_.load()) return;

    metronome_.stop();

    if (stream_) {
        stream_->stop();
        stream_->close();
        stream_.reset();
    }

    isRunning_.store(false);
    LOGI("AudioEngine stopped");
}

bool AudioEngine::openStream(int32_t sampleRate, int32_t framesPerBuffer) {
    oboe::AudioStreamBuilder builder;
    builder.setDirection(oboe::Direction::Output)
           ->setPerformanceMode(oboe::PerformanceMode::LowLatency)
           ->setSharingMode(oboe::SharingMode::Exclusive)
           ->setFormat(oboe::AudioFormat::Float)
           ->setChannelCount(channelCount_)
           ->setSampleRate(sampleRate)
           ->setFramesPerDataCallback(framesPerBuffer)
           ->setDataCallback(this)
           ->setErrorCallback(this);

    oboe::Result result = builder.openStream(stream_);
    if (result != oboe::Result::OK) {
        LOGE("Failed to open stream: %s", oboe::convertToText(result));
        return false;
    }

    sampleRate_ = stream_->getSampleRate();
    channelCount_ = stream_->getChannelCount();
    metronome_.setSampleRate(sampleRate_);

    LOGI("Stream opened: sampleRate=%d, channelCount=%d, framesPerBuffer=%d, "
         "sharingMode=%s, performanceMode=%s",
         sampleRate_, channelCount_,
         stream_->getFramesPerDataCallback(),
         oboe::convertToText(stream_->getSharingMode()),
         oboe::convertToText(stream_->getPerformanceMode()));

    result = stream_->requestStart();
    if (result != oboe::Result::OK) {
        LOGE("Failed to start stream: %s", oboe::convertToText(result));
        stream_->close();
        stream_.reset();
        return false;
    }

    isRunning_.store(true);
    return true;
}

void AudioEngine::restartStream() {
    LOGI("Restarting audio stream...");
    if (stream_) {
        stream_->close();
        stream_.reset();
    }
    openStream(sampleRate_, 0);
}

// --- Metronome control ---

void AudioEngine::setBpm(float bpm) {
    metronome_.setBpm(bpm);
}

void AudioEngine::setTimeSignature(int32_t beatsPerBar, int32_t beatUnit) {
    metronome_.setTimeSignature(beatsPerBar, beatUnit);
}

void AudioEngine::setAccentPattern(const int32_t* pattern, int32_t length) {
    metronome_.setAccentPattern(pattern, length);
}

void AudioEngine::setClickSound(int32_t type) {
    metronome_.setClickSound(type);
}

void AudioEngine::loadCustomClick(const float* data, int32_t numFrames) {
    metronome_.loadCustomClick(data, numFrames);
}

void AudioEngine::setBeatClickTypes(const int32_t* types, int32_t length) {
    metronome_.setBeatClickTypes(types, length);
}

void AudioEngine::setCountIn(int32_t bars, int32_t clickType) {
    metronome_.setCountIn(bars, clickType);
}

void AudioEngine::startClick() {
    metronome_.start();
}

void AudioEngine::stopClick() {
    metronome_.stop();
}

int32_t AudioEngine::getCurrentBeat() const {
    return metronome_.getCurrentBeat();
}

int32_t AudioEngine::getCurrentBar() const {
    return metronome_.getCurrentBar();
}

bool AudioEngine::isClickPlaying() const {
    return metronome_.isPlaying();
}

// --- Practice mode ---

void AudioEngine::setSubdivision(int32_t divisor) {
    metronome_.setSubdivision(divisor);
}

void AudioEngine::setSwing(float percent) {
    metronome_.setSwing(percent);
}

void AudioEngine::setRandomBeatDrop(int32_t percent) {
    metronome_.setRandomBeatDrop(percent);
}

void AudioEngine::setBeatDisplacement(int32_t frames) {
    metronome_.setBeatDisplacement(frames);
}

void AudioEngine::setBackbeat(bool enabled) {
    metronome_.setBackbeat(enabled);
}

void AudioEngine::setSpeedTrainer(bool enabled, float startBpm, float endBpm,
                                   float incrementBpm, int32_t barsPerIncrement) {
    metronome_.setSpeedTrainer(enabled, startBpm, endBpm, incrementBpm, barsPerIncrement);
}

float AudioEngine::getSpeedTrainerCurrentBpm() const {
    return metronome_.getSpeedTrainerCurrentBpm();
}

bool AudioEngine::isSpeedTrainerComplete() const {
    return metronome_.isSpeedTrainerComplete();
}

void AudioEngine::setMutedBars(bool enabled, int32_t playBars, int32_t muteBars) {
    metronome_.setMutedBars(enabled, playBars, muteBars);
}

bool AudioEngine::isMutedBar() const {
    return metronome_.isMutedBar();
}

// --- Mixer ---

void AudioEngine::setChannelGain(int32_t channel, float gain) {
    mixer_.setChannelGain(channel, gain);
}

void AudioEngine::setMasterGain(float gain) {
    mixer_.setMasterGain(gain);
}

void AudioEngine::setSplitStereo(bool enabled) {
    mixer_.setSplitStereo(enabled);
}

// --- Oboe audio callback ---

oboe::DataCallbackResult AudioEngine::onAudioReady(
        oboe::AudioStream* stream,
        void* audioData,
        int32_t numFrames) {

    auto* output = static_cast<float*>(audioData);

    const int32_t totalSamples = numFrames * channelCount_;
    for (int32_t i = 0; i < totalSamples; i++) {
        output[i] = 0.0f;
    }

    // Render metronome (channel 0 = click gain)
    float clickGain = mixer_.getChannelGain(0);
    bool splitStereo = mixer_.getSplitStereo();
    metronome_.render(output, numFrames, channelCount_, clickGain, splitStereo);

    // Apply master gain
    float masterGain = mixer_.getMasterGain();
    if (masterGain != 1.0f) {
        for (int32_t i = 0; i < totalSamples; i++) {
            output[i] *= masterGain;
        }
    }

    return oboe::DataCallbackResult::Continue;
}

void AudioEngine::onErrorBeforeClose(oboe::AudioStream* stream, oboe::Result error) {
    LOGE("Audio stream error before close: %s", oboe::convertToText(error));
}

void AudioEngine::onErrorAfterClose(oboe::AudioStream* stream, oboe::Result error) {
    LOGE("Audio stream error after close: %s", oboe::convertToText(error));
    if (error == oboe::Result::ErrorDisconnected) {
        restartStream();
    }
}

} // namespace gigbooks

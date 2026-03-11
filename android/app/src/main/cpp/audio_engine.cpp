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
    baseBpm_.store(bpm);
    float speed = trackPlayer_.getSpeed();
    metronome_.setBpm(bpm * speed);
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
    // If the track is loaded and not at frame 0 (i.e. resuming from pause),
    // resync the beat map so it aligns to the current track position rather
    // than assuming both started at frame 0.
    if (trackPlayer_.isLoaded()) {
        int64_t trackFrame = trackPlayer_.getPosition();
        if (trackFrame > 0) {
            metronome_.resyncBeatMap(trackFrame, 0, trackPlayer_.getSpeed());
        }
    }
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

int32_t AudioEngine::getBeatTick() const {
    return metronome_.getBeatTick();
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

// --- Track Player ---

void AudioEngine::loadTrack(std::vector<float>&& pcmData, int32_t numFrames,
                              int32_t sampleRate, int32_t channels) {
    // Clear any beat map from a previous song so it doesn't contaminate playback
    // before the new track's analysis completes.
    metronome_.clearBeatMap();
    trackPlayer_.load(std::move(pcmData), numFrames, sampleRate, channels);
}

void AudioEngine::resetTrack() {
    // D-165: Stop playback and release track + all stems so a new song can load clean
    trackPlayer_.stop();
    trackPlayer_.reset();
    for (int32_t i = 0; i < MAX_STEMS; i++) {
        stemPlayers_[i].stop();
        stemPlayers_[i].reset();
    }
    metronome_.clearBeatMap();
    LOGI("resetTrack: track + %d stems released", MAX_STEMS);
}

void AudioEngine::playTrack() {
    trackPlayer_.play();
    for (int32_t i = 0; i < MAX_STEMS; i++) {
        if (stemPlayers_[i].isLoaded()) stemPlayers_[i].play();
    }
}

void AudioEngine::pauseTrack() {
    trackPlayer_.pause();
    for (int32_t i = 0; i < MAX_STEMS; i++) {
        if (stemPlayers_[i].isLoaded()) stemPlayers_[i].pause();
    }
}

void AudioEngine::stopTrack() {
    trackPlayer_.stop();
    for (int32_t i = 0; i < MAX_STEMS; i++) {
        if (stemPlayers_[i].isLoaded()) stemPlayers_[i].stop();
    }
}

void AudioEngine::seekTrack(int64_t frame) {
    trackPlayer_.seek(frame);
    for (int32_t i = 0; i < MAX_STEMS; i++) {
        if (stemPlayers_[i].isLoaded()) stemPlayers_[i].seek(frame);
    }
    metronome_.resyncBeatMap(frame, metronome_.getFramePosition(), trackPlayer_.getSpeed());
}

void AudioEngine::setLoopRegion(int64_t startFrame, int64_t endFrame) {
    trackPlayer_.setLoopRegion(startFrame, endFrame);
    for (int32_t i = 0; i < MAX_STEMS; i++) {
        if (stemPlayers_[i].isLoaded()) stemPlayers_[i].setLoopRegion(startFrame, endFrame);
    }
}

void AudioEngine::clearLoopRegion() {
    trackPlayer_.clearLoopRegion();
    for (int32_t i = 0; i < MAX_STEMS; i++) {
        if (stemPlayers_[i].isLoaded()) stemPlayers_[i].clearLoopRegion();
    }
}

int64_t AudioEngine::getTrackPosition() const {
    return trackPlayer_.getPosition();
}

int64_t AudioEngine::getTrackTotalFrames() const {
    return trackPlayer_.getTotalFrames();
}

bool AudioEngine::isTrackLoaded() const {
    return trackPlayer_.isLoaded();
}

void AudioEngine::setTrackSpeed(float ratio) {
    trackPlayer_.setSpeed(ratio);
    for (int32_t i = 0; i < MAX_STEMS; i++) {
        if (stemPlayers_[i].isLoaded()) stemPlayers_[i].setSpeed(ratio);
    }
    // Adjust metronome BPM proportionally (for fallback / live mode)
    float base = baseBpm_.load();
    metronome_.setBpm(base * ratio);
    // Resync beat map with new speed (beat positions in metronome-frame space change)
    metronome_.resyncBeatMap(trackPlayer_.getPosition(), metronome_.getFramePosition(), ratio);
    LOGI("Track speed set to %.2f, metronome BPM adjusted to %.1f", ratio, base * ratio);
}

float AudioEngine::getTrackSpeed() const {
    return trackPlayer_.getSpeed();
}

void AudioEngine::nudgeClick(int32_t direction) {
    int64_t framesPerBeat = metronome_.getFramesPerBeat();
    int64_t shift = framesPerBeat * direction;
    metronome_.addPhaseShift(shift);
    LOGI("NudgeClick: dir=%d shift=%lld frames (1 beat)", direction, (long long)shift);
}

void AudioEngine::nudgeClickHalf(int32_t direction) {
    int64_t framesPerBeat = metronome_.getFramesPerBeat();
    int64_t shift = (framesPerBeat / 2) * direction;
    metronome_.addPhaseShift(shift);
    LOGI("NudgeClickHalf: dir=%d shift=%lld frames (½ beat)", direction, (long long)shift);
}

// --- Stem Players ---

void AudioEngine::loadStem(int32_t idx, std::vector<float>&& pcmData,
                            int32_t numFrames, int32_t sampleRate, int32_t channels) {
    if (idx < 0 || idx >= MAX_STEMS) {
        LOGW("loadStem: invalid index %d", idx);
        return;
    }
    stemPlayers_[idx].stop();
    stemPlayers_[idx].load(std::move(pcmData), numFrames, sampleRate, channels);
    // Match current track speed so stems play in sync
    stemPlayers_[idx].setSpeed(trackPlayer_.getSpeed());
    LOGI("Stem %d loaded", idx);
}

void AudioEngine::clearStem(int32_t idx) {
    if (idx < 0 || idx >= MAX_STEMS) return;
    stemPlayers_[idx].reset();
    LOGI("Stem %d cleared", idx);
}

void AudioEngine::clearAllStems() {
    for (int32_t i = 0; i < MAX_STEMS; i++) {
        stemPlayers_[i].reset();
    }
    LOGI("All stems cleared");
}

// --- Beat Detection ---

BeatAnalysisResult AudioEngine::analyseTrack() {
    if (!trackPlayer_.isLoaded()) {
        LOGW("analyseTrack: no track loaded");
        return {};
    }
    lastAnalysis_ = BeatDetector::analyse(
        trackPlayer_.getPcmData(),
        trackPlayer_.getTotalFrames(),
        trackPlayer_.getSampleRate());
    return lastAnalysis_;
}

void AudioEngine::applyBeatMap(int32_t beatsPerBar) {
    if (!lastAnalysis_.valid || lastAnalysis_.beatFrames.empty()) {
        LOGW("applyBeatMap: no valid analysis result");
        return;
    }
    float speed = trackPlayer_.getSpeed();
    // Pass current track + metro positions so loadBeatMap skips beats already
    // in the past. This prevents a rapid-fire catch-up burst in the render
    // loop and eliminates the phase discontinuity when the beat map takes over
    // from constant-BPM mode mid-song. When called before playback starts,
    // both positions are 0 and the full beat map is used from the start.
    int64_t trackFrame = trackPlayer_.getPosition();
    int64_t metroFrame = metronome_.getFramePosition();
    metronome_.loadBeatMap(
        lastAnalysis_.beatFrames.data(),
        lastAnalysis_.beatFrames.size(),
        beatsPerBar,
        trackFrame,
        metroFrame,
        speed);
    LOGI("applyBeatMap: %zu beats, bpb=%d, speed=%.2f, trackFrame=%lld, metroFrame=%lld",
         lastAnalysis_.beatFrames.size(), beatsPerBar, speed,
         (long long)trackFrame, (long long)metroFrame);
}

void AudioEngine::applyExternalBeatMap(const float* beatSeconds, size_t count,
                                        int32_t beatsPerBar, int32_t sampleRate) {
    if (!beatSeconds || count == 0) {
        LOGW("applyExternalBeatMap: empty beat array");
        return;
    }
    // Convert seconds to frame positions and store into lastAnalysis_
    // so that applyBeatMap / resyncBeatMap / nudge all work the same way.
    lastAnalysis_.beatFrames.clear();
    lastAnalysis_.beatFrames.reserve(count);
    for (size_t i = 0; i < count; i++) {
        int64_t frame = static_cast<int64_t>(beatSeconds[i] * sampleRate);
        lastAnalysis_.beatFrames.push_back(frame);
    }
    lastAnalysis_.valid = true;
    if (count >= 2) {
        float totalSec = beatSeconds[count - 1] - beatSeconds[0];
        lastAnalysis_.bpm = (totalSec > 0) ? (60.0f * (count - 1) / totalSec) : 0.0f;
    }
    lastAnalysis_.beatOffsetMs = static_cast<int32_t>(beatSeconds[0] * 1000.0f);

    // Now apply via the standard path
    applyBeatMap(beatsPerBar);
    LOGI("applyExternalBeatMap: %zu beats at sr=%d, bpm=%.1f",
         count, sampleRate, lastAnalysis_.bpm);
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

    // Render track player (channel 1 = track gain)
    float trackGain = mixer_.getChannelGain(1);
    trackPlayer_.render(output, numFrames, channelCount_, trackGain);

    // Render stems (channel 2..2+MAX_STEMS-1)
    for (int32_t i = 0; i < MAX_STEMS; i++) {
        if (stemPlayers_[i].isLoaded()) {
            float stemGain = mixer_.getChannelGain(2 + i);
            stemPlayers_[i].render(output, numFrames, channelCount_, stemGain);
        }
    }

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

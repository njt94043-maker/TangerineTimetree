#include "track_player.h"
#include <android/log.h>
#include <cstring>
#include <algorithm>
#include <cmath>
#include <SoundTouch.h>

#define LOG_TAG "GigBooks"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGW(...) __android_log_print(ANDROID_LOG_WARN, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

namespace gigbooks {

TrackPlayer::TrackPlayer() {
    stInputBuffer_.resize(ST_CHUNK_FRAMES * 2);
    stOutputBuffer_.resize(ST_CHUNK_FRAMES * 2 * 4); // Oversized for safety
}

TrackPlayer::~TrackPlayer() = default;

void TrackPlayer::initSoundTouch() {
    soundTouch_ = std::make_unique<soundtouch::SoundTouch>();
    soundTouch_->setSampleRate(sourceSampleRate_);
    soundTouch_->setChannels(2);
    soundTouch_->setTempo(speed_.load());
    // Optimize for quality
    soundTouch_->setSetting(SETTING_USE_AA_FILTER, 1);
    soundTouch_->setSetting(SETTING_SEQUENCE_MS, 40);
    soundTouch_->setSetting(SETTING_SEEKWINDOW_MS, 15);
    soundTouch_->setSetting(SETTING_OVERLAP_MS, 8);
    soundTouchInitialized_ = true;
    LOGI("SoundTouch initialized: sampleRate=%d, channels=2", sourceSampleRate_);
}

void TrackPlayer::updateSoundTouchRate() {
    if (soundTouchInitialized_ && soundTouch_) {
        soundTouch_->setTempo(speed_.load());
    }
}

void TrackPlayer::load(std::vector<float>&& pcmData, int32_t numFrames,
                       int32_t sampleRate, int32_t channels) {
    // Stop playback first
    state_.store(0);
    position_.store(0);

    sourceSampleRate_ = sampleRate;
    sourceChannels_ = channels;

    // Convert mono to stereo if needed
    if (channels == 1) {
        std::vector<float> stereo(numFrames * 2);
        for (int32_t i = 0; i < numFrames; i++) {
            stereo[i * 2] = pcmData[i];
            stereo[i * 2 + 1] = pcmData[i];
        }
        pcmBuffer_ = std::move(stereo);
    } else {
        pcmBuffer_ = std::move(pcmData);
    }

    totalFrames_.store(numFrames);
    isLoaded_.store(true);

    // Reset loop
    loopEnabled_.store(false);
    loopStartFrame_.store(0);
    loopEndFrame_.store(0);

    // Re-init SoundTouch with new sample rate
    initSoundTouch();

    LOGI("Track loaded: %d frames, %d Hz, %d ch", numFrames, sampleRate, channels);
}

void TrackPlayer::play() {
    if (!isLoaded_.load()) return;
    if (soundTouchInitialized_ && soundTouch_) {
        soundTouch_->clear();
    }
    state_.store(1);
}

void TrackPlayer::pause() {
    state_.store(2);
}

void TrackPlayer::stop() {
    state_.store(0);
    // If loop is active, reset to loop start; otherwise reset to beginning
    if (loopEnabled_.load()) {
        position_.store(loopStartFrame_.load());
    } else {
        position_.store(0);
    }
    if (soundTouchInitialized_ && soundTouch_) {
        soundTouch_->clear();
    }
}

void TrackPlayer::seek(int64_t frame) {
    int64_t total = totalFrames_.load();
    frame = std::clamp(frame, int64_t(0), total);
    position_.store(frame);
    if (soundTouchInitialized_ && soundTouch_) {
        soundTouch_->clear();
    }
}

void TrackPlayer::setLoopRegion(int64_t startFrame, int64_t endFrame) {
    int64_t total = totalFrames_.load();
    startFrame = std::clamp(startFrame, int64_t(0), total);
    endFrame = std::clamp(endFrame, startFrame, total);
    loopStartFrame_.store(startFrame);
    loopEndFrame_.store(endFrame);
    loopEnabled_.store(true);
}

void TrackPlayer::clearLoopRegion() {
    loopEnabled_.store(false);
}

void TrackPlayer::reset() {
    // Stop the audio thread from rendering this player on the next callback
    state_.store(0, std::memory_order_seq_cst);
    // Mark as unloaded so render() returns immediately on subsequent callbacks
    isLoaded_.store(false, std::memory_order_seq_cst);
    position_.store(0);
    totalFrames_.store(0);
    loopEnabled_.store(false);
    if (soundTouchInitialized_ && soundTouch_) soundTouch_->clear();
    // pcmBuffer_ is intentionally NOT cleared here to avoid a race with an
    // in-progress audio callback. It will be overwritten on the next load().
}

void TrackPlayer::setSpeed(float ratio) {
    ratio = std::clamp(ratio, 0.25f, 4.0f);
    speed_.store(ratio);
    updateSoundTouchRate();
}

void TrackPlayer::setVolume(float vol) {
    vol = std::clamp(vol, 0.0f, 2.0f);
    volume_.store(vol);
}

TrackPlayer::State TrackPlayer::getState() const {
    int32_t s = state_.load();
    if (s == 1) return State::Playing;
    if (s == 2) return State::Paused;
    return State::Stopped;
}

void TrackPlayer::render(float* output, int32_t numFrames, int32_t channelCount, float gain) {
    if (state_.load() != 1 || !isLoaded_.load()) return;

    const float vol = volume_.load() * gain;
    const float spd = speed_.load();
    const int64_t total = totalFrames_.load();
    const bool loopOn = loopEnabled_.load();
    const int64_t loopStart = loopStartFrame_.load();
    const int64_t loopEnd = loopEndFrame_.load();

    // Speed == 1.0: direct copy (no SoundTouch overhead)
    if (std::abs(spd - 1.0f) < 0.001f) {
        int64_t pos = position_.load();
        for (int32_t f = 0; f < numFrames; f++) {
            if (pos >= total) {
                if (loopOn && loopEnd > loopStart) {
                    pos = loopStart;
                } else {
                    state_.store(0);
                    position_.store(0);
                    return;
                }
            }

            // Check A-B loop boundary
            if (loopOn && pos >= loopEnd) {
                pos = loopStart;
            }

            int64_t idx = pos * 2; // stereo interleaved
            float l = pcmBuffer_[idx] * vol;
            float r = pcmBuffer_[idx + 1] * vol;

            if (channelCount >= 2) {
                output[f * channelCount] += l;
                output[f * channelCount + 1] += r;
            } else {
                output[f] += (l + r) * 0.5f;
            }
            pos++;
        }
        position_.store(pos);
        return;
    }

    // Time-stretched playback via SoundTouch
    if (!soundTouchInitialized_ || !soundTouch_) return;

    int32_t framesRendered = 0;
    int64_t pos = position_.load();

    while (framesRendered < numFrames) {
        // Try to receive processed samples from SoundTouch
        int32_t available = static_cast<int32_t>(
            soundTouch_->receiveSamples(
                stOutputBuffer_.data(),
                std::min(numFrames - framesRendered, ST_CHUNK_FRAMES)));

        if (available > 0) {
            for (int32_t f = 0; f < available && framesRendered < numFrames; f++, framesRendered++) {
                float l = stOutputBuffer_[f * 2] * vol;
                float r = stOutputBuffer_[f * 2 + 1] * vol;
                if (channelCount >= 2) {
                    output[framesRendered * channelCount] += l;
                    output[framesRendered * channelCount + 1] += r;
                } else {
                    output[framesRendered] += (l + r) * 0.5f;
                }
            }
        } else {
            // Feed more source samples to SoundTouch
            int32_t feedFrames = std::min(ST_CHUNK_FRAMES, static_cast<int32_t>(total - pos));
            if (feedFrames <= 0) {
                if (loopOn && loopEnd > loopStart) {
                    pos = loopStart;
                    soundTouch_->clear();
                    continue;
                } else {
                    state_.store(0);
                    position_.store(0);
                    return;
                }
            }

            // Check A-B loop boundary
            if (loopOn && pos + feedFrames > loopEnd) {
                feedFrames = static_cast<int32_t>(loopEnd - pos);
                if (feedFrames <= 0) {
                    pos = loopStart;
                    soundTouch_->clear();
                    continue;
                }
            }

            // Copy source frames into SoundTouch input
            const float* src = pcmBuffer_.data() + pos * 2;
            soundTouch_->putSamples(src, feedFrames);
            pos += feedFrames;
        }
    }

    position_.store(pos);
}

} // namespace gigbooks

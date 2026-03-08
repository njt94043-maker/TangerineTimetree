#pragma once

#include <atomic>
#include <cstdint>
#include <vector>
#include <memory>

// Forward-declare SoundTouch in its namespace
namespace soundtouch { class SoundTouch; }

namespace gigbooks {

/**
 * Track player — plays decoded PCM audio through the Oboe stream.
 *
 * Holds a stereo float PCM buffer and a playhead position.
 * Supports A-B looping, seek, and SoundTouch time-stretch.
 *
 * All timing is frame-based (no system timers).
 * render() is called from the Oboe real-time callback — MUST NOT allocate or block.
 */
class TrackPlayer {
public:
    TrackPlayer();
    ~TrackPlayer();

    // Load decoded PCM data (interleaved stereo float, [-1, 1])
    // Takes ownership of the data via move.
    void load(std::vector<float>&& pcmData, int32_t numFrames,
              int32_t sampleRate, int32_t channels);

    // Transport
    void play();
    void pause();
    void stop();
    void seek(int64_t frame);

    // A-B loop region (frame positions)
    void setLoopRegion(int64_t startFrame, int64_t endFrame);
    void clearLoopRegion();

    // Reset to unloaded state — stops playback and marks as unloaded.
    // Safe to call from any thread. Does NOT free pcmBuffer_ to avoid audio-thread races.
    void reset();

    // Position queries (atomic — safe from any thread)
    int64_t getPosition() const { return position_.load(); }
    int64_t getTotalFrames() const { return totalFrames_.load(); }
    bool isLoaded() const { return isLoaded_.load(); }

    // Raw data access (for beat detector — call from background thread only)
    const float* getPcmData() const { return pcmBuffer_.data(); }
    int32_t getSampleRate() const { return sourceSampleRate_; }

    // Time-stretch (pitch preserved) via SoundTouch
    // ratio: 0.5 = half speed, 1.0 = normal, 2.0 = double speed
    void setSpeed(float ratio);
    float getSpeed() const { return speed_.load(); }

    // Volume (applied in render, separate from mixer channel gain)
    void setVolume(float vol);

    /**
     * Render track audio into the output buffer (additive — adds to existing samples).
     * Called from the Oboe audio callback (real-time thread).
     * MUST NOT allocate, lock, or do I/O.
     *
     * @param output    Interleaved stereo float buffer
     * @param numFrames Number of frames to render
     * @param channelCount Output channel count (should be 2)
     * @param gain      Channel gain from mixer
     */
    void render(float* output, int32_t numFrames, int32_t channelCount, float gain);

    // State
    enum class State { Stopped, Playing, Paused };
    State getState() const;

private:
    // PCM buffer (interleaved stereo)
    std::vector<float> pcmBuffer_;
    std::atomic<int64_t> totalFrames_{0};
    int32_t sourceSampleRate_ = 48000;
    int32_t sourceChannels_ = 2;

    // Playhead
    std::atomic<int64_t> position_{0};
    std::atomic<int32_t> state_{0}; // 0=stopped, 1=playing, 2=paused

    // A-B loop
    std::atomic<bool> loopEnabled_{false};
    std::atomic<int64_t> loopStartFrame_{0};
    std::atomic<int64_t> loopEndFrame_{0};

    // Speed / time-stretch
    std::atomic<float> speed_{1.0f};
    std::unique_ptr<soundtouch::SoundTouch> soundTouch_;
    bool soundTouchInitialized_ = false;
    void initSoundTouch();
    void updateSoundTouchRate();

    // Intermediate buffers for SoundTouch processing (pre-allocated)
    std::vector<float> stInputBuffer_;
    std::vector<float> stOutputBuffer_;
    static constexpr int32_t ST_CHUNK_FRAMES = 512;

    // Volume
    std::atomic<float> volume_{1.0f};

    // Loaded flag
    std::atomic<bool> isLoaded_{false};
};

} // namespace gigbooks

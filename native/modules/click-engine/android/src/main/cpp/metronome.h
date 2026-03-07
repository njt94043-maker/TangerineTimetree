#pragma once

#include <atomic>
#include <cstdint>
#include <array>

namespace gigbooks {

/**
 * Frame-counting metronome — the core timing engine.
 *
 * All timing is derived from sample rate and frame position.
 * NO system timers. The audio hardware clock is the only time source.
 *
 * Click sounds are generated as short sine-wave bursts:
 *   - Downbeat: 880 Hz, ~30ms
 *   - Regular beat: 440 Hz, ~30ms
 *   - With amplitude envelope to prevent pops
 */
class Metronome {
public:
    static constexpr int32_t MAX_BEATS_PER_BAR = 16;
    static constexpr int32_t MAX_ACCENT_LEVELS = 4;

    Metronome() = default;

    // Click sound types
    static constexpr int32_t CLICK_DEFAULT = 0; // Sine 880/440 Hz
    static constexpr int32_t CLICK_HIGH    = 1; // Sine 1760/880 Hz
    static constexpr int32_t CLICK_LOW     = 2; // Sine 440/220 Hz
    static constexpr int32_t CLICK_WOOD    = 3; // Wood block character
    static constexpr int32_t CLICK_RIM     = 4; // Rimshot character
    static constexpr int32_t CLICK_CUSTOM_1 = 5; // User-imported WAV click

    // Max custom click buffer size (~85ms at 48kHz, mono)
    static constexpr int32_t MAX_CUSTOM_CLICK_FRAMES = 4096;

    // Configuration (safe to call from any thread)
    void setSampleRate(int32_t sampleRate);
    void setBpm(float bpm);
    void setTimeSignature(int32_t beatsPerBar, int32_t beatUnit);
    void setAccentPattern(const int32_t* pattern, int32_t length);
    void setClickSound(int32_t type);

    // Custom WAV click: load mono float samples into the internal buffer
    void loadCustomClick(const float* data, int32_t numFrames);

    // Per-beat click type overrides (-1 = use global clickType_)
    void setBeatClickTypes(const int32_t* types, int32_t length);

    // Transport
    void start();
    void stop();
    bool isPlaying() const { return isPlaying_.load(); }

    // State queries (atomic — safe from any thread)
    int32_t getCurrentBeat() const { return currentBeat_.load(); }
    int32_t getCurrentBar() const { return currentBar_.load(); }

    // Frame position info (for future track player beat-sync)
    int64_t getFramePosition() const { return framePosition_; }
    int64_t getFramesPerBeat() const { return framesPerBeat_.load(); }
    int32_t getBeatsPerBar() const { return beatsPerBar_.load(); }

    // --- Count-In ---
    void setCountIn(int32_t bars, int32_t clickType);

    // --- Practice Mode: Subdivisions ---
    void setSubdivision(int32_t divisor);

    // --- Practice Mode: Swing/Shuffle ---
    void setSwing(float percent);

    // --- Practice Mode: Random Beat Drop ---
    void setRandomBeatDrop(int32_t percent);

    // --- Practice Mode: Beat Displacement ---
    void setBeatDisplacement(int32_t frames);
    int32_t getBeatDisplacement() const { return beatDisplacementFrames_.load(); }

    // --- Practice Mode: Backbeat ---
    void setBackbeat(bool enabled);

    // --- Practice Mode: Speed Trainer ---
    void setSpeedTrainer(bool enabled, float startBpm, float endBpm,
                         float incrementBpm, int32_t barsPerIncrement);
    float getSpeedTrainerCurrentBpm() const { return speedCurrentBpm_.load(); }
    bool isSpeedTrainerComplete() const { return speedTrainerComplete_.load(); }

    // --- Practice Mode: Muted Bars (Rhythm Trainer) ---
    void setMutedBars(bool enabled, int32_t playBars, int32_t muteBars);
    bool isMutedBar() const { return currentBarIsMuted_.load(); }

    /**
     * Render click audio into the output buffer.
     * Called from the Oboe audio callback (real-time thread).
     * MUST NOT allocate, lock, or do I/O.
     */
    void render(float* output, int32_t numFrames, int32_t channelCount, float gain = 1.0f,
                bool splitStereo = false);

private:
    void recalcFramesPerBeat();
    float generateClickSample(int32_t sampleIndex, bool isDownbeat, int32_t clickType) const;

    std::atomic<int32_t> sampleRate_{48000};
    std::atomic<float> bpm_{120.0f};
    std::atomic<int32_t> beatsPerBar_{4};
    std::atomic<int32_t> beatUnit_{4};

    std::atomic<int64_t> framesPerBeat_{24000};

    static constexpr float DOWNBEAT_FREQ = 880.0f;
    static constexpr float REGULAR_FREQ = 440.0f;
    static constexpr float CLICK_DURATION_SEC = 0.030f;
    static constexpr float CLICK_AMPLITUDE = 0.7f;

    std::atomic<bool> isPlaying_{false};
    int64_t framePosition_ = 0;
    int64_t nextBeatFrame_ = 0;
    int32_t clickSampleIndex_ = 0;
    int32_t clickDurationFrames_ = 0;
    bool isClickActive_ = false;
    bool currentClickIsDownbeat_ = false;

    std::atomic<int32_t> currentBeat_{0};
    std::atomic<int32_t> currentBar_{0};

    int32_t scheduledBeat_ = 0;
    int32_t scheduledBar_ = 0;

    std::atomic<int32_t> clickType_{CLICK_DEFAULT};

    std::array<int32_t, MAX_BEATS_PER_BAR> accentPattern_{};
    std::atomic<int32_t> accentPatternLength_{0};

    std::atomic<int32_t> subdivisionDivisor_{1};
    int64_t currentBeatStartFrame_ = 0;
    int32_t subBeatIndex_ = 0;
    int32_t subClickSampleIndex_ = 0;
    bool isSubClickActive_ = false;
    bool subClickIsDownbeat_ = false;
    static constexpr float SUB_CLICK_GAIN = 0.4f;

    std::atomic<float> swingPercent_{50.0f};

    std::atomic<int32_t> randomDropPercent_{0};
    uint32_t prngState_{12345};

    std::atomic<int32_t> beatDisplacementFrames_{0};

    std::atomic<bool> backbeatEnabled_{false};

    std::atomic<bool> speedTrainerEnabled_{false};
    std::atomic<float> speedStartBpm_{80.0f};
    std::atomic<float> speedEndBpm_{160.0f};
    std::atomic<float> speedIncrementBpm_{5.0f};
    std::atomic<int32_t> speedBarsPerIncrement_{4};
    int32_t speedBarCounter_ = 0;
    std::atomic<float> speedCurrentBpm_{80.0f};
    std::atomic<bool> speedTrainerComplete_{false};

    std::atomic<bool> muteEnabled_{false};
    std::atomic<int32_t> mutePlayBars_{2};
    std::atomic<int32_t> muteMuteBars_{2};
    int32_t muteBarCounter_ = 0;
    std::atomic<bool> currentBarIsMuted_{false};

    std::atomic<int32_t> countInBars_{0};
    std::atomic<int32_t> countInClickType_{CLICK_HIGH};
    std::atomic<bool> isCountingIn_{false};

    std::array<float, MAX_CUSTOM_CLICK_FRAMES> customClickBuffer_{};
    std::atomic<int32_t> customClickFrames_{0};

    std::array<int32_t, MAX_BEATS_PER_BAR> beatClickType_{};
    std::atomic<int32_t> beatClickTypeLength_{0};

    int32_t currentClickType_{CLICK_DEFAULT};
};

} // namespace gigbooks

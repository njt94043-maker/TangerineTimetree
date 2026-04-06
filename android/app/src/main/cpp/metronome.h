#pragma once

#include <atomic>
#include <cstdint>
#include <array>
#include <vector>

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
    int32_t getBeatTick() const { return beatTick_.load(); }
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
    // Sets the initial phase offset (frames) applied at start() to align click to track.
    void setBeatDisplacement(int32_t frames);
    int32_t getBeatDisplacement() const { return beatDisplacementFrames_.load(); }

    // --- Nudge: one-shot phase shift applied at next beat boundary (thread-safe) ---
    void addPhaseShift(int64_t frames);

    // --- Beat Map Mode ---
    // Load a pre-computed beat map (frame positions in track PCM space at native sample rate).
    // Once loaded, the metronome fires at each beat position rather than at a constant BPM.
    // After the beat map is exhausted the metronome falls back to constant-BPM mode.
    // Call resyncBeatMap whenever track position jumps (seek) or speed changes.
    void loadBeatMap(const int64_t* frames, size_t count, int32_t beatsPerBar,
                     int64_t startTrackFrame, int64_t startMetroFrame, float speed);
    void clearBeatMap();
    // Called when the track is sought or speed changes: recomputes remaining scaled frames.
    void resyncBeatMap(int64_t trackFrame, int64_t metroFrame, float speed);

    // --- Practice Mode: Backbeat ---
    void setBackbeat(bool enabled);

    // --- Practice Mode: Speed Trainer ---
    void setSpeedTrainer(bool enabled, float startBpm, float endBpm,
                         float incrementBpm, int32_t barsPerIncrement);
    float getSpeedTrainerCurrentBpm() const;
    bool isSpeedTrainerComplete() const;

    // --- Practice Mode: Muted Bars ---
    void setMutedBars(bool enabled, int32_t playBars, int32_t muteBars);
    bool isMutedBar() const;

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
    std::atomic<int32_t> beatTick_{0};    // monotonic counter, increments each beat fire

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
    std::atomic<int64_t> pendingPhaseShift_{0};

    std::atomic<bool> backbeatEnabled_{false};


    std::atomic<int32_t> countInBars_{0};
    std::atomic<int32_t> countInClickType_{CLICK_HIGH};
    std::atomic<bool> isCountingIn_{false};

    // --- Beat map mode ---
    std::vector<int64_t> beatMapOrig_;    // beat frames in track PCM space (48kHz)
    std::vector<int64_t> beatMapScaled_;  // beat frames in metronome-frame space (precomputed)
    size_t beatMapIdx_{0};
    bool useBeatMap_{false};
    int32_t beatMapBpb_{4};              // beats per bar for downbeat detection
    int32_t beatMapBeatCount_{0};        // total beats fired from map (for bar counting)
    int64_t beatMapEndFrame_{0};         // metronome frame of last beat (for fallback)
    int64_t beatMapPhaseOffset_{0};      // cumulative user nudge offset (audio thread only)

    std::array<float, MAX_CUSTOM_CLICK_FRAMES> customClickBuffer_{};
    std::atomic<int32_t> customClickFrames_{0};

    std::array<int32_t, MAX_BEATS_PER_BAR> beatClickType_{};
    std::atomic<int32_t> beatClickTypeLength_{0};

    int32_t currentClickType_{CLICK_DEFAULT};

    // Speed trainer state
    std::atomic<bool> speedTrainerEnabled_{false};
    float speedTrainerStartBpm_{80.0f};
    float speedTrainerEndBpm_{160.0f};
    float speedTrainerIncrementBpm_{5.0f};
    int32_t speedTrainerBarsPerIncrement_{4};
    std::atomic<float> speedTrainerCurrentBpm_{80.0f};
    std::atomic<bool> speedTrainerComplete_{false};
    int32_t speedTrainerBarCount_{0};

    // Muted bars state
    std::atomic<bool> mutedBarsEnabled_{false};
    int32_t mutedPlayBars_{4};
    int32_t mutedMuteBars_{1};
    int32_t mutedBarCounter_{0};
    std::atomic<bool> currentBarMuted_{false};
};

} // namespace gigbooks

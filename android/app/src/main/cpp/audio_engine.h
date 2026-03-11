#pragma once

#include <oboe/Oboe.h>
#include <atomic>
#include <memory>
#include <vector>
#include "metronome.h"
#include "mixer.h"
#include "track_player.h"
#include "beat_detector.h"

namespace gigbooks {

/**
 * Central audio engine — singleton.
 * Owns the single Oboe output stream and routes the audio callback
 * to Metronome, TrackPlayer, Mixer, and stem players.
 *
 * Channel 0 = click (metronome)
 * Channel 1 = main practice track
 * Channel 2..7 = stems (loaded by index: 0=DRUMS, 1=BASS, 2=GUITAR, 3=KEYS, 4=VOCALS, 5=OTHER)
 */
class AudioEngine : public oboe::AudioStreamDataCallback,
                    public oboe::AudioStreamErrorCallback {
public:
    static AudioEngine& getInstance();

    // Lifecycle
    bool start(int32_t sampleRate, int32_t framesPerBuffer);
    void stop();
    bool isRunning() const { return isRunning_.load(); }

    // Metronome control
    void setBpm(float bpm);
    void setTimeSignature(int32_t beatsPerBar, int32_t beatUnit);
    void setAccentPattern(const int32_t* pattern, int32_t length);
    void setClickSound(int32_t type);
    void loadCustomClick(const float* data, int32_t numFrames);
    void setBeatClickTypes(const int32_t* types, int32_t length);
    void setCountIn(int32_t bars, int32_t clickType);
    void startClick();
    void stopClick();

    // State queries
    int32_t getCurrentBeat() const;
    int32_t getCurrentBar() const;
    int32_t getBeatTick() const;
    bool isClickPlaying() const;

    // Mixer (channel 0 = click, channel 1 = track)
    void setChannelGain(int32_t channel, float gain);
    void setMasterGain(float gain);
    void setSplitStereo(bool enabled);

    // Practice mode
    void setSubdivision(int32_t divisor);
    void setSwing(float percent);
    void setRandomBeatDrop(int32_t percent);
    void setBeatDisplacement(int32_t frames);
    void setBackbeat(bool enabled);
    void setSpeedTrainer(bool enabled, float startBpm, float endBpm,
                         float incrementBpm, int32_t barsPerIncrement);
    float getSpeedTrainerCurrentBpm() const;
    bool isSpeedTrainerComplete() const;
    void setMutedBars(bool enabled, int32_t playBars, int32_t muteBars);
    bool isMutedBar() const;

    // --- Track Player ---
    void loadTrack(std::vector<float>&& pcmData, int32_t numFrames,
                   int32_t sampleRate, int32_t channels);
    void resetTrack();  // Stop + unload track + all stems (D-165)
    void playTrack();
    void pauseTrack();
    void stopTrack();
    void seekTrack(int64_t frame);
    void setLoopRegion(int64_t startFrame, int64_t endFrame);
    void clearLoopRegion();
    int64_t getTrackPosition() const;
    int64_t getTrackTotalFrames() const;
    bool isTrackLoaded() const;

    // --- Stem Players (ch2..ch2+MAX_STEMS-1) ---
    // idx: 0=DRUMS, 1=BASS, 2=GUITAR, 3=KEYS, 4=VOCALS, 5=BACKING, 6=OTHER
    static constexpr int32_t MAX_STEMS = 7;
    void loadStem(int32_t idx, std::vector<float>&& pcmData, int32_t numFrames,
                  int32_t sampleRate, int32_t channels);
    void clearStem(int32_t idx);
    void clearAllStems();

    // Time-stretch (adjusts both track speed AND metronome BPM proportionally)
    void setTrackSpeed(float ratio);
    float getTrackSpeed() const;

    // Beat step/nudge — shift metronome phase relative to track
    void nudgeClick(int32_t direction);      // ±1 full beat
    void nudgeClickHalf(int32_t direction);  // ±½ beat (Rec'n'Share Beat Step)

    // --- Beat Detection (runs offline, NOT in audio callback) ---
    BeatAnalysisResult analyseTrack();

    // --- Beat Map ---
    // Apply the beat map from the last analyseTrack() result to the metronome.
    // The metronome will fire at each detected beat position instead of a fixed BPM.
    // beatsPerBar controls downbeat (accent) detection.
    void applyBeatMap(int32_t beatsPerBar);

    // Apply an external beat map (e.g. from server-side madmom analysis).
    // beatSeconds: array of beat times in seconds (e.g. [0.45, 0.92, 1.38, ...])
    // sampleRate: the sample rate to use for seconds→frames conversion (use track SR)
    void applyExternalBeatMap(const float* beatSeconds, size_t count,
                              int32_t beatsPerBar, int32_t sampleRate);

    // --- Accessors ---
    int32_t getSampleRate() const { return sampleRate_; }

    // Oboe callbacks
    oboe::DataCallbackResult onAudioReady(
        oboe::AudioStream* stream,
        void* audioData,
        int32_t numFrames) override;

    void onErrorBeforeClose(oboe::AudioStream* stream, oboe::Result error) override;
    void onErrorAfterClose(oboe::AudioStream* stream, oboe::Result error) override;

private:
    AudioEngine() = default;
    ~AudioEngine() = default;
    AudioEngine(const AudioEngine&) = delete;
    AudioEngine& operator=(const AudioEngine&) = delete;

    bool openStream(int32_t sampleRate, int32_t framesPerBuffer);
    void restartStream();

    std::shared_ptr<oboe::AudioStream> stream_;
    std::atomic<bool> isRunning_{false};
    int32_t sampleRate_ = 48000;
    int32_t channelCount_ = 2;

    // Base BPM before speed adjustment (for proportional speed control)
    std::atomic<float> baseBpm_{120.0f};

    // Last beat analysis result — stored so applyBeatMap() can use it
    BeatAnalysisResult lastAnalysis_;

    Metronome metronome_;
    Mixer mixer_;
    TrackPlayer trackPlayer_;
    TrackPlayer stemPlayers_[MAX_STEMS]; // ch2..ch7
};

} // namespace gigbooks

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
 * to Metronome, TrackPlayer, and Mixer.
 *
 * Channel 0 = click (metronome), Channel 1 = track (practice MP3).
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
    void playTrack();
    void pauseTrack();
    void stopTrack();
    void seekTrack(int64_t frame);
    void setLoopRegion(int64_t startFrame, int64_t endFrame);
    void clearLoopRegion();
    int64_t getTrackPosition() const;
    int64_t getTrackTotalFrames() const;
    bool isTrackLoaded() const;

    // Time-stretch (adjusts both track speed AND metronome BPM proportionally)
    void setTrackSpeed(float ratio);
    float getTrackSpeed() const;

    // Beat step/nudge — shift metronome phase by one beat relative to track
    void nudgeClick(int32_t direction);

    // --- Beat Detection (runs offline, NOT in audio callback) ---
    BeatAnalysisResult analyseTrack();

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

    Metronome metronome_;
    Mixer mixer_;
    TrackPlayer trackPlayer_;
};

} // namespace gigbooks

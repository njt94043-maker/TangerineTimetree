#pragma once

#include <oboe/Oboe.h>
#include <atomic>
#include <memory>
#include "metronome.h"
#include "mixer.h"

namespace gigbooks {

/**
 * Central audio engine — singleton.
 * Owns the single Oboe output stream and routes the audio callback
 * to Metronome and Mixer.
 *
 * Stripped from ClickTrack: only metronome + mixer.
 * No sample player, loop player, polyrhythm, or MIDI clock.
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

    // Mixer
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

    Metronome metronome_;
    Mixer mixer_;
};

} // namespace gigbooks

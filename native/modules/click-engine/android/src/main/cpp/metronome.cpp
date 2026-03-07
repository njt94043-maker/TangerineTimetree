#include "metronome.h"
#include <cmath>
#include <algorithm>

namespace gigbooks {

void Metronome::setSampleRate(int32_t sampleRate) {
    sampleRate_.store(sampleRate);
    clickDurationFrames_ = static_cast<int32_t>(CLICK_DURATION_SEC * sampleRate);
    recalcFramesPerBeat();
}

void Metronome::setBpm(float bpm) {
    if (bpm < 20.0f) bpm = 20.0f;
    if (bpm > 400.0f) bpm = 400.0f;
    bpm_.store(bpm);
    recalcFramesPerBeat();
}

void Metronome::setTimeSignature(int32_t beatsPerBar, int32_t beatUnit) {
    if (beatsPerBar < 1) beatsPerBar = 1;
    if (beatsPerBar > MAX_BEATS_PER_BAR) beatsPerBar = MAX_BEATS_PER_BAR;
    beatsPerBar_.store(beatsPerBar);
    beatUnit_.store(beatUnit);
    recalcFramesPerBeat();
}

void Metronome::setClickSound(int32_t type) {
    if (type < 0 || type > CLICK_CUSTOM_1) type = CLICK_DEFAULT;
    if (type == CLICK_CUSTOM_1 && customClickFrames_.load() <= 0) type = CLICK_DEFAULT;
    clickType_.store(type);
}

void Metronome::loadCustomClick(const float* data, int32_t numFrames) {
    int32_t frames = std::min(numFrames, MAX_CUSTOM_CLICK_FRAMES);
    for (int32_t i = 0; i < frames; i++) {
        customClickBuffer_[i] = data[i];
    }
    customClickFrames_.store(frames);
}

void Metronome::setBeatClickTypes(const int32_t* types, int32_t length) {
    int32_t len = std::min(length, static_cast<int32_t>(MAX_BEATS_PER_BAR));
    for (int32_t i = 0; i < len; i++) {
        beatClickType_[i] = types[i];
    }
    beatClickTypeLength_.store(len);
}

void Metronome::setAccentPattern(const int32_t* pattern, int32_t length) {
    if (length > MAX_BEATS_PER_BAR) length = MAX_BEATS_PER_BAR;
    for (int32_t i = 0; i < length; i++) {
        accentPattern_[i] = pattern[i];
    }
    accentPatternLength_.store(length);
}

void Metronome::setCountIn(int32_t bars, int32_t clickType) {
    countInBars_.store(bars < 0 ? 0 : bars);
    countInClickType_.store(clickType);
}

void Metronome::setSubdivision(int32_t divisor) {
    if (divisor < 1) divisor = 1;
    if (divisor > 6) divisor = 6;
    subdivisionDivisor_.store(divisor);
}

void Metronome::setSwing(float percent) {
    swingPercent_.store(std::clamp(percent, 50.0f, 75.0f));
}

void Metronome::setRandomBeatDrop(int32_t percent) {
    randomDropPercent_.store(std::clamp(percent, 0, 100));
}

void Metronome::setBeatDisplacement(int32_t frames) {
    beatDisplacementFrames_.store(frames);
}

void Metronome::setBackbeat(bool enabled) {
    backbeatEnabled_.store(enabled);
}

void Metronome::setSpeedTrainer(bool enabled, float startBpm, float endBpm,
                                float incrementBpm, int32_t barsPerIncrement) {
    speedTrainerEnabled_.store(enabled);
    speedStartBpm_.store(startBpm);
    speedEndBpm_.store(endBpm);
    speedIncrementBpm_.store(std::max(1.0f, incrementBpm));
    speedBarsPerIncrement_.store(std::max(1, barsPerIncrement));
    speedBarCounter_ = 0;
    speedTrainerComplete_.store(false);
    if (enabled) {
        speedCurrentBpm_.store(startBpm);
        setBpm(startBpm);
    }
}

void Metronome::setMutedBars(bool enabled, int32_t playBars, int32_t muteBars) {
    muteEnabled_.store(enabled);
    mutePlayBars_.store(std::max(1, playBars));
    muteMuteBars_.store(std::max(1, muteBars));
    muteBarCounter_ = 0;
    currentBarIsMuted_.store(false);
}

void Metronome::start() {
    framePosition_ = 0;
    nextBeatFrame_ = 0;
    clickSampleIndex_ = 0;
    isClickActive_ = false;
    scheduledBeat_ = 0;
    scheduledBar_ = 0;
    currentBeat_.store(0);
    currentBar_.store(0);

    currentBeatStartFrame_ = 0;
    subBeatIndex_ = 0;
    isSubClickActive_ = false;

    speedBarCounter_ = 0;
    if (speedTrainerEnabled_.load()) {
        speedCurrentBpm_.store(speedStartBpm_.load());
        setBpm(speedStartBpm_.load());
        speedTrainerComplete_.store(false);
    }

    muteBarCounter_ = 0;
    currentBarIsMuted_.store(false);

    isCountingIn_.store(countInBars_.load() > 0);

    isPlaying_.store(true);
}

void Metronome::stop() {
    isPlaying_.store(false);
    isClickActive_ = false;
    isSubClickActive_ = false;
}

void Metronome::recalcFramesPerBeat() {
    float bpm = bpm_.load();
    int32_t sr = sampleRate_.load();
    if (bpm > 0.0f && sr > 0) {
        int64_t fpb = static_cast<int64_t>(static_cast<double>(sr) * 60.0 / bpm);
        framesPerBeat_.store(fpb);
    }
}

float Metronome::generateClickSample(int32_t sampleIndex, bool isDownbeat, int32_t clickType) const {
    int32_t sr = sampleRate_.load();
    int32_t durationFrames = clickDurationFrames_;
    if (durationFrames <= 0 || sr <= 0) return 0.0f;

    if (clickType == CLICK_CUSTOM_1) {
        int32_t customFrames = customClickFrames_.load();
        if (sampleIndex < customFrames) {
            return customClickBuffer_[sampleIndex] * CLICK_AMPLITUDE;
        }
        return 0.0f;
    }

    float t = static_cast<float>(sampleIndex) / static_cast<float>(durationFrames);
    float srf = static_cast<float>(sr);
    float si = static_cast<float>(sampleIndex);
    float twoPi = 2.0f * static_cast<float>(M_PI);

    switch (clickType) {
        case CLICK_HIGH: {
            float freq = isDownbeat ? 1760.0f : 880.0f;
            float phase = twoPi * freq * si / srf;
            float sample = sinf(phase);
            float env = 1.0f;
            if (t < 0.05f) env = t / 0.05f;
            else if (t > 0.7f) env = 1.0f - (t - 0.7f) / 0.3f;
            return sample * env * CLICK_AMPLITUDE;
        }
        case CLICK_LOW: {
            float freq = isDownbeat ? 440.0f : 220.0f;
            float phase = twoPi * freq * si / srf;
            float sample = sinf(phase);
            float env = 1.0f;
            if (t < 0.05f) env = t / 0.05f;
            else if (t > 0.7f) env = 1.0f - (t - 0.7f) / 0.3f;
            return sample * env * CLICK_AMPLITUDE;
        }
        case CLICK_WOOD: {
            float f1 = isDownbeat ? 800.0f : 650.0f;
            float f2 = f1 * 1.63f;
            float f3 = f1 * 2.67f;
            float s1 = sinf(twoPi * f1 * si / srf);
            float s2 = sinf(twoPi * f2 * si / srf) * 0.6f;
            float s3 = sinf(twoPi * f3 * si / srf) * 0.3f;
            float sample = s1 + s2 + s3;
            float env = expf(-8.0f * t);
            if (t < 0.02f) env *= t / 0.02f;
            return sample * env * CLICK_AMPLITUDE * 0.4f;
        }
        case CLICK_RIM: {
            float f1 = isDownbeat ? 1200.0f : 1000.0f;
            float f2 = f1 * 2.4f;
            float toneComponent = sinf(twoPi * f1 * si / srf) * 0.5f +
                                  sinf(twoPi * f2 * si / srf) * 0.3f;
            float noiseApprox = sinf(twoPi * 3517.0f * si / srf) * 0.3f +
                                sinf(twoPi * 5471.0f * si / srf) * 0.2f +
                                sinf(twoPi * 7919.0f * si / srf) * 0.1f;
            float sample = toneComponent + noiseApprox;
            float env = expf(-12.0f * t);
            if (t < 0.01f) env *= t / 0.01f;
            return sample * env * CLICK_AMPLITUDE * 0.5f;
        }
        default: {
            float freq = isDownbeat ? DOWNBEAT_FREQ : REGULAR_FREQ;
            float phase = twoPi * freq * si / srf;
            float sample = sinf(phase);
            float env = 1.0f;
            if (t < 0.05f) env = t / 0.05f;
            else if (t > 0.7f) env = 1.0f - (t - 0.7f) / 0.3f;
            return sample * env * CLICK_AMPLITUDE;
        }
    }
}

void Metronome::render(float* output, int32_t numFrames, int32_t channelCount, float gain,
                       bool splitStereo) {
    if (!isPlaying_.load()) return;

    int64_t fpb = framesPerBeat_.load();
    int32_t bpb = beatsPerBar_.load();
    if (fpb <= 0 || bpb <= 0) return;

    int32_t divisor = subdivisionDivisor_.load();
    bool muteActive = muteEnabled_.load();
    bool speedActive = speedTrainerEnabled_.load();
    float swingPct = swingPercent_.load();
    int32_t dropPct = randomDropPercent_.load();
    bool backbeat = backbeatEnabled_.load();
    int32_t displacement = beatDisplacementFrames_.load();

    for (int32_t frame = 0; frame < numFrames; frame++) {

        // PRIMARY METRONOME — beat boundary check
        if (framePosition_ >= nextBeatFrame_) {
            int32_t beat = scheduledBeat_;
            int32_t bar = scheduledBar_;

            currentBeat_.store(beat);
            currentBar_.store(bar);

            currentClickIsDownbeat_ = (beat == 0);

            int32_t accentLen = accentPatternLength_.load();
            bool shouldSound = true;
            if (accentLen > 0 && beat < accentLen) {
                shouldSound = (accentPattern_[beat] > 0);
                if (accentPattern_[beat] >= 3) {
                    currentClickIsDownbeat_ = true;
                }
            }

            if (muteActive && currentBarIsMuted_.load()) {
                shouldSound = false;
            }

            if (backbeat && (beat % 2 == 0)) {
                shouldSound = false;
            }

            if (dropPct > 0 && shouldSound) {
                prngState_ = prngState_ * 1664525u + 1013904223u;
                int32_t roll = static_cast<int32_t>((prngState_ >> 16) % 100);
                if (roll < dropPct) {
                    shouldSound = false;
                }
            }

            if (shouldSound) {
                isClickActive_ = true;
                clickSampleIndex_ = 0;
                if (isCountingIn_.load()) {
                    currentClickType_ = countInClickType_.load();
                } else {
                    int32_t btLen = beatClickTypeLength_.load();
                    if (btLen > 0 && beat < btLen && beatClickType_[beat] >= 0) {
                        currentClickType_ = beatClickType_[beat];
                    } else {
                        currentClickType_ = clickType_.load();
                    }
                }
            }

            currentBeatStartFrame_ = framePosition_;
            subBeatIndex_ = 1;
            isSubClickActive_ = false;

            nextBeatFrame_ = framePosition_ + fpb + displacement;

            int32_t prevBar = bar;
            scheduledBeat_ = beat + 1;
            if (scheduledBeat_ >= bpb) {
                scheduledBeat_ = 0;
                scheduledBar_ = bar + 1;

                if (isCountingIn_.load()) {
                    int32_t ciBars = countInBars_.load();
                    if (scheduledBar_ >= ciBars) {
                        isCountingIn_.store(false);
                    }
                }

                if (speedActive && !speedTrainerComplete_.load()) {
                    speedBarCounter_++;
                    if (speedBarCounter_ >= speedBarsPerIncrement_.load()) {
                        speedBarCounter_ = 0;
                        float currentBpm = speedCurrentBpm_.load();
                        float endBpm = speedEndBpm_.load();
                        float inc = speedIncrementBpm_.load();
                        float newBpm = currentBpm + inc;
                        if (newBpm >= endBpm) {
                            newBpm = endBpm;
                            speedTrainerComplete_.store(true);
                        }
                        speedCurrentBpm_.store(newBpm);
                        bpm_.store(newBpm);
                        recalcFramesPerBeat();
                        fpb = framesPerBeat_.load();
                    }
                }

                if (muteActive) {
                    muteBarCounter_++;
                    int32_t playBars = mutePlayBars_.load();
                    int32_t mutBars = muteMuteBars_.load();
                    int32_t cycle = playBars + mutBars;
                    int32_t phase = muteBarCounter_ % cycle;
                    currentBarIsMuted_.store(phase >= playBars);
                }
            }
        }

        // SUBDIVISION CLICKS
        if (divisor > 1 && subBeatIndex_ < divisor) {
            int64_t subBeatFrame;
            bool applySwing = (swingPct != 50.0f) && (divisor != 3) && (divisor != 5);

            if (applySwing && (subBeatIndex_ % 2 == 1)) {
                int32_t pairBase = subBeatIndex_ - 1;
                int64_t pairStartFrame = currentBeatStartFrame_
                    + (static_cast<int64_t>(pairBase) * fpb) / divisor;
                int64_t pairDuration = (2 * fpb) / divisor;
                subBeatFrame = pairStartFrame
                    + static_cast<int64_t>(pairDuration * swingPct / 100.0f);
            } else {
                subBeatFrame = currentBeatStartFrame_
                    + (static_cast<int64_t>(subBeatIndex_) * fpb) / divisor;
            }

            if (framePosition_ >= subBeatFrame) {
                bool subShouldSound = !(muteActive && currentBarIsMuted_.load());
                if (subShouldSound) {
                    isSubClickActive_ = true;
                    subClickSampleIndex_ = 0;
                    subClickIsDownbeat_ = false;
                }
                subBeatIndex_++;
            }
        }

        // GENERATE PRIMARY CLICK AUDIO
        if (isClickActive_) {
            float clickSample = generateClickSample(
                clickSampleIndex_, currentClickIsDownbeat_, currentClickType_);

            if (splitStereo && channelCount > 1) {
                output[frame * channelCount] += clickSample * gain;
            } else {
                for (int32_t ch = 0; ch < channelCount; ch++) {
                    output[frame * channelCount + ch] += clickSample * gain;
                }
            }

            clickSampleIndex_++;
            int32_t maxFrames = (currentClickType_ == CLICK_CUSTOM_1)
                ? customClickFrames_.load() : clickDurationFrames_;
            if (clickSampleIndex_ >= maxFrames) {
                isClickActive_ = false;
            }
        }

        // GENERATE SUBDIVISION CLICK AUDIO
        if (isSubClickActive_) {
            float subSample = generateClickSample(
                subClickSampleIndex_, subClickIsDownbeat_, clickType_.load());

            float subGain = gain * SUB_CLICK_GAIN;
            if (splitStereo && channelCount > 1) {
                output[frame * channelCount] += subSample * subGain;
            } else {
                for (int32_t ch = 0; ch < channelCount; ch++) {
                    output[frame * channelCount + ch] += subSample * subGain;
                }
            }

            subClickSampleIndex_++;
            if (subClickSampleIndex_ >= clickDurationFrames_) {
                isSubClickActive_ = false;
            }
        }

        framePosition_++;
    }
}

} // namespace gigbooks

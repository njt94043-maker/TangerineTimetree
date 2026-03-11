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

void Metronome::addPhaseShift(int64_t frames) {
    pendingPhaseShift_.fetch_add(frames);
}

void Metronome::loadBeatMap(const int64_t* frames, size_t count, int32_t beatsPerBar,
                             int64_t startTrackFrame, int64_t startMetroFrame, float speed) {
    beatMapOrig_.assign(frames, frames + count);
    beatMapBpb_          = std::max(1, beatsPerBar);
    beatMapPhaseOffset_  = 0;

    beatMapScaled_.resize(count);
    for (size_t i = 0; i < count; i++) {
        beatMapScaled_[i] = startMetroFrame +
            (int64_t)((beatMapOrig_[i] - startTrackFrame) / (double)speed);
    }
    beatMapEndFrame_ = (count > 0) ? beatMapScaled_.back() : 0;

    // Skip beats that are already in the past (startMetroFrame is the current
    // frame position).  Without this, the render loop would rapid-fire all
    // past beats in consecutive frames, causing a burst of clicks and then a
    // phase discontinuity when beat-map mode takes over from constant-BPM.
    beatMapIdx_       = 0;
    beatMapBeatCount_ = 0;
    while (beatMapIdx_ < count && beatMapScaled_[beatMapIdx_] < startMetroFrame) {
        beatMapIdx_++;
        beatMapBeatCount_++;
    }

    useBeatMap_ = (count > 0);
}

void Metronome::clearBeatMap() {
    useBeatMap_ = false;
    beatMapOrig_.clear();
    beatMapScaled_.clear();
    beatMapIdx_       = 0;
    beatMapBeatCount_ = 0;
}

void Metronome::resyncBeatMap(int64_t trackFrame, int64_t metroFrame, float speed) {
    if (!useBeatMap_ || beatMapOrig_.empty()) return;
    // Advance index to next beat at or after trackFrame
    size_t newIdx = beatMapIdx_;
    while (newIdx < beatMapOrig_.size() && beatMapOrig_[newIdx] < trackFrame) newIdx++;
    beatMapIdx_ = newIdx;
    // Recompute scaled positions for remaining beats
    for (size_t i = newIdx; i < beatMapOrig_.size(); i++) {
        beatMapScaled_[i] = metroFrame +
            (int64_t)((beatMapOrig_[i] - trackFrame) / (double)speed);
    }
    if (!beatMapScaled_.empty()) beatMapEndFrame_ = beatMapScaled_.back();
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
    // Apply beat offset so first click fires at the correct phase (aligns to track)
    nextBeatFrame_ = static_cast<int64_t>(beatDisplacementFrames_.load());
    pendingPhaseShift_.store(0);
    clickSampleIndex_ = 0;
    isClickActive_ = false;
    scheduledBeat_ = 0;
    scheduledBar_ = 0;
    currentBeat_.store(0);
    currentBar_.store(0);
    beatTick_.store(0);

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

    // Reset beat map playhead
    beatMapIdx_          = 0;
    beatMapBeatCount_    = 0;
    beatMapPhaseOffset_  = 0;
    if (!beatMapOrig_.empty()) {
        // Re-derive scaled positions from the start (speed=1.0, metroFrame=0, trackFrame=0)
        for (size_t i = 0; i < beatMapOrig_.size(); i++) {
            beatMapScaled_[i] = beatMapOrig_[i]; // speed=1.0 at start
        }
        useBeatMap_ = true;
    }

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

    // Consume any pending phase nudge before the frame loop.
    int64_t pendingNudge = pendingPhaseShift_.exchange(0);
    if (pendingNudge != 0) {
        if (useBeatMap_) {
            beatMapPhaseOffset_ += pendingNudge;
        } else {
            nextBeatFrame_ += pendingNudge;
        }
    }

    int32_t divisor = subdivisionDivisor_.load();
    bool muteActive = muteEnabled_.load();
    bool speedActive = speedTrainerEnabled_.load();
    float swingPct = swingPercent_.load();
    int32_t dropPct = randomDropPercent_.load();
    bool backbeat = backbeatEnabled_.load();

    for (int32_t frame = 0; frame < numFrames; frame++) {

        // PRIMARY METRONOME — beat boundary check
        // Beat map mode: fires at exact pre-computed track beat positions.
        // Constant-BPM mode: fires at fixed interval (fallback / live mode).
        bool beatFired = false;

        if (useBeatMap_ && beatMapIdx_ < beatMapScaled_.size()) {
            // ── BEAT MAP MODE ──────────────────────────────────────────────
            if (framePosition_ >= beatMapScaled_[beatMapIdx_] + beatMapPhaseOffset_) {
                int32_t beatInBar = beatMapBeatCount_ % beatMapBpb_;
                int32_t bar       = beatMapBeatCount_ / beatMapBpb_;

                currentBeat_.store(beatInBar);
                currentBar_.store(bar);
                currentClickIsDownbeat_ = false; // no accent — all clicks sound identical

                bool shouldSound = !(muteActive && currentBarIsMuted_.load());
                if (backbeat && (beatInBar % 2 == 0)) shouldSound = false;
                if (dropPct > 0 && shouldSound) {
                    prngState_ = prngState_ * 1664525u + 1013904223u;
                    if (static_cast<int32_t>((prngState_ >> 16) % 100) < dropPct)
                        shouldSound = false;
                }

                if (shouldSound) {
                    isClickActive_     = true;
                    clickSampleIndex_  = 0;
                    currentClickType_  = clickType_.load();
                }

                // Derive beat interval for subdivision: distance to next beat in map
                if (beatMapIdx_ + 1 < beatMapScaled_.size()) {
                    fpb = beatMapScaled_[beatMapIdx_ + 1] - beatMapScaled_[beatMapIdx_];
                }
                currentBeatStartFrame_ = framePosition_;
                subBeatIndex_          = 1;
                isSubClickActive_      = false;

                if (beatInBar + 1 >= beatMapBpb_ && muteActive) {
                    muteBarCounter_++;
                    int32_t cycle = mutePlayBars_.load() + muteMuteBars_.load();
                    currentBarIsMuted_.store((muteBarCounter_ % cycle) >= mutePlayBars_.load());
                }

                beatMapBeatCount_++;
                beatMapIdx_++;
                beatTick_.fetch_add(1);
                beatFired = true;

                // When beat map is exhausted, transition to constant-BPM fallback
                if (beatMapIdx_ >= beatMapScaled_.size()) {
                    useBeatMap_     = false;
                    nextBeatFrame_  = framePosition_ + framesPerBeat_.load();
                    scheduledBeat_  = beatMapBeatCount_ % beatMapBpb_;
                    scheduledBar_   = beatMapBeatCount_ / beatMapBpb_;
                }
            }
        } else if (!useBeatMap_) {
            // ── CONSTANT-BPM MODE ──────────────────────────────────────────
            if (framePosition_ >= nextBeatFrame_) {
                int32_t beat = scheduledBeat_;
                int32_t bar  = scheduledBar_;

                currentBeat_.store(beat);
                currentBar_.store(bar);
                currentClickIsDownbeat_ = false; // no accent — all clicks sound identical

                int32_t accentLen = accentPatternLength_.load();
                bool shouldSound = true;
                if (accentLen > 0 && beat < accentLen) {
                    shouldSound = (accentPattern_[beat] > 0);
                }
                if (muteActive && currentBarIsMuted_.load()) shouldSound = false;
                if (backbeat && (beat % 2 == 0)) shouldSound = false;
                if (dropPct > 0 && shouldSound) {
                    prngState_ = prngState_ * 1664525u + 1013904223u;
                    if (static_cast<int32_t>((prngState_ >> 16) % 100) < dropPct)
                        shouldSound = false;
                }

                if (shouldSound) {
                    isClickActive_    = true;
                    clickSampleIndex_ = 0;
                    if (isCountingIn_.load()) {
                        currentClickType_ = countInClickType_.load();
                    } else {
                        int32_t btLen = beatClickTypeLength_.load();
                        currentClickType_ = (btLen > 0 && beat < btLen && beatClickType_[beat] >= 0)
                            ? beatClickType_[beat] : clickType_.load();
                    }
                }

                currentBeatStartFrame_ = framePosition_;
                subBeatIndex_          = 1;
                isSubClickActive_      = false;

                nextBeatFrame_   = framePosition_ + fpb;
                beatTick_.fetch_add(1);

                scheduledBeat_ = beat + 1;
                if (scheduledBeat_ >= bpb) {
                    scheduledBeat_ = 0;
                    scheduledBar_  = bar + 1;

                    if (isCountingIn_.load()) {
                        if (scheduledBar_ >= countInBars_.load())
                            isCountingIn_.store(false);
                    }
                    if (speedActive && !speedTrainerComplete_.load()) {
                        speedBarCounter_++;
                        if (speedBarCounter_ >= speedBarsPerIncrement_.load()) {
                            speedBarCounter_ = 0;
                            float newBpm = speedCurrentBpm_.load() + speedIncrementBpm_.load();
                            if (newBpm >= speedEndBpm_.load()) {
                                newBpm = speedEndBpm_.load();
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
                        int32_t cycle = mutePlayBars_.load() + muteMuteBars_.load();
                        currentBarIsMuted_.store((muteBarCounter_ % cycle) >= mutePlayBars_.load());
                    }
                }
                beatFired = true;
            }
        }
        (void)beatFired;

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

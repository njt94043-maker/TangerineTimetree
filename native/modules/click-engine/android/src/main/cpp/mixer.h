#pragma once

#include <atomic>
#include <cstdint>

namespace gigbooks {

class Mixer {
public:
    static constexpr int32_t MAX_CHANNELS = 16;

    Mixer() : masterGain_(1.0f) {
        for (auto& g : channelGains_) {
            g.store(1.0f);
        }
    }

    void setChannelGain(int32_t channel, float gain);
    float getChannelGain(int32_t channel) const;
    void setMasterGain(float gain);
    float getMasterGain() const { return masterGain_.load(); }
    void setSplitStereo(bool enabled) { splitStereo_.store(enabled); }
    bool getSplitStereo() const { return splitStereo_.load(); }

private:
    std::atomic<float> channelGains_[MAX_CHANNELS];
    std::atomic<float> masterGain_;
    std::atomic<bool> splitStereo_{false};
};

} // namespace gigbooks

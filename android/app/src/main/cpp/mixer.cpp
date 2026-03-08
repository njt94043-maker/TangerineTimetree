#include "mixer.h"
#include <algorithm>

namespace gigbooks {

void Mixer::setChannelGain(int32_t channel, float gain) {
    if (channel < 0 || channel >= MAX_CHANNELS) return;
    gain = std::clamp(gain, 0.0f, 2.0f);
    channelGains_[channel].store(gain);
}

float Mixer::getChannelGain(int32_t channel) const {
    if (channel < 0 || channel >= MAX_CHANNELS) return 0.0f;
    return channelGains_[channel].load();
}

void Mixer::setMasterGain(float gain) {
    gain = std::clamp(gain, 0.0f, 2.0f);
    masterGain_.store(gain);
}

} // namespace gigbooks

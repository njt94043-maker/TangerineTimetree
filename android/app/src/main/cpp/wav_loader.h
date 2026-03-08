#pragma once

#include <cstdint>
#include <vector>
#include <string>

namespace gigbooks {

struct WavData {
    std::vector<float> samples;
    int32_t sampleRate = 0;
    int32_t channels = 2;
    int32_t numFrames = 0;
    bool valid = false;
};

class WavLoader {
public:
    static WavData load(const char* filePath);

private:
    static bool parseHeader(FILE* file, int32_t& sampleRate, int32_t& channels,
                            int32_t& bitsPerSample, int32_t& dataSize);
    static void convert16BitToFloat(const int16_t* input, float* output, int32_t numSamples);
    static void monoToStereo(const float* mono, float* stereo, int32_t numFrames);
};

} // namespace gigbooks

#include "wav_loader.h"
#include <cstdio>
#include <cstring>
#include <android/log.h>

#define LOG_TAG "GigBooks"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

namespace gigbooks {

WavData WavLoader::load(const char* filePath) {
    WavData result;

    FILE* file = fopen(filePath, "rb");
    if (!file) {
        LOGE("WavLoader: Cannot open file %s", filePath);
        return result;
    }

    int32_t sampleRate, channels, bitsPerSample, dataSize;
    if (!parseHeader(file, sampleRate, channels, bitsPerSample, dataSize)) {
        fclose(file);
        return result;
    }

    if (bitsPerSample != 16) {
        LOGE("WavLoader: Unsupported bits per sample: %d (only 16-bit supported)", bitsPerSample);
        fclose(file);
        return result;
    }

    int32_t numSamples = dataSize / (bitsPerSample / 8);
    int32_t numFrames = numSamples / channels;

    std::vector<int16_t> rawData(numSamples);
    size_t read = fread(rawData.data(), sizeof(int16_t), numSamples, file);
    fclose(file);

    if (static_cast<int32_t>(read) < numSamples) {
        numSamples = static_cast<int32_t>(read);
        numFrames = numSamples / channels;
    }

    std::vector<float> floatData(numSamples);
    convert16BitToFloat(rawData.data(), floatData.data(), numSamples);

    if (channels == 1) {
        std::vector<float> stereoData(numFrames * 2);
        monoToStereo(floatData.data(), stereoData.data(), numFrames);
        result.samples = std::move(stereoData);
    } else if (channels == 2) {
        result.samples = std::move(floatData);
    } else {
        std::vector<float> stereoData(numFrames * 2);
        for (int32_t f = 0; f < numFrames; f++) {
            stereoData[f * 2] = floatData[f * channels];
            stereoData[f * 2 + 1] = floatData[f * channels + 1];
        }
        result.samples = std::move(stereoData);
    }

    result.sampleRate = sampleRate;
    result.channels = 2;
    result.numFrames = numFrames;
    result.valid = true;

    LOGI("WavLoader: Loaded %s — %d frames, %d Hz, stereo", filePath, numFrames, sampleRate);
    return result;
}

bool WavLoader::parseHeader(FILE* file, int32_t& sampleRate, int32_t& channels,
                            int32_t& bitsPerSample, int32_t& dataSize) {
    char chunkId[5] = {0};

    if (fread(chunkId, 1, 4, file) != 4 || strncmp(chunkId, "RIFF", 4) != 0) {
        LOGE("WavLoader: Not a RIFF file");
        return false;
    }

    int32_t fileSize;
    fread(&fileSize, 4, 1, file);

    if (fread(chunkId, 1, 4, file) != 4 || strncmp(chunkId, "WAVE", 4) != 0) {
        LOGE("WavLoader: Not a WAVE file");
        return false;
    }

    bool foundFmt = false;
    bool foundData = false;

    while (!foundData) {
        if (fread(chunkId, 1, 4, file) != 4) break;
        int32_t chunkSize;
        if (fread(&chunkSize, 4, 1, file) != 1) break;

        if (strncmp(chunkId, "fmt ", 4) == 0) {
            int16_t audioFormat, numChannels;
            int32_t sr, byteRate;
            int16_t blockAlign, bps;

            fread(&audioFormat, 2, 1, file);
            fread(&numChannels, 2, 1, file);
            fread(&sr, 4, 1, file);
            fread(&byteRate, 4, 1, file);
            fread(&blockAlign, 2, 1, file);
            fread(&bps, 2, 1, file);

            if (audioFormat != 1) {
                LOGE("WavLoader: Non-PCM format (%d) not supported", audioFormat);
                return false;
            }

            sampleRate = sr;
            channels = numChannels;
            bitsPerSample = bps;
            foundFmt = true;

            if (chunkSize > 16) {
                fseek(file, chunkSize - 16, SEEK_CUR);
            }
        } else if (strncmp(chunkId, "data", 4) == 0) {
            dataSize = chunkSize;
            foundData = true;
        } else {
            fseek(file, chunkSize, SEEK_CUR);
        }
    }

    if (!foundFmt || !foundData) {
        LOGE("WavLoader: Missing fmt or data chunk");
        return false;
    }

    return true;
}

void WavLoader::convert16BitToFloat(const int16_t* input, float* output, int32_t numSamples) {
    for (int32_t i = 0; i < numSamples; i++) {
        output[i] = static_cast<float>(input[i]) / 32768.0f;
    }
}

void WavLoader::monoToStereo(const float* mono, float* stereo, int32_t numFrames) {
    for (int32_t i = 0; i < numFrames; i++) {
        stereo[i * 2] = mono[i];
        stereo[i * 2 + 1] = mono[i];
    }
}

} // namespace gigbooks

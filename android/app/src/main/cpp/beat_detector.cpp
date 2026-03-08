#include "beat_detector.h"
#include <android/log.h>
#include <cmath>
#include <algorithm>
#include <numeric>

#define LOG_TAG "GigBooks"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

namespace gigbooks {

// --- Utility: stereo to mono ---

std::vector<float> BeatDetector::toMono(const float* stereo, int64_t numFrames) {
    std::vector<float> mono(numFrames);
    for (int64_t i = 0; i < numFrames; i++) {
        mono[i] = (stereo[i * 2] + stereo[i * 2 + 1]) * 0.5f;
    }
    return mono;
}

// --- Simple radix-2 FFT ---

void BeatDetector::fft(float* real, float* imag, int32_t n) {
    // Bit-reversal permutation
    for (int32_t i = 1, j = 0; i < n; i++) {
        int32_t bit = n >> 1;
        for (; j & bit; bit >>= 1) {
            j ^= bit;
        }
        j ^= bit;
        if (i < j) {
            std::swap(real[i], real[j]);
            std::swap(imag[i], imag[j]);
        }
    }

    // Cooley-Tukey iterative FFT
    for (int32_t len = 2; len <= n; len <<= 1) {
        float ang = -2.0f * static_cast<float>(M_PI) / len;
        float wRe = std::cos(ang);
        float wIm = std::sin(ang);
        for (int32_t i = 0; i < n; i += len) {
            float curRe = 1.0f, curIm = 0.0f;
            for (int32_t j = 0; j < len / 2; j++) {
                float uRe = real[i + j];
                float uIm = imag[i + j];
                float vRe = real[i + j + len / 2] * curRe - imag[i + j + len / 2] * curIm;
                float vIm = real[i + j + len / 2] * curIm + imag[i + j + len / 2] * curRe;
                real[i + j] = uRe + vRe;
                imag[i + j] = uIm + vIm;
                real[i + j + len / 2] = uRe - vRe;
                imag[i + j + len / 2] = uIm - vIm;
                float newCurRe = curRe * wRe - curIm * wIm;
                curIm = curRe * wIm + curIm * wRe;
                curRe = newCurRe;
            }
        }
    }
}

// --- Onset Strength Function (spectral flux) ---

std::vector<float> BeatDetector::computeOnsetStrength(
        const float* mono, int64_t numSamples, int32_t sampleRate,
        int32_t hopSize, int32_t windowSize) {

    int32_t numHops = static_cast<int32_t>((numSamples - windowSize) / hopSize) + 1;
    if (numHops <= 0) return {};

    int32_t fftSize = windowSize; // Must be power of 2
    int32_t numBins = fftSize / 2 + 1;

    std::vector<float> window(fftSize);
    for (int32_t i = 0; i < fftSize; i++) {
        window[i] = 0.5f - 0.5f * std::cos(2.0f * static_cast<float>(M_PI) * i / (fftSize - 1));
    }

    std::vector<float> fftReal(fftSize);
    std::vector<float> fftImag(fftSize);
    std::vector<float> prevMag(numBins, 0.0f);
    std::vector<float> curMag(numBins);
    std::vector<float> onsetStrength(numHops);

    for (int32_t hop = 0; hop < numHops; hop++) {
        int64_t offset = static_cast<int64_t>(hop) * hopSize;

        // Window the frame
        for (int32_t i = 0; i < fftSize; i++) {
            int64_t idx = offset + i;
            fftReal[i] = (idx < numSamples) ? mono[idx] * window[i] : 0.0f;
            fftImag[i] = 0.0f;
        }

        // FFT
        fft(fftReal.data(), fftImag.data(), fftSize);

        // Magnitude spectrum
        for (int32_t i = 0; i < numBins; i++) {
            curMag[i] = std::sqrt(fftReal[i] * fftReal[i] + fftImag[i] * fftImag[i]);
        }

        // Spectral flux (half-wave rectified increase)
        float flux = 0.0f;
        for (int32_t i = 0; i < numBins; i++) {
            float diff = curMag[i] - prevMag[i];
            if (diff > 0.0f) flux += diff;
        }
        onsetStrength[hop] = flux;

        std::copy(curMag.begin(), curMag.end(), prevMag.begin());
    }

    return onsetStrength;
}

// --- BPM Estimation via Autocorrelation ---

float BeatDetector::estimateBpm(const std::vector<float>& onsetStrength,
                                 int32_t sampleRate, int32_t hopSize) {
    if (onsetStrength.empty()) return 120.0f;

    int32_t n = static_cast<int32_t>(onsetStrength.size());

    // BPM range: 60-200 BPM
    float hopsPerSecond = static_cast<float>(sampleRate) / hopSize;
    int32_t minLag = static_cast<int32_t>(hopsPerSecond * 60.0f / 200.0f); // 200 BPM
    int32_t maxLag = static_cast<int32_t>(hopsPerSecond * 60.0f / 60.0f);  // 60 BPM
    maxLag = std::min(maxLag, n / 2);

    if (minLag >= maxLag || maxLag >= n) return 120.0f;

    // Compute mean for normalization
    float mean = 0.0f;
    for (float v : onsetStrength) mean += v;
    mean /= n;

    // Autocorrelation
    float bestCorr = -1.0f;
    int32_t bestLag = minLag;

    for (int32_t lag = minLag; lag <= maxLag; lag++) {
        float corr = 0.0f;
        float norm1 = 0.0f;
        float norm2 = 0.0f;
        int32_t count = n - lag;
        for (int32_t i = 0; i < count; i++) {
            float a = onsetStrength[i] - mean;
            float b = onsetStrength[i + lag] - mean;
            corr += a * b;
            norm1 += a * a;
            norm2 += b * b;
        }
        float denom = std::sqrt(norm1 * norm2);
        if (denom > 0.0f) corr /= denom;

        // Weight towards common tempos (prefer 100-160 BPM range)
        float bpm = hopsPerSecond * 60.0f / lag;
        float weight = 1.0f;
        if (bpm >= 100.0f && bpm <= 160.0f) weight = 1.2f;

        corr *= weight;

        if (corr > bestCorr) {
            bestCorr = corr;
            bestLag = lag;
        }
    }

    float bpm = hopsPerSecond * 60.0f / bestLag;

    // Check for half/double tempo ambiguity
    // If the half-tempo correlation is nearly as strong, prefer it
    int32_t doubleLag = bestLag * 2;
    if (doubleLag <= maxLag) {
        float doubleCorr = 0.0f;
        float norm1 = 0.0f, norm2 = 0.0f;
        int32_t count = n - doubleLag;
        for (int32_t i = 0; i < count; i++) {
            float a = onsetStrength[i] - mean;
            float b = onsetStrength[i + doubleLag] - mean;
            doubleCorr += a * b;
            norm1 += a * a;
            norm2 += b * b;
        }
        float denom = std::sqrt(norm1 * norm2);
        if (denom > 0.0f) doubleCorr /= denom;

        float halfBpm = bpm / 2.0f;
        if (halfBpm >= 60.0f && doubleCorr > bestCorr * 0.85f) {
            bpm = halfBpm;
            bestLag = doubleLag;
        }
    }

    LOGI("BPM estimated: %.1f (lag=%d, corr=%.3f)", bpm, bestLag, bestCorr);
    return bpm;
}

// --- Find Beat Positions ---

std::vector<int64_t> BeatDetector::findBeats(const std::vector<float>& onsetStrength,
                                              float bpm, int32_t sampleRate,
                                              int32_t hopSize) {
    if (onsetStrength.empty() || bpm <= 0.0f) return {};

    float hopsPerSecond = static_cast<float>(sampleRate) / hopSize;
    float hopsPerBeat = hopsPerSecond * 60.0f / bpm;
    int32_t n = static_cast<int32_t>(onsetStrength.size());

    // Find the first strong onset to anchor beats
    float maxOnset = *std::max_element(onsetStrength.begin(), onsetStrength.end());
    float threshold = maxOnset * 0.3f;

    // Find first onset above threshold
    int32_t firstOnsetHop = 0;
    for (int32_t i = 0; i < n; i++) {
        if (onsetStrength[i] > threshold) {
            firstOnsetHop = i;
            break;
        }
    }

    // Generate beat grid from first onset, then refine each beat position
    // by finding the nearest strong onset within a window
    std::vector<int64_t> beats;
    int32_t windowHops = static_cast<int32_t>(hopsPerBeat * 0.25f); // Search window: 25% of beat

    for (float beatHop = static_cast<float>(firstOnsetHop);
         beatHop < n;
         beatHop += hopsPerBeat) {

        int32_t center = static_cast<int32_t>(beatHop);
        int32_t searchStart = std::max(0, center - windowHops);
        int32_t searchEnd = std::min(n - 1, center + windowHops);

        // Find strongest onset in window
        int32_t bestHop = center;
        float bestStrength = -1.0f;
        for (int32_t h = searchStart; h <= searchEnd; h++) {
            if (onsetStrength[h] > bestStrength) {
                bestStrength = onsetStrength[h];
                bestHop = h;
            }
        }

        int64_t framePos = static_cast<int64_t>(bestHop) * hopSize;
        beats.push_back(framePos);
    }

    return beats;
}

// --- Main Analysis Entry Point ---

BeatAnalysisResult BeatDetector::analyse(const float* pcmData, int64_t numFrames,
                                          int32_t sampleRate) {
    BeatAnalysisResult result;

    if (!pcmData || numFrames < sampleRate) {
        // Need at least 1 second of audio
        LOGI("BeatDetector: not enough audio data (%lld frames)", (long long)numFrames);
        return result;
    }

    LOGI("BeatDetector: analysing %lld frames at %d Hz", (long long)numFrames, sampleRate);

    // Convert to mono
    auto mono = toMono(pcmData, numFrames);

    // Analysis parameters
    int32_t windowSize = 2048; // ~43ms at 48kHz
    int32_t hopSize = 512;     // ~10.7ms at 48kHz — good onset resolution

    // Compute onset strength function
    auto onsetStrength = computeOnsetStrength(
        mono.data(), static_cast<int64_t>(mono.size()),
        sampleRate, hopSize, windowSize);

    if (onsetStrength.empty()) {
        LOGI("BeatDetector: failed to compute onset strength");
        return result;
    }

    // Estimate BPM
    result.bpm = estimateBpm(onsetStrength, sampleRate, hopSize);

    // Find beat positions
    result.beatFrames = findBeats(onsetStrength, result.bpm, sampleRate, hopSize);

    // Beat offset = position of first beat in milliseconds
    if (!result.beatFrames.empty()) {
        result.beatOffsetMs = static_cast<int32_t>(
            result.beatFrames[0] * 1000LL / sampleRate);
    }

    result.valid = true;

    LOGI("BeatDetector: BPM=%.1f, offset=%dms, %zu beats found",
         result.bpm, result.beatOffsetMs, result.beatFrames.size());

    return result;
}

} // namespace gigbooks

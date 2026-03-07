#pragma once

#include <cstdint>
#include <vector>

namespace gigbooks {

/**
 * Beat detector — analyses PCM audio to detect BPM and beat positions.
 *
 * Uses onset-strength function + autocorrelation for BPM estimation,
 * then peak-picking on the onset function for beat positions.
 *
 * NOT real-time — runs as offline analysis on a full PCM buffer.
 * Call from a background thread (not the audio callback).
 */
struct BeatAnalysisResult {
    float bpm = 0.0f;
    int32_t beatOffsetMs = 0;           // Offset of first detected beat from start
    std::vector<int64_t> beatFrames;    // Frame positions of detected beats
    bool valid = false;
};

class BeatDetector {
public:
    /**
     * Analyse a PCM buffer for tempo and beat positions.
     *
     * @param pcmData    Interleaved stereo float samples [-1, 1]
     * @param numFrames  Total number of frames
     * @param sampleRate Sample rate (e.g., 44100, 48000)
     * @return BeatAnalysisResult with BPM, beat offset, and beat positions
     */
    static BeatAnalysisResult analyse(const float* pcmData, int64_t numFrames,
                                       int32_t sampleRate);

private:
    // Convert stereo interleaved to mono
    static std::vector<float> toMono(const float* stereo, int64_t numFrames);

    // Compute onset strength function (spectral flux)
    // Returns one value per hop (hopSize frames apart)
    static std::vector<float> computeOnsetStrength(
        const float* mono, int64_t numSamples, int32_t sampleRate,
        int32_t hopSize, int32_t windowSize);

    // Autocorrelation-based BPM estimation from onset strength
    static float estimateBpm(const std::vector<float>& onsetStrength,
                              int32_t sampleRate, int32_t hopSize);

    // Find beat positions from onset strength + estimated BPM
    static std::vector<int64_t> findBeats(const std::vector<float>& onsetStrength,
                                           float bpm, int32_t sampleRate,
                                           int32_t hopSize);

    // Simple FFT (in-place, power-of-2 radix-2 DIT)
    static void fft(float* real, float* imag, int32_t n);
};

} // namespace gigbooks

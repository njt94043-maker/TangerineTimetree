#pragma once

#include <cstdint>
#include <vector>

namespace gigbooks {

/**
 * Beat detector — analyses PCM audio to detect BPM and beat positions.
 *
 * Uses BTrack (Adam Stark, Queen Mary University of London) — a real-time
 * beat tracker driven offline over the decoded PCM buffer.
 *
 * NOT real-time — runs as offline analysis on a full PCM buffer.
 * Call from a background thread (not the audio callback).
 */
struct BeatAnalysisResult {
    float bpm = 0.0f;
    int32_t beatOffsetMs = 0;           // Offset of first detected beat from start (ms)
    std::vector<int64_t> beatFrames;    // Frame positions of detected beats
    bool valid = false;
};

class BeatDetector {
public:
    /**
     * Analyse a PCM buffer for tempo and beat positions using BTrack.
     *
     * @param pcmData    Interleaved stereo float samples [-1, 1]
     * @param numFrames  Total number of frames
     * @param sampleRate Sample rate (e.g., 44100, 48000)
     * @return BeatAnalysisResult with BPM, beat offset, and beat positions
     */
    static BeatAnalysisResult analyse(const float* pcmData, int64_t numFrames,
                                       int32_t sampleRate);
};

} // namespace gigbooks

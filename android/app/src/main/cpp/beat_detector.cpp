#include "beat_detector.h"
#include "third_party/btrack/BTrack.h"
#include <android/log.h>
#include <algorithm>
#include <numeric>
#include <cmath>

#define LOG_TAG "GigBooks"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)

namespace gigbooks {

// BTrack parameters — hop=512 gives onsetDFBufferSize=512 (ratio=1.0, no resampling)
static constexpr int BTRACK_HOP_SIZE   = 512;
static constexpr int BTRACK_FRAME_SIZE = 1024;

// Analyse up to 3 minutes
static constexpr int ANALYSIS_SECONDS  = 180;
// First pass uses 30s to get rough BPM before running the full analysis
static constexpr int PASS1_SECONDS     = 30;

// --- helpers ----------------------------------------------------------------

static double computeMedianMs(const std::vector<int64_t>& frames, size_t skip,
                               int32_t sampleRate) {
    std::vector<double> ibis;
    ibis.reserve(frames.size());
    for (size_t i = skip + 1; i < frames.size(); i++) {
        double ms = (double)(frames[i] - frames[i - 1]) * 1000.0 / sampleRate;
        if (ms > 200.0 && ms < 2000.0) ibis.push_back(ms);
    }
    if (ibis.empty()) return 0.0;
    std::sort(ibis.begin(), ibis.end());
    return ibis[ibis.size() / 2];
}

// Run one BTrack pass over [0, maxFrames) and collect beat positions.
static std::vector<int64_t> runBTrackPass(const float* pcmData,
                                           int64_t maxFrames,
                                           int32_t sampleRate,
                                           float seedBpm) {
    BTrack bt(BTRACK_HOP_SIZE, BTRACK_FRAME_SIZE);
    bt.setSampleRate(sampleRate);
    if (seedBpm > 0.0f) bt.setTempo(static_cast<double>(seedBpm));

    std::vector<double> frame(BTRACK_FRAME_SIZE);
    std::vector<int64_t> beats;

    for (int64_t hopStart = 0;
         hopStart + BTRACK_FRAME_SIZE <= maxFrames;
         hopStart += BTRACK_HOP_SIZE) {

        for (int i = 0; i < BTRACK_FRAME_SIZE; i++) {
            int64_t idx = hopStart + i;
            frame[i] = (double)(pcmData[idx * 2] + pcmData[idx * 2 + 1]) * 0.5;
        }
        bt.processAudioFrame(frame.data());

        if (bt.beatDueInCurrentFrame()) {
            beats.push_back(hopStart + BTRACK_HOP_SIZE / 2);
        }
    }
    return beats;
}

// Post-process a beat map: remove double-detections and fill single missing
// beats. Uses a local sliding-window median IBI to handle gradual tempo changes.
static std::vector<int64_t> cleanBeatMap(const std::vector<int64_t>& raw,
                                          int32_t sampleRate) {
    if (raw.size() < 4) return raw;

    // Global median IBI
    std::vector<int64_t> ibiVec;
    ibiVec.reserve(raw.size());
    for (size_t i = 1; i < raw.size(); i++) ibiVec.push_back(raw[i] - raw[i - 1]);
    std::vector<int64_t> sorted = ibiVec;
    std::sort(sorted.begin(), sorted.end());
    int64_t globalMedian = sorted[sorted.size() / 2];

    std::vector<int64_t> clean;
    clean.reserve(raw.size());
    clean.push_back(raw[0]);

    for (size_t i = 1; i < raw.size(); i++) {
        // Local median IBI from the last 8 clean beats
        int64_t localIBI = globalMedian;
        if (clean.size() >= 2) {
            size_t wStart = (clean.size() >= 8) ? clean.size() - 8 : 0;
            std::vector<int64_t> win;
            for (size_t j = wStart + 1; j < clean.size(); j++)
                win.push_back(clean[j] - clean[j - 1]);
            if (!win.empty()) {
                std::sort(win.begin(), win.end());
                localIBI = win[win.size() / 2];
            }
        }

        int64_t gap = raw[i] - clean.back();

        if (gap < localIBI * 5 / 10) {
            // Double-detection: skip
            continue;
        }
        if (gap > localIBI * 15 / 10 && gap < localIBI * 25 / 10) {
            // Missed one beat: interpolate
            clean.push_back(clean.back() + gap / 2);
        }
        clean.push_back(raw[i]);
    }

    LOGI("BeatDetector: cleanBeatMap %zu → %zu beats", raw.size(), clean.size());
    return clean;
}

// ----------------------------------------------------------------------------

BeatAnalysisResult BeatDetector::analyse(const float* pcmData, int64_t numFrames,
                                          int32_t sampleRate) {
    BeatAnalysisResult result;

    if (!pcmData || numFrames < sampleRate) {
        LOGI("BeatDetector: not enough audio data (%lld frames)", (long long)numFrames);
        return result;
    }

    const int64_t maxFrames = std::min(numFrames,
                                        (int64_t)sampleRate * ANALYSIS_SECONDS);
    const int64_t pass1Frames = std::min(numFrames,
                                          (int64_t)sampleRate * PASS1_SECONDS);

    LOGI("BeatDetector: analysing %lld frames at %d Hz (%.1fs)",
         (long long)maxFrames, sampleRate, (double)maxFrames / sampleRate);

    // ── PASS 1: rough BPM over the first 30 seconds ─────────────────────────
    // BTrack starts at 120 BPM default. Running a short pass first lets us
    // extract the true tempo before the full pass, so pass 2 initialises at
    // the right BPM instead of spending ~25 beats converging from 120.
    float roughBpm = 0.0f;
    {
        std::vector<int64_t> p1beats = runBTrackPass(pcmData, pass1Frames, sampleRate, 0.0f);
        const size_t skip1 = std::min((size_t)8, p1beats.size() / 4);
        double med = computeMedianMs(p1beats, skip1, sampleRate);
        if (med > 0.0) roughBpm = (float)(60000.0 / med);
        LOGI("BeatDetector: pass1 rough BPM=%.1f (%zu beats)", roughBpm, p1beats.size());
    }

    if (roughBpm < 40.0f || roughBpm > 250.0f) {
        LOGI("BeatDetector: pass1 BPM out of range (%.1f) — giving up", roughBpm);
        return result;
    }

    // ── PASS 2: full analysis seeded at the correct tempo ───────────────────
    // setTempo() initialises BTrack's cumulative score at the right period so
    // beat positions converge from beat 1 rather than after 25 warmup beats.
    std::vector<int64_t> beatFrames =
        runBTrackPass(pcmData, maxFrames, sampleRate, roughBpm);

    // Skip the first few beats — even with a good seed there is some startup
    // transient (BTrack fires beat due immediately after setTempo).
    const size_t skipBeats = std::min((size_t)4, beatFrames.size() / 6);

    if (beatFrames.size() < 8) {
        LOGI("BeatDetector: pass2 too few beats (%zu)", beatFrames.size());
        return result;
    }

    // Remove the warmup beats before cleaning
    beatFrames.erase(beatFrames.begin(), beatFrames.begin() + skipBeats);

    // ── POST-PROCESS: remove double-detections, fill single gaps ────────────
    beatFrames = cleanBeatMap(beatFrames, sampleRate);

    if (beatFrames.size() < 4) {
        LOGI("BeatDetector: too few beats after cleaning (%zu)", beatFrames.size());
        return result;
    }

    // BPM from the actual BTrack beat positions
    double medianMs = computeMedianMs(beatFrames, 0, sampleRate);
    if (medianMs <= 0.0) {
        LOGI("BeatDetector: no valid IBI after cleaning");
        return result;
    }
    result.bpm = (float)(60000.0 / medianMs);

    int64_t firstBeat    = beatFrames[0];
    result.beatOffsetMs  = (int32_t)(firstBeat * 1000LL / sampleRate);
    result.beatFrames    = beatFrames;
    result.valid         = true;

    LOGI("BeatDetector: BPM=%.2f, firstBeat=%lldms, %zu clean beats",
         result.bpm,
         (long long)(firstBeat * 1000LL / sampleRate),
         beatFrames.size());

    return result;
}

} // namespace gigbooks

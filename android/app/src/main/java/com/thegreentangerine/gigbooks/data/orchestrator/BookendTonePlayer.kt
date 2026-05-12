package com.thegreentangerine.gigbooks.data.orchestrator

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.util.Log
import kotlinx.coroutines.delay
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/**
 * Plays a short, distinctive 1 kHz tone burst at set boundaries (S139 brief).
 *
 * Three audiences:
 *  - Audience hears "set start / set end" cue.
 *  - Band gets the same cue plus an internal ready signal.
 *  - Video phones recording at the gig pick it up via their mics; post-prod
 *    uses FFT correlation to align video tracks against Reaper's per-set
 *    markers.
 *
 * Tone params (brief §"Tone characteristics"):
 *  - 1 kHz sine, 250 ms burst, -12 dBFS amplitude, 10 ms cosine fade.
 *  - Set-start = 1 burst. Set-end = 2 bursts, 100 ms gap.
 *  - 100 ms silence pre/post for clean FFT envelope.
 *
 * Phone media volume is briefly forced to max during the burst so the tone is
 * loud enough to be picked up by far video phones, then restored.
 *
 * Callers should fire-and-forget (per §B.4 — OSC bundle must not wait on tone).
 */
class BookendTonePlayer(
    private val context: Context,
    private val sampleRate: Int = 48000,
) {
    private val audioManager: AudioManager =
        context.getSystemService(Context.AUDIO_SERVICE) as AudioManager

    suspend fun playSetStart() {
        playBursts(count = 1)
    }

    suspend fun playSetEnd() {
        playBursts(count = 2)
    }

    private suspend fun playBursts(count: Int) {
        val buffer = buildWaveform(count)
        val streamType = AudioManager.STREAM_MUSIC
        val previousVolume = audioManager.getStreamVolume(streamType)
        val maxVolume = audioManager.getStreamMaxVolume(streamType)

        var track: AudioTrack? = null
        try {
            audioManager.setStreamVolume(streamType, maxVolume, 0)

            track = AudioTrack.Builder()
                .setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                .setAudioFormat(
                    AudioFormat.Builder()
                        .setSampleRate(sampleRate)
                        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                        .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                        .build()
                )
                .setBufferSizeInBytes(buffer.size * 2)
                .setTransferMode(AudioTrack.MODE_STATIC)
                .build()

            track.write(buffer, 0, buffer.size)
            track.play()

            // Wait for playback to drain. Buffer length in ms + small slack.
            val durationMs = (buffer.size * 1000L) / sampleRate + 50
            delay(durationMs)
        } catch (e: Exception) {
            Log.w(TAG, "Bookend tone failed: ${e.message}")
        } finally {
            try { track?.stop() } catch (_: Exception) {}
            try { track?.release() } catch (_: Exception) {}
            try {
                audioManager.setStreamVolume(streamType, previousVolume, 0)
            } catch (_: Exception) {}
        }
    }

    /**
     * Build the full waveform for `count` bursts.
     *
     * Layout:  silencePre  [burst (silenceGap burst)*]  silencePost
     * Single bursts skip the gap. Double bursts have one gap between them.
     */
    private fun buildWaveform(count: Int): ShortArray {
        val burstSamples = sampleRate * BURST_MS / 1000
        val fadeSamples = sampleRate * FADE_MS / 1000
        val gapSamples = sampleRate * GAP_MS / 1000
        val padSamples = sampleRate * PAD_MS / 1000

        val totalBurst = burstSamples * count + gapSamples * (count - 1).coerceAtLeast(0)
        val total = padSamples + totalBurst + padSamples
        val out = ShortArray(total)

        val amplitude = (Short.MAX_VALUE * AMPLITUDE_LINEAR).toInt()
        var idx = padSamples
        for (b in 0 until count) {
            for (s in 0 until burstSamples) {
                val phase = 2.0 * PI * FREQ_HZ * s / sampleRate
                // Cosine fade envelope at both ends of the burst.
                val env = when {
                    s < fadeSamples -> 0.5 * (1.0 - cos(PI * s / fadeSamples))
                    s > burstSamples - fadeSamples ->
                        0.5 * (1.0 - cos(PI * (burstSamples - s) / fadeSamples))
                    else -> 1.0
                }
                out[idx++] = (sin(phase) * env * amplitude).toInt().toShort()
            }
            if (b < count - 1) {
                idx += gapSamples
            }
        }
        return out
    }

    companion object {
        private const val TAG = "BookendTonePlayer"
        private const val FREQ_HZ = 1000.0
        private const val BURST_MS = 250
        private const val FADE_MS = 10
        private const val GAP_MS = 100
        private const val PAD_MS = 100
        // -12 dBFS ≈ 10^(-12/20) ≈ 0.2512
        private const val AMPLITUDE_LINEAR = 0.2512
    }
}

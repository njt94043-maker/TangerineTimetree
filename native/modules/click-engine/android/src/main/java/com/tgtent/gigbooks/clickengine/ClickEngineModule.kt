package com.tgtent.gigbooks.clickengine

import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.net.URL
import java.nio.ByteBuffer
import java.nio.ByteOrder

class ClickEngineModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("ClickEngine")

        // --- Engine lifecycle ---

        Function("startEngine") { sampleRate: Int, framesPerBuffer: Int ->
            ClickEngineBridge.nativeStartEngine(sampleRate, framesPerBuffer)
        }

        Function("stopEngine") {
            ClickEngineBridge.nativeStopEngine()
        }

        // --- Metronome ---

        Function("setBpm") { bpm: Double ->
            ClickEngineBridge.nativeSetBpm(bpm.toFloat())
        }

        Function("setTimeSignature") { beatsPerBar: Int, beatUnit: Int ->
            ClickEngineBridge.nativeSetTimeSignature(beatsPerBar, beatUnit)
        }

        Function("setAccentPattern") { pattern: List<Int> ->
            ClickEngineBridge.nativeSetAccentPattern(pattern.toIntArray())
        }

        Function("setClickSound") { type: Int ->
            ClickEngineBridge.nativeSetClickSound(type)
        }

        Function("setCountIn") { bars: Int, clickType: Int ->
            ClickEngineBridge.nativeSetCountIn(bars, clickType)
        }

        Function("startClick") {
            ClickEngineBridge.nativeStartClick()
        }

        Function("stopClick") {
            ClickEngineBridge.nativeStopClick()
        }

        Function("getCurrentBeat") {
            ClickEngineBridge.nativeGetCurrentBeat()
        }

        Function("getCurrentBar") {
            ClickEngineBridge.nativeGetCurrentBar()
        }

        Function("isPlaying") {
            ClickEngineBridge.nativeIsPlaying()
        }

        // --- Practice mode ---

        Function("setSubdivision") { divisor: Int ->
            ClickEngineBridge.nativeSetSubdivision(divisor)
        }

        Function("setSwing") { percent: Double ->
            ClickEngineBridge.nativeSetSwing(percent.toFloat())
        }

        // --- Mixer ---

        Function("setChannelGain") { channel: Int, gain: Double ->
            ClickEngineBridge.nativeSetChannelGain(channel, gain.toFloat())
        }

        Function("setMasterGain") { gain: Double ->
            ClickEngineBridge.nativeSetMasterGain(gain.toFloat())
        }

        Function("setSplitStereo") { enabled: Boolean ->
            ClickEngineBridge.nativeSetSplitStereo(enabled)
        }

        // --- Track Player ---

        // Download MP3 from URL, decode to PCM, load into C++ engine
        AsyncFunction("loadTrackFromUrl") { url: String ->
            val context = appContext.reactContext ?: throw Exception("No context")
            withContext(Dispatchers.IO) {
                val cacheFile = downloadToCache(url, context.cacheDir)
                val pcmResult = decodeToPcm(cacheFile.absolutePath)
                ClickEngineBridge.nativeLoadTrack(
                    pcmResult.samples,
                    pcmResult.numFrames,
                    pcmResult.sampleRate,
                    pcmResult.channels
                )
                // Clean up cache file
                cacheFile.delete()
                mapOf(
                    "numFrames" to pcmResult.numFrames,
                    "sampleRate" to pcmResult.sampleRate,
                    "channels" to pcmResult.channels,
                    "durationMs" to (pcmResult.numFrames.toLong() * 1000L / pcmResult.sampleRate)
                )
            }
        }

        // Load from local file path
        AsyncFunction("loadTrackFromFile") { filePath: String ->
            withContext(Dispatchers.IO) {
                val pcmResult = decodeToPcm(filePath)
                ClickEngineBridge.nativeLoadTrack(
                    pcmResult.samples,
                    pcmResult.numFrames,
                    pcmResult.sampleRate,
                    pcmResult.channels
                )
                mapOf(
                    "numFrames" to pcmResult.numFrames,
                    "sampleRate" to pcmResult.sampleRate,
                    "channels" to pcmResult.channels,
                    "durationMs" to (pcmResult.numFrames.toLong() * 1000L / pcmResult.sampleRate)
                )
            }
        }

        Function("playTrack") {
            ClickEngineBridge.nativePlayTrack()
        }

        Function("pauseTrack") {
            ClickEngineBridge.nativePauseTrack()
        }

        Function("stopTrack") {
            ClickEngineBridge.nativeStopTrack()
        }

        Function("seekTrack") { frame: Double ->
            ClickEngineBridge.nativeSeekTrack(frame.toLong())
        }

        Function("setLoopRegion") { startFrame: Double, endFrame: Double ->
            ClickEngineBridge.nativeSetLoopRegion(startFrame.toLong(), endFrame.toLong())
        }

        Function("clearLoopRegion") {
            ClickEngineBridge.nativeClearLoopRegion()
        }

        Function("getTrackPosition") {
            ClickEngineBridge.nativeGetTrackPosition().toDouble()
        }

        Function("getTrackTotalFrames") {
            ClickEngineBridge.nativeGetTrackTotalFrames().toDouble()
        }

        Function("isTrackLoaded") {
            ClickEngineBridge.nativeIsTrackLoaded()
        }

        Function("setTrackSpeed") { ratio: Double ->
            ClickEngineBridge.nativeSetTrackSpeed(ratio.toFloat())
        }

        Function("getTrackSpeed") {
            ClickEngineBridge.nativeGetTrackSpeed().toDouble()
        }

        Function("nudgeClick") { direction: Int ->
            ClickEngineBridge.nativeNudgeClick(direction)
        }

        // Beat detection — runs offline analysis on loaded track
        AsyncFunction("analyseTrack") {
            withContext(Dispatchers.Default) {
                val result = ClickEngineBridge.nativeAnalyseTrack()
                mapOf(
                    "bpm" to result[0].toDouble(),
                    "beatOffsetMs" to result[1].toInt()
                )
            }
        }
    }

    // --- MP3 decode pipeline ---

    private data class PcmResult(
        val samples: FloatArray,
        val numFrames: Int,
        val sampleRate: Int,
        val channels: Int
    )

    private fun downloadToCache(urlString: String, cacheDir: File): File {
        val cacheFile = File(cacheDir, "practice_track_${System.currentTimeMillis()}.mp3")
        URL(urlString).openStream().use { input ->
            FileOutputStream(cacheFile).use { output ->
                input.copyTo(output)
            }
        }
        Log.i("GigBooks", "Downloaded track to cache: ${cacheFile.length()} bytes")
        return cacheFile
    }

    private fun decodeToPcm(filePath: String): PcmResult {
        val extractor = MediaExtractor()
        extractor.setDataSource(filePath)

        // Find audio track
        var audioTrackIndex = -1
        var format: MediaFormat? = null
        for (i in 0 until extractor.trackCount) {
            val trackFormat = extractor.getTrackFormat(i)
            val mime = trackFormat.getString(MediaFormat.KEY_MIME)
            if (mime?.startsWith("audio/") == true) {
                audioTrackIndex = i
                format = trackFormat
                break
            }
        }
        if (audioTrackIndex < 0 || format == null) {
            extractor.release()
            throw Exception("No audio track found in file")
        }

        extractor.selectTrack(audioTrackIndex)

        val sampleRate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE)
        val channels = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
        val mime = format.getString(MediaFormat.KEY_MIME)!!

        Log.i("GigBooks", "Decoding: mime=$mime, sampleRate=$sampleRate, channels=$channels")

        val codec = MediaCodec.createDecoderByType(mime)
        codec.configure(format, null, null, 0)
        codec.start()

        val bufferInfo = MediaCodec.BufferInfo()
        val allSamples = mutableListOf<Float>()
        var inputDone = false
        var outputDone = false

        while (!outputDone) {
            // Feed input
            if (!inputDone) {
                val inputIndex = codec.dequeueInputBuffer(10_000)
                if (inputIndex >= 0) {
                    val inputBuffer = codec.getInputBuffer(inputIndex)!!
                    val bytesRead = extractor.readSampleData(inputBuffer, 0)
                    if (bytesRead < 0) {
                        codec.queueInputBuffer(inputIndex, 0, 0, 0,
                            MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                        inputDone = true
                    } else {
                        codec.queueInputBuffer(inputIndex, 0, bytesRead,
                            extractor.sampleTime, 0)
                        extractor.advance()
                    }
                }
            }

            // Read output
            val outputIndex = codec.dequeueOutputBuffer(bufferInfo, 10_000)
            if (outputIndex >= 0) {
                if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
                    outputDone = true
                }

                val outputBuffer = codec.getOutputBuffer(outputIndex)!!
                outputBuffer.position(bufferInfo.offset)
                outputBuffer.limit(bufferInfo.offset + bufferInfo.size)

                // MediaCodec outputs 16-bit PCM — convert to float
                val shortBuffer = outputBuffer.order(ByteOrder.nativeOrder()).asShortBuffer()
                val numShorts = shortBuffer.remaining()
                for (i in 0 until numShorts) {
                    allSamples.add(shortBuffer.get().toFloat() / 32768.0f)
                }

                codec.releaseOutputBuffer(outputIndex, false)
            }
        }

        codec.stop()
        codec.release()
        extractor.release()

        val totalSamples = allSamples.size
        val numFrames = totalSamples / channels

        Log.i("GigBooks", "Decoded: $numFrames frames, $sampleRate Hz, $channels ch")

        return PcmResult(
            samples = allSamples.toFloatArray(),
            numFrames = numFrames,
            sampleRate = sampleRate,
            channels = channels
        )
    }
}

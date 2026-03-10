package com.thegreentangerine.gigbooks.data.audio

import android.content.Context
import android.media.MediaRecorder
import android.os.Build
import java.io.File

/**
 * Simple audio recorder for S41 takes.
 * Uses MediaRecorder (AAC/M4A) for reliable capture.
 * Separate from C++ engine — engine keeps playing for overdub (D-140).
 */
class AudioRecorder(private val context: Context) {

    private var recorder: MediaRecorder? = null
    private var outputFile: File? = null
    private var startTimeMs: Long = 0

    val isRecording: Boolean get() = recorder != null
    val elapsedMs: Long get() = if (isRecording) System.currentTimeMillis() - startTimeMs else 0

    /** Start recording audio. Returns the output file path. */
    fun start(): File {
        val dir = File(context.filesDir, "takes")
        if (!dir.exists()) dir.mkdirs()
        val file = File(dir, "rec_${System.currentTimeMillis()}.m4a")
        outputFile = file

        val rec = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            MediaRecorder(context)
        } else {
            @Suppress("DEPRECATION")
            MediaRecorder()
        }
        rec.setAudioSource(MediaRecorder.AudioSource.MIC)
        rec.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
        rec.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
        rec.setAudioSamplingRate(44100)
        rec.setAudioEncodingBitRate(128000)
        rec.setOutputFile(file.absolutePath)
        rec.prepare()
        rec.start()
        startTimeMs = System.currentTimeMillis()
        recorder = rec
        return file
    }

    /** Stop recording and return duration in seconds. */
    fun stop(): Double {
        val duration = elapsedMs / 1000.0
        try {
            recorder?.stop()
        } catch (_: Exception) { }
        recorder?.release()
        recorder = null
        return duration
    }

    /** Get the recorded file. */
    fun getOutputFile(): File? = outputFile

    /** Get max amplitude (0-32767) for level metering. Call periodically. */
    fun getMaxAmplitude(): Int {
        return try {
            recorder?.maxAmplitude ?: 0
        } catch (_: Exception) {
            0
        }
    }

    /** Clean up without saving. */
    fun discard() {
        stop()
        outputFile?.delete()
        outputFile = null
    }
}

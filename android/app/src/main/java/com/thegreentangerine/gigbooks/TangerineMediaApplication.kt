package com.thegreentangerine.gigbooks

import android.app.Application
import android.media.AudioManager
import com.thegreentangerine.gigbooks.audio.AudioEngineBridge

class TangerineMediaApplication : Application() {

    companion object {
        var engineAvailable = false
    }

    override fun onCreate() {
        super.onCreate()
        try {
            val am  = getSystemService(AUDIO_SERVICE) as AudioManager
            val sr  = am.getProperty(AudioManager.PROPERTY_OUTPUT_SAMPLE_RATE)?.toIntOrNull() ?: 44100
            val fpb = am.getProperty(AudioManager.PROPERTY_OUTPUT_FRAMES_PER_BUFFER)?.toIntOrNull() ?: 256
            engineAvailable = AudioEngineBridge.nativeStartEngine(sr, fpb)
        } catch (_: Throwable) {
            engineAvailable = false
        }
    }
}

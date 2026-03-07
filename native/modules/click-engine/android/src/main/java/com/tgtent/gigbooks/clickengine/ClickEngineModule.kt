package com.tgtent.gigbooks.clickengine

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

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
    }
}

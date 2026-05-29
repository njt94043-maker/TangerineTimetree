package com.thegreentangerine.gigbooks.data.orchestrator

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * S133 P1 — S23 battery alert during gig mode.
 *
 * Watches the system BATTERY_CHANGED sticky broadcast and surfaces a
 * "battery low" flag when the phone drops under [thresholdPct] (default 20%).
 * Pair with a one-shot toast / notification on the UI side — the monitor
 * itself never decides UI; it only flips state.
 *
 * Why a flag, not a callback: the gig-mode UI subscribes via [isLowBattery]
 * StateFlow; we don't want N parallel toast emissions if Android sticky-
 * broadcasts the same level twice. The UI debounces emission of the toast
 * by guarding on "we already showed it for this drop event".
 *
 * Lifecycle: [start] from OrchestratorService.onCreate; [stop] from
 * onDestroy. Receiver lifetime matches the foreground service so we don't
 * leak past the gig.
 */
class BatteryMonitor(
    private val context: Context,
    private val thresholdPct: Int = DEFAULT_THRESHOLD_PCT,
) {

    private val _levelPct = MutableStateFlow<Int?>(null)
    val levelPct: StateFlow<Int?> = _levelPct.asStateFlow()

    private val _isLowBattery = MutableStateFlow(false)
    val isLowBattery: StateFlow<Boolean> = _isLowBattery.asStateFlow()

    private val _isCharging = MutableStateFlow(false)
    val isCharging: StateFlow<Boolean> = _isCharging.asStateFlow()

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context?, intent: Intent?) {
            if (intent?.action != Intent.ACTION_BATTERY_CHANGED) return
            val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
            val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
            if (level < 0 || scale <= 0) return
            val pct = (level * 100 / scale).coerceIn(0, 100)
            _levelPct.value = pct

            val plugged = intent.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0)
            _isCharging.value = plugged != 0

            // Low = under threshold AND not actively charging. Plugging in
            // clears the warning even if level hasn't risen yet — Nathan
            // can see "ok it's recovering, don't panic".
            _isLowBattery.value = pct < thresholdPct && plugged == 0
        }
    }

    @Volatile private var registered = false

    fun start() {
        if (registered) return
        registered = true
        val filter = IntentFilter(Intent.ACTION_BATTERY_CHANGED)
        // Sticky broadcast — registerReceiver returns the most recent intent
        // immediately so we get the current level on first frame.
        val sticky = context.registerReceiver(receiver, filter)
        sticky?.let { receiver.onReceive(context, it) }
    }

    fun stop() {
        if (!registered) return
        registered = false
        try {
            context.unregisterReceiver(receiver)
        } catch (_: IllegalArgumentException) {
            // Already unregistered — defensive (e.g. double-stop on
            // crash-recovery path).
        }
    }

    companion object {
        /** Default low-battery threshold per S133 P1 brief. */
        const val DEFAULT_THRESHOLD_PCT = 20
    }
}

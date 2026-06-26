package com.thegreentangerine.gigbooks.data.orchestrator

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.rigDataStore: DataStore<Preferences> by preferencesDataStore(name = "rig_target")

/**
 * S211: persists the gig rig's network target so it is set once and survives
 * reboot/reinstall — replacing the dead 2026-06-13 hard-pinned hotspot IP that
 * silently broke connectivity at any other venue.
 *
 * One host drives both transports: OSC (host:oscPort, default 8000) and the
 * Media-Server HTTP bridge (host:9200, fixed by GIG_PORT_DEFAULT). When
 * [RigTarget.autoDiscover] is true the saved host is dormant and mDNS drives
 * targeting; saving a manual host flips autoDiscover off. Mirrors the
 * DataStore pattern in CameraSettingsStore.
 */
class RigTargetStore(private val context: Context) {

    // S233: apiSecret is the per-rig Media-Server API secret, set once via the "Pair with rig"
    // flow in ReaperConfigPane (scan the host's QR or type/paste the raw 64-char secret). The old
    // LAN GET /api/pairing hand-out is dead. "" until paired — gates the host HTTP bridge in either
    // auto/manual mode.
    data class RigTarget(val host: String?, val oscPort: Int, val autoDiscover: Boolean, val apiSecret: String = "")

    fun observe(): Flow<RigTarget> = context.rigDataStore.data.map { prefs ->
        RigTarget(
            host = prefs[KEY_HOST],
            oscPort = prefs[KEY_OSC_PORT] ?: DEFAULT_OSC_PORT,
            autoDiscover = prefs[KEY_AUTO_DISCOVER] ?: true,
            apiSecret = prefs[KEY_API_SECRET] ?: "",
        )
    }

    suspend fun current(): RigTarget = observe().first()

    /** Save a manually-entered rig host (+ OSC port). Flips to manual mode. */
    suspend fun setManual(host: String, oscPort: Int) {
        context.rigDataStore.edit { prefs ->
            prefs[KEY_HOST] = host.trim()
            prefs[KEY_OSC_PORT] = oscPort
            prefs[KEY_AUTO_DISCOVER] = false
        }
    }

    suspend fun setAutoDiscover(enabled: Boolean) {
        context.rigDataStore.edit { prefs -> prefs[KEY_AUTO_DISCOVER] = enabled }
    }

    /** S233: persist the per-rig MS API secret (set via the "Pair with rig" QR/typed flow in
     *  ReaperConfigPane; the old GET /api/pairing hand-out is dead). "" clears it. Independent of
     *  host/auto-discover — the secret gates the HTTP bridge in either mode. */
    suspend fun setApiSecret(secret: String) {
        context.rigDataStore.edit { prefs -> prefs[KEY_API_SECRET] = secret.trim() }
    }

    companion object {
        const val DEFAULT_OSC_PORT = 8000
        private val KEY_HOST = stringPreferencesKey("rig_host")
        private val KEY_OSC_PORT = intPreferencesKey("rig_osc_port")
        private val KEY_AUTO_DISCOVER = booleanPreferencesKey("rig_auto_discover")
        private val KEY_API_SECRET = stringPreferencesKey("rig_api_secret")
    }
}

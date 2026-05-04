package com.thegreentangerine.gigbooks.data.xr18

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "camera_settings")

/**
 * Persists per-role camera settings so band members configure once per device.
 *
 * Two roles, two independent settings blobs:
 *   - Peer (other phones acting as cameras during the gig)
 *   - Orchestrator (drummer's S23U recording its own selfie video while prompting)
 *
 * Same phone could be either role depending on the drawer entry, so the two are
 * stored independently. Defaults differ: peer = back camera (typical fan-cam from
 * audience), orchestrator = front camera (drummer-cam pointed at face).
 */
class CameraSettingsStore(private val context: Context) {

    enum class Role { Peer, Orchestrator }

    fun observe(role: Role): Flow<PhoneSettings> = context.dataStore.data
        .map { prefs ->
            val def = defaultFor(role)
            PhoneSettings(
                resolution = prefs[keyResolution(role)] ?: def.resolution,
                framerate = prefs[keyFramerate(role)] ?: def.framerate,
                cameraFacing = prefs[keyFacing(role)] ?: def.cameraFacing,
                useAutoRotation = prefs[keyAutoRotation(role)] ?: def.useAutoRotation,
                rotationDegrees = prefs[keyRotation(role)] ?: def.rotationDegrees,
            )
        }
        // DataStore can emit identical PhoneSettings on initial load (empty prefs
        // map → defaults; then again when the prefs file is fully read). Without
        // dedup, every emission re-keys downstream Compose effects, which CameraX
        // turns into a rebind storm — the S122 gig-night failure mode.
        .distinctUntilChanged()

    suspend fun current(role: Role): PhoneSettings = observe(role).first()

    suspend fun update(role: Role, settings: PhoneSettings) {
        context.dataStore.edit { prefs ->
            prefs[keyFacing(role)] = settings.cameraFacing
            prefs[keyAutoRotation(role)] = settings.useAutoRotation
            prefs[keyRotation(role)] = settings.rotationDegrees
            prefs[keyResolution(role)] = settings.resolution
            prefs[keyFramerate(role)] = settings.framerate
        }
    }

    private fun defaultFor(role: Role): PhoneSettings = when (role) {
        Role.Peer -> PhoneSettings(cameraFacing = "back")
        Role.Orchestrator -> PhoneSettings(cameraFacing = "front")
    }

    private fun keyFacing(role: Role) = stringPreferencesKey("${role.name}_facing")
    private fun keyAutoRotation(role: Role) = booleanPreferencesKey("${role.name}_auto_rotation")
    private fun keyRotation(role: Role) = intPreferencesKey("${role.name}_rotation")
    private fun keyResolution(role: Role) = stringPreferencesKey("${role.name}_resolution")
    private fun keyFramerate(role: Role) = intPreferencesKey("${role.name}_framerate")
}

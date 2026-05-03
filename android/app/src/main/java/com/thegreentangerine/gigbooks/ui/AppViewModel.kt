package com.thegreentangerine.gigbooks.ui

import android.app.Application
import androidx.camera.view.PreviewView
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.viewModelScope
import com.thegreentangerine.gigbooks.data.supabase.AuthRepository
import com.thegreentangerine.gigbooks.data.supabase.CachedGigRepository
import com.thegreentangerine.gigbooks.data.supabase.OfflineCache
import com.thegreentangerine.gigbooks.data.supabase.SetlistEntriesRepository
import com.thegreentangerine.gigbooks.data.supabase.models.AwayDate
import com.thegreentangerine.gigbooks.data.supabase.models.Gig
import com.thegreentangerine.gigbooks.data.xr18.CameraRecordingManager
import com.thegreentangerine.gigbooks.data.xr18.PhoneSettings
import java.time.LocalDate
import kotlinx.coroutines.launch

/**
 * Minimal ViewModel for the post-S121 APK. Per the S118 ecosystem-pivot lock,
 * the APK is just calendar + Orchestrator + Drummer Prompter + Peer + Settings.
 * No more Songs / setlists-as-collections / player modes / click engine / track
 * playback / stem mixing / takes — those moved to Media Server (home practice)
 * and Studio v2 (gig-mode) by S118 design.
 *
 * What this VM owns now:
 *   - Calendar state (gigs + away dates + profiles for the calendar screen).
 *   - The shared `CameraRecordingManager` so PeerScreen can bind / record.
 *
 * Setlist data lives in [SetlistEntriesRepository] (singleton, Realtime-backed).
 * The drummer prompter reads it directly — no VM hop.
 */
class AppViewModel(app: Application) : AndroidViewModel(app) {

    val currentUserId: String? get() = AuthRepository.currentUserId()

    private val offlineCache = OfflineCache(app)
    private val cachedGigs = CachedGigRepository(offlineCache)

    /** D-166: skip splash on Activity recreation/resume. */
    var splashDone by mutableStateOf(false)

    // ── Calendar ──────────────────────────────────────────────────────────────
    private val _today = LocalDate.now()
    var calViewYear  by mutableStateOf(_today.year);          private set
    var calViewMonth by mutableStateOf(_today.monthValue);    private set
    var calGigs      by mutableStateOf<List<Gig>>(emptyList()); private set
    var calAwayDates by mutableStateOf<List<AwayDate>>(emptyList()); private set
    var calLoading   by mutableStateOf(false);                private set
    var profileNames by mutableStateOf<Map<String, String>>(emptyMap()); private set

    init {
        loadCalendarMonth()
        // Kick the setlist repo so DrummerPrompter has data when it opens.
        SetlistEntriesRepository.start()
    }

    fun calNavigate(year: Int, month: Int) {
        calViewYear  = year
        calViewMonth = month
        loadCalendarMonth(year, month)
    }

    fun loadCalendarMonth(year: Int = calViewYear, month: Int = calViewMonth) {
        viewModelScope.launch {
            calLoading = true
            try {
                calGigs = cachedGigs.getGigsForMonth(year, month)
                calAwayDates = cachedGigs.getAwayDatesForMonth(year, month)
                if (profileNames.isEmpty()) {
                    profileNames = cachedGigs.getProfiles().associate { it.id to it.name }
                }
            } catch (_: Exception) {
                /* non-fatal — calendar shows empty when network is down */
            } finally {
                calLoading = false
            }
        }
    }

    // ── Camera (used by PeerScreen) ───────────────────────────────────────────
    // Lazily created so phones that never open Peer don't allocate CameraX state.

    private var _cameraRecording: CameraRecordingManager? = null

    val cameraRecording: CameraRecordingManager get() {
        if (_cameraRecording == null) {
            _cameraRecording = CameraRecordingManager(getApplication())
        }
        return _cameraRecording!!
    }

    fun bindCamera(lifecycleOwner: LifecycleOwner, previewView: PreviewView, settings: PhoneSettings = PhoneSettings()) {
        cameraRecording.bind(lifecycleOwner, previewView, settings)
    }

    fun releaseCamera() { _cameraRecording?.release() }

    override fun onCleared() {
        super.onCleared()
        _cameraRecording?.release()
    }
}

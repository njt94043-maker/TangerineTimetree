package com.thegreentangerine.gigbooks.ui

import android.app.Application
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.thegreentangerine.gigbooks.TangerineMediaApplication
import com.thegreentangerine.gigbooks.audio.AudioEngineBridge
import com.thegreentangerine.gigbooks.data.supabase.AuthRepository
import com.thegreentangerine.gigbooks.data.supabase.CachedGigRepository
import com.thegreentangerine.gigbooks.data.supabase.CachedSongRepository
import com.thegreentangerine.gigbooks.data.supabase.CachedSetlistRepository
import com.thegreentangerine.gigbooks.data.supabase.GigRepository
import com.thegreentangerine.gigbooks.data.supabase.OfflineCache
import com.thegreentangerine.gigbooks.data.supabase.SetlistRepository
import com.thegreentangerine.gigbooks.data.supabase.SongRepository
import com.thegreentangerine.gigbooks.data.supabase.StemRepository
import com.thegreentangerine.gigbooks.data.xr18.CameraRecordingManager
import com.thegreentangerine.gigbooks.data.xr18.ConnectionState
import com.thegreentangerine.gigbooks.data.xr18.PairingInfo
import com.thegreentangerine.gigbooks.data.xr18.PhoneCompanionManager
import com.thegreentangerine.gigbooks.data.xr18.PhoneSettings
import com.thegreentangerine.gigbooks.data.supabase.models.AwayDate
import com.thegreentangerine.gigbooks.data.supabase.models.Gig
import com.thegreentangerine.gigbooks.data.supabase.models.SetlistWithSongs
import com.thegreentangerine.gigbooks.data.supabase.models.Song
import com.thegreentangerine.gigbooks.data.supabase.models.SongStem
import java.time.LocalDate
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import androidx.camera.view.PreviewView
import androidx.lifecycle.LifecycleOwner
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder

class AppViewModel(app: Application) : AndroidViewModel(app) {

    val engineAvailable: Boolean = TangerineMediaApplication.engineAvailable

    // Offline-first cached repositories
    private val offlineCache = OfflineCache(app)
    private val cachedGigs = CachedGigRepository(offlineCache)
    private val cachedSongs = CachedSongRepository(offlineCache)
    private val cachedSetlists = CachedSetlistRepository(offlineCache)

    // D-166: Track splash completion so we skip it on Activity recreation / resume
    var splashDone by mutableStateOf(false)

    // ── Library ───────────────────────────────────────────────────────────────
    var songs    by mutableStateOf<List<Song>>(emptyList());           private set
    var setlists by mutableStateOf<List<SetlistWithSongs>>(emptyList()); private set
    var loadError by mutableStateOf<String?>(null);                    private set
    var isLoading by mutableStateOf(true);                             private set
    var profileNames by mutableStateOf<Map<String, String>>(emptyMap()); private set
    var sharedSongIds by mutableStateOf<Set<String>>(emptySet());        private set
    val currentUserId: String? get() = AuthRepository.currentUserId()

    // ── Calendar ──────────────────────────────────────────────────────────────
    private val _today = LocalDate.now()
    var calViewYear  by mutableStateOf(_today.year);        private set
    var calViewMonth by mutableStateOf(_today.monthValue);  private set
    var calGigs      by mutableStateOf<List<Gig>>(emptyList());        private set
    var calAwayDates by mutableStateOf<List<AwayDate>>(emptyList());   private set
    var calLoading   by mutableStateOf(false);                         private set

    // ── Selection ─────────────────────────────────────────────────────────────
    var selectedSong     by mutableStateOf<Song?>(null)
    var activeSetlist    by mutableStateOf<SetlistWithSongs?>(null);   private set
    var activeSetlistIdx by mutableStateOf(0);                         private set

    // D-166: Track the last player mode so the drawer can offer "return to player"
    // Values: "live", "practice", "view", or null when no player session is active
    var activePlayerRoute by mutableStateOf<String?>(null);            private set

    fun enterPlayer(route: String) { activePlayerRoute = route }
    fun exitPlayer() {
        activePlayerRoute = null
        // Stop playback + release audio so nothing runs in background
        if (engineAvailable) try {
            if (isClickPlaying) { AudioEngineBridge.nativeStopClick(); isClickPlaying = false }
            AudioEngineBridge.nativeResetTrack()
        } catch (_: Exception) { }
        trackLoaded = false
        isTrackPlaying = false
        selectedSong = null
        queueSongs = emptyList()
        activeSetlist = null
    }

    // ── Queue (D-168) ────────────────────────────────────────────────────────
    // Generalized queue: the ordered list of songs for next/prev navigation.
    // Set from the source list the user tapped from (filtered songs, setlist, etc.)
    var queueSongs by mutableStateOf<List<Song>>(emptyList());  private set
    var queueIdx   by mutableStateOf(0);                         private set
    var queueLabel by mutableStateOf("All Songs");               private set

    // ── Click engine ──────────────────────────────────────────────────────────
    var isClickPlaying by mutableStateOf(false);    private set
    var currentBeat    by mutableStateOf(0);        private set
    var currentBar     by mutableStateOf(0);        private set
    var bpmOffset      by mutableStateOf(0f)        // Live mode ±BPM nudge

    // ── Practice controls ─────────────────────────────────────────────────────
    var practiceSpeed  by mutableStateOf(1.0f)
    var subdivision    by mutableStateOf(1)         // 1=off, 2=8ths, 3=triplets, 4=16ths
    var countInBars    by mutableStateOf(0)
    var nudgeOffsetMs  by mutableStateOf(0f);       private set

    val effectiveBpm: Float
        get() = ((selectedSong?.bpm ?: 120.0) * practiceSpeed).toFloat() + bpmOffset

    // ── Mix gains + mute ──────────────────────────────────────────────────────
    var clickGain    by mutableStateOf(1.5f)
    var trackGain    by mutableStateOf(0.7f)
    var isClickMuted by mutableStateOf(false)

    var isTrackMuted by mutableStateOf(false)

    fun changeClickGain(g: Float) { clickGain = g; if (!isClickMuted && engineAvailable) try { AudioEngineBridge.nativeSetChannelGain(0, g) } catch (_: Exception) { } }
    fun changeTrackGain(g: Float) { trackGain = g; if (!isTrackMuted && engineAvailable) try { AudioEngineBridge.nativeSetChannelGain(1, g) } catch (_: Exception) { } }
    fun toggleClickMute() {
        isClickMuted = !isClickMuted
        if (engineAvailable) try {
            AudioEngineBridge.nativeSetChannelGain(0, if (isClickMuted) 0f else clickGain)
        } catch (_: Exception) { }
    }
    fun toggleTrackMute() {
        isTrackMuted = !isTrackMuted
        if (engineAvailable) try {
            AudioEngineBridge.nativeSetChannelGain(1, if (isTrackMuted) 0f else trackGain)
        } catch (_: Exception) { }
    }

    // ── Track ─────────────────────────────────────────────────────────────────
    var trackLoaded      by mutableStateOf(false);   private set
    var isTrackPlaying   by mutableStateOf(false);   private set
    var trackPositionFr  by mutableStateOf(0L);      private set
    var trackTotalFr     by mutableStateOf(1L);      private set
    var trackSampleRate  by mutableStateOf(44100);   private set
    var isLoadingTrack   by mutableStateOf(false);   private set
    var trackError       by mutableStateOf<String?>(null); private set
    var loopAFrame       by mutableStateOf<Long?>(null);   private set
    var loopBFrame       by mutableStateOf<Long?>(null);   private set

    // ── Stems ─────────────────────────────────────────────────────────────────
    // loadedStems: list of (stemIndex, SongStem) for stems successfully loaded into the engine
    var loadedStems   by mutableStateOf<List<Pair<Int, SongStem>>>(emptyList()); private set
    var stemsLoading  by mutableStateOf(false);                                  private set
    var stemErrors    by mutableStateOf<Map<String, String>>(emptyMap());        private set
    // stemGains: idx → gain (0..1), one entry per loaded stem, default 1.0
    var stemGains     by mutableStateOf<Map<Int, Float>>(emptyMap());            private set
    // stemMutes: idx → muted (true = channel silenced, gain stored in stemGains)
    var stemMutes     by mutableStateOf<Map<Int, Boolean>>(emptyMap());          private set
    // processingStatus: non-null while server is processing stems (pending/analysing/separating)
    var processingStatus by mutableStateOf<String?>(null);                       private set

    // ── Visualiser ─────────────────────────────────────────────────────────
    // 16 band energies (0-1) from the C++ audio callback, polled on each frame
    var visBands by mutableStateOf(FloatArray(16)); private set

    // ── Takes (S41) ─────────────────────────────────────────────────────────
    var cloudTakes by mutableStateOf<List<SongStem>>(emptyList());              private set
    var localTakes by mutableStateOf<List<com.thegreentangerine.gigbooks.data.audio.LocalTakesStore.LocalTake>>(emptyList()); private set
    var takesLoading by mutableStateOf(false);                                  private set

    fun loadTakes(songId: String) {
        val userId = currentUserId ?: return
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val cloud = StemRepository.getUserRecordedTakes(songId)
                val local = com.thegreentangerine.gigbooks.data.audio.LocalTakesStore.getUserTakes(
                    getApplication(), songId, userId
                )
                withContext(Dispatchers.Main) {
                    cloudTakes = cloud
                    localTakes = local
                }
            } catch (_: Exception) { }
        }
    }

    fun setBestTake(stemId: String, songId: String) {
        viewModelScope.launch(Dispatchers.IO) {
            takesLoading = true
            try {
                StemRepository.setBestTake(stemId, songId)
                loadTakes(songId)
            } catch (_: Exception) { }
            takesLoading = false
        }
    }

    fun clearBestTake(stemId: String, songId: String) {
        viewModelScope.launch(Dispatchers.IO) {
            takesLoading = true
            try {
                StemRepository.clearBestTake(stemId)
                loadTakes(songId)
            } catch (_: Exception) { }
            takesLoading = false
        }
    }

    fun deleteCloudTake(stemId: String, songId: String) {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                StemRepository.deleteRecordedTake(stemId)
                loadTakes(songId)
            } catch (_: Exception) { }
        }
    }

    fun deleteLocalTake(takeId: String, songId: String) {
        com.thegreentangerine.gigbooks.data.audio.LocalTakesStore.deleteTake(getApplication(), takeId)
        val userId = currentUserId ?: return
        localTakes = com.thegreentangerine.gigbooks.data.audio.LocalTakesStore.getUserTakes(
            getApplication(), songId, userId
        )
    }

    // ── Recording (S41) ──────────────────────────────────────────────────────
    enum class RecState { IDLE, COUNT_IN, RECORDING, DONE }

    var recState      by mutableStateOf(RecState.IDLE);          private set
    var recElapsedSec by mutableStateOf(0);                      private set
    var recInputLevel by mutableStateOf(0f);                     private set  // 0-1 normalised
    var recTakeNumber by mutableStateOf(1);                      private set
    var recDuration   by mutableStateOf(0.0);                    private set
    var recFile       by mutableStateOf<java.io.File?>(null);    private set

    private val audioRecorder by lazy { com.thegreentangerine.gigbooks.data.audio.AudioRecorder(getApplication()) }
    private var recTimerJob: Job? = null
    private var recLevelJob: Job? = null

    fun startRecording() {
        val song = selectedSong ?: return
        val userId = currentUserId ?: return

        // Get next take number
        recTakeNumber = com.thegreentangerine.gigbooks.data.audio.LocalTakesStore
            .getNextTakeNumber(getApplication(), song.id, userId)

        viewModelScope.launch {
            // Count-in (D-142)
            if (countInBars > 0 && effectiveBpm > 0) {
                recState = RecState.COUNT_IN
                val beatsPerBar = (selectedSong?.timeSignatureTop?.toInt() ?: 4)
                val countInBeats = countInBars * beatsPerBar
                val beatMs = (60_000.0 / effectiveBpm).toLong()
                // Start click for count-in
                if (!isClickPlaying && engineAvailable) play()
                delay(countInBeats * beatMs)
            }

            // Start recording
            recState = RecState.RECORDING
            recElapsedSec = 0
            recFile = audioRecorder.start()

            // Timer
            recTimerJob = viewModelScope.launch {
                while (isActive) {
                    delay(250)
                    recElapsedSec = (audioRecorder.elapsedMs / 1000).toInt()
                }
            }

            // Level metering
            recLevelJob = viewModelScope.launch {
                while (isActive) {
                    delay(100)
                    val amp = audioRecorder.getMaxAmplitude()
                    recInputLevel = (amp / 32767f).coerceIn(0f, 1f)
                }
            }
        }
    }

    fun stopRecording() {
        recTimerJob?.cancel()
        recLevelJob?.cancel()
        recDuration = audioRecorder.stop()
        recInputLevel = 0f
        recState = RecState.DONE
    }

    /** Post-recording: discard and optionally re-take */
    fun discardRecording(retake: Boolean = false) {
        audioRecorder.discard()
        recFile = null
        recState = RecState.IDLE
        if (retake) startRecording()
    }

    /** Post-recording: save take locally, optionally as best, optionally re-take */
    fun saveRecording(asBest: Boolean, retake: Boolean = false, preview: Boolean = false) {
        val song = selectedSong ?: return
        val userId = currentUserId ?: return
        val file = recFile ?: return

        viewModelScope.launch(Dispatchers.IO) {
            val audioData = file.readBytes()
            val take = com.thegreentangerine.gigbooks.data.audio.LocalTakesStore.LocalTake(
                id = com.thegreentangerine.gigbooks.data.audio.LocalTakesStore.makeTakeId(song.id, userId, recTakeNumber),
                songId = song.id,
                userId = userId,
                takeNumber = recTakeNumber,
                audioFileName = file.name,
                durationSeconds = recDuration,
                label = "Take $recTakeNumber",
                createdAt = java.time.Instant.now().toString(),
            )
            com.thegreentangerine.gigbooks.data.audio.LocalTakesStore.saveTake(getApplication(), take, audioData)

            if (asBest) {
                // TODO: Upload to Supabase as best take (needs storage upload API on Android)
            }

            withContext(Dispatchers.Main) {
                loadTakes(song.id)
                recFile = null
                recState = RecState.IDLE
                if (retake) startRecording()
            }
        }
    }

    // ── Take Playback (S45) ────────────────────────────────────────────────────
    var playingTakeId by mutableStateOf<String?>(null);    private set
    private var takePlayer: android.media.MediaPlayer? = null

    /** Play a local take by its ID. Uses MediaPlayer for simple playback. */
    fun playTake(takeId: String) {
        // Stop any existing playback
        stopTakePlayback()

        val userId = currentUserId ?: return
        val songId = selectedSong?.id ?: return

        // Try local take first
        val localTake = localTakes.find { it.id == takeId }
        if (localTake != null) {
            val takesDir = java.io.File(getApplication<android.app.Application>().filesDir, "takes")
            val audioFile = java.io.File(takesDir, localTake.audioFileName)
            if (audioFile.exists()) {
                try {
                    takePlayer = android.media.MediaPlayer().apply {
                        setDataSource(audioFile.absolutePath)
                        prepare()
                        start()
                        setOnCompletionListener { stopTakePlayback() }
                    }
                    playingTakeId = takeId
                } catch (_: Exception) { }
            }
            return
        }

        // Try cloud take (has audio_url)
        val cloudTake = cloudTakes.find { it.id == takeId }
        if (cloudTake != null && cloudTake.audioUrl != null) {
            viewModelScope.launch(Dispatchers.IO) {
                try {
                    val mp = android.media.MediaPlayer().apply {
                        setDataSource(cloudTake.audioUrl)
                        prepare()
                    }
                    withContext(Dispatchers.Main) {
                        takePlayer = mp
                        playingTakeId = takeId
                        mp.start()
                        mp.setOnCompletionListener { stopTakePlayback() }
                    }
                } catch (_: Exception) { }
            }
        }
    }

    fun stopTakePlayback() {
        try {
            takePlayer?.stop()
            takePlayer?.release()
        } catch (_: Exception) { }
        takePlayer = null
        playingTakeId = null
    }

    // ── Waveform ──────────────────────────────────────────────────────────────
    // Amplitude envelope of the main track, normalised to 0..1, ~600 points.
    var waveformEnvelope by mutableStateOf<FloatArray>(floatArrayOf());          private set

    // ── Beat alignment ────────────────────────────────────────────────────────
    // detectedBpm / detectedOffsetMs: results from nativeAnalyseTrack()
    // showBeatBanner: true when analysis returned usable results, user hasn't applied yet
    // isAnalysing: true while analysis is running in background
    // appliedBeatOffsetMs: non-zero when an offset has been applied to the engine
    var detectedBpm        by mutableStateOf(0f);    private set
    var detectedOffsetMs   by mutableStateOf(0);     private set
    var showBeatBanner     by mutableStateOf(false);  private set
    var isAnalysing        by mutableStateOf(false);  private set
    var appliedBeatOffsetMs by mutableStateOf(0);    private set

    private var beatPollJob:  Job? = null
    private var trackPollJob: Job? = null

    init {
        loadLibrary()
        loadCalendarMonth()
        // Apply default mix gains to engine
        if (engineAvailable) try {
            AudioEngineBridge.nativeSetChannelGain(0, clickGain)
            AudioEngineBridge.nativeSetChannelGain(1, trackGain)
        } catch (_: Exception) { }
    }

    // ── New Song Idea (D-138) ──────────────────────────────────────────────────
    var newIdeaSong by mutableStateOf<Song?>(null); private set

    /** Create a minimal song and flag it for immediate recording */
    fun createSongIdea(name: String, onCreated: (Song) -> Unit) {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val song = SongRepository.createSong(name = name, category = "personal_original")
                withContext(Dispatchers.Main) {
                    newIdeaSong = song
                    songs = songs + song  // Add to library list
                    onCreated(song)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    loadError = "Failed to create song: ${e.message}"
                }
            }
        }
    }

    /** Clear the new idea flag (after recording starts) */
    fun clearNewIdeaFlag() { newIdeaSong = null }

    /** Update a song's fields in Supabase and refresh local state */
    fun updateSong(songId: String, updates: Map<String, Any?>, onDone: () -> Unit = {}) {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                SongRepository.updateSong(songId, updates)
                val refreshed = cachedSongs.getSongs()
                withContext(Dispatchers.Main) {
                    songs = refreshed
                    // Update selectedSong if it's the one we just edited
                    if (selectedSong?.id == songId) {
                        selectedSong = refreshed.find { it.id == songId }
                    }
                    onDone()
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    loadError = "Failed to update song: ${e.message}"
                }
            }
        }
    }

    // ── Library loading ───────────────────────────────────────────────────────
    fun loadLibrary() {
        viewModelScope.launch {
            isLoading = true; loadError = null
            try {
                songs    = cachedSongs.getSongs()
                setlists = SetlistRepository.getAllSetlistsWithSongs()
                // Load profile name map for owner tags
                val profiles = cachedGigs.getProfiles()
                profileNames = profiles.associate { it.id to it.name }
                // Load shared song IDs for current user
                val uid = currentUserId
                if (uid != null) {
                    sharedSongIds = SongRepository.getSharedSongIds(uid)
                }
            } catch (e: Exception) {
                loadError = e.message
            } finally {
                isLoading = false
            }
        }
    }

    // ── Calendar loading ──────────────────────────────────────────────────────
    fun calNavigate(year: Int, month: Int) {
        calViewYear  = year
        calViewMonth = month
        loadCalendarMonth(year, month)
    }

    fun loadCalendarMonth(year: Int = calViewYear, month: Int = calViewMonth) {
        viewModelScope.launch {
            calLoading = true
            try {
                calGigs      = cachedGigs.getGigsForMonth(year, month)
                calAwayDates = cachedGigs.getAwayDatesForMonth(year, month)
            } catch (_: Exception) { /* non-fatal — calendar just shows empty */ }
            finally { calLoading = false }
        }
    }

    // ── Selection ─────────────────────────────────────────────────────────────
    fun setStemGain(idx: Int, gain: Float) {
        stemGains = stemGains + (idx to gain)
        if (stemMutes[idx] != true && engineAvailable) {
            try { AudioEngineBridge.nativeSetChannelGain(2 + idx, gain) } catch (_: Exception) { }
        }
    }

    fun toggleStemMute(idx: Int) {
        val wasMuted = stemMutes[idx] == true
        stemMutes = stemMutes + (idx to !wasMuted)
        if (engineAvailable) try {
            val gain = if (!wasMuted) 0f else (stemGains[idx] ?: 1f)
            AudioEngineBridge.nativeSetChannelGain(2 + idx, gain)
        } catch (_: Exception) { }
    }

    fun selectSong(song: Song) {
        // D-165: Stop + release previous track/stems before loading new song
        if (engineAvailable) try {
            if (isClickPlaying) { AudioEngineBridge.nativeStopClick(); isClickPlaying = false }
            AudioEngineBridge.nativeResetTrack()
        } catch (_: Exception) { }
        trackLoaded     = false
        loadedStems     = emptyList()
        stemErrors      = emptyMap()
        stemGains       = emptyMap()
        stemMutes       = emptyMap()
        // Restore track gain after stems cleared (was muted when stems were active)
        if (engineAvailable) try { AudioEngineBridge.nativeSetChannelGain(1, trackGain) } catch (_: Exception) { }

        selectedSong        = song
        bpmOffset           = 0f
        practiceSpeed       = 1f
        nudgeOffsetMs       = 0f
        waveformEnvelope    = floatArrayOf()
        detectedBpm         = 0f
        detectedOffsetMs    = 0
        showBeatBanner      = false
        appliedBeatOffsetMs = 0
        activeSetlist?.songs
            ?.indexOfFirst { it.songs?.id == song.id }
            ?.takeIf { it >= 0 }
            ?.let { activeSetlistIdx = it }
        // D-168: keep queueIdx in sync
        queueSongs.indexOfFirst { it.id == song.id }
            .takeIf { it >= 0 }
            ?.let { queueIdx = it }
        applyEngineSettings(song)  // always sync BPM/time-sig to engine when song selected

        // D-165: Auto-load the new song's track if it has audio
        if (song.hasAudio) {
            loadTrack(song.audioUrl!!)
        }
    }

    fun selectSetlist(setlist: SetlistWithSongs) {
        activeSetlist    = setlist
        activeSetlistIdx = 0
        // D-168: setlist songs become the queue
        queueSongs = setlist.songs.mapNotNull { it.songs }
        queueIdx   = 0
        queueLabel = setlist.setlist.name
        setlist.songs.firstOrNull()?.songs?.let { selectSong(it) }
    }

    /** D-168: Set the queue from an ad-hoc song list (e.g. filtered Library songs). */
    fun setQueue(songs: List<Song>, startSong: Song, label: String = "All Songs") {
        activeSetlist = null
        queueSongs = songs
        queueIdx   = songs.indexOfFirst { it.id == startSong.id }.coerceAtLeast(0)
        queueLabel = label
    }

    fun clearSetlist() { activeSetlist = null }

    // ── Set complete ────────────────────────────────────────────────────────
    var isSetComplete by mutableStateOf(false); private set

    fun dismissSetComplete() { isSetComplete = false }

    fun restartSetlist() {
        isSetComplete = false
        queueIdx = 0
        activeSetlistIdx = 0
        queueSongs.firstOrNull()?.let { selectSong(it) }
    }

    fun nextSong() {
        // D-168: navigate via generalized queue
        if (queueSongs.isEmpty()) return
        if (queueIdx < queueSongs.size - 1) {
            queueIdx++
            activeSetlist?.let { activeSetlistIdx = queueIdx }
            selectSong(queueSongs[queueIdx])
        } else {
            isSetComplete = true
        }
    }

    fun prevSong() {
        if (queueSongs.isEmpty()) return
        if (queueIdx > 0) {
            queueIdx--
            activeSetlist?.let { activeSetlistIdx = queueIdx }
            selectSong(queueSongs[queueIdx])
        }
    }

    fun reorderSetlistSong(fromIdx: Int, toIdx: Int) {
        if (fromIdx == toIdx || queueSongs.isEmpty()) return
        val reordered = queueSongs.toMutableList()
        val moved = reordered.removeAt(fromIdx)
        reordered.add(toIdx, moved)
        queueSongs = reordered
        queueIdx = reordered.indexOfFirst { it.id == selectedSong?.id }.coerceAtLeast(0)
        // Keep activeSetlist in sync if present
        val current = activeSetlist
        if (current != null) {
            val setlistSongs = current.songs.toMutableList()
            if (fromIdx in setlistSongs.indices && toIdx in setlistSongs.indices) {
                val movedSls = setlistSongs.removeAt(fromIdx)
                setlistSongs.add(toIdx, movedSls)
                activeSetlist = current.copy(songs = setlistSongs)
                activeSetlistIdx = queueIdx
            }
        }
    }

    fun jumpToSong(idx: Int) {
        if (idx in queueSongs.indices) {
            queueIdx = idx
            activeSetlist?.let { activeSetlistIdx = idx }
            selectSong(queueSongs[idx])
        }
    }

    // ── Engine ────────────────────────────────────────────────────────────────
    private fun applyEngineSettings(song: Song) {
        if (!engineAvailable) return
        try {
            // Only apply metadata BPM if analysis hasn't already set one
            if (detectedBpm <= 0f) AudioEngineBridge.nativeSetBpm(effectiveBpm)
            AudioEngineBridge.nativeSetTimeSignature(
                song.timeSignatureTop.toInt(),
                song.timeSignatureBottom.toInt(),
            )
            AudioEngineBridge.nativeSetSubdivision(subdivision)
            AudioEngineBridge.nativeSetSwing(song.swingPercent.toFloat())
            AudioEngineBridge.nativeSetCountIn(countInBars, 0)
        } catch (_: Exception) { }
    }

    /** Start click engine + begin beat polling. */
    fun startClick() {
        if (!engineAvailable) return
        selectedSong?.let { applyEngineSettings(it) }
        try { AudioEngineBridge.nativeStartClick() } catch (_: Exception) { return }
        isClickPlaying = true
        beatPollJob?.cancel()
        var lastTick = 0  // matches C++ start() reset: beatTick_=0
        beatPollJob = viewModelScope.launch(Dispatchers.Default) {
            while (isActive) {
                try {
                    val tick = AudioEngineBridge.nativeGetBeatTick()
                    if (tick > 0 && tick != lastTick) {
                        lastTick = tick
                        // C++ currentBeat_ is 0-indexed (0..beatsPerBar-1)
                        // UI needs 1-indexed (1..beatsPerBar), 0 = idle
                        val b = AudioEngineBridge.nativeGetCurrentBeat() + 1
                        val r = AudioEngineBridge.nativeGetCurrentBar()
                        withContext(Dispatchers.Main) { currentBeat = b; currentBar = r }
                    }
                    // Poll visualiser band energies (~60fps)
                    val bands = AudioEngineBridge.nativeGetVisBands()
                    withContext(Dispatchers.Main) { visBands = bands }
                } catch (_: Exception) { }
                delay(16L)
            }
        }
    }

    fun stopClick() {
        if (!engineAvailable) return
        try { AudioEngineBridge.nativeStopClick() } catch (_: Exception) { }
        isClickPlaying = false
        beatPollJob?.cancel()
        currentBeat = 0; currentBar = 0
    }

    /** Unified play: starts click + track (if loaded) together. */
    fun play() {
        if (!engineAvailable) return
        if (!isClickPlaying) startClick()
        if (trackLoaded && !isTrackPlaying) {
            try { AudioEngineBridge.nativePlayTrack() } catch (_: Exception) { return }
            isTrackPlaying = true
            trackPollJob?.cancel()
            trackPollJob = viewModelScope.launch(Dispatchers.Default) {
                while (isActive) {
                    try {
                        val p = AudioEngineBridge.nativeGetTrackPosition()
                        withContext(Dispatchers.Main) { trackPositionFr = p }
                    } catch (_: Exception) { }
                    delay(100L)
                }
            }
        }
    }

    /** Unified pause: pauses both click + track. */
    fun pause() {
        if (isTrackPlaying) {
            if (engineAvailable) try { AudioEngineBridge.nativePauseTrack() } catch (_: Exception) { }
            isTrackPlaying = false; trackPollJob?.cancel()
        }
        stopClick()
    }

    /** Unified stop: stops and rewinds both. */
    fun stop() {
        if (engineAvailable) try { AudioEngineBridge.nativeStopTrack() } catch (_: Exception) { }
        isTrackPlaying = false; trackPositionFr = 0L; trackPollJob?.cancel()
        stopClick()
    }

    /** Restart from frame 0 and immediately play — one tap to relisten. */
    fun restart() {
        if (!engineAvailable || !trackLoaded) return
        stop()
        try { AudioEngineBridge.nativeSeekTrack(0L) } catch (_: Exception) { }
        trackPositionFr = 0L
        play()
    }

    fun toggleClick() { if (isClickPlaying) stopClick() else startClick() }

    fun adjustBpm(delta: Float) {
        bpmOffset += delta
        if (engineAvailable) try { AudioEngineBridge.nativeSetBpm(effectiveBpm) } catch (_: Exception) { }
    }

    fun resetBpmOffset() {
        bpmOffset = 0f
        if (engineAvailable) try { AudioEngineBridge.nativeSetBpm(effectiveBpm) } catch (_: Exception) { }
    }

    fun applySpeed(speed: Float) {
        practiceSpeed = speed
        if (engineAvailable) try {
            // Set baseBpm in engine first (nativeSetTrackSpeed will scale it by ratio)
            val baseBpm = if (detectedBpm > 0f) detectedBpm else (selectedSong?.bpm ?: 120.0).toFloat()
            AudioEngineBridge.nativeSetBpm(baseBpm)
            if (trackLoaded) AudioEngineBridge.nativeSetTrackSpeed(speed)
        } catch (_: Exception) { }
    }

    fun applySubdivision(sub: Int) {
        subdivision = sub
        if (engineAvailable) try { AudioEngineBridge.nativeSetSubdivision(sub) } catch (_: Exception) { }
    }

    fun setCountIn(bars: Int) {
        countInBars = bars
        if (engineAvailable) try { AudioEngineBridge.nativeSetCountIn(bars, 0) } catch (_: Exception) { }
    }

    fun nudge(direction: Int) {
        if (!engineAvailable) return
        try {
            AudioEngineBridge.nativeNudgeClick(direction)
            val bpmNow = if (detectedBpm > 0f) detectedBpm
                         else (selectedSong?.bpm ?: 120.0).toFloat()
            nudgeOffsetMs += direction * (60000f / bpmNow)
        } catch (_: Exception) { }
    }

    /** Half-beat step — Rec'n'Share Beat Step feature. Shifts by exactly ½ beat. */
    fun nudgeHalf(direction: Int) {
        if (!engineAvailable) return
        try {
            AudioEngineBridge.nativeNudgeClickHalf(direction)
            val bpmNow = if (detectedBpm > 0f) detectedBpm
                         else (selectedSong?.bpm ?: 120.0).toFloat()
            nudgeOffsetMs += direction * (30000f / bpmNow)  // half a beat in ms
        } catch (_: Exception) { }
    }

    fun resetNudge() {
        nudgeOffsetMs = 0f
        // Reload the beat map from scratch — this resets beatMapPhaseOffset_ to 0 in C++
        if (engineAvailable && detectedBpm > 0f) {
            val beatsPerBar = selectedSong?.timeSignatureTop?.toInt() ?: 4
            try { AudioEngineBridge.nativeApplyBeatMap(beatsPerBar) } catch (_: Exception) { }
        }
    }

    // ── Track loading ─────────────────────────────────────────────────────────
    fun loadTrack(audioUrl: String) {
        // Clear stems + analysis state from previous song
        loadedStems         = emptyList()
        stemErrors          = emptyMap()
        stemMutes           = emptyMap()
        isTrackMuted        = false
        showBeatBanner      = false
        appliedBeatOffsetMs = 0
        if (engineAvailable) try {
            AudioEngineBridge.nativeClearAllStems()
            AudioEngineBridge.nativeSetBeatOffsetMs(0) // reset displacement
        } catch (_: Exception) { }

        viewModelScope.launch {
            isLoadingTrack = true; trackError = null
            try {
                val (pcm, sr) = decodeAudio(audioUrl)
                waveformEnvelope = computeEnvelope(pcm)
                if (engineAvailable) {
                    AudioEngineBridge.nativeLoadTrack(pcm, pcm.size, sr, 1)
                    trackSampleRate = sr
                    trackTotalFr    = AudioEngineBridge.nativeGetTrackTotalFrames()
                    trackLoaded     = true
                    AudioEngineBridge.nativeSetTrackSpeed(practiceSpeed)

                    // Always run full beat-map analysis — gives dynamic per-beat
                    // alignment rather than a static constant-BPM offset.
                    runAnalysis()

                    // Load stems for the current song in the background
                    selectedSong?.id?.let { loadStemsForSong(it) }
                } else {
                    trackError = "Audio engine unavailable"
                }
            } catch (e: Exception) {
                trackError = "Load failed: ${e.message}"
            } finally {
                isLoadingTrack = false
            }
        }
    }

    // ── Beat Analysis ──────────────────────────────────────────────────────────

    /** Try server-side beat map first (madmom via Supabase), then fall back to
     *  on-device BTrack analysis if no server result is available. */
    private fun runAnalysis() {
        val songId = selectedSong?.id
        viewModelScope.launch(Dispatchers.Default) {
            withContext(Dispatchers.Main) { isAnalysing = true }
            try {
                var applied = false

                // 1. Try server-side beat map from Supabase
                if (songId != null) {
                    try {
                        val beatMap = SongRepository.getBeatMap(songId)
                        if (beatMap != null && beatMap.beats.isNotEmpty()) {
                            val beatsArr = beatMap.beatsAsFloatArray()
                            if (beatsArr.size >= 2 && engineAvailable) {
                                val beatsPerBar = selectedSong?.timeSignatureTop?.toInt() ?: 4
                                val sr = try { AudioEngineBridge.nativeGetSampleRate() } catch (_: Exception) { trackSampleRate }
                                AudioEngineBridge.nativeApplyExternalBeatMap(beatsArr, beatsPerBar, sr)
                                withContext(Dispatchers.Main) {
                                    detectedBpm      = beatMap.bpm.toFloat()
                                    detectedOffsetMs = (beatsArr[0] * 1000f).toInt().coerceAtLeast(0)
                                    if (engineAvailable) try {
                                        AudioEngineBridge.nativeSetBpm(detectedBpm)
                                    } catch (_: Exception) { }
                                    nudgeOffsetMs       = 0f
                                    appliedBeatOffsetMs = detectedOffsetMs
                                    applyDetectedBeat() // D-167: auto-save, no manual tap
                                }
                                applied = true
                                android.util.Log.i("TangerineMedia", "Server beat map applied: ${beatsArr.size} beats, ${beatMap.bpm} BPM")
                            }
                        }
                    } catch (e: Exception) {
                        android.util.Log.w("TangerineMedia", "Server beat map fetch failed, falling back to BTrack: ${e.message}")
                    }
                }

                // 2. Fallback: on-device BTrack analysis
                if (!applied) {
                    val result = AudioEngineBridge.nativeAnalyseTrack() // [bpm, beatOffsetMs]
                    if (result.size >= 2 && result[0] in 40f..250f && engineAvailable) {
                        val beatsPerBar = selectedSong?.timeSignatureTop?.toInt() ?: 4
                        try { AudioEngineBridge.nativeApplyBeatMap(beatsPerBar) } catch (_: Exception) { }
                    }
                    withContext(Dispatchers.Main) {
                        if (result.size >= 2 && result[0] in 40f..250f) {
                            detectedBpm      = result[0]
                            detectedOffsetMs = result[1].toInt().coerceAtLeast(0)
                            if (engineAvailable) try {
                                AudioEngineBridge.nativeSetBpm(detectedBpm)
                            } catch (_: Exception) { }
                            nudgeOffsetMs       = 0f
                            appliedBeatOffsetMs = detectedOffsetMs
                            applyDetectedBeat() // D-167: auto-save, no manual tap
                        }
                    }
                }
            } catch (e: Exception) {
                android.util.Log.e("TangerineMedia", "runAnalysis failed: ${e.message}", e)
            } finally {
                withContext(Dispatchers.Main) { isAnalysing = false }
            }
        }
    }

    /** Save the auto-applied beat analysis result to Supabase. Engine already updated. */
    fun applyDetectedBeat() {
        val song = selectedSong ?: return
        val bpm  = detectedBpm
        val ms   = detectedOffsetMs

        showBeatBanner = false

        // Update in-memory song so BPM display reflects detected value
        val updatedSong = song.copy(bpm = bpm.toDouble(), beatOffsetMs = ms.toDouble())
        selectedSong = updatedSong
        songs = songs.map { if (it.id == song.id) updatedSong else it }

        // Save to Supabase in background
        viewModelScope.launch {
            try { SongRepository.updateBeatInfo(song.id, bpm.toDouble(), ms) } catch (_: Exception) { }
        }
    }

    fun dismissBeatBanner() { showBeatBanner = false }

    fun loadStemsForSong(songId: String) {
        viewModelScope.launch {
            stemsLoading = true
            stemErrors   = emptyMap()
            loadedStems  = emptyList()
            stemMutes    = emptyMap()
            if (engineAvailable) try { AudioEngineBridge.nativeClearAllStems() } catch (_: Exception) { }

            try {
                val stems = StemRepository.getStemsBySongId(songId)
                    .filter { !it.audioUrl.isNullOrBlank() }

                val loaded  = mutableListOf<Pair<Int, SongStem>>()
                val errors  = mutableMapOf<String, String>()

                stems.forEach { stem ->
                    val idx = stem.stemIndex
                    try {
                        val (pcm, sr) = decodeAudio(stem.audioUrl!!)
                        if (engineAvailable) {
                            AudioEngineBridge.nativeLoadStem(idx, pcm, pcm.size, sr, 1)
                        }
                        loaded.add(idx to stem)
                    } catch (e: Exception) {
                        errors[stem.label] = e.message ?: "Unknown error"
                    }
                }

                loadedStems = loaded.sortedBy { it.first }
                stemErrors  = errors
                stemGains   = loaded.associate { (idx, _) -> idx to 1.0f }

                // When stems are loaded, mute the main mixed track (ch1) so we
                // only hear individual stems — otherwise audio doubles up.
                if (loaded.isNotEmpty() && engineAvailable) {
                    try { AudioEngineBridge.nativeSetChannelGain(1, 0f) } catch (_: Exception) { }
                }

                // If no stems loaded, check if server is still processing
                if (loaded.isEmpty()) {
                    try {
                        val beatMap = SongRepository.getBeatMap(songId)
                        processingStatus = when (beatMap?.status) {
                            "pending", "analysing", "separating" -> beatMap.status
                            else -> null
                        }
                        // Poll while processing
                        if (processingStatus != null) {
                            pollForStems(songId)
                        }
                    } catch (_: Exception) {
                        processingStatus = null
                    }
                } else {
                    processingStatus = null
                }
            } catch (_: Exception) {
                // Stem fetch failure is non-critical — track still plays without stems
            } finally {
                stemsLoading = false
            }
        }
    }

    /** Poll beat_maps status every 10s while server is processing, then auto-load stems. */
    private fun pollForStems(songId: String) {
        viewModelScope.launch {
            while (processingStatus != null) {
                kotlinx.coroutines.delay(10_000)
                try {
                    val bm = SongRepository.getBeatMap(songId) ?: break
                    when (bm.status) {
                        "ready" -> {
                            processingStatus = null
                            loadStemsForSong(songId)
                            break
                        }
                        "failed" -> {
                            processingStatus = null
                            break
                        }
                        else -> processingStatus = bm.status
                    }
                } catch (_: Exception) { break }
            }
        }
    }

    /** Compute amplitude envelope from mono PCM, normalised to 0..1 (~600 points). */
    private fun computeEnvelope(pcm: FloatArray, points: Int = 600): FloatArray {
        if (pcm.isEmpty()) return floatArrayOf()
        val chunkSize = maxOf(1, pcm.size / points)
        val count = minOf(points, pcm.size)
        var peak = 0f
        val raw = FloatArray(count) { i ->
            val start = i * chunkSize
            val end   = minOf(start + chunkSize, pcm.size)
            var max = 0f
            for (j in start until end) { val v = kotlin.math.abs(pcm[j]); if (v > max) max = v }
            if (max > peak) peak = max
            max
        }
        // Normalise so loudest point = 1.0 (avoids tiny waveforms)
        val norm = if (peak > 0f) 1f / peak else 1f
        return FloatArray(count) { raw[it] * norm }
    }

    private suspend fun decodeAudio(url: String): Pair<FloatArray, Int> = withContext(Dispatchers.IO) {
        val extractor = MediaExtractor()
        extractor.setDataSource(url)

        var trackIdx = -1; var mime = ""; var sr = 44100; var ch = 1
        for (i in 0 until extractor.trackCount) {
            val fmt = extractor.getTrackFormat(i)
            val m   = fmt.getString(MediaFormat.KEY_MIME) ?: continue
            if (m.startsWith("audio/")) { trackIdx = i; mime = m
                sr = fmt.getInteger(MediaFormat.KEY_SAMPLE_RATE)
                ch = fmt.getInteger(MediaFormat.KEY_CHANNEL_COUNT); break }
        }
        require(trackIdx >= 0) { "No audio track found" }
        extractor.selectTrack(trackIdx)

        val codec = MediaCodec.createDecoderByType(mime)
        codec.configure(extractor.getTrackFormat(trackIdx), null, null, 0)
        codec.start()

        val info       = MediaCodec.BufferInfo()
        val chunks     = mutableListOf<ByteArray>()
        var totalBytes = 0
        var eos        = false

        while (!eos) {
            val ii = codec.dequeueInputBuffer(10_000L)
            if (ii >= 0) {
                val ib = codec.getInputBuffer(ii)!!
                val n  = extractor.readSampleData(ib, 0)
                if (n < 0) codec.queueInputBuffer(ii, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                else       { codec.queueInputBuffer(ii, 0, n, extractor.sampleTime, 0); extractor.advance() }
            }
            val oi = codec.dequeueOutputBuffer(info, 10_000L)
            if (oi >= 0) {
                val ob    = codec.getOutputBuffer(oi)!!
                val bytes = ByteArray(info.size)
                ob.position(info.offset); ob.get(bytes)
                chunks.add(bytes); totalBytes += info.size
                codec.releaseOutputBuffer(oi, false)
                if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) eos = true
            }
        }
        codec.stop(); codec.release(); extractor.release()

        // Convert chunk list → mono FloatArray using primitive ShortBuffer (no boxing)
        val floatCount = totalBytes / 2 / ch
        val floats     = FloatArray(floatCount)
        var fi = 0; var chanAcc = 0f; var chanN = 0
        for (chunk in chunks) {
            val sb = ByteBuffer.wrap(chunk).order(ByteOrder.nativeOrder()).asShortBuffer()
            while (sb.hasRemaining()) {
                chanAcc += sb.get().toFloat()
                if (++chanN == ch) { floats[fi++] = chanAcc / (32768f * ch); chanAcc = 0f; chanN = 0 }
            }
        }

        // Resample to engine sample rate if needed (e.g. track=44100, engine=48000)
        val engineSr = try { AudioEngineBridge.nativeGetSampleRate() } catch (_: Exception) { sr }
        if (sr == engineSr || engineSr <= 0) {
            Pair(floats, engineSr)
        } else {
            val ratio     = engineSr.toDouble() / sr.toDouble()
            val newSize   = (floats.size * ratio).toInt()
            val resampled = FloatArray(newSize) { i ->
                val srcPos = i / ratio
                val srcIdx = srcPos.toInt()
                val frac   = (srcPos - srcIdx).toFloat()
                val a      = if (srcIdx < floats.size) floats[srcIdx] else 0f
                val b      = if (srcIdx + 1 < floats.size) floats[srcIdx + 1] else a
                a + (b - a) * frac
            }
            Pair(resampled, engineSr)
        }
    }

    fun playTrack() {
        if (!engineAvailable || !trackLoaded) return
        try { AudioEngineBridge.nativePlayTrack() } catch (_: Exception) { return }
        isTrackPlaying = true
        // Auto-start click if not already playing (click + track always play together)
        if (!isClickPlaying) startClick()
        trackPollJob?.cancel()
        trackPollJob = viewModelScope.launch(Dispatchers.Default) {
            while (isActive) {
                try {
                    val p = AudioEngineBridge.nativeGetTrackPosition()
                    withContext(Dispatchers.Main) { trackPositionFr = p }
                } catch (_: Exception) { }
                delay(100L)
            }
        }
    }

    fun pauseTrack() {
        if (!engineAvailable) return
        try { AudioEngineBridge.nativePauseTrack() } catch (_: Exception) { }
        isTrackPlaying = false; trackPollJob?.cancel()
        if (isClickPlaying) stopClick()
    }

    fun stopTrack() {
        if (!engineAvailable) return
        try { AudioEngineBridge.nativeStopTrack() } catch (_: Exception) { }
        isTrackPlaying = false; trackPositionFr = 0L; trackPollJob?.cancel()
        if (isClickPlaying) stopClick()
    }

    fun seekTrackFraction(fraction: Float) {
        if (!engineAvailable || trackTotalFr <= 0) return
        val frame = (fraction.coerceIn(0f, 1f) * trackTotalFr).toLong()
        try { AudioEngineBridge.nativeSeekTrack(frame); trackPositionFr = frame } catch (_: Exception) { }
    }

    fun setLoopA() { loopAFrame = trackPositionFr; tryApplyLoop() }
    fun setLoopB() { loopBFrame = trackPositionFr; tryApplyLoop() }
    fun clearLoop() {
        loopAFrame = null; loopBFrame = null
        if (engineAvailable) try { AudioEngineBridge.nativeClearLoopRegion() } catch (_: Exception) { }
    }

    private fun tryApplyLoop() {
        val a = loopAFrame ?: return; val b = loopBFrame ?: return
        if (engineAvailable) try {
            AudioEngineBridge.nativeSetLoopRegion(minOf(a, b), maxOf(a, b))
        } catch (_: Exception) { }
    }

    // ── XR18 Camera Companion ────────────────────────────────────────────────
    // Managers survive navigation — created once, live until ViewModel cleared.

    private var _phoneCompanion: PhoneCompanionManager? = null
    private var _cameraRecording: CameraRecordingManager? = null

    val phoneCompanion: PhoneCompanionManager get() {
        if (_phoneCompanion == null) initCameraManagers()
        return _phoneCompanion!!
    }
    val cameraRecording: CameraRecordingManager get() {
        if (_cameraRecording == null) initCameraManagers()
        return _cameraRecording!!
    }

    /** Whether managers have been initialised (avoids creating them just to read state). */
    val cameraInitialised: Boolean get() = _phoneCompanion != null

    private fun initCameraManagers() {
        val ctx = getApplication<android.app.Application>()
        val mgr = PhoneCompanionManager(ctx)
        val cam = CameraRecordingManager(ctx)

        // Wire callbacks — same as XR18CameraScreen did, but ViewModel-scoped
        mgr.onStartRecording = { sessionName, sessionId ->
            val dir = File(ctx.filesDir, "xr18_recordings")
            cam.startRecording(dir, sessionName, sessionId)
        }
        mgr.onStopRecording = { cam.stopRecording() }
        mgr.onSettingsChanged = { /* Settings applied when screen binds camera */ }
        mgr.capturePreviewFrame = { cam.capturePreviewFrame() }
        cam.onQrCodeScanned = { pairingInfo -> mgr.connect(pairingInfo) }

        _phoneCompanion = mgr
        _cameraRecording = cam
    }

    fun connectCamera(info: PairingInfo) { phoneCompanion.connect(info) }
    fun disconnectCamera() { _phoneCompanion?.disconnect() }

    /** Phone requests Studio to start ASIO recording AND starts local camera recording. */
    fun requestStudioRecording() {
        phoneCompanion.sendStartRecRequest()
        // Local camera recording is triggered by the Studio's StartRec response
        // (wired in initCameraManagers via onStartRecording callback)
    }

    /** Phone requests Studio to stop recording AND stops local camera recording. */
    fun requestStudioStopRecording() {
        phoneCompanion.sendStopRecRequest()
        // Local camera stop is triggered by Studio's StopRec response
    }

    fun bindCamera(lifecycleOwner: LifecycleOwner, previewView: PreviewView, settings: PhoneSettings) {
        cameraRecording.bind(lifecycleOwner, previewView, settings)
    }

    fun releaseCamera() { _cameraRecording?.release() }

    override fun onCleared() {
        super.onCleared()
        beatPollJob?.cancel(); trackPollJob?.cancel()
        if (engineAvailable) try {
            AudioEngineBridge.nativeStopClick()
            AudioEngineBridge.nativeStopTrack()
        } catch (_: Exception) { }
        // Clean up camera companion
        _phoneCompanion?.disconnect()
        _cameraRecording?.release()
    }
}

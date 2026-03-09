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
import com.thegreentangerine.gigbooks.GigBooksApplication
import com.thegreentangerine.gigbooks.audio.AudioEngineBridge
import com.thegreentangerine.gigbooks.data.supabase.GigRepository
import com.thegreentangerine.gigbooks.data.supabase.SetlistRepository
import com.thegreentangerine.gigbooks.data.supabase.SongRepository
import com.thegreentangerine.gigbooks.data.supabase.StemRepository
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
import java.nio.ByteBuffer
import java.nio.ByteOrder

class AppViewModel(app: Application) : AndroidViewModel(app) {

    val engineAvailable: Boolean = GigBooksApplication.engineAvailable

    // ── Library ───────────────────────────────────────────────────────────────
    var songs    by mutableStateOf<List<Song>>(emptyList());           private set
    var setlists by mutableStateOf<List<SetlistWithSongs>>(emptyList()); private set
    var loadError by mutableStateOf<String?>(null);                    private set
    var isLoading by mutableStateOf(true);                             private set

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

    fun changeClickGain(g: Float) { clickGain = g; if (!isClickMuted && engineAvailable) try { AudioEngineBridge.nativeSetChannelGain(0, g) } catch (_: Exception) { } }
    fun changeTrackGain(g: Float) { trackGain = g; if (engineAvailable) try { AudioEngineBridge.nativeSetChannelGain(1, g) } catch (_: Exception) { } }
    fun toggleClickMute() {
        isClickMuted = !isClickMuted
        if (engineAvailable) try {
            AudioEngineBridge.nativeSetChannelGain(0, if (isClickMuted) 0f else clickGain)
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
    // processingStatus: non-null while server is processing stems (pending/analysing/separating)
    var processingStatus by mutableStateOf<String?>(null);                       private set

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

    // ── Library loading ───────────────────────────────────────────────────────
    fun loadLibrary() {
        viewModelScope.launch {
            isLoading = true; loadError = null
            try {
                songs    = SongRepository.getSongs()
                setlists = SetlistRepository.getAllSetlistsWithSongs()
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
                calGigs      = GigRepository.getGigsForMonth(year, month)
                calAwayDates = GigRepository.getAwayDatesForMonth(year, month)
            } catch (_: Exception) { /* non-fatal — calendar just shows empty */ }
            finally { calLoading = false }
        }
    }

    // ── Selection ─────────────────────────────────────────────────────────────
    fun setStemGain(idx: Int, gain: Float) {
        stemGains = stemGains + (idx to gain)
        if (engineAvailable) try { AudioEngineBridge.nativeSetChannelGain(2 + idx, gain) } catch (_: Exception) { }
    }

    fun selectSong(song: Song) {
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
        applyEngineSettings(song)  // always sync BPM/time-sig to engine when song selected
    }

    fun selectSetlist(setlist: SetlistWithSongs) {
        activeSetlist    = setlist
        activeSetlistIdx = 0
        setlist.songs.firstOrNull()?.songs?.let { selectSong(it) }
    }

    fun clearSetlist() { activeSetlist = null }

    // ── Set complete ────────────────────────────────────────────────────────
    var isSetComplete by mutableStateOf(false); private set

    fun dismissSetComplete() { isSetComplete = false }

    fun restartSetlist() {
        isSetComplete = false
        activeSetlistIdx = 0
        activeSetlist?.songs?.firstOrNull()?.songs?.let { selectSong(it) }
    }

    fun nextSong() {
        val list = activeSetlist?.songs ?: return
        if (activeSetlistIdx < list.size - 1) {
            activeSetlistIdx++
            list[activeSetlistIdx].songs?.let { selectSong(it) }
        } else {
            isSetComplete = true
        }
    }

    fun prevSong() {
        val list = activeSetlist?.songs ?: return
        if (activeSetlistIdx > 0) {
            activeSetlistIdx--
            list[activeSetlistIdx].songs?.let { selectSong(it) }
        }
    }

    fun reorderSetlistSong(fromIdx: Int, toIdx: Int) {
        val current = activeSetlist ?: return
        if (fromIdx == toIdx) return
        val songs = current.songs.toMutableList()
        val moved = songs.removeAt(fromIdx)
        songs.add(toIdx, moved)
        activeSetlist = current.copy(songs = songs)
        activeSetlistIdx = songs.indexOfFirst { it.songs?.id == selectedSong?.id }.coerceAtLeast(0)
    }

    fun jumpToSong(idx: Int) {
        val list = activeSetlist?.songs ?: return
        if (idx in list.indices) {
            activeSetlistIdx = idx
            list[idx].songs?.let { selectSong(it) }
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
        beatPollJob = viewModelScope.launch(Dispatchers.Default) {
            while (isActive) {
                try {
                    val b = AudioEngineBridge.nativeGetCurrentBeat()
                    val r = AudioEngineBridge.nativeGetCurrentBar()
                    withContext(Dispatchers.Main) { currentBeat = b; currentBar = r }
                } catch (_: Exception) { }
                delay(40L)
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
                                    showBeatBanner      = true
                                }
                                applied = true
                                android.util.Log.i("GigBooks", "Server beat map applied: ${beatsArr.size} beats, ${beatMap.bpm} BPM")
                            }
                        }
                    } catch (e: Exception) {
                        android.util.Log.w("GigBooks", "Server beat map fetch failed, falling back to BTrack: ${e.message}")
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
                            showBeatBanner      = true
                        }
                    }
                }
            } catch (e: Exception) {
                android.util.Log.e("GigBooks", "runAnalysis failed: ${e.message}", e)
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

    override fun onCleared() {
        super.onCleared()
        beatPollJob?.cancel(); trackPollJob?.cancel()
        if (engineAvailable) try {
            AudioEngineBridge.nativeStopClick()
            AudioEngineBridge.nativeStopTrack()
        } catch (_: Exception) { }
    }
}

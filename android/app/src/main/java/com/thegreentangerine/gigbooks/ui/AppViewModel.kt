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
import com.thegreentangerine.gigbooks.data.supabase.SetlistRepository
import com.thegreentangerine.gigbooks.data.supabase.SongRepository
import com.thegreentangerine.gigbooks.data.supabase.StemRepository
import com.thegreentangerine.gigbooks.data.supabase.models.SetlistWithSongs
import com.thegreentangerine.gigbooks.data.supabase.models.Song
import com.thegreentangerine.gigbooks.data.supabase.models.SongStem
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.nio.ByteOrder

class AppViewModel(app: Application) : AndroidViewModel(app) {

    val engineAvailable: Boolean = GigBooksApplication.engineAvailable

    // ── Library ───────────────────────────────────────────────────────────────
    var songs    by mutableStateOf<List<Song>>(emptyList());           private set
    var setlists by mutableStateOf<List<SetlistWithSongs>>(emptyList()); private set
    var loadError by mutableStateOf<String?>(null);                    private set
    var isLoading by mutableStateOf(true);                             private set

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

    init { loadLibrary() }

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
        if (isClickPlaying) applyEngineSettings(song)
    }

    fun selectSetlist(setlist: SetlistWithSongs) {
        activeSetlist    = setlist
        activeSetlistIdx = 0
        setlist.songs.firstOrNull()?.songs?.let { selectSong(it) }
    }

    fun clearSetlist() { activeSetlist = null }

    fun nextSong() {
        val list = activeSetlist?.songs ?: return
        if (activeSetlistIdx < list.size - 1) {
            activeSetlistIdx++
            list[activeSetlistIdx].songs?.let { selectSong(it) }
        }
    }

    fun prevSong() {
        val list = activeSetlist?.songs ?: return
        if (activeSetlistIdx > 0) {
            activeSetlistIdx--
            list[activeSetlistIdx].songs?.let { selectSong(it) }
        }
    }

    // ── Engine ────────────────────────────────────────────────────────────────
    private fun applyEngineSettings(song: Song) {
        if (!engineAvailable) return
        try {
            AudioEngineBridge.nativeSetBpm(effectiveBpm)
            AudioEngineBridge.nativeSetTimeSignature(
                song.timeSignatureTop.toInt(),
                song.timeSignatureBottom.toInt(),
            )
            AudioEngineBridge.nativeSetSubdivision(subdivision)
            AudioEngineBridge.nativeSetSwing(song.swingPercent.toFloat())
            AudioEngineBridge.nativeSetCountIn(countInBars, 0)
        } catch (_: Exception) { }
    }

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
            AudioEngineBridge.nativeSetBpm(effectiveBpm)
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
        try { AudioEngineBridge.nativeNudgeClick(direction); nudgeOffsetMs += direction * 5f }
        catch (_: Exception) { }
    }

    fun resetNudge() {
        nudgeOffsetMs = 0f
        // Re-apply settings to reset offset
        selectedSong?.let { if (engineAvailable) applyEngineSettings(it) }
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

                    // Beat alignment: auto-apply stored offset or run analysis
                    val storedOffsetMs = selectedSong?.beatOffsetMs?.toInt() ?: 0
                    if (storedOffsetMs > 0) {
                        AudioEngineBridge.nativeSetBeatOffsetMs(storedOffsetMs)
                        appliedBeatOffsetMs = storedOffsetMs
                    } else {
                        runAnalysis()
                    }

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

    /** Run nativeAnalyseTrack() on a background thread; show banner if result is valid. */
    private fun runAnalysis() {
        viewModelScope.launch(Dispatchers.Default) {
            withContext(Dispatchers.Main) { isAnalysing = true }
            try {
                val result = AudioEngineBridge.nativeAnalyseTrack() // [bpm, beatOffsetMs]
                withContext(Dispatchers.Main) {
                    if (result.size >= 2 && result[0] in 40f..250f) {
                        detectedBpm      = result[0]
                        detectedOffsetMs = result[1].toInt().coerceAtLeast(0)
                        showBeatBanner   = true
                    }
                }
            } catch (_: Exception) {
            } finally {
                withContext(Dispatchers.Main) { isAnalysing = false }
            }
        }
    }

    /** Apply detected BPM + offset to engine, update in-memory song, save to Supabase. */
    fun applyDetectedBeat() {
        val song = selectedSong ?: return
        val bpm  = detectedBpm
        val ms   = detectedOffsetMs

        // Apply to engine
        if (engineAvailable) try {
            AudioEngineBridge.nativeSetBeatOffsetMs(ms)
            AudioEngineBridge.nativeSetBpm(bpm)
        } catch (_: Exception) { }

        // Reset any manual nudge — offset is now set absolutely
        nudgeOffsetMs       = 0f
        appliedBeatOffsetMs = ms
        showBeatBanner      = false

        // Update in-memory song so the BPM display reflects the detected value
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
            } catch (_: Exception) {
                // Stem fetch failure is non-critical — track still plays without stems
            } finally {
                stemsLoading = false
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

        val info   = MediaCodec.BufferInfo()
        val shorts = mutableListOf<Short>()
        var eos    = false

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
                val ob = codec.getOutputBuffer(oi)!!.order(ByteOrder.nativeOrder()).asShortBuffer()
                while (ob.hasRemaining()) shorts.add(ob.get())
                codec.releaseOutputBuffer(oi, false)
                if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) eos = true
            }
        }
        codec.stop(); codec.release(); extractor.release()

        val floats = if (ch > 1)
            FloatArray(shorts.size / ch) { i ->
                (0 until ch).sumOf { c -> shorts[i * ch + c].toDouble() }.toFloat() / (32768f * ch)
            }
        else FloatArray(shorts.size) { shorts[it] / 32768f }

        Pair(floats, sr)
    }

    fun playTrack() {
        if (!engineAvailable || !trackLoaded) return
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

    fun pauseTrack() {
        if (!engineAvailable) return
        try { AudioEngineBridge.nativePauseTrack() } catch (_: Exception) { }
        isTrackPlaying = false; trackPollJob?.cancel()
    }

    fun stopTrack() {
        if (!engineAvailable) return
        try { AudioEngineBridge.nativeStopTrack() } catch (_: Exception) { }
        isTrackPlaying = false; trackPositionFr = 0L; trackPollJob?.cancel()
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

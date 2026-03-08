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
import com.thegreentangerine.gigbooks.data.supabase.models.SetlistWithSongs
import com.thegreentangerine.gigbooks.data.supabase.models.Song
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
    fun selectSong(song: Song) {
        selectedSong  = song
        bpmOffset     = 0f
        practiceSpeed = 1f
        nudgeOffsetMs = 0f
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
        viewModelScope.launch {
            isLoadingTrack = true; trackError = null
            try {
                val (pcm, sr) = decodeAudio(audioUrl)
                if (engineAvailable) {
                    AudioEngineBridge.nativeLoadTrack(pcm, pcm.size, sr, 1)
                    trackSampleRate = sr
                    trackTotalFr    = AudioEngineBridge.nativeGetTrackTotalFrames()
                    trackLoaded     = true
                    AudioEngineBridge.nativeSetTrackSpeed(practiceSpeed)
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

package com.thegreentangerine.gigbooks.data.mediaserver

import android.content.Context
import android.util.Log
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.zip.ZipInputStream

/**
 * Media server connection state for UI binding.
 */
enum class ServerConnectionState {
    DISCONNECTED,
    DISCOVERING,
    CONNECTING,
    CONNECTED,
    CONNECTION_FAILED
}

/**
 * Track metadata from the media server.
 */
@Serializable
data class ServerTrack(
    val id: String = "",
    val title: String = "",
    val artist: String = "",
    val album: String = "",
    val genre: String = "",
    val year: Int? = null,
    val durationMs: Long = 0,
    val hasStems: Boolean = false,
    val bpm: Double? = null,
    val albumArtPath: String? = null,
    val path: String = "",
)

/**
 * Stem metadata from the media server.
 */
@Serializable
data class ServerStem(
    val label: String = "",
    val filename: String = "",
    @Suppress("PropertyName")
    val size_bytes: Long = 0,
)

/**
 * Beat map data from the media server.
 */
@Serializable
data class ServerBeatMap(
    val beats: List<Float> = emptyList(),
    val bpm: Double = 0.0,
    val beatsPerBar: Int = 4,
)

/**
 * HTTP client for the Tangerine Media Server.
 * Handles server discovery, track browsing, streaming, and stem management.
 * Replaces Supabase for bulk audio operations.
 */
class MediaServerClient(private val context: Context) {

    companion object {
        private const val TAG = "MediaServerClient"
        private const val DEFAULT_PORT = 9200
        private const val CONNECT_TIMEOUT = 5000
        private const val READ_TIMEOUT = 30000
    }

    private val json = Json { ignoreUnknownKeys = true; isLenient = true }
    private var baseUrl: String? = null

    private val _connectionState = MutableStateFlow(ServerConnectionState.DISCONNECTED)
    val connectionState: StateFlow<ServerConnectionState> = _connectionState

    private val _serverInfo = MutableStateFlow<String?>(null)
    val serverInfo: StateFlow<String?> = _serverInfo

    // ── Cache directory for downloaded tracks/stems ──
    private val cacheDir: File
        get() = File(context.cacheDir, "media_server_cache").also { it.mkdirs() }

    private val stemCacheDir: File
        get() = File(cacheDir, "stems").also { it.mkdirs() }

    // ── Connection ──

    /**
     * Auto-discover and connect to the media server.
     * Tries: manual IP → localhost → mDNS.
     */
    suspend fun autoConnect(savedIp: String? = null) {
        _connectionState.value = ServerConnectionState.DISCOVERING

        // 1. Saved IP
        if (savedIp != null) {
            if (tryConnect("http://$savedIp:$DEFAULT_PORT")) return
        }

        // 2. Localhost (for USB tethering / same device)
        if (tryConnect("http://localhost:$DEFAULT_PORT")) return
        if (tryConnect("http://10.0.2.2:$DEFAULT_PORT")) return // Android emulator

        // 3. Common LAN addresses
        val commonHosts = listOf("192.168.1.", "192.168.0.", "10.0.0.")
        for (prefix in commonHosts) {
            // Try common host IDs
            for (id in listOf(100, 1, 2, 50)) {
                if (tryConnect("http://$prefix$id:$DEFAULT_PORT")) return
            }
        }

        _connectionState.value = ServerConnectionState.DISCONNECTED
        Log.w(TAG, "Auto-connect failed — no server found")
    }

    /**
     * Connect to a specific server URL.
     */
    suspend fun connect(url: String): Boolean = tryConnect(url)

    private suspend fun tryConnect(url: String): Boolean {
        _connectionState.value = ServerConnectionState.CONNECTING
        return withContext(Dispatchers.IO) {
            try {
                val conn = URL("$url/api/health").openConnection() as HttpURLConnection
                conn.connectTimeout = CONNECT_TIMEOUT
                conn.readTimeout = READ_TIMEOUT
                conn.requestMethod = "GET"

                if (conn.responseCode == 200) {
                    val body = conn.inputStream.bufferedReader().readText()
                    conn.disconnect()

                    baseUrl = url
                    _connectionState.value = ServerConnectionState.CONNECTED
                    _serverInfo.value = url
                    Log.i(TAG, "Connected to media server: $url")
                    true
                } else {
                    conn.disconnect()
                    false
                }
            } catch (e: Exception) {
                Log.d(TAG, "Connection attempt failed ($url): ${e.message}")
                false
            }
        }
    }

    fun disconnect() {
        baseUrl = null
        _connectionState.value = ServerConnectionState.DISCONNECTED
        _serverInfo.value = null
    }

    val isConnected: Boolean get() = _connectionState.value == ServerConnectionState.CONNECTED

    // ── Library Browsing ──

    suspend fun searchTracks(query: String, limit: Int = 100): List<ServerTrack> =
        fetchTracks("/api/library/search?q=${encode(query)}&limit=$limit")

    suspend fun getAllTracks(sort: String = "title", limit: Int = 500): List<ServerTrack> =
        fetchTracks("/api/library/tracks?sort=$sort&limit=$limit")

    suspend fun getTracksByArtist(artist: String, limit: Int = 200): List<ServerTrack> =
        fetchTracks("/api/library/tracks/artist/${encode(artist)}?limit=$limit")

    suspend fun getTracksByAlbum(album: String, artist: String? = null, limit: Int = 200): List<ServerTrack> {
        var url = "/api/library/tracks/album/${encode(album)}?limit=$limit"
        if (artist != null) url += "&artist=${encode(artist)}"
        return fetchTracks(url)
    }

    suspend fun getTracksByGenre(genre: String, limit: Int = 200): List<ServerTrack> =
        fetchTracks("/api/library/tracks/genre/${encode(genre)}?limit=$limit")

    suspend fun getArtists(limit: Int = 500): List<String> =
        fetchStringList("/api/library/artists?limit=$limit", "name")

    suspend fun getAlbums(artist: String? = null, limit: Int = 500): List<String> {
        var url = "/api/library/albums?limit=$limit"
        if (artist != null) url += "&artist=${encode(artist)}"
        return fetchStringList(url, "name")
    }

    suspend fun getGenres(limit: Int = 200): List<String> =
        fetchStringList("/api/library/genres?limit=$limit", "name")

    // ── Track Streaming ──

    fun getStreamUrl(trackId: String): String? {
        val base = baseUrl ?: return null
        return "$base/api/track/$trackId/stream"
    }

    fun getArtUrl(trackId: String): String? {
        val base = baseUrl ?: return null
        return "$base/api/track/$trackId/art"
    }

    // ── Stems ──

    suspend fun getStems(trackId: String): List<ServerStem> = withContext(Dispatchers.IO) {
        try {
            val body = httpGet("/api/track/$trackId/stems") ?: return@withContext emptyList()
            val array = json.parseToJsonElement(body).jsonArray
            array.map { json.decodeFromJsonElement<ServerStem>(it) }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get stems for $trackId: ${e.message}")
            emptyList()
        }
    }

    fun getStemStreamUrl(trackId: String, label: String): String? {
        val base = baseUrl ?: return null
        return "$base/api/track/$trackId/stem/$label/stream"
    }

    /**
     * Download all stems for a track as a ZIP and extract to local cache.
     * Returns the directory containing extracted stem files, or null on failure.
     */
    suspend fun downloadStems(trackId: String): File? = withContext(Dispatchers.IO) {
        val base = baseUrl ?: return@withContext null
        val destDir = File(stemCacheDir, trackId).also { it.mkdirs() }

        // Skip if already cached
        if (destDir.listFiles()?.isNotEmpty() == true) {
            Log.d(TAG, "Stems already cached for $trackId")
            return@withContext destDir
        }

        try {
            val conn = URL("$base/api/track/$trackId/stems/download").openConnection() as HttpURLConnection
            conn.connectTimeout = CONNECT_TIMEOUT
            conn.readTimeout = 120_000 // 2 min for large stem downloads

            if (conn.responseCode != 200) {
                conn.disconnect()
                return@withContext null
            }

            ZipInputStream(conn.inputStream.buffered()).use { zip ->
                var entry = zip.nextEntry
                while (entry != null) {
                    if (!entry.isDirectory) {
                        val outFile = File(destDir, entry.name)
                        FileOutputStream(outFile).use { out ->
                            zip.copyTo(out)
                        }
                    }
                    zip.closeEntry()
                    entry = zip.nextEntry
                }
            }
            conn.disconnect()

            Log.i(TAG, "Downloaded stems for $trackId to ${destDir.absolutePath}")
            destDir
        } catch (e: Exception) {
            Log.e(TAG, "Failed to download stems for $trackId: ${e.message}")
            null
        }
    }

    // ── Beat Maps ──

    suspend fun getBeatMap(trackId: String): ServerBeatMap? = withContext(Dispatchers.IO) {
        try {
            val body = httpGet("/api/track/$trackId/beatmap") ?: return@withContext null
            json.decodeFromString<ServerBeatMap>(body)
        } catch (e: Exception) {
            Log.d(TAG, "No beatmap for $trackId: ${e.message}")
            null
        }
    }

    // ── Click Sounds ──

    suspend fun getClickSounds(): List<String> = withContext(Dispatchers.IO) {
        try {
            val body = httpGet("/api/click-sounds") ?: return@withContext emptyList()
            val array = json.parseToJsonElement(body).jsonArray
            array.mapNotNull { it.jsonObject["name"]?.jsonPrimitive?.contentOrNull }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get click sounds: ${e.message}")
            emptyList()
        }
    }

    fun getClickSoundUrl(name: String): String? {
        val base = baseUrl ?: return null
        return "$base/api/click-sounds/$name/stream"
    }

    // ── Processing ──

    suspend fun triggerStemSplit(trackId: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val conn = URL("$baseUrl/api/track/$trackId/split").openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.doOutput = false
            val success = conn.responseCode in 200..299
            conn.disconnect()
            success
        } catch (e: Exception) {
            Log.e(TAG, "Failed to trigger stem split: ${e.message}")
            false
        }
    }

    suspend fun triggerBeatDetection(trackId: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val conn = URL("$baseUrl/api/track/$trackId/beatmap/generate").openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.doOutput = false
            val success = conn.responseCode in 200..299
            conn.disconnect()
            success
        } catch (e: Exception) {
            Log.e(TAG, "Failed to trigger beat detection: ${e.message}")
            false
        }
    }

    // ── Cache Management ──

    fun getCachedStemDir(trackId: String): File? {
        val dir = File(stemCacheDir, trackId)
        return if (dir.exists() && dir.listFiles()?.isNotEmpty() == true) dir else null
    }

    fun getCacheSize(): Long = cacheDir.walkTopDown().filter { it.isFile }.sumOf { it.length() }

    fun clearCache() {
        cacheDir.deleteRecursively()
        cacheDir.mkdirs()
    }

    fun clearStemCache(trackId: String) {
        File(stemCacheDir, trackId).deleteRecursively()
    }

    // ── HTTP Helpers ──

    private suspend fun httpGet(path: String): String? = withContext(Dispatchers.IO) {
        val base = baseUrl ?: return@withContext null
        try {
            val conn = URL("$base$path").openConnection() as HttpURLConnection
            conn.connectTimeout = CONNECT_TIMEOUT
            conn.readTimeout = READ_TIMEOUT
            if (conn.responseCode != 200) {
                conn.disconnect()
                return@withContext null
            }
            val body = conn.inputStream.bufferedReader().readText()
            conn.disconnect()
            body
        } catch (e: Exception) {
            Log.d(TAG, "HTTP GET failed ($path): ${e.message}")
            null
        }
    }

    private suspend fun fetchTracks(path: String): List<ServerTrack> = withContext(Dispatchers.IO) {
        try {
            val body = httpGet(path) ?: return@withContext emptyList()
            val array = json.parseToJsonElement(body).jsonArray
            array.map { json.decodeFromJsonElement<ServerTrack>(it) }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to fetch tracks ($path): ${e.message}")
            emptyList()
        }
    }

    private suspend fun fetchStringList(path: String, key: String): List<String> = withContext(Dispatchers.IO) {
        try {
            val body = httpGet(path) ?: return@withContext emptyList()
            val array = json.parseToJsonElement(body).jsonArray
            array.mapNotNull { it.jsonObject[key]?.jsonPrimitive?.contentOrNull }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to fetch list ($path): ${e.message}")
            emptyList()
        }
    }

    private fun encode(s: String): String = java.net.URLEncoder.encode(s, "UTF-8")
}

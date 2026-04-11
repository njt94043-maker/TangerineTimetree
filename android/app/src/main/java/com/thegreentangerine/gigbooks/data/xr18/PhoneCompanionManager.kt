package com.thegreentangerine.gigbooks.data.xr18

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.wifi.WifiManager
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.os.StatFs
import android.util.Base64
import android.util.Log
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

enum class ConnectionState {
    Disconnected, Connecting, Pairing, Connected, Recording, Error
}

/**
 * Client-side orchestrator for XR18Studio Phone Director connection.
 * Supports triple BT+TCP+Relay transport: BT connects first (no WiFi needed),
 * TCP connects as second channel for high-bandwidth preview,
 * Supabase relay connects as internet fallback (phone on cellular, PC on WiFi).
 *
 * Routing:
 *  - Commands (heartbeat, status, rec responses) → BT primary, TCP fallback, Relay fallback
 *  - Preview frames → TCP primary, BT fallback, Relay fallback
 *  - Messages received from any channel are handled identically
 */
class PhoneCompanionManager(private val context: Context) {

    companion object {
        private const val TAG = "PhoneCompanion"
    }

    private val tcpClient = TcpPhoneClient()
    private val btClient = BluetoothPhoneClient(context)
    private val relayClient = SupabaseBroadcastClient()
    private var scope: CoroutineScope? = null
    private var statusJob: Job? = null
    private var previewJob: Job? = null
    private var reconnectJob: Job? = null
    private var tcpConnectJob: Job? = null
    private var relayConnectJob: Job? = null

    private val _state = MutableStateFlow(ConnectionState.Disconnected)
    val state: StateFlow<ConnectionState> = _state

    private val _phoneId = MutableStateFlow<String?>(null)
    val phoneId: StateFlow<String?> = _phoneId

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    private val _currentSettings = MutableStateFlow(PhoneSettings())
    val currentSettings: StateFlow<PhoneSettings> = _currentSettings

    /** Which transports are currently connected. */
    private val _btConnected = MutableStateFlow(false)
    val btConnected: StateFlow<Boolean> = _btConnected

    private val _tcpConnected = MutableStateFlow(false)
    val tcpConnected: StateFlow<Boolean> = _tcpConnected

    private val _relayConnected = MutableStateFlow(false)
    val relayConnected: StateFlow<Boolean> = _relayConnected

    var pairingInfo: PairingInfo? = null
        private set

    // Callbacks
    /** Called when StartRec is received. Parameters: sessionName, sessionId. */
    var onStartRecording: ((sessionName: String, sessionId: String) -> Unit)? = null
    var onStopRecording: (() -> Unit)? = null
    var onSettingsChanged: ((PhoneSettings) -> Unit)? = null
    var capturePreviewFrame: (() -> ByteArray?)? = null

    /** Called when a SyncPulse command is received. Should trigger screen flash + beep.
     *  Returns the timestamp (ms) at which the pulse was executed. */
    var onSyncPulse: (() -> Long)? = null

    /** Provides the actual recording framerate for status reporting. */
    var getActualFramerate: (() -> Double)? = null

    /** Provides whether recording is using constant frame rate for status reporting. */
    var getIsConstantFrameRate: (() -> Boolean)? = null

    /** Provides quality warning info after recording starts, if device can't sustain CFR. */
    var getQualityWarning: (() -> QualityWarningPayload?)? = null

    /** S54 W-G: Called when Studio sends a clip for sharing. Parameters: clipName, localFilePath. */
    var onClipDownloaded: ((clipName: String, filePath: String) -> Unit)? = null

    private var wifiLock: WifiManager.WifiLock? = null
    private var intentionalDisconnect = false
    private var btPaired = false
    private var tcpPaired = false
    private var relayPaired = false
    private var livePreviewEnabled = true  // Server can pause/resume preview sending

    fun connect(info: PairingInfo) {
        pairingInfo = info
        intentionalDisconnect = false
        btPaired = false
        tcpPaired = false
        scope?.cancel()
        scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
        scope?.launch { doConnect(info) }
    }

    fun disconnect() {
        intentionalDisconnect = true
        cleanup()
        _state.value = ConnectionState.Disconnected
    }

    /** Request Studio to start recording (phone → server direction). */
    fun sendStartRecRequest() {
        val msg = PhoneProtocol.createMessage(
            type = PhoneMessageType.StartRecRequest,
            phoneId = _phoneId.value,
        )
        scope?.launch { sendCommand(msg) }
    }

    /** Request Studio to stop recording (phone → server direction). */
    fun sendStopRecRequest() {
        val msg = PhoneProtocol.createMessage(
            type = PhoneMessageType.StopRecRequest,
            phoneId = _phoneId.value,
        )
        scope?.launch { sendCommand(msg) }
    }

    /** S41: Notify Studio that drummer selected a song in live mode (for session markers + PWA broadcast). */
    fun sendSongChanged(song: com.thegreentangerine.gigbooks.data.supabase.models.Song) {
        val payload = PhoneProtocol.serializePayload(SongChangedPayload(
            songId = song.id,
            songName = song.name,
            artist = song.artist,
            bpm = song.bpm,
        ))
        val msg = PhoneProtocol.createMessage(
            type = PhoneMessageType.SongChanged,
            phoneId = _phoneId.value,
            payload = payload,
        )
        scope?.launch { sendCommand(msg) }
    }

    /** S41: Request Studio to start recording with gig context. */
    fun sendStartRecRequestWithGig(gigId: String?, venueName: String?, gigDate: String?) {
        val payload = PhoneProtocol.serializePayload(StartRecPayload(
            gigId = gigId,
            venueName = venueName,
            gigDate = gigDate,
        ))
        val msg = PhoneProtocol.createMessage(
            type = PhoneMessageType.StartRecRequest,
            phoneId = _phoneId.value,
            payload = payload,
        )
        scope?.launch { sendCommand(msg) }
    }

    private suspend fun doConnect(info: PairingInfo) {
        _state.value = ConnectionState.Connecting
        _error.value = null

        // Strategy: try BT first (instant, no WiFi needed), then TCP in background
        var btOk = false
        var tcpOk = false

        // 1. Try Bluetooth first if btName is available
        if (info.hasBluetooth) {
            try {
                Log.d(TAG, "Attempting BT connection to '${info.btName}'")
                btClient.connect(info.btName!!, timeoutMs = 10000)
                btOk = true
                _btConnected.value = true
                Log.d(TAG, "BT connected")
            } catch (e: Exception) {
                Log.w(TAG, "BT connect failed: ${e.message}")
                // BT failed — fall through to TCP
            }
        }

        // 2. Try TCP (needs same network as XR18 Studio)
        if (!btOk) {
            // If BT failed, TCP is our only hope — try it now
            try {
                connectTcp(info)
                tcpOk = true
            } catch (e: Exception) {
                Log.w(TAG, "TCP connect failed: ${e.message}")
            }
        } else {
            // BT succeeded — try TCP in background (non-blocking)
            tcpConnectJob = scope?.launch {
                try {
                    connectTcp(info)
                } catch (e: Exception) {
                    Log.d(TAG, "Background TCP connect failed: ${e.message}")
                    // That's fine — BT is working
                }
            }
        }

        // 3. If neither BT nor TCP worked, try relay as last resort (synchronous)
        var relayOk = false
        if (!btOk && !tcpOk) {
            try {
                Log.d(TAG, "Attempting Supabase relay connection")
                relayClient.connect(info.secret)
                // Give WebSocket a moment to connect and join
                delay(2000)
                if (relayClient.isConnected.value) {
                    relayOk = true
                    _relayConnected.value = true
                    Log.d(TAG, "Relay connected")
                }
            } catch (e: Exception) {
                Log.w(TAG, "Relay connect failed: ${e.message}")
            }
        } else {
            // BT or TCP succeeded — try relay in background (non-blocking fallback)
            relayConnectJob = scope?.launch {
                delay(2000) // Brief delay
                try {
                    relayClient.connect(info.secret)
                    delay(2000) // Wait for WS handshake
                    if (relayClient.isConnected.value) {
                        _relayConnected.value = true
                        Log.d(TAG, "Background relay connected")
                        // Start handler for relay messages
                        scope?.launch {
                            relayClient.messages.collect { m -> handleMessage(m) }
                        }
                        scope?.launch {
                            relayClient.disconnected.collect {
                                _relayConnected.value = false
                                Log.w(TAG, "Relay disconnected")
                                onTransportLost()
                            }
                        }
                        // If already paired, send Pair on relay too
                        if (_phoneId.value != null) {
                            val pairPayload = PhoneProtocol.serializePayload(
                                PairPayload(
                                    deviceModel = "${Build.MANUFACTURER} ${Build.MODEL}",
                                    platform = "Android",
                                    name = "Camera",
                                )
                            )
                            relayClient.send(PhoneProtocol.createMessage(
                                type = PhoneMessageType.Pair,
                                phoneId = _phoneId.value,
                                payload = pairPayload,
                                secret = info.secret,
                            ))
                            relayPaired = true
                        }
                    }
                } catch (_: Exception) {
                    // Relay unavailable — that's fine
                }
            }
        }

        if (!btOk && !tcpOk && !relayOk) {
            _state.value = ConnectionState.Error
            _error.value = "No connection — check Bluetooth pairing, WiFi, or internet"
            scheduleReconnect()
            return
        }

        _state.value = ConnectionState.Pairing

        // Send Pair on the connected transport (BT preferred, then TCP, then relay)
        val pairPayload = PhoneProtocol.serializePayload(
            PairPayload(
                deviceModel = "${Build.MANUFACTURER} ${Build.MODEL}",
                platform = "Android",
                name = "Camera",
            )
        )
        val pairMsg = PhoneProtocol.createMessage(
            type = PhoneMessageType.Pair,
            payload = pairPayload,
            secret = info.secret,
        )
        sendCommand(pairMsg)

        // Start message handlers for whichever transports are connected
        startMessageHandlers()
        startDisconnectHandlers()
        acquireWifiLock()
    }

    private suspend fun connectTcp(info: PairingInfo) {
        var connected = false
        var lastError: Exception? = null
        for (ip in info.ips) {
            try {
                tcpClient.connect(ip, info.tcpPort, timeoutMs = 3000)
                connected = true
                _tcpConnected.value = true
                Log.d(TAG, "TCP connected to $ip:${info.tcpPort}")
                break
            } catch (e: Exception) {
                lastError = e
            }
        }
        if (!connected) throw lastError ?: Exception("No reachable IP")

        // If we're already paired via BT, pair on TCP too (dual-attach)
        if (btPaired && _phoneId.value != null) {
            val pairPayload = PhoneProtocol.serializePayload(
                PairPayload(
                    deviceModel = "${Build.MANUFACTURER} ${Build.MODEL}",
                    platform = "Android",
                    name = "Camera",
                )
            )
            tcpClient.send(PhoneProtocol.createMessage(
                type = PhoneMessageType.Pair,
                phoneId = _phoneId.value,
                payload = pairPayload,
                secret = pairingInfo?.secret,
            ))
            tcpPaired = true
        }
    }

    private fun startMessageHandlers() {
        // BT messages
        if (_btConnected.value) {
            scope?.launch {
                btClient.messages.collect { msg -> handleMessage(msg) }
            }
        }
        // TCP messages
        if (_tcpConnected.value) {
            scope?.launch {
                tcpClient.messages.collect { msg -> handleMessage(msg) }
            }
        }
        // Relay messages
        if (_relayConnected.value) {
            scope?.launch {
                relayClient.messages.collect { msg -> handleMessage(msg) }
            }
        }
    }

    private fun startDisconnectHandlers() {
        if (_btConnected.value) {
            scope?.launch {
                btClient.disconnected.collect {
                    _btConnected.value = false
                    Log.w(TAG, "BT disconnected")
                    onTransportLost()
                }
            }
        }
        if (_tcpConnected.value) {
            scope?.launch {
                tcpClient.disconnected.collect {
                    _tcpConnected.value = false
                    Log.w(TAG, "TCP disconnected")
                    onTransportLost()
                }
            }
        }
        if (_relayConnected.value) {
            scope?.launch {
                relayClient.disconnected.collect {
                    _relayConnected.value = false
                    Log.w(TAG, "Relay disconnected")
                    onTransportLost()
                }
            }
        }
    }

    private fun onTransportLost() {
        if (intentionalDisconnect) return
        // If at least one transport is still alive, keep going
        if (_btConnected.value || _tcpConnected.value || _relayConnected.value) {
            Log.d(TAG, "One transport lost, but still have bt=${_btConnected.value} tcp=${_tcpConnected.value} relay=${_relayConnected.value}")
            return
        }
        // All transports dead
        _state.value = ConnectionState.Error
        _error.value = "Connection lost"
        scheduleReconnect()
    }

    private suspend fun handleMessage(msg: PhoneMessage) {
        when (msg.type) {
            PhoneMessageType.PairAck -> {
                _phoneId.value = msg.phoneId
                _state.value = ConnectionState.Connected
                // Track which transport just paired
                if (_btConnected.value && !btPaired) btPaired = true
                if (_tcpConnected.value && !tcpPaired) tcpPaired = true
                startStatusSender()
                startPreviewSender()

                // If BT paired but TCP not yet connected, start background TCP connect
                if (btPaired && !_tcpConnected.value && tcpConnectJob == null) {
                    val info = pairingInfo ?: return
                    tcpConnectJob = scope?.launch {
                        delay(1000) // Brief delay before attempting TCP
                        try {
                            connectTcp(info)
                            if (_tcpConnected.value) {
                                // Start handler for the late-arriving TCP transport
                                scope?.launch {
                                    tcpClient.messages.collect { m -> handleMessage(m) }
                                }
                                scope?.launch {
                                    tcpClient.disconnected.collect {
                                        _tcpConnected.value = false
                                        Log.w(TAG, "TCP disconnected (late)")
                                        onTransportLost()
                                    }
                                }
                            }
                        } catch (_: Exception) {
                            // TCP unavailable — BT-only is fine
                        }
                    }
                }
            }

            PhoneMessageType.PairReject -> {
                _error.value = "Pairing rejected — invalid secret"
                _state.value = ConnectionState.Error
                btClient.disconnect()
                tcpClient.disconnect()
            }

            PhoneMessageType.Heartbeat -> {
                sendCommand(PhoneProtocol.createMessage(
                    type = PhoneMessageType.HeartbeatAck,
                    phoneId = _phoneId.value,
                ))
            }

            PhoneMessageType.SyncTimeRequest -> {
                val t2 = System.currentTimeMillis()
                val t1Payload = PhoneProtocol.deserializePayload<SyncTimePayload>(msg.payload)
                val t1 = t1Payload?.t1 ?: 0
                val t3 = System.currentTimeMillis()
                sendCommand(PhoneProtocol.createMessage(
                    type = PhoneMessageType.SyncTimeResponse,
                    phoneId = _phoneId.value,
                    payload = PhoneProtocol.serializePayload(SyncTimePayload(t1 = t1, t2 = t2, t3 = t3)),
                ))
            }

            PhoneMessageType.StartRec -> {
                val recPayload = PhoneProtocol.deserializePayload<StartRecPayload>(msg.payload)
                val sessionName = recPayload?.sessionName ?: "recording"
                val sessionId = recPayload?.sessionId ?: ""
                _state.value = ConnectionState.Recording
                onStartRecording?.invoke(sessionName, sessionId)
                sendCommand(PhoneProtocol.createMessage(
                    type = PhoneMessageType.RecStarted,
                    phoneId = _phoneId.value,
                ))
                // Check quality after 6 seconds and send warning if framerate is off
                scope?.launch {
                    delay(6000)
                    val warning = getQualityWarning?.invoke()
                    if (warning != null) {
                        Log.w(TAG, "Quality warning: ${warning.warning}")
                        sendCommand(PhoneProtocol.createMessage(
                            type = PhoneMessageType.QualityWarning,
                            phoneId = _phoneId.value,
                            payload = PhoneProtocol.serializePayload(warning),
                        ))
                    }
                }
            }

            PhoneMessageType.StopRec -> {
                onStopRecording?.invoke()
                _state.value = ConnectionState.Connected
                sendCommand(PhoneProtocol.createMessage(
                    type = PhoneMessageType.RecStopped,
                    phoneId = _phoneId.value,
                ))
            }

            PhoneMessageType.SettingsPush -> {
                val settings = PhoneProtocol.deserializePayload<PhoneSettings>(msg.payload)
                if (settings != null) {
                    _currentSettings.value = settings
                    try {
                        onSettingsChanged?.invoke(settings)
                    } catch (e: Exception) {
                        Log.e(TAG, "Settings apply failed: ${e.message}", e)
                        // Don't crash — keep running with previous settings
                    }
                }
                sendCommand(PhoneProtocol.createMessage(
                    type = PhoneMessageType.SettingsAck,
                    phoneId = _phoneId.value,
                ))
            }

            PhoneMessageType.PreviewRequest -> {
                // Server requests a single preview frame
                val frame = capturePreviewFrame?.invoke()
                if (frame != null) {
                    val base64 = Base64.encodeToString(frame, Base64.NO_WRAP)
                    sendPreview(PhoneProtocol.createMessage(
                        type = PhoneMessageType.CameraPreview,
                        phoneId = _phoneId.value,
                        payload = base64,
                    ))
                }
            }

            PhoneMessageType.PreviewStart -> {
                livePreviewEnabled = true
                Log.d(TAG, "Live preview enabled")
            }

            PhoneMessageType.PreviewStop -> {
                livePreviewEnabled = false
                Log.d(TAG, "Live preview paused")
            }

            PhoneMessageType.SyncPulse -> {
                val pulsePayload = PhoneProtocol.deserializePayload<SyncPulsePayload>(msg.payload)
                Log.d(TAG, "SyncPulse received: serverTs=${pulsePayload?.serverTimestampMs} sessionId=${pulsePayload?.sessionId}")
                // Execute sync pulse (flash + beep) via callback; fall back to current time
                val executedAtMs = onSyncPulse?.invoke() ?: System.currentTimeMillis()
                sendCommand(PhoneProtocol.createMessage(
                    type = PhoneMessageType.SyncPulseAck,
                    phoneId = _phoneId.value,
                    payload = PhoneProtocol.serializePayload(mapOf("executedAtMs" to executedAtMs)),
                ))
            }

            PhoneMessageType.ClipReady -> {
                val clipPayload = PhoneProtocol.deserializePayload<ClipReadyPayload>(msg.payload)
                if (clipPayload != null && clipPayload.downloadUrl.isNotBlank()) {
                    Log.i(TAG, "ClipReady: ${clipPayload.clipName} (${clipPayload.fileSizeBytes / 1024}KB) from ${clipPayload.downloadUrl}")
                    // Download in background, then notify via callback for share intent
                    scope?.launch(Dispatchers.IO) {
                        try {
                            val localPath = downloadClip(clipPayload)
                            if (localPath != null) {
                                withContext(Dispatchers.Main) {
                                    onClipDownloaded?.invoke(clipPayload.clipName, localPath)
                                }
                            }
                        } catch (e: Exception) {
                            Log.e(TAG, "Clip download failed: ${e.message}", e)
                        }
                    }
                }
            }

            else -> { /* Ignore unknown */ }
        }
    }

    /**
     * S54 W-G: Download an exported clip from the media server via Tailscale HTTPS.
     * Returns the local file path, or null on failure.
     */
    private fun downloadClip(payload: ClipReadyPayload): String? {
        val clipsDir = java.io.File(context.getExternalFilesDir(null), "TangerineClips")
        if (!clipsDir.exists()) clipsDir.mkdirs()

        val safeName = payload.clipName.replace(Regex("[^a-zA-Z0-9._-]"), "_")
        val outputFile = java.io.File(clipsDir, "$safeName.mp4")

        // Accept self-signed certs for Tailscale HTTPS
        val trustAllCerts = arrayOf<javax.net.ssl.TrustManager>(object : javax.net.ssl.X509TrustManager {
            override fun checkClientTrusted(chain: Array<java.security.cert.X509Certificate>, authType: String) {}
            override fun checkServerTrusted(chain: Array<java.security.cert.X509Certificate>, authType: String) {}
            override fun getAcceptedIssuers(): Array<java.security.cert.X509Certificate> = arrayOf()
        })

        val sslContext = javax.net.ssl.SSLContext.getInstance("TLS")
        sslContext.init(null, trustAllCerts, java.security.SecureRandom())

        val url = java.net.URL(payload.downloadUrl)
        val conn = url.openConnection() as javax.net.ssl.HttpsURLConnection
        conn.sslSocketFactory = sslContext.socketFactory
        conn.hostnameVerifier = javax.net.ssl.HostnameVerifier { _, _ -> true }
        conn.connectTimeout = 15_000
        conn.readTimeout = 60_000

        try {
            conn.connect()
            if (conn.responseCode != 200) {
                Log.e(TAG, "Clip download HTTP ${conn.responseCode}")
                return null
            }

            conn.inputStream.use { input ->
                outputFile.outputStream().use { output ->
                    input.copyTo(output, bufferSize = 8192)
                }
            }

            Log.i(TAG, "Clip downloaded: ${outputFile.absolutePath} (${outputFile.length() / 1024}KB)")
            return outputFile.absolutePath
        } finally {
            conn.disconnect()
        }
    }

    /**
     * Send a command message: BT primary, TCP fallback, Relay fallback.
     */
    private suspend fun sendCommand(msg: PhoneMessage) {
        try {
            if (_btConnected.value) {
                btClient.send(msg)
                return
            }
        } catch (e: Exception) {
            Log.w(TAG, "BT send failed, falling back to TCP: ${e.message}")
        }
        try {
            if (_tcpConnected.value) {
                tcpClient.send(msg)
                return
            }
        } catch (e: Exception) {
            Log.w(TAG, "TCP send failed, falling back to relay: ${e.message}")
        }
        try {
            if (_relayConnected.value) {
                relayClient.send(msg)
                return
            }
        } catch (e: Exception) {
            Log.w(TAG, "Relay send also failed: ${e.message}")
        }
    }

    /**
     * Send a preview frame: TCP primary (higher bandwidth), BT fallback, Relay fallback.
     */
    private suspend fun sendPreview(msg: PhoneMessage) {
        try {
            if (_tcpConnected.value) {
                tcpClient.send(msg)
                return
            }
        } catch (e: Exception) {
            Log.w(TAG, "TCP preview send failed, falling back to BT: ${e.message}")
        }
        try {
            if (_btConnected.value) {
                btClient.send(msg)
                return
            }
        } catch (e: Exception) {
            Log.w(TAG, "BT preview send failed, falling back to relay: ${e.message}")
        }
        try {
            if (_relayConnected.value) {
                relayClient.send(msg)
                return
            }
        } catch (e: Exception) {
            Log.w(TAG, "Relay preview send also failed: ${e.message}")
        }
    }

    private fun startStatusSender() {
        statusJob?.cancel()
        statusJob = scope?.launch {
            while (isActive) {
                delay(10_000)
                sendStatus()
            }
        }
    }

    private suspend fun sendStatus() {
        val battery = getBatteryPercent()
        val storageFree = getStorageFree()
        val settings = _currentSettings.value
        val recording = _state.value == ConnectionState.Recording
        sendCommand(PhoneProtocol.createMessage(
            type = PhoneMessageType.Status,
            phoneId = _phoneId.value,
            payload = PhoneProtocol.serializePayload(StatusPayload(
                battery = battery,
                storageFree = storageFree,
                resolution = settings.resolution,
                framerate = settings.framerate,
                isRecording = recording,
                actualFramerate = getActualFramerate?.invoke() ?: settings.framerate.toDouble(),
                isConstantFrameRate = getIsConstantFrameRate?.invoke() ?: true,
            )),
        ))
    }

    private fun startPreviewSender() {
        previewJob?.cancel()
        previewJob = scope?.launch {
            while (isActive) {
                delay(2000)
                if (!livePreviewEnabled) continue  // Server paused preview
                if (_state.value == ConnectionState.Recording) {
                    delay(3000) // Less frequent during recording
                    continue
                }
                val frame = capturePreviewFrame?.invoke() ?: continue
                val base64 = Base64.encodeToString(frame, Base64.NO_WRAP)
                sendPreview(PhoneProtocol.createMessage(
                    type = PhoneMessageType.CameraPreview,
                    phoneId = _phoneId.value,
                    payload = base64,
                ))
            }
        }
    }

    private fun scheduleReconnect() {
        if (intentionalDisconnect) return
        val info = pairingInfo ?: return
        reconnectJob?.cancel()
        reconnectJob = scope?.launch {
            var backoff = 1000L
            while (isActive && _state.value != ConnectionState.Connected) {
                delay(backoff)
                backoff = (backoff * 2).coerceAtMost(30_000)
                try {
                    doConnect(info)
                    if (_state.value == ConnectionState.Pairing || _state.value == ConnectionState.Connected) break
                } catch (_: Exception) { /* retry */ }
            }
        }
    }

    private fun acquireWifiLock() {
        if (wifiLock == null) {
            val wifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
            wifiLock = wifiManager.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "XR18Studio:WiFi")
        }
        wifiLock?.takeIf { !it.isHeld }?.acquire()
    }

    private fun releaseWifiLock() {
        wifiLock?.takeIf { it.isHeld }?.release()
    }

    private fun getBatteryPercent(): Int {
        val intent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val level = intent?.getIntExtra(BatteryManager.EXTRA_LEVEL, 0) ?: 0
        val scale = intent?.getIntExtra(BatteryManager.EXTRA_SCALE, 100) ?: 100
        return if (scale > 0) (level * 100) / scale else 0
    }

    private fun getStorageFree(): Long {
        return try {
            val stat = StatFs(Environment.getExternalStorageDirectory().path)
            stat.availableBlocksLong * stat.blockSizeLong
        } catch (_: Exception) { 0 }
    }

    private fun cleanup() {
        statusJob?.cancel()
        previewJob?.cancel()
        reconnectJob?.cancel()
        tcpConnectJob?.cancel()
        relayConnectJob?.cancel()
        btClient.disconnect()
        tcpClient.disconnect()
        relayClient.disconnect()
        _btConnected.value = false
        _tcpConnected.value = false
        _relayConnected.value = false
        btPaired = false
        tcpPaired = false
        relayPaired = false
        releaseWifiLock()
        scope?.cancel()
        scope = null
    }
}

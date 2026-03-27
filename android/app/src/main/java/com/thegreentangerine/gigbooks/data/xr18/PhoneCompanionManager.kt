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
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

enum class ConnectionState {
    Disconnected, Connecting, Pairing, Connected, Recording, Error
}

/**
 * Client-side orchestrator for XR18Studio Phone Director connection.
 * Manages TCP connection, pairing, heartbeat ACK, time sync, recording commands,
 * status reporting, preview frames, and auto-reconnect.
 */
class PhoneCompanionManager(private val context: Context) {

    private val tcpClient = TcpPhoneClient()
    private var scope: CoroutineScope? = null
    private var statusJob: Job? = null
    private var previewJob: Job? = null
    private var reconnectJob: Job? = null

    private val _state = MutableStateFlow(ConnectionState.Disconnected)
    val state: StateFlow<ConnectionState> = _state

    private val _phoneId = MutableStateFlow<String?>(null)
    val phoneId: StateFlow<String?> = _phoneId

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    private val _currentSettings = MutableStateFlow(PhoneSettings())
    val currentSettings: StateFlow<PhoneSettings> = _currentSettings

    var pairingInfo: PairingInfo? = null
        private set

    // Callbacks
    var onStartRecording: ((sessionName: String) -> Unit)? = null
    var onStopRecording: (() -> Unit)? = null
    var onSettingsChanged: ((PhoneSettings) -> Unit)? = null
    var capturePreviewFrame: (() -> ByteArray?)? = null

    private var wifiLock: WifiManager.WifiLock? = null
    private var intentionalDisconnect = false

    fun connect(info: PairingInfo) {
        pairingInfo = info
        intentionalDisconnect = false
        scope?.cancel()
        scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
        scope?.launch { doConnect(info) }
    }

    fun disconnect() {
        intentionalDisconnect = true
        cleanup()
        _state.value = ConnectionState.Disconnected
    }

    private suspend fun doConnect(info: PairingInfo) {
        _state.value = ConnectionState.Connecting
        _error.value = null
        try {
            tcpClient.connect(info.ip, info.tcpPort)
            _state.value = ConnectionState.Pairing

            // Send Pair message
            val pairPayload = PhoneProtocol.serializePayload(
                PairPayload(
                    deviceModel = "${Build.MANUFACTURER} ${Build.MODEL}",
                    platform = "Android",
                    name = "Camera",
                )
            )
            tcpClient.send(PhoneProtocol.createMessage(
                type = PhoneMessageType.Pair,
                payload = pairPayload,
                secret = info.secret,
            ))

            // Start message handling
            startMessageHandler()
            startDisconnectHandler()
            acquireWifiLock()
        } catch (e: Exception) {
            _state.value = ConnectionState.Error
            _error.value = e.message ?: "Connection failed"
            scheduleReconnect()
        }
    }

    private fun startMessageHandler() {
        scope?.launch {
            tcpClient.messages.collect { msg -> handleMessage(msg) }
        }
    }

    private fun startDisconnectHandler() {
        scope?.launch {
            tcpClient.disconnected.collect {
                if (!intentionalDisconnect) {
                    _state.value = ConnectionState.Error
                    _error.value = "Connection lost"
                    scheduleReconnect()
                }
            }
        }
    }

    private suspend fun handleMessage(msg: PhoneMessage) {
        when (msg.type) {
            PhoneMessageType.PairAck -> {
                _phoneId.value = msg.phoneId
                _state.value = ConnectionState.Connected
                startStatusSender()
                startPreviewSender()
            }

            PhoneMessageType.PairReject -> {
                _error.value = "Pairing rejected — invalid secret"
                _state.value = ConnectionState.Error
                tcpClient.disconnect()
            }

            PhoneMessageType.Heartbeat -> {
                tcpClient.send(PhoneProtocol.createMessage(
                    type = PhoneMessageType.HeartbeatAck,
                    phoneId = _phoneId.value,
                ))
            }

            PhoneMessageType.SyncTimeRequest -> {
                val t2 = System.currentTimeMillis()
                val t1Payload = PhoneProtocol.deserializePayload<SyncTimePayload>(msg.payload)
                val t1 = t1Payload?.t1 ?: 0
                val t3 = System.currentTimeMillis()
                tcpClient.send(PhoneProtocol.createMessage(
                    type = PhoneMessageType.SyncTimeResponse,
                    phoneId = _phoneId.value,
                    payload = PhoneProtocol.serializePayload(SyncTimePayload(t1 = t1, t2 = t2, t3 = t3)),
                ))
            }

            PhoneMessageType.StartRec -> {
                val recPayload = PhoneProtocol.deserializePayload<StartRecPayload>(msg.payload)
                _state.value = ConnectionState.Recording
                onStartRecording?.invoke(recPayload?.sessionName ?: "recording")
                tcpClient.send(PhoneProtocol.createMessage(
                    type = PhoneMessageType.RecStarted,
                    phoneId = _phoneId.value,
                ))
            }

            PhoneMessageType.StopRec -> {
                onStopRecording?.invoke()
                _state.value = ConnectionState.Connected
                tcpClient.send(PhoneProtocol.createMessage(
                    type = PhoneMessageType.RecStopped,
                    phoneId = _phoneId.value,
                ))
            }

            PhoneMessageType.SettingsPush -> {
                val settings = PhoneProtocol.deserializePayload<PhoneSettings>(msg.payload)
                if (settings != null) {
                    _currentSettings.value = settings
                    onSettingsChanged?.invoke(settings)
                }
                tcpClient.send(PhoneProtocol.createMessage(
                    type = PhoneMessageType.SettingsAck,
                    phoneId = _phoneId.value,
                ))
            }

            else -> { /* Ignore unknown */ }
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
        tcpClient.send(PhoneProtocol.createMessage(
            type = PhoneMessageType.Status,
            phoneId = _phoneId.value,
            payload = PhoneProtocol.serializePayload(StatusPayload(
                battery = battery,
                storageFree = storageFree,
                resolution = settings.resolution,
                framerate = settings.framerate,
                isRecording = recording,
            )),
        ))
    }

    private fun startPreviewSender() {
        previewJob?.cancel()
        previewJob = scope?.launch {
            while (isActive) {
                delay(2000)
                if (_state.value == ConnectionState.Recording) {
                    delay(3000) // Less frequent during recording
                    continue
                }
                val frame = capturePreviewFrame?.invoke() ?: continue
                val base64 = Base64.encodeToString(frame, Base64.NO_WRAP)
                tcpClient.send(PhoneProtocol.createMessage(
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
        tcpClient.disconnect()
        releaseWifiLock()
        scope?.cancel()
        scope = null
    }
}

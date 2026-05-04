package com.thegreentangerine.gigbooks.data.orchestrator

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.net.wifi.WifiManager
import android.os.Build
import android.util.Base64
import android.util.Log
import com.thegreentangerine.gigbooks.data.xr18.PairPayload
import com.thegreentangerine.gigbooks.data.xr18.PhoneMessage
import com.thegreentangerine.gigbooks.data.xr18.PhoneMessageType
import com.thegreentangerine.gigbooks.data.xr18.PhoneProtocol
import com.thegreentangerine.gigbooks.data.xr18.StartRecPayload
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.NetworkInterface
import java.net.Socket

/**
 * Peer-side adapter that lives on a non-drummer phone (camera / video capture).
 *
 * Discovers the drummer's orchestrator via mDNS (`_tgt-orchestrator._tcp.`),
 * connects over TCP, sends Pair, then listens for StartRec / StopRec fanouts.
 * Reuses [PhoneProtocol] so the wire format matches the existing XR18Studio
 * companion path — peer code can swap between the two by changing the discovery
 * + transport layer only.
 *
 * No QR pairing, no secret. The orchestrator + peers share a private LAN (S23
 * hotspot at gig, home WiFi otherwise); LAN membership is the trust boundary.
 *
 * UI integration is deferred to a future session; for now the class exposes
 * callbacks the camera screen can wire to [com.thegreentangerine.gigbooks.data.xr18.CameraRecordingManager].
 */
class PeerOrchestratorClient(private val context: Context) {

    companion object {
        private const val TAG = "PeerOrchestrator"
        private const val PREVIEW_INTERVAL_MS = 3_000L
        private const val PREVIEW_INTERVAL_REC_MS = 8_000L
    }

    enum class State { Idle, Discovering, Connecting, Paired, Recording }

    data class Discovered(val name: String, val host: String, val port: Int)

    private val nsd = context.getSystemService(Context.NSD_SERVICE) as NsdManager
    private val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    private var multicastLock: WifiManager.MulticastLock? = null
    private var discoveryListener: NsdManager.DiscoveryListener? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private var resolvingNow = false
    private var resolveBacklog = mutableListOf<NsdServiceInfo>()

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var connectJob: Job? = null
    private var receiveJob: Job? = null
    private var previewJob: Job? = null
    private val sendMutex = Mutex()
    private var socket: Socket? = null

    private val _state = MutableStateFlow(State.Idle)
    val state: StateFlow<State> = _state

    private val _discovered = MutableStateFlow<Discovered?>(null)
    val discovered: StateFlow<Discovered?> = _discovered

    private val _phoneId = MutableStateFlow<String?>(null)
    val phoneId: StateFlow<String?> = _phoneId

    /** Called when the orchestrator broadcasts StartRec. Caller wires this to start camera recording. */
    var onStartRec: ((sessionId: String, sessionName: String) -> Unit)? = null

    /** Called when the orchestrator broadcasts StopRec. */
    var onStopRec: (() -> Unit)? = null

    /** Caller provides JPEG bytes for the periodic preview heartbeat. Null skips a beat. */
    var providePreviewFrame: (() -> ByteArray?)? = null

    fun start() {
        acquireMulticastLock()
        registerNetworkWatcher()
        startDiscovery()
    }

    fun stop() {
        stopDiscovery()
        unregisterNetworkWatcher()
        releaseMulticastLock()
        connectJob?.cancel()
        connectJob = null
        disconnect()
        _state.value = State.Idle
    }

    fun shutdown() {
        stop()
        scope.cancel()
    }

    // ── Discovery ────────────────────────────────────────────────────────────────

    private fun startDiscovery() {
        stopDiscovery()
        _discovered.value = null
        _state.value = State.Discovering
        val listener = object : NsdManager.DiscoveryListener {
            override fun onDiscoveryStarted(serviceType: String) {
                Log.d(TAG, "Discovery started for $serviceType")
            }
            override fun onDiscoveryStopped(serviceType: String) {
                Log.d(TAG, "Discovery stopped for $serviceType")
            }
            override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {
                Log.w(TAG, "Discovery start failed: $errorCode")
            }
            override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) {
                Log.w(TAG, "Discovery stop failed: $errorCode")
            }
            override fun onServiceFound(info: NsdServiceInfo) {
                Log.d(TAG, "Found ${info.serviceName} (${info.serviceType})")
                if (info.serviceName.startsWith("TGT Orchestrator")) {
                    if (resolvingNow) {
                        resolveBacklog += info
                    } else {
                        resolveService(info)
                    }
                }
            }
            override fun onServiceLost(info: NsdServiceInfo) {
                Log.d(TAG, "Service lost: ${info.serviceName}")
                val cur = _discovered.value
                if (cur != null && cur.name == info.serviceName) {
                    _discovered.value = null
                    disconnect()
                    _state.value = State.Discovering
                }
            }
        }
        try {
            nsd.discoverServices(OrchestratorPublisher.SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, listener)
            discoveryListener = listener
        } catch (e: Exception) {
            Log.w(TAG, "discoverServices threw: ${e.message}")
        }
    }

    private fun stopDiscovery() {
        val l = discoveryListener ?: return
        try { nsd.stopServiceDiscovery(l) } catch (_: Exception) {}
        discoveryListener = null
    }

    private fun resolveService(info: NsdServiceInfo) {
        resolvingNow = true
        if (Build.VERSION.SDK_INT >= 34) {
            try {
                nsd.registerServiceInfoCallback(info, { it.run() }, object : NsdManager.ServiceInfoCallback {
                    override fun onServiceInfoCallbackRegistrationFailed(errorCode: Int) {
                        finishResolve()
                    }
                    override fun onServiceUpdated(updated: NsdServiceInfo) {
                        publishResolved(updated)
                        finishResolve()
                    }
                    override fun onServiceLost() {}
                    override fun onServiceInfoCallbackUnregistered() {}
                })
                return
            } catch (e: Exception) {
                Log.w(TAG, "registerServiceInfoCallback failed, fallback: ${e.message}")
            }
        }
        @Suppress("DEPRECATION")
        nsd.resolveService(info, object : NsdManager.ResolveListener {
            override fun onResolveFailed(info: NsdServiceInfo, errorCode: Int) {
                Log.w(TAG, "Resolve failed: $errorCode")
                finishResolve()
            }
            override fun onServiceResolved(resolved: NsdServiceInfo) {
                publishResolved(resolved)
                finishResolve()
            }
        })
    }

    private fun finishResolve() {
        resolvingNow = false
        val next = resolveBacklog.removeFirstOrNull() ?: return
        resolveService(next)
    }

    private fun publishResolved(resolved: NsdServiceInfo) {
        @Suppress("DEPRECATION")
        val host = resolved.host?.hostAddress ?: return
        val port = resolved.port
        if (port <= 0) return
        // S122 gig-night bug: if the same phone is running both orchestrator and
        // peer roles (e.g. Gig Mode opened then Peer drawer entry tapped), mDNS
        // happily resolves the orchestrator's own broadcast and the peer connects
        // to localhost as peer-1. The orchestrator then fans out RECORD to its own
        // peer, which kills CameraX through the rebind storm. Refuse to pair with
        // self.
        if (isLocalHost(host)) {
            Log.w(TAG, "Refusing self-pair: $host is one of this device's own interfaces — likely Gig Mode + Peer both open on the same phone.")
            return
        }
        Log.i(TAG, "Resolved ${resolved.serviceName} → $host:$port")
        _discovered.value = Discovered(resolved.serviceName, host, port)
        connectAsync(host, port)
    }

    /** True if [host] resolves to one of this device's own interface addresses. */
    private fun isLocalHost(host: String): Boolean = try {
        val resolved = InetAddress.getByName(host)
        NetworkInterface.getNetworkInterfaces().asSequence()
            .flatMap { it.inetAddresses.asSequence() }
            .any { it.hostAddress == resolved.hostAddress }
    } catch (_: Exception) {
        false
    }

    // ── Connection ───────────────────────────────────────────────────────────────

    /**
     * Cancels any prior connect/reconnect, then runs a single retry loop with
     * exponential backoff. The loop exits when we reach Paired/Recording or when
     * something else cancels the job (e.g. discovery resolved a different host).
     */
    private fun connectAsync(host: String, port: Int) {
        connectJob?.cancel()
        connectJob = scope.launch {
            var backoff = 1_000L
            while (isActive) {
                val ok = tryConnectOnce(host, port)
                if (ok) return@launch
                _state.value = State.Discovering
                delay(backoff)
                backoff = (backoff * 2).coerceAtMost(30_000)
            }
        }
    }

    /** One single connect + Pair attempt. Returns true on success (Pair sent, receive loop running). */
    private suspend fun tryConnectOnce(host: String, port: Int): Boolean {
        _state.value = State.Connecting
        return try {
            disconnect()
            val sock = withContext(Dispatchers.IO) {
                val s = Socket()
                s.connect(InetSocketAddress(host, port), 5_000)
                s.tcpNoDelay = true
                s.soTimeout = 0
                s
            }
            socket = sock
            val pairPayload = PhoneProtocol.serializePayload(PairPayload(
                deviceModel = "${Build.MANUFACTURER} ${Build.MODEL}",
                platform = "Android",
                name = "Camera",
            ))
            sendInternal(PhoneProtocol.createMessage(
                type = PhoneMessageType.Pair,
                payload = pairPayload,
            ))
            startReceiveLoop()
            true
        } catch (e: Exception) {
            Log.w(TAG, "Connect to $host:$port failed: ${e.message}")
            false
        }
    }

    private fun startReceiveLoop() {
        receiveJob?.cancel()
        receiveJob = scope.launch {
            try {
                val sock = socket ?: return@launch
                val input = sock.getInputStream()
                while (isActive) {
                    val frame = withContext(Dispatchers.IO) {
                        PhoneProtocol.readTcpFrame(input)
                    } ?: break
                    val msg = PhoneProtocol.deserialize(frame) ?: continue
                    handleServerMessage(msg)
                }
            } catch (e: Exception) {
                Log.w(TAG, "Receive loop ended: ${e.message}")
            } finally {
                disconnect()
                _state.value = State.Discovering
                // After loss, restart connection attempts to the last-known target via
                // the same single-loop path. discovery may also push a new target soon.
                _discovered.value?.let { d -> connectAsync(d.host, d.port) }
            }
        }
    }

    private suspend fun handleServerMessage(msg: PhoneMessage) {
        when (msg.type) {
            PhoneMessageType.PairAck -> {
                _phoneId.value = msg.phoneId
                _state.value = State.Paired
                startPreviewSender()
                Log.i(TAG, "Paired as ${msg.phoneId}")
            }
            PhoneMessageType.Heartbeat -> {
                sendInternal(PhoneProtocol.createMessage(
                    type = PhoneMessageType.HeartbeatAck,
                    phoneId = _phoneId.value,
                ))
            }
            PhoneMessageType.StartRec -> {
                val payload = PhoneProtocol.deserializePayload<StartRecPayload>(msg.payload)
                _state.value = State.Recording
                onStartRec?.invoke(payload?.sessionId ?: "", payload?.sessionName ?: "gig-set")
                sendInternal(PhoneProtocol.createMessage(
                    type = PhoneMessageType.RecStarted,
                    phoneId = _phoneId.value,
                ))
            }
            PhoneMessageType.StopRec -> {
                _state.value = State.Paired
                onStopRec?.invoke()
                sendInternal(PhoneProtocol.createMessage(
                    type = PhoneMessageType.RecStopped,
                    phoneId = _phoneId.value,
                ))
            }
            else -> { /* ignore */ }
        }
    }

    private fun startPreviewSender() {
        previewJob?.cancel()
        previewJob = scope.launch {
            while (isActive && (_state.value == State.Paired || _state.value == State.Recording)) {
                val gap = if (_state.value == State.Recording) PREVIEW_INTERVAL_REC_MS else PREVIEW_INTERVAL_MS
                delay(gap)
                val frame = providePreviewFrame?.invoke() ?: continue
                val base64 = Base64.encodeToString(frame, Base64.NO_WRAP)
                try {
                    sendInternal(PhoneProtocol.createMessage(
                        type = PhoneMessageType.CameraPreview,
                        phoneId = _phoneId.value,
                        payload = base64,
                    ))
                } catch (e: Exception) {
                    Log.w(TAG, "Preview send failed: ${e.message}")
                }
            }
        }
    }

    private suspend fun sendInternal(msg: PhoneMessage) {
        sendMutex.withLock {
            withContext(Dispatchers.IO) {
                val out = socket?.getOutputStream() ?: return@withContext
                val frame = PhoneProtocol.frameForTcp(PhoneProtocol.serialize(msg))
                out.write(frame)
                out.flush()
            }
        }
    }

    private fun disconnect() {
        previewJob?.cancel()
        previewJob = null
        receiveJob?.cancel()
        receiveJob = null
        try { socket?.close() } catch (_: Exception) {}
        socket = null
    }

    // ── Network + multicast plumbing (mirrors OrchestratorDiscovery) ─────────────

    private fun registerNetworkWatcher() {
        if (networkCallback != null) return
        val cb = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                Log.d(TAG, "Network available — restarting discovery")
                startDiscovery()
            }
            override fun onLost(network: Network) {
                Log.d(TAG, "Network lost")
                _discovered.value = null
            }
        }
        try {
            cm.registerDefaultNetworkCallback(cb)
            networkCallback = cb
        } catch (e: Exception) {
            Log.w(TAG, "registerDefaultNetworkCallback failed: ${e.message}")
        }
    }

    private fun unregisterNetworkWatcher() {
        val cb = networkCallback ?: return
        try { cm.unregisterNetworkCallback(cb) } catch (_: Exception) {}
        networkCallback = null
    }

    private fun acquireMulticastLock() {
        if (multicastLock != null) return
        val wifi = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
        multicastLock = wifi.createMulticastLock("TGT:Peer").apply {
            setReferenceCounted(false)
            acquire()
        }
    }

    private fun releaseMulticastLock() {
        multicastLock?.takeIf { it.isHeld }?.release()
        multicastLock = null
    }
}

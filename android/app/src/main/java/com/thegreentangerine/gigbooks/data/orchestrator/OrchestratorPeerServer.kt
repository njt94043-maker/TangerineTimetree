package com.thegreentangerine.gigbooks.data.orchestrator

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
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.io.IOException
import java.net.ServerSocket
import java.net.Socket
import java.util.concurrent.atomic.AtomicInteger

/**
 * TCP server on the drummer's APK (orchestrator). Accepts peer Android phones
 * paired via mDNS (`_tgt-orchestrator._tcp.`) and fans out RECORD_START / RECORD_STOP
 * to the fleet. Reuses the existing PhoneProtocol wire format (4-byte length-prefix
 * framing, JSON envelope) so peers can use the same encoder/decoder paths.
 *
 * Bound to `0.0.0.0` so the same APK works whether the LAN is the S23 hotspot
 * (gig) or home WiFi (practice). Picks an ephemeral port and exposes it via
 * [boundPort] for the publisher to advertise.
 */
class OrchestratorPeerServer {

    companion object {
        private const val TAG = "OrchestratorServer"
    }

    /** Snapshot of one connected peer for UI display. */
    data class PeerInfo(
        val phoneId: String,
        val deviceName: String,
        val isRecording: Boolean,
        val lastPreviewJpeg: ByteArray?,
        val lastSeenMs: Long,
    )

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var serverSocket: ServerSocket? = null
    private var acceptJob: Job? = null

    private val nextPhoneId = AtomicInteger(1)
    private val peersMutex = Mutex()
    private val peers = mutableMapOf<String, ConnectedPeer>()

    private val _peerInfos = MutableStateFlow<List<PeerInfo>>(emptyList())
    val peerInfos: StateFlow<List<PeerInfo>> = _peerInfos

    private val _boundPort = MutableStateFlow(0)
    val boundPort: StateFlow<Int> = _boundPort

    /** Start listening. Returns the bound port (0 if start failed). */
    fun start(): Int {
        stop()
        return try {
            val sock = ServerSocket(0)  // ephemeral port
            serverSocket = sock
            _boundPort.value = sock.localPort
            Log.i(TAG, "Listening on 0.0.0.0:${sock.localPort}")
            acceptJob = scope.launch { acceptLoop(sock) }
            sock.localPort
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start: ${e.message}", e)
            0
        }
    }

    fun stop() {
        acceptJob?.cancel()
        acceptJob = null
        try { serverSocket?.close() } catch (_: Exception) {}
        serverSocket = null
        scope.launch {
            peersMutex.withLock {
                peers.values.forEach { it.close() }
                peers.clear()
            }
            republishPeers()
        }
    }

    /** Fan-out: tell every paired peer to start recording. */
    fun broadcastStartRec(sessionId: String) {
        val payload = PhoneProtocol.serializePayload(StartRecPayload(
            sessionId = sessionId,
            sessionName = "gig-set",
            timestamp = System.currentTimeMillis(),
        ))
        broadcast(PhoneMessageType.StartRec, payload)
        scope.launch {
            peersMutex.withLock { peers.values.forEach { it.markRecording(true) } }
            republishPeers()
        }
    }

    /** Fan-out: tell every paired peer to stop recording. */
    fun broadcastStopRec() {
        broadcast(PhoneMessageType.StopRec, null)
        scope.launch {
            peersMutex.withLock { peers.values.forEach { it.markRecording(false) } }
            republishPeers()
        }
    }

    private fun broadcast(type: PhoneMessageType, payload: String?) {
        scope.launch {
            val snapshot = peersMutex.withLock { peers.values.toList() }
            snapshot.forEach { peer ->
                try {
                    peer.send(PhoneProtocol.createMessage(type = type, payload = payload))
                } catch (e: Exception) {
                    Log.w(TAG, "broadcast to ${peer.phoneId} failed: ${e.message}")
                }
            }
        }
    }

    private suspend fun acceptLoop(sock: ServerSocket) {
        while (scope.isActive) {
            val client = try {
                sock.accept()
            } catch (_: IOException) {
                break  // socket closed
            } catch (e: Exception) {
                Log.w(TAG, "accept threw: ${e.message}")
                break
            }
            client.tcpNoDelay = true
            client.soTimeout = 0
            scope.launch { handlePeer(client) }
        }
    }

    private suspend fun handlePeer(socket: Socket) {
        val phoneId = "peer-${nextPhoneId.getAndIncrement()}"
        Log.i(TAG, "Peer connected from ${socket.inetAddress.hostAddress}, assigning $phoneId")
        val peer = ConnectedPeer(phoneId, socket)
        try {
            peersMutex.withLock { peers[phoneId] = peer }
            republishPeers()
            // Read frames until disconnect
            val input = socket.getInputStream()
            while (scope.isActive) {
                val frame = withContext(Dispatchers.IO) {
                    PhoneProtocol.readTcpFrame(input)
                } ?: break
                val msg = PhoneProtocol.deserialize(frame) ?: continue
                handlePeerMessage(peer, msg)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Peer $phoneId loop ended: ${e.message}")
        } finally {
            try { socket.close() } catch (_: Exception) {}
            peersMutex.withLock { peers.remove(phoneId) }
            republishPeers()
            Log.i(TAG, "Peer $phoneId disconnected")
        }
    }

    private suspend fun handlePeerMessage(peer: ConnectedPeer, msg: PhoneMessage) {
        peer.touch()
        when (msg.type) {
            PhoneMessageType.Pair -> {
                val pairPayload = PhoneProtocol.deserializePayload<PairPayload>(msg.payload)
                peer.deviceName = pairPayload?.let { "${it.deviceModel} (${it.name})" } ?: "Unknown"
                peer.send(PhoneProtocol.createMessage(
                    type = PhoneMessageType.PairAck,
                    phoneId = peer.phoneId,
                ))
                republishPeers()
                Log.i(TAG, "Paired ${peer.phoneId} as ${peer.deviceName}")
            }
            PhoneMessageType.Heartbeat -> {
                peer.send(PhoneProtocol.createMessage(
                    type = PhoneMessageType.HeartbeatAck,
                    phoneId = peer.phoneId,
                ))
            }
            PhoneMessageType.CameraPreview -> {
                val jpegBase64 = msg.payload ?: return
                val jpeg = try { Base64.decode(jpegBase64, Base64.NO_WRAP) }
                catch (_: Exception) { return }
                peer.lastPreviewJpeg = jpeg
                republishPeers()
            }
            PhoneMessageType.RecStarted -> {
                peer.markRecording(true)
                republishPeers()
            }
            PhoneMessageType.RecStopped -> {
                peer.markRecording(false)
                republishPeers()
            }
            else -> {
                // Status / SyncTimeResponse / etc — ignored for now; surface in future iterations.
            }
        }
    }

    private suspend fun republishPeers() {
        val snapshot = peersMutex.withLock {
            peers.values.map { p ->
                PeerInfo(
                    phoneId = p.phoneId,
                    deviceName = p.deviceName,
                    isRecording = p.isRecording,
                    lastPreviewJpeg = p.lastPreviewJpeg,
                    lastSeenMs = p.lastSeenMs,
                )
            }
        }
        _peerInfos.value = snapshot
    }

    fun shutdown() {
        stop()
        scope.cancel()
    }

    private class ConnectedPeer(val phoneId: String, val socket: Socket) {
        var deviceName: String = "Unpaired"
        @Volatile var lastPreviewJpeg: ByteArray? = null
        @Volatile var isRecording: Boolean = false
        @Volatile var lastSeenMs: Long = System.currentTimeMillis()
        private val sendMutex = Mutex()

        suspend fun send(msg: PhoneMessage) {
            sendMutex.withLock {
                withContext(Dispatchers.IO) {
                    val out = socket.getOutputStream()
                    val frame = PhoneProtocol.frameForTcp(PhoneProtocol.serialize(msg))
                    out.write(frame)
                    out.flush()
                }
            }
        }

        fun touch() { lastSeenMs = System.currentTimeMillis() }
        fun markRecording(rec: Boolean) { isRecording = rec }
        fun close() { try { socket.close() } catch (_: Exception) {} }
    }
}

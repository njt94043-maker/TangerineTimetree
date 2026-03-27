package com.thegreentangerine.gigbooks.data.xr18

import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.io.InputStream
import java.io.OutputStream
import java.net.InetSocketAddress
import java.net.Socket

/**
 * TCP client for XR18Studio Phone Director.
 * Uses 4-byte big-endian length-prefix framing per PhoneProtocol.
 */
class TcpPhoneClient {

    private var socket: Socket? = null
    private var input: InputStream? = null
    private var output: OutputStream? = null
    private var receiveJob: Job? = null
    private val sendMutex = Mutex()

    private val _isConnected = MutableStateFlow(false)
    val isConnected: StateFlow<Boolean> = _isConnected

    private val _messages = MutableSharedFlow<PhoneMessage>(extraBufferCapacity = 64)
    val messages: SharedFlow<PhoneMessage> = _messages

    private val _disconnected = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val disconnected: SharedFlow<Unit> = _disconnected

    suspend fun connect(host: String, port: Int, timeoutMs: Int = 5000) {
        withContext(Dispatchers.IO) {
            disconnect()
            val sock = Socket()
            sock.connect(InetSocketAddress(host, port), timeoutMs)
            sock.soTimeout = 0 // blocking reads in receive loop
            sock.tcpNoDelay = true
            socket = sock
            input = sock.getInputStream()
            output = sock.getOutputStream()
            _isConnected.value = true
            receiveJob = CoroutineScope(Dispatchers.IO).launch { receiveLoop() }
        }
    }

    suspend fun send(message: PhoneMessage) {
        sendMutex.withLock {
            withContext(Dispatchers.IO) {
                val out = output ?: return@withContext
                val jsonBytes = PhoneProtocol.serialize(message)
                val frame = PhoneProtocol.frameForTcp(jsonBytes)
                out.write(frame)
                out.flush()
            }
        }
    }

    fun disconnect() {
        receiveJob?.cancel()
        receiveJob = null
        try { socket?.close() } catch (_: Exception) {}
        socket = null
        input = null
        output = null
        _isConnected.value = false
    }

    private suspend fun receiveLoop() {
        try {
            val inp = input ?: return
            while (currentCoroutineContext().isActive) {
                val frameBytes = PhoneProtocol.readTcpFrame(inp) ?: break
                val msg = PhoneProtocol.deserialize(frameBytes) ?: continue
                _messages.emit(msg)
            }
        } catch (_: Exception) {
            // Socket closed or error
        } finally {
            _isConnected.value = false
            _disconnected.tryEmit(Unit)
        }
    }
}

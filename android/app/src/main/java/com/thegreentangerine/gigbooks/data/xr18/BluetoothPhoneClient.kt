package com.thegreentangerine.gigbooks.data.xr18

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.util.Log
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.io.InputStream
import java.io.OutputStream
import java.util.UUID

/**
 * Bluetooth classic (RFCOMM/SPP) client for XR18Studio Phone Director.
 * Mirrors TcpPhoneClient's API but connects via Bluetooth SPP.
 * Uses the same 4-byte big-endian length-prefix framing as TCP.
 */
class BluetoothPhoneClient(private val context: Context) {

    companion object {
        private const val TAG = "BtPhoneClient"
        /** Must match BluetoothPhoneServer.ServiceUuid on the C# server. */
        val SERVICE_UUID: UUID = UUID.fromString("a1b2c3d4-e5f6-7890-abcd-ef1234567890")
    }

    private var socket: BluetoothSocket? = null
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

    /**
     * Connect to the XR18 Studio server via Bluetooth SPP.
     * Finds the device by name from paired devices, then connects via RFCOMM.
     */
    @SuppressLint("MissingPermission")
    suspend fun connect(deviceName: String, timeoutMs: Long = 10000) {
        withContext(Dispatchers.IO) {
            disconnect()

            val btManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
            val adapter = btManager?.adapter
                ?: throw IllegalStateException("Bluetooth not available")

            if (!adapter.isEnabled) {
                throw IllegalStateException("Bluetooth is disabled")
            }

            // Find the target device in paired devices
            val device = findDevice(adapter, deviceName)
                ?: throw IllegalStateException("Device '$deviceName' not found in paired devices")

            Log.d(TAG, "Connecting to BT device: ${device.name} (${device.address})")

            // Cancel discovery to speed up connection
            try { adapter.cancelDiscovery() } catch (_: Exception) {}

            // Connect via RFCOMM with the custom UUID
            val sock = device.createRfcommSocketToServiceRecord(SERVICE_UUID)

            // Use withTimeout for the blocking connect call
            withTimeout(timeoutMs) {
                sock.connect()
            }

            socket = sock
            input = sock.inputStream
            output = sock.outputStream
            _isConnected.value = true

            Log.d(TAG, "BT connected to ${device.name}")
            receiveJob = CoroutineScope(Dispatchers.IO).launch { receiveLoop() }
        }
    }

    /**
     * Send a message over Bluetooth using the same framing as TCP.
     */
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
        if (_isConnected.value) {
            _isConnected.value = false
            Log.d(TAG, "BT disconnected")
        }
    }

    @SuppressLint("MissingPermission")
    private fun findDevice(adapter: BluetoothAdapter, deviceName: String): BluetoothDevice? {
        return try {
            adapter.bondedDevices?.firstOrNull { it.name == deviceName }
        } catch (_: SecurityException) {
            null
        }
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

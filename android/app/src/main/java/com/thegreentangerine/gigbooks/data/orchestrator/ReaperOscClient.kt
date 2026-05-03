package com.thegreentangerine.gigbooks.data.orchestrator

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.withContext
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress

/**
 * Minimal OSC-over-UDP sender for the E6330 Reaper appliance.
 *
 * Reaper listens on UDP 8000 by Default.ReaperOSC. `/record` toggles transport
 * record-arm; `/stop` stops the transport. `/song_marker s "title"` is a custom
 * pattern routed to a ReaScript (added in feature B).
 */
class ReaperOscClient {

    data class Target(val host: String, val port: Int)

    private val _target = MutableStateFlow(Target("e6330.local", 8000))
    val target: StateFlow<Target> = _target

    private val _lastSendOk = MutableStateFlow<Boolean?>(null)
    val lastSendOk: StateFlow<Boolean?> = _lastSendOk

    fun setTarget(host: String, port: Int) {
        _target.value = Target(host.trim(), port)
    }

    suspend fun sendRecord() = sendMessage("/record")
    suspend fun sendStop() = sendMessage("/stop")
    suspend fun sendSongMarker(title: String) = sendMessage("/song_marker", title)

    private suspend fun sendMessage(address: String, vararg stringArgs: String) {
        val packet = encode(address, stringArgs.toList())
        val tgt = _target.value
        val ok = withContext(Dispatchers.IO) {
            try {
                DatagramSocket().use { sock ->
                    val pkt = DatagramPacket(packet, packet.size, InetAddress.getByName(tgt.host), tgt.port)
                    sock.send(pkt)
                }
                true
            } catch (_: Exception) { false }
        }
        _lastSendOk.value = ok
    }

    /** OSC 1.0 encoding: address + null-terminated, padded to 4-byte boundary; type tag ',sss…' likewise; each string arg likewise. */
    private fun encode(address: String, stringArgs: List<String>): ByteArray {
        val addr = padTo4(address.toByteArray(Charsets.US_ASCII) + 0)
        val tag = padTo4(("," + "s".repeat(stringArgs.size)).toByteArray(Charsets.US_ASCII) + 0)
        val args = stringArgs.fold(ByteArray(0)) { acc, s ->
            acc + padTo4(s.toByteArray(Charsets.US_ASCII) + 0)
        }
        return addr + tag + args
    }

    private fun padTo4(bytes: ByteArray): ByteArray {
        val rem = bytes.size % 4
        return if (rem == 0) bytes else bytes + ByteArray(4 - rem)
    }
}

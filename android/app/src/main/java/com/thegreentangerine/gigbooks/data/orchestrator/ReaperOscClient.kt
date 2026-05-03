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
 * Reaper listens on UDP 8000 with Default.ReaperOSC. `/action/<id>` triggers
 * the Reaper action with that command ID. `sendRecord()` sends an OSC bundle
 * of two messages (cursor-to-end + record) so Reaper processes them atomically
 * on a single tick — required for per-set gig recording (S119 lock) so set 2
 * doesn't overwrite set 1. `/stop` is a built-in OSC path. `/song_marker` is
 * custom (feature B).
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

    suspend fun sendRecord() = sendBundle(
        encodeMessage("/action", intArg = 40043),  // View: Move edit cursor to end of project
        encodeMessage("/action", intArg = 1013),   // Transport: Record
    )
    suspend fun sendStop() = sendPacket(encodeMessage("/stop"))
    suspend fun sendSongMarker(title: String) = sendPacket(encodeMessage("/song_marker", stringArg = title))

    private suspend fun sendBundle(vararg messages: ByteArray) = sendPacket(encodeBundle(messages.toList()))

    private suspend fun sendPacket(packet: ByteArray) {
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

    /** OSC 1.0 message: address + null-terminated, padded to 4-byte boundary; type tag ',si…' likewise; each arg likewise. */
    private fun encodeMessage(address: String, intArg: Int? = null, stringArg: String? = null): ByteArray {
        val tagChars = StringBuilder(",")
        val argsBytes = mutableListOf<ByteArray>()
        if (intArg != null) {
            tagChars.append('i')
            argsBytes += ByteArray(4).also {
                it[0] = (intArg ushr 24).toByte(); it[1] = (intArg ushr 16).toByte()
                it[2] = (intArg ushr 8).toByte();  it[3] = intArg.toByte()
            }
        }
        if (stringArg != null) {
            tagChars.append('s')
            argsBytes += padTo4(stringArg.toByteArray(Charsets.US_ASCII) + 0)
        }
        val addr = padTo4(address.toByteArray(Charsets.US_ASCII) + 0)
        val tag = padTo4(tagChars.toString().toByteArray(Charsets.US_ASCII) + 0)
        return addr + tag + argsBytes.fold(ByteArray(0)) { acc, b -> acc + b }
    }

    /** OSC 1.0 bundle: "#bundle\0" + 8-byte timetag (1 = "immediate") + (size+msg) per element. */
    private fun encodeBundle(messages: List<ByteArray>): ByteArray {
        val header = "#bundle".toByteArray(Charsets.US_ASCII) + 0  // 8 bytes
        val timetag = ByteArray(8).also { it[7] = 1 }              // OSC immediate
        val body = messages.fold(ByteArray(0)) { acc, m ->
            val size = m.size
            val sizeBytes = byteArrayOf(
                (size ushr 24).toByte(), (size ushr 16).toByte(),
                (size ushr 8).toByte(),  size.toByte()
            )
            acc + sizeBytes + m
        }
        return header + timetag + body
    }

    private fun padTo4(bytes: ByteArray): ByteArray {
        val rem = bytes.size % 4
        return if (rem == 0) bytes else bytes + ByteArray(4 - rem)
    }
}

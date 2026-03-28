package com.thegreentangerine.gigbooks.data.xr18

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.InputStream
import java.io.OutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder

// ── Message types (camelCase wire names matching XR18Studio server) ──

@Serializable
enum class PhoneMessageType {
    @SerialName("pair") Pair,
    @SerialName("pairAck") PairAck,
    @SerialName("pairReject") PairReject,
    @SerialName("status") Status,
    @SerialName("heartbeat") Heartbeat,
    @SerialName("heartbeatAck") HeartbeatAck,
    @SerialName("startRec") StartRec,
    @SerialName("stopRec") StopRec,
    @SerialName("settingsPush") SettingsPush,
    @SerialName("recStarted") RecStarted,
    @SerialName("recStopped") RecStopped,
    @SerialName("settingsAck") SettingsAck,
    @SerialName("syncTimeRequest") SyncTimeRequest,
    @SerialName("syncTimeResponse") SyncTimeResponse,
    @SerialName("cameraPreview") CameraPreview,
    @SerialName("previewRequest") PreviewRequest,
    @SerialName("previewStart") PreviewStart,
    @SerialName("previewStop") PreviewStop,
}

// ── Message envelope ──

@Serializable
data class PhoneMessage(
    val type: PhoneMessageType,
    val phoneId: String? = null,
    val timestampMs: Long = System.currentTimeMillis(),
    val payload: String? = null,
    val secret: String? = null,
)

// ── Payload types ──

@Serializable
data class PairPayload(
    val deviceModel: String,
    val platform: String = "Android",
    val name: String = "Camera",
)

@Serializable
data class StatusPayload(
    val battery: Int = 0,
    val storageFree: Long = 0,
    val resolution: String = "1080p",
    val framerate: Int = 30,
    val sampleRate: String = "48000",
    val isRecording: Boolean = false,
)

@Serializable
data class SyncTimePayload(
    val t1: Long = 0,
    val t2: Long = 0,
    val t3: Long = 0,
)

@Serializable
data class PhoneSettings(
    val resolution: String = "1080p",
    val framerate: Int = 30,
    val exposure: String = "Auto",
    val stabilisation: String = "Off",
    val cameraFacing: String = "back",  // "back" or "front"
)

@Serializable
data class StartRecPayload(
    val sessionName: String = "",
    val timestamp: Long = 0,
)

// ── QR pairing URI ──

data class PairingInfo(
    val ips: List<String>,
    val tcpPort: Int,
    val wsPort: Int,
    val secret: String,
    val btName: String? = null,
) {
    /** First IP (primary). */
    val ip: String get() = ips.first()
    /** Whether Bluetooth pairing is available. */
    val hasBluetooth: Boolean get() = !btName.isNullOrBlank()
    /** Relay channel name for Supabase Broadcast. */
    val relayChannelName: String get() = "xr18-relay:$secret"
}

// ── JSON codec ──

val PhoneJson = Json {
    ignoreUnknownKeys = true
    encodeDefaults = true
}

object PhoneProtocol {
    const val MAX_MESSAGE_SIZE = 1024 * 1024  // 1MB
    const val TCP_HEADER_SIZE = 4

    fun serialize(message: PhoneMessage): ByteArray =
        PhoneJson.encodeToString(PhoneMessage.serializer(), message).toByteArray(Charsets.UTF_8)

    fun deserialize(data: ByteArray): PhoneMessage? = try {
        PhoneJson.decodeFromString(PhoneMessage.serializer(), data.toString(Charsets.UTF_8))
    } catch (_: Exception) { null }

    fun deserialize(json: String): PhoneMessage? = try {
        PhoneJson.decodeFromString(PhoneMessage.serializer(), json)
    } catch (_: Exception) { null }

    inline fun <reified T> serializePayload(obj: T): String =
        PhoneJson.encodeToString(kotlinx.serialization.serializer<T>(), obj)

    inline fun <reified T> deserializePayload(json: String?): T? {
        if (json.isNullOrEmpty()) return null
        return try { PhoneJson.decodeFromString(kotlinx.serialization.serializer<T>(), json) }
        catch (_: Exception) { null }
    }

    fun createMessage(
        type: PhoneMessageType,
        phoneId: String? = null,
        payload: String? = null,
        secret: String? = null,
    ) = PhoneMessage(type = type, phoneId = phoneId, payload = payload, secret = secret)

    /** Wraps JSON bytes with 4-byte big-endian length prefix for TCP framing. */
    fun frameForTcp(jsonBytes: ByteArray): ByteArray {
        val frame = ByteArray(TCP_HEADER_SIZE + jsonBytes.size)
        ByteBuffer.wrap(frame, 0, 4).order(ByteOrder.BIG_ENDIAN).putInt(jsonBytes.size)
        jsonBytes.copyInto(frame, TCP_HEADER_SIZE)
        return frame
    }

    /** Reads one length-prefixed frame from a TCP stream. Returns null on disconnect. */
    fun readTcpFrame(input: InputStream): ByteArray? {
        val header = ByteArray(TCP_HEADER_SIZE)
        if (!readExact(input, header, TCP_HEADER_SIZE)) return null
        val length = ByteBuffer.wrap(header).order(ByteOrder.BIG_ENDIAN).int
        if (length <= 0 || length > MAX_MESSAGE_SIZE) return null
        val body = ByteArray(length)
        return if (readExact(input, body, length)) body else null
    }

    /** Parses QR code URI: xr18studio://<ip1,ip2,...>:<tcpPort>/<wsPort>/<secret>[/<btName>] */
    fun parsePairingUri(uri: String): PairingInfo? {
        val prefix = "xr18studio://"
        if (!uri.startsWith(prefix)) return null
        val rest = uri.removePrefix(prefix)
        val parts = rest.split("/")
        if (parts.size < 3) return null
        val hostPort = parts[0].split(":")
        if (hostPort.size != 2) return null
        val ips = hostPort[0].split(",").filter { it.isNotBlank() }
        if (ips.isEmpty()) return null
        return try {
            val btName = if (parts.size >= 4 && parts[3].isNotBlank()) {
                java.net.URLDecoder.decode(parts[3], "UTF-8")
            } else null
            PairingInfo(
                ips = ips,
                tcpPort = hostPort[1].toInt(),
                wsPort = parts[1].toInt(),
                secret = parts[2],
                btName = btName,
            )
        } catch (_: NumberFormatException) { null }
    }

    private fun readExact(input: InputStream, buffer: ByteArray, count: Int): Boolean {
        var offset = 0
        while (offset < count) {
            val n = input.read(buffer, offset, count - offset)
            if (n <= 0) return false
            offset += n
        }
        return true
    }
}

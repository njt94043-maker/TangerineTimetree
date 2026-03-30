package com.thegreentangerine.gigbooks.data.xr18

import android.util.Log
import com.thegreentangerine.gigbooks.data.supabase.SupabaseProvider
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.serialization.json.*

/**
 * Supabase Broadcast relay client for XR18Studio Phone Director.
 * Connects to Supabase Realtime WebSocket, joins a broadcast channel
 * keyed by the pairing secret, and sends/receives PhoneMessages.
 *
 * Uses the same Phoenix WebSocket protocol as the C# SupabaseBroadcastServer:
 * - Join channel "xr18-relay:{secret}" with broadcast config
 * - Send messages as broadcast events with type "phone_msg"
 * - Receive broadcasts and extract PhoneMessages from payload
 *
 * This client uses raw WebSocket (OkHttp) to match the C# server's Phoenix protocol
 * exactly, rather than the Supabase Kotlin SDK's Realtime module (which uses a
 * different API surface).
 */
class SupabaseBroadcastClient {

    companion object {
        private const val TAG = "SupabaseRelay"
        private const val CHANNEL_PREFIX = "xr18-relay"
        private const val HEARTBEAT_INTERVAL_MS = 30_000L
    }

    private var ws: okhttp3.WebSocket? = null
    private var scope: CoroutineScope? = null
    private var heartbeatJob: Job? = null
    private var refCounter = 0
    private var channelTopic = ""

    @Volatile
    private var joined = false

    private val _isConnected = MutableStateFlow(false)
    val isConnected: StateFlow<Boolean> = _isConnected

    private val _messages = MutableSharedFlow<PhoneMessage>(extraBufferCapacity = 64)
    val messages: SharedFlow<PhoneMessage> = _messages

    private val _disconnected = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val disconnected: SharedFlow<Unit> = _disconnected

    private fun nextRef(): String = (++refCounter).toString()

    /**
     * Connect to Supabase Realtime and join the relay channel for the given secret.
     */
    suspend fun connect(secret: String) {
        disconnect()

        channelTopic = "$CHANNEL_PREFIX:$secret"
        scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

        val url = "wss://jlufqgslgjowfaqmqlds.supabase.co/realtime/v1/websocket" +
            "?apikey=[REDACTED -- sb_publishable key]&vsn=1.0.0"

        val client = okhttp3.OkHttpClient.Builder()
            .pingInterval(java.time.Duration.ofSeconds(30))
            .build()

        val request = okhttp3.Request.Builder().url(url).build()

        val listener = object : okhttp3.WebSocketListener() {
            override fun onOpen(webSocket: okhttp3.WebSocket, response: okhttp3.Response) {
                Log.d(TAG, "WebSocket connected, joining channel: $channelTopic")
                _isConnected.value = true

                // Send Phoenix join
                val joinMsg = buildJsonObject {
                    put("topic", channelTopic)
                    put("event", "phx_join")
                    put("payload", buildJsonObject {
                        put("config", buildJsonObject {
                            put("broadcast", buildJsonObject {
                                put("self", JsonPrimitive(false))
                            })
                        })
                    })
                    put("ref", nextRef())
                }
                webSocket.send(joinMsg.toString())

                // Start heartbeat
                heartbeatJob = scope?.launch {
                    while (isActive) {
                        delay(HEARTBEAT_INTERVAL_MS)
                        val hb = buildJsonObject {
                            put("topic", "phoenix")
                            put("event", "heartbeat")
                            put("payload", buildJsonObject {})
                            put("ref", nextRef())
                        }
                        webSocket.send(hb.toString())
                    }
                }
            }

            override fun onMessage(webSocket: okhttp3.WebSocket, text: String) {
                handleFrame(text)
            }

            override fun onFailure(webSocket: okhttp3.WebSocket, t: Throwable, response: okhttp3.Response?) {
                Log.w(TAG, "WebSocket failure: ${t.message}")
                handleDisconnect()
            }

            override fun onClosed(webSocket: okhttp3.WebSocket, code: Int, reason: String) {
                Log.d(TAG, "WebSocket closed: $code $reason")
                handleDisconnect()
            }
        }

        ws = client.newWebSocket(request, listener)
    }

    /**
     * Send a PhoneMessage as a broadcast on the relay channel.
     */
    fun send(message: PhoneMessage) {
        val w = ws ?: return
        if (!_isConnected.value) return

        val innerJson = PhoneJson.encodeToString(PhoneMessage.serializer(), message)
        val broadcast = buildJsonObject {
            put("topic", channelTopic)
            put("event", "broadcast")
            put("payload", buildJsonObject {
                put("type", "broadcast")
                put("event", "phone_msg")
                put("payload", Json.parseToJsonElement(innerJson))
            })
            put("ref", nextRef())
        }
        w.send(broadcast.toString())
    }

    fun disconnect() {
        heartbeatJob?.cancel()
        heartbeatJob = null
        joined = false

        ws?.let { w ->
            try {
                // Send Phoenix leave
                val leave = buildJsonObject {
                    put("topic", channelTopic)
                    put("event", "phx_leave")
                    put("payload", buildJsonObject {})
                    put("ref", nextRef())
                }
                w.send(leave.toString())
                w.close(1000, "Client disconnect")
            } catch (_: Exception) {}
        }
        ws = null

        if (_isConnected.value) {
            _isConnected.value = false
            Log.d(TAG, "Relay disconnected")
        }

        scope?.cancel()
        scope = null
    }

    private fun handleFrame(json: String) {
        try {
            val frame = Json.parseToJsonElement(json).jsonObject
            val event = frame["event"]?.jsonPrimitive?.contentOrNull ?: return

            when (event) {
                "phx_reply" -> {
                    val status = frame["payload"]?.jsonObject?.get("status")?.jsonPrimitive?.contentOrNull
                    val topic = frame["topic"]?.jsonPrimitive?.contentOrNull
                    if (topic == channelTopic && status == "ok" && !joined) {
                        joined = true
                        Log.d(TAG, "Joined relay channel: $channelTopic")
                    }
                }

                "broadcast" -> {
                    val payload = frame["payload"]?.jsonObject ?: return
                    val broadcastEvent = payload["event"]?.jsonPrimitive?.contentOrNull
                    if (broadcastEvent != "phone_msg") return

                    val innerPayload = payload["payload"] ?: return
                    val msg = PhoneProtocol.deserialize(innerPayload.toString())
                    if (msg != null) {
                        _messages.tryEmit(msg)
                    }
                }

                "phx_error" -> {
                    Log.e(TAG, "Channel error: $json")
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Frame parse error: ${e.message}")
        }
    }

    private fun handleDisconnect() {
        if (!_isConnected.value) return
        _isConnected.value = false
        joined = false
        heartbeatJob?.cancel()
        _disconnected.tryEmit(Unit)
    }
}

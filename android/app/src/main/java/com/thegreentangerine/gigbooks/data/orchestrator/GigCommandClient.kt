package com.thegreentangerine.gigbooks.data.orchestrator

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.withContext
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.URL

/**
 * HTTP client for the E6330 gig-command-server.py daemon (S129 row 6).
 *
 * Why HTTP not OSC: Reaper's OSC bindings are wired to numeric Reaper actions,
 * not arbitrary Lua scripts that take string args (like a project name). The
 * S128 file-poll listener pattern is what handles project-level state changes;
 * this client is just the network leg that gets a JSON command from the APK
 * onto the E6330's filesystem so the gig-command-listener.lua picks it up.
 *
 * Target: e6330.local:8666 by default. Auto-discovery hook is identical to
 * [ReaperOscClient] — when the orchestrator's mDNS discovery resolves the
 * Reaper-host, that host is reused here on port 8666.
 *
 * **v1.2.6: network-binding fix.** When the APK is hosting a hotspot, the
 * default Android network is cellular — `URL.openConnection()` routes via
 * cellular and a 10.119.x.x destination becomes unreachable. UDP/OSC works
 * because the kernel picks an interface by destination, but TCP/HTTP needs
 * an explicit `Network.openConnection(url)` against the hotspot network.
 * We try every non-cellular network with IPv4 + INTERNET capability in turn,
 * accepting the first 2xx response.
 *
 * Fire-and-forget: APK does not wait for Reaper to actually rename / save.
 * lastSendOk surfaces transport success only.
 */
class GigCommandClient(private val context: Context) {

    companion object {
        private const val TAG = "GigCommandClient"
    }

    data class Target(val host: String, val port: Int)

    private val _target = MutableStateFlow(Target("e6330.local", 8666))
    val target: StateFlow<Target> = _target

    private val _lastSendOk = MutableStateFlow<Boolean?>(null)
    val lastSendOk: StateFlow<Boolean?> = _lastSendOk

    private val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    fun setTarget(host: String, port: Int = 8666) {
        _target.value = Target(host.trim(), port)
    }

    suspend fun start(projectName: String) = postJson(
        path = "/gig",
        body = """{"action":"start","project_name":${jsonString(projectName)}}""",
    )

    suspend fun save() = postJson(
        path = "/gig",
        body = """{"action":"save","project_name":""}""",
    )

    suspend fun stop() = postJson(
        path = "/gig",
        body = """{"action":"stop","project_name":""}""",
    )

    /**
     * S129: replaces the dual OSC `/action/40157` + `/song_marker` bundle.
     * The named marker is dropped by the Reaper-side song-marker-listener.lua
     * when this file lands in /tmp/song-markers/.
     */
    suspend fun sendSongMarker(title: String) = postJson(
        path = "/song-marker",
        body = """{"title":${jsonString(title)}}""",
    )

    private suspend fun postJson(path: String, body: String) {
        val tgt = _target.value
        val url = URL("http://${tgt.host}:${tgt.port}$path")

        val ok = withContext(Dispatchers.IO) {
            // Try the default network first (the home-WiFi happy path), then
            // fall back to every non-cellular candidate. Hotspot-host mode
            // keeps cellular as the default — direct IPs in the hotspot subnet
            // are unreachable that way, so we have to bind to the hotspot
            // network's Network instance.
            val candidates = collectCandidateNetworks()
            for (network in candidates) {
                if (tryPost(network, url, body)) return@withContext true
            }
            // Last resort: try without binding (some configurations route
            // correctly even when our network-pick logic doesn't find anything).
            tryPost(network = null, url = url, body = body)
        }
        _lastSendOk.value = ok
    }

    /** Default network first, then every other non-cellular network with IPv4 INTERNET. */
    private fun collectCandidateNetworks(): List<Network> {
        val result = mutableListOf<Network>()
        cm.activeNetwork?.let { result.add(it) }
        for (n in cm.allNetworks) {
            if (n in result) continue
            val caps = cm.getNetworkCapabilities(n) ?: continue
            // Skip pure-cellular nets (they can't reach private LAN IPs).
            if (caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) continue
            // Need IP-level connectivity (WiFi, ethernet, hotspot loopback).
            if (!caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                !caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_TRUSTED)) {
                continue
            }
            result.add(n)
        }
        return result
    }

    private fun tryPost(network: Network?, url: URL, body: String): Boolean = try {
        val conn = (network?.openConnection(url) ?: url.openConnection()) as HttpURLConnection
        conn.requestMethod = "POST"
        conn.connectTimeout = 1500
        conn.readTimeout = 1500
        conn.doOutput = true
        conn.setRequestProperty("Content-Type", "application/json")
        conn.outputStream.use { out: OutputStream ->
            out.write(body.toByteArray(Charsets.UTF_8))
        }
        val code = conn.responseCode
        conn.disconnect()
        if (code in 200..299) {
            true
        } else {
            Log.w(TAG, "POST $url via ${network ?: "default"} -> HTTP $code")
            false
        }
    } catch (e: Exception) {
        Log.w(TAG, "POST $url via ${network ?: "default"} failed: ${e.message}")
        false
    }

    /** Minimal JSON string escaper — only the characters that break a JSON literal. */
    private fun jsonString(s: String): String {
        val sb = StringBuilder("\"")
        for (c in s) {
            when (c) {
                '"' -> sb.append("\\\"")
                '\\' -> sb.append("\\\\")
                '\n' -> sb.append("\\n")
                '\r' -> sb.append("\\r")
                '\t' -> sb.append("\\t")
                else -> if (c.code < 0x20) sb.append("\\u%04x".format(c.code)) else sb.append(c)
            }
        }
        sb.append('"')
        return sb.toString()
    }
}

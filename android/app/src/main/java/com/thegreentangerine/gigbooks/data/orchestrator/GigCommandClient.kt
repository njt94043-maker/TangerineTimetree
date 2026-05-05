package com.thegreentangerine.gigbooks.data.orchestrator

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
 * Fire-and-forget: APK does not wait for Reaper to actually rename / save.
 * lastSendOk surfaces transport success only.
 */
class GigCommandClient {

    data class Target(val host: String, val port: Int)

    private val _target = MutableStateFlow(Target("e6330.local", 8666))
    val target: StateFlow<Target> = _target

    private val _lastSendOk = MutableStateFlow<Boolean?>(null)
    val lastSendOk: StateFlow<Boolean?> = _lastSendOk

    fun setTarget(host: String, port: Int = 8666) {
        _target.value = Target(host.trim(), port)
    }

    suspend fun start(projectName: String) = post(
        action = "start",
        projectName = projectName,
    )

    suspend fun save() = post(action = "save", projectName = "")

    suspend fun stop() = post(action = "stop", projectName = "")

    private suspend fun post(action: String, projectName: String) {
        val tgt = _target.value
        val ok = withContext(Dispatchers.IO) {
            try {
                val url = URL("http://${tgt.host}:${tgt.port}/gig")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.connectTimeout = 1500
                conn.readTimeout = 1500
                conn.doOutput = true
                conn.setRequestProperty("Content-Type", "application/json")
                val body = """{"action":"$action","project_name":${jsonString(projectName)}}"""
                conn.outputStream.use { out: OutputStream ->
                    out.write(body.toByteArray(Charsets.UTF_8))
                }
                val code = conn.responseCode
                conn.disconnect()
                code in 200..299
            } catch (_: Exception) {
                false
            }
        }
        _lastSendOk.value = ok
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

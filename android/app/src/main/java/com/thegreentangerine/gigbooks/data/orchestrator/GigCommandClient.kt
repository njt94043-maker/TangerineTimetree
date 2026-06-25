package com.thegreentangerine.gigbooks.data.orchestrator

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.util.Log
import com.thegreentangerine.gigbooks.BuildConfig
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.NetworkInterface
import java.net.Socket
import java.net.URL
import org.json.JSONArray
import org.json.JSONObject

/** One row of the take-mode browser (4c-1 `GET /take/songs`). `bpm` null = no detected tempo.
 *  `beatmapVerified` = sidecar schemaVersion >= 2 → drives the ✓/⚠ badge. */
data class TakeSong(
    val trackId: String,
    val title: String,
    val artist: String,
    val bpm: Double?,
    val beatmapVerified: Boolean,
)

/** S216 slice2: one clone-forward take read back from the rig (`/take/status` `takes[]`).
 *  `index` is 1-based in timeline order; `startSec`/`endSec` are its position + end. The take
 *  strip renders one pill per entry; tapping seeks to `startSec` and plays. S220 ②·3b adds `label`
 *  — the take's free-text descriptive label ("" = none; shown as a small caption under `T{index}`). */
data class TakeTakeInfo(
    val index: Int,
    val startSec: Double,
    val endSec: Double,
    val label: String,
)

/** S221 ②·4a: one instrument LAYER of a cover (`/take/status` `layers[]`). `id` is the registry id
 *  ("drums"/"vocals"/…); `kind` the instrument kind (drums|vocals|guitar|bass|keys|other); `armed` =
 *  a Record lays a take on this layer. Takes stay GLOBAL — a layer is just *which instruments are in
 *  the take* — so there's no per-layer take count here. */
data class TakeLayerInfo(
    val id: String,
    val name: String,
    val kind: String,
    val armed: Boolean,
)

/** S214 Reaper-mirror status (`GET /take/status`) — what the rig is doing, polled 1 s by the
 *  take surface. The MS forces a stopped/idle/null readout + `stale = true` when its sidecar is
 *  missing or > 3 s old, so the APK greys out cleanly instead of showing a frozen fake state.
 *  Numerics are nullable for exactly that reason. `ssdFreeLabel` is the recording-drive headroom
 *  (independent of the sidecar — present even when stale). S216 slice2 adds the rig-driven take
 *  readback: `takeCount` / `activeTake` / `takes` (the source of truth that replaces the old
 *  local counter; default 0 / 0 / empty so a pre-deploy MS can't crash the parse). S217 adds
 *  `takeCap` — the rig's per-cover take ceiling (0 = no cap info; a pre-deploy MS / stale rig omits
 *  it, so the surface won't disable Record off a missing cap). S219 ②·3a adds `masterTake` — the
 *  1-based index of the ★ kept take (0 = none; a pre-deploy MS / stale rig omits it, so no ★). */
data class TakeStatus(
    val stale: Boolean,
    val playState: String,
    val recording: Boolean,
    val playing: Boolean,
    val positionSec: Double?,
    val lengthSec: Double?,
    val projectName: String?,
    val ssdFreeLabel: String?,
    val takeCount: Int,
    val takeCap: Int,
    val activeTake: Int,
    val masterTake: Int,
    val takes: List<TakeTakeInfo>,
    // S221 ②·4a: the cover's instrument layers + the active layer id. Default empty / "" for a
    // pre-S221 MS / stale rig, so the LAYERS/KIT tab empties + the active-layer pill hides cleanly.
    val layers: List<TakeLayerInfo>,
    val activeLayer: String,
)

/**
 * HTTP client for the MS host gig-command bridge (S186, replaces the dead
 * E6330 gig-command-server.py per v3 charter §"DROP").
 *
 * Why HTTP not OSC: Reaper's OSC bindings are wired to numeric Reaper actions,
 * not arbitrary Lua scripts that take string args (like a project name). The
 * S128 file-poll listener pattern is what handles project-level state changes;
 * this client is just the network leg that gets a JSON command from the APK
 * onto the laptop's filesystem so the gig-command-listener.lua picks it up.
 *
 * Target (S192 batch-D retarget): MS host on the laptop. Defaults come from
 * BuildConfig:
 *   - release: GIG_HOST_DEFAULT="tgt-host.local", GIG_PORT_DEFAULT=9200
 *   - debug:   GIG_HOST_DEFAULT="localhost",      GIG_PORT_DEFAULT=9200
 * Mounted endpoints unchanged from the dead E6330 daemon: POST /gig + POST
 * /song-marker. See [GigCommandBridgeEndpoints] in TangerineMediaServer/Api.
 *
 * Auto-discovery still wins: when the orchestrator's mDNS discovery resolves
 * the Reaper-host, that host is pushed via [setTarget] (port stays at
 * GIG_PORT_DEFAULT — the MS host's fixed bridge port).
 *
 * **v1.2.6: network-binding fix.** When the APK is hosting a hotspot, the
 * default Android network is cellular — `URL.openConnection()` routes via
 * cellular and a 10.119.x.x destination becomes unreachable. UDP/OSC works
 * because the kernel picks an interface by destination, but TCP/HTTP needs
 * an explicit `Network.openConnection(url)` against the hotspot network.
 * We try every non-cellular network with IPv4 + INTERNET capability in turn,
 * accepting the first 2xx response.
 *
 * **S192 batch-D: persistent command queue.** On POST failure the command
 * (path + body) lands in [GigCommandQueue] backed by SharedPreferences.
 * When the next POST succeeds — or when [flushQueue] is invoked from a
 * connectivity/online event — the queue drains oldest-first. A failed
 * drain attempt leaves the queue intact. Markers fired during a hotspot
 * drop window no longer evaporate.
 */
class GigCommandClient(
    private val context: Context,
    private val queue: GigCommandQueue = GigCommandQueue(context),
) {

    companion object {
        private const val TAG = "GigCommandClient"
    }

    data class Target(val host: String, val port: Int)

    private val _target = MutableStateFlow(
        Target(BuildConfig.GIG_HOST_DEFAULT, BuildConfig.GIG_PORT_DEFAULT)
    )
    val target: StateFlow<Target> = _target

    private val _lastSendOk = MutableStateFlow<Boolean?>(null)
    val lastSendOk: StateFlow<Boolean?> = _lastSendOk

    private val _queuedCount = MutableStateFlow(queue.size())
    val queuedCount: StateFlow<Int> = _queuedCount

    private val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    fun setTarget(host: String, port: Int = BuildConfig.GIG_PORT_DEFAULT) {
        _target.value = Target(host.trim(), port)
    }

    // S233 (DARK): per-rig MS API secret, attached as `Authorization: Bearer` on every request
    // WHEN non-empty. Empty (the default, until a pairing slice supplies it) => no header sent;
    // the server runs log-only DARK mode, so nothing breaks pre-flip. Pushed in from RigTargetStore
    // via OrchestratorService. @Volatile: written on the service scope, read on the request IO threads.
    @Volatile
    private var apiSecret: String = ""

    fun setApiSecret(secret: String) {
        apiSecret = secret.trim()
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

    // ── S206 Slice 4b: take-mode commands. Hit the MS host's /take bridge
    // (S206 4a) the same way start/stop hit /gig — same postJson + offline
    // queue. takeLoad builds/opens the per-song cover; takeRecord arms the
    // requested drum channels + records a take (jump+gap+copy-stems-forward,
    // server-side). Stop is OSC /stop (ReaperOscClient), not an HTTP command.
    suspend fun takeLoad(trackId: String, title: String) = postJson(
        path = "/take/load",
        body = """{"trackId":${jsonString(trackId)},"title":${jsonString(title)}}""",
    )

    /** S224: from-scratch source — build a blank recordable Drums cover named [title] (NO library
     *  trackId, NO stems, NO click). Mirrors takeLoad down the same /take bridge + offline queue; the
     *  rig copies the take template + seeds the Drums layer. The next /take/status poll shows it. */
    suspend fun takeNewScratch(title: String) = postJson(
        path = "/take/new-scratch",
        body = """{"title":${jsonString(title)}}""",
    )

    suspend fun takeRecord(armCsv: String) = postJson(
        path = "/take/record",
        body = """{"arm":${jsonString(armCsv)}}""",
    )

    /** S213: backing-stem mix. Sets one backing track's mute + monitor level on the live
     *  cover (Reaper take-mix handler), down the same /take bridge as takeLoad/takeRecord.
     *  Absolute values (no rig->APK readback yet) — the panel is the source of truth. */
    suspend fun takeMix(mixTrack: String, mute: Boolean, volDb: Double) = postJson(
        path = "/take/mix",
        body = """{"mix_track":${jsonString(mixTrack)},"mute":${if (mute) 1 else 0},"vol_db":$volDb}""",
    )

    /** S214: scrub the loaded cover to [posSec] seconds. File-bridge seek (the Lua moves the
     *  edit cursor + playback) — reuses the proven /take path + offline queue rather than OSC,
     *  so there's no OSC-seek config risk. The MS clamps pos_sec >= 0; we send raw seconds.
     *  Finger-up-only from the UI (a drag stream would flood the file-drop backend). */
    suspend fun takeSeek(posSec: Double) = postJson(
        path = "/take/seek",
        body = """{"pos_sec":$posSec}""",
    )

    /** S217: delete a whole take (clone-forward slab) by 1-based [takeIndex]. The rig removes every
     *  item in that slab's window on all tracks (it refuses the only take); the next 1 s /take/status
     *  poll re-enumerates + renumbers the strip. Same /take bridge + offline queue as the others. */
    suspend fun takeDelete(takeIndex: Int) = postJson(
        path = "/take/delete",
        body = """{"take_index":$takeIndex}""",
    )

    /** S217: record over take [takeIndex] (1-based) — replace that slab's drums in place, keeping its
     *  backing clone so click/stems stay aligned. Backs the face Re-do (index = last take) and the
     *  long-press "record over this take". [armCsv] follows the same contract as [takeRecord]. */
    suspend fun takeRecordOver(takeIndex: Int, armCsv: String) = postJson(
        path = "/take/record-over",
        body = """{"take_index":$takeIndex,"arm":${jsonString(armCsv)}}""",
    )

    /** S219 ②·3a: set/toggle the KEPT (★ master) take by 1-based [takeIndex]. The rig persists it in
     *  the cover's .rpp (the slab's start position — survives reopen + record-over); the next 1 s
     *  /take/status poll reflects `master_take`. Tapping the current master clears it (rig-side toggle).
     *  Same /take bridge + offline queue as the others. */
    suspend fun takeSetMaster(takeIndex: Int) = postJson(
        path = "/take/master",
        body = """{"take_index":$takeIndex}""",
    )

    /** S220 ②·3b: set/clear take [takeIndex]'s free-text [label] (empty clears). The MS sanitizes +
     *  caps it (the Lua's raw parser can't take a `"`/`\`); the rig persists it per-slab in the cover's
     *  .rpp (survives reopen + record-over); the next /take/status poll reflects it. Same /take bridge +
     *  offline queue as the others. */
    suspend fun takeLabel(takeIndex: Int, label: String) = postJson(
        path = "/take/label",
        body = """{"take_index":$takeIndex,"label":${jsonString(label)}}""",
    )

    /** S221 ②·4a: add a NEW instrument layer — the rig materialises its track + pro chain + bus on
     *  demand. ②·4a builds Vocals; the other kinds queue for the rig's no-op-log until ②·4b. The next
     *  /take/status poll shows the new layer. Same /take bridge + offline queue as the others. */
    suspend fun takeAddLayer(kind: String) = postJson(
        path = "/take/add-layer",
        body = """{"kind":${jsonString(kind)}}""",
    )

    /** S221 ②·4a: make [layerId] the active (face-following) layer. Takes are GLOBAL, so the take strip
     *  is unchanged — only the active-layer pill + which layer's kit setup shows follow. */
    suspend fun takeSwitchLayer(layerId: String) = postJson(
        path = "/take/switch-layer",
        body = """{"layer":${jsonString(layerId)}}""",
    )

    /** S221 ②·4a: set the armed-layer set (the ids to lay a take on). The rig intersects with its
     *  registry + always implies the active layer; one Record then lays a take on every armed layer at
     *  once, aligned. Sent as a CSV string the MS sanitises per-id. */
    suspend fun takeArmLayers(layerIds: List<String>) = postJson(
        path = "/take/arm-layers",
        body = """{"layers":${jsonString(layerIds.joinToString(","))}}""",
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
        val ok = sendOnce(path, body)
        _lastSendOk.value = ok
        if (ok) {
            // Opportunistically drain the queue when a fresh POST succeeds —
            // the network leg is proven up so any previously-failed commands
            // have a real shot at landing now. drainQueue() is fire-and-forget
            // (uses its own IO scope) — does not block the calling coroutine.
            scope.launch { drainQueue() }
        } else {
            queue.enqueue(path, body)
            _queuedCount.value = queue.size()
            Log.w(TAG, "POST $path queued (queue size=${_queuedCount.value})")
        }
    }

    /**
     * Public flush hook — call from a connectivity-restored broadcast or
     * UI "retry queued commands" button. Safe to call repeatedly. Returns
     * count of commands successfully sent (the ones that failed remain
     * in the queue).
     */
    suspend fun flushQueue(): Int = drainQueue()

    /**
     * Drain the persistent queue oldest-first. Stops at the first send
     * failure (network is presumably still down; spamming the wire helps
     * nobody). Successfully-sent commands are removed; failed ones stay.
     */
    private suspend fun drainQueue(): Int {
        var sent = 0
        while (true) {
            val head = queue.peek() ?: break
            val ok = sendOnce(head.path, head.body)
            if (!ok) break
            queue.removeHead()
            sent++
            _queuedCount.value = queue.size()
        }
        return sent
    }

    /** One POST attempt with the full network-binding cascade. Pure I/O. */
    private suspend fun sendOnce(path: String, body: String): Boolean {
        val tgt = _target.value
        val url = URL("http://${tgt.host}:${tgt.port}$path")

        return withContext(Dispatchers.IO) {
            // S144 fix — interface-bound HTTP for private LAN destinations.
            // When this device is the SoftAP host (e.g. S23 broadcasting
            // `nathan's S23`), the SoftAP downlink (swlan0) isn't exposed
            // as a Network on Samsung One UI, so the cm.allNetworks loop
            // below finds zero candidates that can reach the AP subnet.
            // We work around that by enumerating NetworkInterface directly,
            // finding one whose subnet contains the target IP, and writing
            // raw HTTP/1.1 over a socket bound to that interface's local
            // address. Falls through to the cm.Networks loop for hostname
            // targets (where InetAddress.getByName can't resolve .local).
            if (tryPostInterfaceBound(url, body)) return@withContext true

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
    }

    /**
     * S144 fix — write HTTP/1.1 over a socket bound to a local interface
     * whose subnet contains the target IP. This works for the SoftAP-host
     * case where the AP downlink isn't a Network. Returns false when the
     * target host isn't an IPv4 literal we can resolve locally (e.g. when
     * target is still `e6330.local` because mDNS discovery hasn't yet
     * pushed an IP into setTarget) — the existing cm.Networks loop is the
     * fallback for that path.
     */
    private fun tryPostInterfaceBound(url: URL, body: String): Boolean {
        return try {
            val targetAddr = try { InetAddress.getByName(url.host) } catch (_: Exception) { null }
                ?: return false
            if (targetAddr.address.size != 4) return false  // IPv4 only

            val localAddr = findInterfaceAddressInSubnet(targetAddr) ?: return false

            Socket().use { socket ->
                socket.bind(InetSocketAddress(localAddr, 0))
                socket.connect(InetSocketAddress(targetAddr, url.port), 1500)
                socket.soTimeout = 1500

                val pathOrSlash = url.path.ifEmpty { "/" }
                val bodyBytes = body.toByteArray(Charsets.UTF_8)
                val request = buildString {
                    append("POST ").append(pathOrSlash).append(" HTTP/1.1\r\n")
                    append("Host: ").append(url.host).append(':').append(url.port).append("\r\n")
                    append("Content-Type: application/json\r\n")
                    // S233 (DARK): attach the per-rig bearer when set (raw-socket path is tried FIRST).
                    apiSecret.let { s -> if (s.isNotEmpty()) append("Authorization: Bearer ").append(s).append("\r\n") }
                    append("Content-Length: ").append(bodyBytes.size).append("\r\n")
                    append("Connection: close\r\n\r\n")
                }
                socket.getOutputStream().apply {
                    write(request.toByteArray(Charsets.UTF_8))
                    write(bodyBytes)
                    flush()
                }
                val statusLine = socket.getInputStream().bufferedReader(Charsets.UTF_8).readLine()
                    ?: return false
                val code = statusLine.split(" ").getOrNull(1)?.toIntOrNull() ?: return false
                if (code in 200..299) {
                    true
                } else {
                    Log.w(TAG, "POST $url interface-bound -> HTTP $code")
                    false
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "POST $url interface-bound failed: ${e.message}")
            false
        }
    }

    /** Find a local IPv4 InetAddress whose subnet contains the target. */
    private fun findInterfaceAddressInSubnet(target: InetAddress): InetAddress? {
        val ifaces = NetworkInterface.getNetworkInterfaces() ?: return null
        for (iface in ifaces.toList()) {
            if (!iface.isUp || iface.isLoopback) continue
            for (ifaceAddr in iface.interfaceAddresses) {
                val addr = ifaceAddr.address ?: continue
                if (addr.address.size != 4) continue
                val prefix = ifaceAddr.networkPrefixLength.toInt()
                if (sameSubnet(target.address, addr.address, prefix)) {
                    return addr
                }
            }
        }
        return null
    }

    /** True if `a` and `b` share the first `prefixBits` bits. IPv4-only. */
    private fun sameSubnet(a: ByteArray, b: ByteArray, prefixBits: Int): Boolean {
        if (a.size != 4 || b.size != 4 || prefixBits !in 0..32) return false
        val full = prefixBits / 8
        for (i in 0 until full) {
            if (a[i] != b[i]) return false
        }
        val rem = prefixBits % 8
        if (rem == 0) return true
        val mask = (0xff shl (8 - rem)) and 0xff
        return (a[full].toInt() and mask) == (b[full].toInt() and mask)
    }

    /** Default network first, then every other non-cellular network with IPv4 INTERNET. */
    private fun collectCandidateNetworks(): List<Network> = try {
        buildList {
            cm.activeNetwork?.let { add(it) }
            for (n in cm.allNetworks) {
                if (n in this) continue
                val caps = cm.getNetworkCapabilities(n) ?: continue
                // Skip pure-cellular nets (they can't reach private LAN IPs).
                if (caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) continue
                // Need IP-level connectivity (WiFi, ethernet, hotspot loopback).
                if (!caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                    !caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_TRUSTED)) {
                    continue
                }
                add(n)
            }
        }
    } catch (e: SecurityException) {
        // Hotspot mode depends on explicit network binding. If the manifest or
        // install state ever lacks ACCESS_NETWORK_STATE, keep the HTTP fallback
        // alive via the final unbound attempt instead of crashing the coroutine
        // before the persistent command queue can record the miss.
        Log.w(TAG, "Cannot enumerate candidate networks: ${e.message}")
        emptyList()
    }

    private fun tryPost(network: Network?, url: URL, body: String): Boolean = try {
        val conn = (network?.openConnection(url) ?: url.openConnection()) as HttpURLConnection
        conn.requestMethod = "POST"
        conn.connectTimeout = 1500
        conn.readTimeout = 1500
        conn.doOutput = true
        conn.setRequestProperty("Content-Type", "application/json")
        apiSecret.let { s -> if (s.isNotEmpty()) conn.setRequestProperty("Authorization", "Bearer $s") }  // S233 (DARK)
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

    // ── S206 Slice 4c-2: take-mode browser fetch. GET the MS host's /take/songs (4c-1)
    // over the SAME discovered target the take POSTs use. Take Mode is home-studio /
    // house-WiFi (the phone is a LAN client, not the SoftAP host), so this uses the
    // candidate-Network cascade only — the raw-socket interface-bound path (for the gig
    // SoftAP-host case, where the AP downlink isn't a Network) is deliberately NOT needed
    // here. Returns null on any failure (caller shows a retry).
    suspend fun fetchTakeSongs(): List<TakeSong>? {
        val body = getString("/take/songs") ?: return null
        return try { parseTakeSongs(body) } catch (e: Exception) {
            Log.w(TAG, "parse /take/songs failed: ${e.message}"); null
        }
    }

    /** S214: poll the Reaper-mirror status (`GET /take/status`). Returns null when the MS is
     *  unreachable (the surface greys the status bar); a reachable-but-stale rig still returns a
     *  [TakeStatus] with `stale = true` (the MS never 500s on a missing/corrupt sidecar). */
    suspend fun fetchTakeStatus(): TakeStatus? {
        val body = getString("/take/status") ?: return null
        return try { parseTakeStatus(body) } catch (e: Exception) {
            Log.w(TAG, "parse /take/status failed: ${e.message}"); null
        }
    }

    private fun parseTakeStatus(json: String): TakeStatus {
        val o = JSONObject(json)
        // S216 slice2: parse the take readback with safe defaults — a pre-S216 MS omits these
        // fields entirely, so optInt/optJSONArray must degrade to 0 / empty (never throw).
        val takesArr = o.optJSONArray("takes")
        val takes = if (takesArr == null) emptyList() else buildList {
            for (i in 0 until takesArr.length()) {
                val t = takesArr.optJSONObject(i) ?: continue
                add(
                    TakeTakeInfo(
                        index = t.optInt("index", 0),
                        startSec = t.optDouble("start_sec", 0.0),
                        endSec = t.optDouble("end_sec", 0.0),
                        // S220 ②·3b: per-take label — a pre-S220 rig omits it, so default "".
                        label = t.optString("label", ""),
                    )
                )
            }
        }
        // S221 ②·4a: parse the layer registry with safe defaults — a pre-S221 MS omits layers/
        // active_layer entirely, so optJSONArray/optString degrade to empty / "" (never throw).
        val layersArr = o.optJSONArray("layers")
        val layers = if (layersArr == null) emptyList() else buildList {
            for (i in 0 until layersArr.length()) {
                val l = layersArr.optJSONObject(i) ?: continue
                add(
                    TakeLayerInfo(
                        id = l.optString("id", ""),
                        name = l.optString("name", ""),
                        kind = l.optString("kind", ""),
                        armed = l.optBoolean("armed", false),
                    )
                )
            }
        }
        return TakeStatus(
            stale = o.optBoolean("stale", true),
            playState = o.optString("play_state", "stopped"),
            recording = o.optBoolean("recording", false),
            playing = o.optBoolean("playing", false),
            positionSec = if (o.isNull("position_sec")) null else o.optDouble("position_sec"),
            lengthSec = if (o.isNull("length_sec")) null else o.optDouble("length_sec"),
            projectName = if (o.isNull("project_name")) null else o.optString("project_name"),
            ssdFreeLabel = if (o.isNull("ssd_free_label")) null else o.optString("ssd_free_label"),
            takeCount = o.optInt("take_count", 0),
            takeCap = o.optInt("take_cap", 0),
            activeTake = o.optInt("active_take", 0),
            // S219 ②·3a: ★ master take — a pre-S219 MS omits master_take, so default 0 (no ★).
            masterTake = o.optInt("master_take", 0),
            takes = takes,
            layers = layers,
            activeLayer = o.optString("active_layer", ""),
        )
    }

    private suspend fun getString(path: String): String? {
        val tgt = _target.value
        val url = URL("http://${tgt.host}:${tgt.port}$path")
        return withContext(Dispatchers.IO) {
            for (network in collectCandidateNetworks()) {
                tryGet(network, url)?.let { return@withContext it }
            }
            tryGet(network = null, url = url)  // last resort: unbound
        }
    }

    private fun tryGet(network: Network?, url: URL): String? = try {
        val conn = (network?.openConnection(url) ?: url.openConnection()) as HttpURLConnection
        conn.requestMethod = "GET"
        conn.connectTimeout = 2000
        conn.readTimeout = 2000
        conn.setRequestProperty("Accept", "application/json")
        apiSecret.let { s -> if (s.isNotEmpty()) conn.setRequestProperty("Authorization", "Bearer $s") }  // S233 (DARK): /take/status + /take/songs are gated machine GETs
        val code = conn.responseCode
        val text = if (code in 200..299)
            conn.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
        else null
        conn.disconnect()
        if (text == null) Log.w(TAG, "GET $url via ${network ?: "default"} -> HTTP $code")
        text
    } catch (e: Exception) {
        Log.w(TAG, "GET $url via ${network ?: "default"} failed: ${e.message}")
        null
    }

    private fun parseTakeSongs(json: String): List<TakeSong> {
        val arr = JSONArray(json)
        val out = ArrayList<TakeSong>(arr.length())
        for (i in 0 until arr.length()) {
            val o = arr.getJSONObject(i)
            out.add(
                TakeSong(
                    trackId = o.getString("trackId"),
                    title = o.optString("title", ""),
                    artist = o.optString("artist", ""),
                    bpm = if (o.isNull("bpm")) null else o.optDouble("bpm"),
                    beatmapVerified = o.optBoolean("beatmapVerified", false),
                )
            )
        }
        return out
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

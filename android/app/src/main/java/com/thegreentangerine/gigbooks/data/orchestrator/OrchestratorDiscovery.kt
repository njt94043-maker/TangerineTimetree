package com.thegreentangerine.gigbooks.data.orchestrator

import android.content.Context
import android.net.ConnectivityManager
import android.net.LinkAddress
import android.net.Network
import android.net.NetworkCapabilities
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.net.wifi.WifiManager
import android.os.Build
import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.net.Inet4Address
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.Socket

/**
 * mDNS / NSD-based auto-discovery of the Tangerine Media Server host on the LAN.
 *
 * Listens for `_tangerine-media._tcp.` services on the current network (advertised
 * by the Media Server with the machine name as the instance), resolves the
 * service's numeric IP+port, and exposes [discovered]. Re-runs whenever the
 * default network changes (home WiFi → S23 hotspot, etc.).
 *
 * The APK NEVER needs a manual host config in the normal path. Manual override
 * stays in the UI as a diagnostics escape hatch.
 */
class OrchestratorDiscovery(private val context: Context) {

    companion object {
        private const val TAG = "OrchestratorDiscovery"
        private const val SERVICE_TYPE = "_tangerine-media._tcp."
        // The Media Server advertises this TGT-specific type with the machine name as
        // the instance (see ServiceAdvertiser.cs). Any instance of this type IS our
        // host, so we no longer filter by an instance-name prefix.
    }

    data class Discovered(val name: String, val host: String, val port: Int)

    private val _discovered = MutableStateFlow<Discovered?>(null)
    val discovered: StateFlow<Discovered?> = _discovered

    private val _isSearching = MutableStateFlow(false)
    val isSearching: StateFlow<Boolean> = _isSearching

    private val nsd = context.getSystemService(Context.NSD_SERVICE) as NsdManager
    private val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    private var multicastLock: WifiManager.MulticastLock? = null
    private var discoveryListener: NsdManager.DiscoveryListener? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private var resolvingNow = false

    /** Begin searching. Idempotent. */
    fun start() {
        acquireMulticastLock()
        registerNetworkWatcher()
        restartDiscovery()
    }

    /** Stop searching + release locks. Safe to call multiple times. */
    fun stop() {
        stopDiscovery()
        unregisterNetworkWatcher()
        releaseMulticastLock()
        _isSearching.value = false
    }

    private fun restartDiscovery() {
        stopDiscovery()
        _discovered.value = null
        val listener = object : NsdManager.DiscoveryListener {
            override fun onDiscoveryStarted(serviceType: String) {
                Log.d(TAG, "Discovery started for $serviceType")
                _isSearching.value = true
            }
            override fun onDiscoveryStopped(serviceType: String) {
                Log.d(TAG, "Discovery stopped for $serviceType")
                _isSearching.value = false
            }
            override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {
                Log.w(TAG, "Start discovery failed: $errorCode")
                _isSearching.value = false
            }
            override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) {
                Log.w(TAG, "Stop discovery failed: $errorCode")
            }
            override fun onServiceFound(info: NsdServiceInfo) {
                Log.d(TAG, "Service found: ${info.serviceName} (${info.serviceType})")
                resolveService(info)
            }
            override fun onServiceLost(info: NsdServiceInfo) {
                Log.d(TAG, "Service lost: ${info.serviceName}")
                val current = _discovered.value
                if (current != null && current.name == info.serviceName) {
                    _discovered.value = null
                }
            }
        }
        try {
            nsd.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, listener)
            discoveryListener = listener
        } catch (e: Exception) {
            Log.w(TAG, "discoverServices threw: ${e.message}")
        }
    }

    private fun stopDiscovery() {
        val l = discoveryListener ?: return
        try { nsd.stopServiceDiscovery(l) } catch (_: Exception) {}
        discoveryListener = null
    }

    private fun resolveService(info: NsdServiceInfo) {
        // Older API: only one resolve at a time. Serialise.
        if (resolvingNow) return
        resolvingNow = true
        if (Build.VERSION.SDK_INT >= 34) {
            // API 34+: registerServiceInfoCallback is the recommended path
            try {
                nsd.registerServiceInfoCallback(info, { it.run() }, object : NsdManager.ServiceInfoCallback {
                    override fun onServiceInfoCallbackRegistrationFailed(errorCode: Int) {
                        resolvingNow = false
                    }
                    override fun onServiceUpdated(updated: NsdServiceInfo) {
                        publishResolved(updated)
                    }
                    override fun onServiceLost() { /* handled in DiscoveryListener */ }
                    override fun onServiceInfoCallbackUnregistered() {}
                })
                resolvingNow = false
                return
            } catch (e: Exception) {
                Log.w(TAG, "registerServiceInfoCallback failed, falling back: ${e.message}")
                // fall through to legacy
            }
        }
        @Suppress("DEPRECATION")
        nsd.resolveService(info, object : NsdManager.ResolveListener {
            override fun onResolveFailed(info: NsdServiceInfo, errorCode: Int) {
                Log.w(TAG, "Resolve failed: $errorCode")
                resolvingNow = false
            }
            override fun onServiceResolved(resolved: NsdServiceInfo) {
                publishResolved(resolved)
                resolvingNow = false
            }
        })
    }

    private fun publishResolved(resolved: NsdServiceInfo) {
        val port = resolved.port
        if (port <= 0) return
        val candidates = resolvedHostCandidates(resolved)
        val wifiRoute = activeWifiRoute()
        val chosen = RigHostSelector.select(
            candidates = candidates,
            wifi = wifiRoute.linkAddress,
            probe = { candidate ->
                wifiRoute.network?.let { network ->
                    probeHostOnWifiNetwork(candidate, port, network)
                } ?: false
            },
        )
        val host = chosen?.hostAddress
        if (host == null) {
            Log.w(TAG, "Resolved ${resolved.serviceName} but no reachable IPv4 host from ${candidates.toLogString()}")
            return
        }
        Log.i(TAG, "Resolved ${resolved.serviceName} → $host:$port")
        _discovered.value = Discovered(resolved.serviceName, host, port)
    }

    private fun resolvedHostCandidates(resolved: NsdServiceInfo): List<InetAddress> {
        if (Build.VERSION.SDK_INT >= 34) {
            return resolved.hostAddresses.filterNotNull()
        }
        Log.i(TAG, "API ${Build.VERSION.SDK_INT} legacy NSD exposes one resolved host only; multi-address selection unavailable")
        @Suppress("DEPRECATION")
        return listOfNotNull(resolved.host)
    }

    private data class WifiRoute(val network: Network?, val linkAddress: LinkAddress?)

    @Suppress("DEPRECATION")
    private fun activeWifiRoute(): WifiRoute {
        var firstWifiNetwork: Network? = null
        for (network in cm.allNetworks) {
            val caps = cm.getNetworkCapabilities(network) ?: continue
            if (!caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) continue
            if (firstWifiNetwork == null) firstWifiNetwork = network
            val ipv4Link = cm.getLinkProperties(network)
                ?.linkAddresses
                ?.firstOrNull { it.address is Inet4Address }
            if (ipv4Link != null) return WifiRoute(network, ipv4Link)
        }
        return WifiRoute(firstWifiNetwork, null)
    }

    private fun probeHostOnWifiNetwork(
        candidate: InetAddress,
        port: Int,
        network: Network,
        timeoutMs: Int = 400,
    ): Boolean =
        try {
            Socket().use { socket ->
                network.bindSocket(socket)
                socket.connect(InetSocketAddress(candidate, port), timeoutMs)
                true
            }
        } catch (_: Exception) {
            false
        }

    private fun registerNetworkWatcher() {
        if (networkCallback != null) return
        val cb = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                Log.d(TAG, "Network available — restarting discovery")
                restartDiscovery()
            }
            override fun onLost(network: Network) {
                Log.d(TAG, "Network lost")
                _discovered.value = null
            }
        }
        try {
            cm.registerDefaultNetworkCallback(cb)
            networkCallback = cb
        } catch (e: Exception) {
            Log.w(TAG, "registerDefaultNetworkCallback failed: ${e.message}")
        }
    }

    private fun unregisterNetworkWatcher() {
        val cb = networkCallback ?: return
        try { cm.unregisterNetworkCallback(cb) } catch (_: Exception) {}
        networkCallback = null
    }

    private fun acquireMulticastLock() {
        if (multicastLock != null) return
        val wifi = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
        multicastLock = wifi.createMulticastLock("TGT:Discovery").apply {
            setReferenceCounted(false)
            acquire()
        }
    }

    private fun releaseMulticastLock() {
        multicastLock?.takeIf { it.isHeld }?.release()
        multicastLock = null
    }
}

object RigHostSelector {

    fun select(
        candidates: List<InetAddress>,
        wifi: LinkAddress?,
        probe: (InetAddress) -> Boolean,
    ): InetAddress? =
        select(
            candidates = candidates,
            wifiAddress = wifi?.address as? Inet4Address,
            wifiPrefixLength = wifi?.prefixLength,
            probe = probe,
        )

    fun select(
        candidates: List<InetAddress>,
        wifiAddress: Inet4Address?,
        wifiPrefixLength: Int?,
        probe: (InetAddress) -> Boolean,
    ): InetAddress? {
        val ipv4Candidates = candidates
            .filterIsInstance<Inet4Address>()
            .filterNot { it.isLoopbackAddress }

        if (ipv4Candidates.isEmpty()) return null
        if (ipv4Candidates.size == 1) return ipv4Candidates.first()

        val sameSubnet = if (
            wifiAddress != null &&
            wifiPrefixLength != null &&
            wifiPrefixLength in 0..32
        ) {
            ipv4Candidates.firstOrNull { it.isSameSubnetAs(wifiAddress, wifiPrefixLength) }
        } else {
            null
        }
        if (sameSubnet != null) return sameSubnet

        return ipv4Candidates.firstOrNull {
            !it.isLinkLocalAddress &&
                !it.isCarrierGradeNat() &&
                probe(it)
        }
    }

    private fun Inet4Address.isSameSubnetAs(other: Inet4Address, prefixLength: Int): Boolean {
        val mask = if (prefixLength == 0) 0 else -1 shl (32 - prefixLength)
        return (toIpv4Int() and mask) == (other.toIpv4Int() and mask)
    }

    private fun Inet4Address.toIpv4Int(): Int =
        address.fold(0) { acc, byte -> (acc shl 8) or (byte.toInt() and 0xff) }

    private fun Inet4Address.isCarrierGradeNat(): Boolean {
        val octets = address.map { it.toInt() and 0xff }
        return octets[0] == 100 && octets[1] in 64..127
    }
}

private fun List<InetAddress>.toLogString(): String =
    joinToString(prefix = "[", postfix = "]") { it.hostAddress ?: it.toString() }

package com.thegreentangerine.gigbooks.data.orchestrator

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.net.wifi.WifiManager
import android.os.Build
import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/**
 * mDNS / NSD-based auto-discovery of the E6330 Reaper appliance.
 *
 * Listens for `_osc._udp.` services on the current network, picks the one
 * whose name starts with "TGT Reaper" (advertised by avahi on the E6330),
 * resolves its IP+port, and exposes [discovered]. Re-runs whenever the
 * default network changes (home WiFi → S23 hotspot, etc.).
 *
 * The APK NEVER needs a manual host config in the normal path. Manual override
 * stays in the UI as a diagnostics escape hatch.
 */
class OrchestratorDiscovery(private val context: Context) {

    companion object {
        private const val TAG = "OrchestratorDiscovery"
        private const val SERVICE_TYPE = "_osc._udp."
        private const val SERVICE_NAME_PREFIX = "TGT Reaper"
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
                if (info.serviceName.startsWith(SERVICE_NAME_PREFIX)) {
                    resolveService(info)
                }
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
        @Suppress("DEPRECATION")
        val host = resolved.host?.hostAddress ?: return
        val port = resolved.port
        if (port <= 0) return
        Log.i(TAG, "Resolved ${resolved.serviceName} → $host:$port")
        _discovered.value = Discovered(resolved.serviceName, host, port)
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

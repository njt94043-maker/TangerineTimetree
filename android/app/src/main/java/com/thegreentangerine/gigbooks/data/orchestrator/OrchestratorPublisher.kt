package com.thegreentangerine.gigbooks.data.orchestrator

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.os.Build
import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/**
 * Publishes the orchestrator TCP server as `_tgt-orchestrator._tcp.` over mDNS so
 * peer Android phones on the same LAN can discover it without configuration.
 *
 * Service name = "TGT Orchestrator <Build.MODEL>" so multiple drummers' rigs on
 * the same network never collide. Port comes from [OrchestratorPeerServer].
 */
class OrchestratorPublisher(private val context: Context) {

    companion object {
        private const val TAG = "OrchestratorPublisher"
        const val SERVICE_TYPE = "_tgt-orchestrator._tcp."
    }

    private val nsd = context.getSystemService(Context.NSD_SERVICE) as NsdManager
    private var registrationListener: NsdManager.RegistrationListener? = null

    private val _registered = MutableStateFlow(false)
    val registered: StateFlow<Boolean> = _registered

    private val _serviceName = MutableStateFlow<String?>(null)
    val serviceName: StateFlow<String?> = _serviceName

    /** Register the service on [port]. Idempotent — re-register replaces. */
    fun register(port: Int) {
        if (port <= 0) {
            Log.w(TAG, "register skipped, invalid port=$port")
            return
        }
        unregister()
        val info = NsdServiceInfo().apply {
            serviceName = "TGT Orchestrator ${Build.MODEL}"
            serviceType = SERVICE_TYPE
            this.port = port
        }
        val listener = object : NsdManager.RegistrationListener {
            override fun onServiceRegistered(registered: NsdServiceInfo) {
                Log.i(TAG, "Registered: ${registered.serviceName} on :${registered.port}")
                _serviceName.value = registered.serviceName
                _registered.value = true
            }
            override fun onRegistrationFailed(info: NsdServiceInfo, errorCode: Int) {
                Log.w(TAG, "Registration failed code=$errorCode")
                _registered.value = false
            }
            override fun onServiceUnregistered(info: NsdServiceInfo) {
                Log.d(TAG, "Unregistered: ${info.serviceName}")
                _registered.value = false
                _serviceName.value = null
            }
            override fun onUnregistrationFailed(info: NsdServiceInfo, errorCode: Int) {
                Log.w(TAG, "Unregistration failed code=$errorCode")
            }
        }
        try {
            nsd.registerService(info, NsdManager.PROTOCOL_DNS_SD, listener)
            registrationListener = listener
        } catch (e: Exception) {
            Log.e(TAG, "registerService threw: ${e.message}", e)
        }
    }

    fun unregister() {
        val l = registrationListener ?: return
        try { nsd.unregisterService(l) } catch (_: Exception) {}
        registrationListener = null
        _registered.value = false
        _serviceName.value = null
    }
}

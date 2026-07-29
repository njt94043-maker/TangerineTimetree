package com.thegreentangerine.gigbooks.data.orchestrator

import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import java.net.Inet4Address
import java.net.InetAddress
import java.net.NetworkInterface

/**
 * S284 slice 1: find the rig by PROBING, not by name.
 *
 * mDNS stays the fast path ([OrchestratorDiscovery]); this is the fallback for when
 * it doesn't fire — which is the case that actually matters, because Nathan's gigs
 * run on the phone's own hotspot (session--281) and the rig is a DHCP client of the
 * phone. A `.local` name is worthless there; a swept IP is not.
 *
 * Everything except [localSubnets] is pure and unit-tested — the network I/O is
 * injected as a `probe` lambda so the caller reuses ITS existing probe rather than
 * this file growing a second one.
 */
object RigSweep {

    /** Concurrent probes in flight. Deliberately bounded — this runs on the gig path. */
    const val MAX_IN_FLIGHT = 32

    /** Per-host TCP connect timeout while sweeping. */
    const val PROBE_TIMEOUT_MS = 300

    /**
     * Only sweep /22 or NARROWER (i.e. prefix length >= 22, <= 1022 hosts). Guards
     * against walking a /8. /31 and /32 carry no usable host addresses, so 30 is the
     * upper bound.
     */
    const val MIN_PREFIX_LENGTH = 22
    const val MAX_PREFIX_LENGTH = 30

    /** One local IPv4 interface address + its subnet prefix length. */
    data class Subnet(val address: String, val prefixLength: Int)

    /**
     * This device's own non-loopback IPv4 interface addresses — the same
     * `NetworkInterface` approach [GigCommandClient.findInterfaceAddressInSubnet]
     * already uses, so the SoftAP-host case works (Android does not expose the AP
     * downlink as a `Network`, which is why enumerating Networks is not enough).
     */
    fun localSubnets(): List<Subnet> = try {
        buildList {
            val ifaces = NetworkInterface.getNetworkInterfaces() ?: return@buildList
            for (iface in ifaces.toList()) {
                if (!iface.isUp || iface.isLoopback) continue
                for (ifaceAddr in iface.interfaceAddresses) {
                    val addr = ifaceAddr.address as? Inet4Address ?: continue
                    val host = addr.hostAddress ?: continue
                    add(Subnet(host, ifaceAddr.networkPrefixLength.toInt()))
                }
            }
        }
    } catch (_: Exception) {
        emptyList()
    }

    /**
     * Keep only the subnets worth sweeping: real IPv4, not loopback / link-local /
     * multicast, and narrow enough that the sweep is bounded.
     */
    fun sweepable(candidates: List<Subnet>): List<Subnet> = candidates.filter { s ->
        if (s.prefixLength !in MIN_PREFIX_LENGTH..MAX_PREFIX_LENGTH) return@filter false
        val addr = parseIpv4(s.address) ?: return@filter false
        !addr.isLoopbackAddress && !addr.isLinkLocalAddress && !addr.isAnyLocalAddress &&
            !addr.isMulticastAddress
    }

    /**
     * Every usable host address in [subnet], EXCLUDING the network address, the
     * broadcast address, and this device's own address. Ascending — a hotspot rig
     * takes a low DHCP lease, so the winner usually falls out in the first window.
     */
    fun hostsIn(subnet: Subnet): List<String> {
        if (subnet.prefixLength !in MIN_PREFIX_LENGTH..MAX_PREFIX_LENGTH) return emptyList()
        val self = parseIpv4(subnet.address)?.let { toInt(it.address) } ?: return emptyList()
        val mask = -1 shl (32 - subnet.prefixLength)
        val network = self and mask
        val broadcast = network or mask.inv()
        val out = ArrayList<String>(broadcast - network - 1)
        var host = network + 1
        while (host < broadcast) {
            if (host != self) out.add(toDotted(host))
            host++
        }
        return out
    }

    /**
     * Probe [hosts] in windows of [maxInFlight], returning the FIRST responder (in
     * list order) or null. A window is fully awaited before the next starts, so the
     * in-flight count never exceeds the bound — this runs on the gig path and must
     * not launch 254 unbounded coroutines.
     */
    suspend fun findFirstResponder(
        hosts: List<String>,
        maxInFlight: Int = MAX_IN_FLIGHT,
        probe: suspend (String) -> Boolean,
    ): String? = coroutineScope {
        for (window in hosts.chunked(maxInFlight.coerceAtLeast(1))) {
            val hits = window.map { host -> async { if (probe(host)) host else null } }.awaitAll()
            hits.firstOrNull { it != null }?.let { return@coroutineScope it }
        }
        null
    }

    private fun parseIpv4(address: String): Inet4Address? = try {
        InetAddress.getByName(address) as? Inet4Address
    } catch (_: Exception) {
        null
    }

    private fun toInt(octets: ByteArray): Int =
        octets.fold(0) { acc, b -> (acc shl 8) or (b.toInt() and 0xff) }

    private fun toDotted(value: Int): String =
        "${(value ushr 24) and 0xff}.${(value ushr 16) and 0xff}.${(value ushr 8) and 0xff}.${value and 0xff}"
}

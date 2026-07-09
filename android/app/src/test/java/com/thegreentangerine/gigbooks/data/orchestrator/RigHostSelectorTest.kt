package com.thegreentangerine.gigbooks.data.orchestrator

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.net.Inet4Address
import java.net.Inet6Address
import java.net.InetAddress

class RigHostSelectorTest {

    @Test
    fun `multi homed rig chooses the candidate on the phone wifi subnet`() {
        val chosen = RigHostSelector.select(
            candidates = ips("192.168.15.10", "192.168.1.90", "100.122.32.41"),
            wifiAddress = ipv4("192.168.1.90"),
            wifiPrefixLength = 24,
            probe = { false },
        )

        assertEquals("192.168.1.90", chosen?.hostAddress)
    }

    @Test
    fun `single hotspot candidate is preserved`() {
        val chosen = RigHostSelector.select(
            candidates = ips("10.226.54.64"),
            wifiAddress = ipv4("10.226.54.138"),
            wifiPrefixLength = 24,
            probe = { false },
        )

        assertEquals("10.226.54.64", chosen?.hostAddress)
    }

    @Test
    fun `single homed rig is preserved when wifi info is unavailable`() {
        val chosen = RigHostSelector.select(
            candidates = ips("192.168.1.90"),
            wifiAddress = null,
            wifiPrefixLength = null,
            probe = { false },
        )

        assertEquals("192.168.1.90", chosen?.hostAddress)
    }

    @Test
    fun `multi homed decoys are not latched when subnet and probe both fail`() {
        val chosen = RigHostSelector.select(
            candidates = ips("100.122.32.41", "192.168.15.10"),
            wifiAddress = ipv4("192.168.1.90"),
            wifiPrefixLength = 24,
            probe = { false },
        )

        assertNull(chosen)
    }

    @Test
    fun `zero ipv4 candidates returns null`() {
        val chosen = RigHostSelector.select(
            candidates = listOf(ipv6("fe80::1")),
            wifiAddress = ipv4("192.168.1.90"),
            wifiPrefixLength = 24,
            probe = { false },
        )

        assertNull(chosen)
    }

    private fun ips(vararg addresses: String): List<InetAddress> =
        addresses.map { InetAddress.getByName(it) }

    private fun ipv4(address: String): Inet4Address =
        InetAddress.getByName(address) as Inet4Address

    private fun ipv6(address: String): Inet6Address =
        InetAddress.getByName(address) as Inet6Address
}

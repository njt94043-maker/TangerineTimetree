package com.thegreentangerine.gigbooks.data.orchestrator

import kotlinx.coroutines.delay
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.atomic.AtomicInteger

/**
 * S284 slice 1: the pure half of the rig sweep. Real network I/O is deliberately NOT
 * tested here — the probe is injected, so what is under test is the subnet maths and
 * the concurrency bound.
 */
class RigSweepTest {

    // ─── host expansion ───────────────────────────────────────────────────────

    @Test
    fun `a 24 expands to every host except network, broadcast and self`() {
        val hosts = RigSweep.hostsIn(RigSweep.Subnet("192.168.1.90", 24))

        // 256 addresses - network - broadcast - self = 253
        assertEquals(253, hosts.size)
        assertFalse("network address must be excluded", hosts.contains("192.168.1.0"))
        assertFalse("broadcast address must be excluded", hosts.contains("192.168.1.255"))
        assertFalse("this device must be excluded", hosts.contains("192.168.1.90"))
        assertTrue(hosts.contains("192.168.1.1"))
        assertTrue(hosts.contains("192.168.1.254"))
        assertEquals("192.168.1.1", hosts.first())
        assertEquals("192.168.1.254", hosts.last())
        assertEquals("no duplicates", hosts.size, hosts.toSet().size)
    }

    @Test
    fun `a 22 expands across all four octets in range, minus network, broadcast and self`() {
        val hosts = RigSweep.hostsIn(RigSweep.Subnet("10.226.54.138", 22))

        // /22 = 1024 addresses - network - broadcast - self = 1021
        assertEquals(1021, hosts.size)
        assertFalse(hosts.contains("10.226.52.0"))    // network
        assertFalse(hosts.contains("10.226.55.255"))  // broadcast
        assertFalse(hosts.contains("10.226.54.138"))  // self
        assertEquals("10.226.52.1", hosts.first())
        assertEquals("10.226.55.254", hosts.last())
        assertTrue(hosts.contains("10.226.53.7"))
        assertTrue(hosts.contains("10.226.55.1"))
    }

    @Test
    fun `an android softAP 24 yields the client range the rig leases from`() {
        // The gig case: the phone hosts the AP and the rig is a DHCP client of it.
        val hosts = RigSweep.hostsIn(RigSweep.Subnet("192.168.43.1", 24))

        assertEquals(253, hosts.size)
        assertFalse(hosts.contains("192.168.43.1"))  // the phone itself
        assertEquals("192.168.43.2", hosts.first())  // the first lease the rig can hold
    }

    @Test
    fun `a subnet wider than 22 is never expanded`() {
        assertTrue(RigSweep.hostsIn(RigSweep.Subnet("10.0.0.5", 8)).isEmpty())
        assertTrue(RigSweep.hostsIn(RigSweep.Subnet("169.254.229.195", 16)).isEmpty())
        assertTrue(RigSweep.hostsIn(RigSweep.Subnet("10.226.54.138", 21)).isEmpty())
    }

    @Test
    fun `a 31 or 32 has no usable host addresses`() {
        assertTrue(RigSweep.hostsIn(RigSweep.Subnet("192.168.1.90", 31)).isEmpty())
        assertTrue(RigSweep.hostsIn(RigSweep.Subnet("192.168.1.90", 32)).isEmpty())
    }

    // ─── subnet enumeration / filtering ───────────────────────────────────────

    @Test
    fun `sweepable keeps narrow routable subnets and drops the rest`() {
        val kept = RigSweep.sweepable(
            listOf(
                RigSweep.Subnet("192.168.1.90", 24),      // home WiFi  -> keep
                RigSweep.Subnet("192.168.43.1", 24),      // phone softAP -> keep
                RigSweep.Subnet("10.226.54.138", 22),     // widest allowed -> keep
                RigSweep.Subnet("10.0.0.5", 8),           // far too wide -> drop
                RigSweep.Subnet("172.16.4.9", 21),        // one bit too wide -> drop
                RigSweep.Subnet("169.254.229.195", 16),   // link-local, too wide -> drop
                RigSweep.Subnet("169.254.229.195", 24),   // link-local -> drop on address
                RigSweep.Subnet("127.0.0.1", 24),         // loopback -> drop
                RigSweep.Subnet("not-an-ip", 24),         // unparseable -> drop
            )
        )

        assertEquals(
            listOf("192.168.1.90", "192.168.43.1", "10.226.54.138"),
            kept.map { it.address },
        )
    }

    // ─── bounded concurrency ──────────────────────────────────────────────────

    @Test
    fun `findFirstResponder returns the first responder in list order`() = runTest {
        val hosts = (1..100).map { "192.168.1.$it" }

        val hit = RigSweep.findFirstResponder(hosts, maxInFlight = 32) { host ->
            host == "192.168.1.40" || host == "192.168.1.77"
        }

        assertEquals("192.168.1.40", hit)
    }

    @Test
    fun `findFirstResponder never exceeds the in-flight bound`() = runTest {
        val inFlight = AtomicInteger(0)
        val peak = AtomicInteger(0)
        val hosts = (1..254).map { "10.0.0.$it" }

        val hit = RigSweep.findFirstResponder(hosts, maxInFlight = 32) {
            val now = inFlight.incrementAndGet()
            peak.updateAndGet { p -> maxOf(p, now) }
            delay(5)
            inFlight.decrementAndGet()
            false
        }

        assertNull(hit)
        assertTrue("peak in flight was ${peak.get()}", peak.get() <= 32)
    }

    @Test
    fun `findFirstResponder stops probing once a host answers`() = runTest {
        val probed = AtomicInteger(0)
        val hosts = (1..254).map { "10.0.0.$it" }

        val hit = RigSweep.findFirstResponder(hosts, maxInFlight = 32) { host ->
            probed.incrementAndGet()
            host == "10.0.0.5"
        }

        assertEquals("10.0.0.5", hit)
        // The winner is in the first window, so the sweep stops after that window —
        // it must not walk the remaining 222 addresses.
        assertTrue("probed ${probed.get()} hosts", probed.get() <= 32)
    }

    @Test
    fun `no hosts means no responder and no probing`() = runTest {
        val probed = AtomicInteger(0)
        val hit = RigSweep.findFirstResponder(emptyList()) { probed.incrementAndGet(); true }

        assertNull(hit)
        assertEquals(0, probed.get())
    }
}

package com.thegreentangerine.gigbooks.data.orchestrator

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * S284 slice 1: an EMPTY rig target means NOT PAIRED, and every send path must
 * short-circuit on it rather than attempting a doomed resolve.
 *
 * The positive control matters as much as the assertion: `127.0.0.1` proves the send
 * path really does run (and report true) when there IS a target, so a passing
 * short-circuit test can't be a blanket false.
 */
class ReaperOscClientTargetTest {

    @Test
    fun `an empty host is not a target`() {
        val client = ReaperOscClient()
        client.setTarget("", 8000)
        assertFalse(client.hasTarget)
    }

    @Test
    fun `a whitespace-only host is not a target either`() {
        val client = ReaperOscClient()
        client.setTarget("   ", 8000)
        assertFalse(client.hasTarget)
        assertEquals("", client.target.value.host)
    }

    @Test
    fun `sending to an empty target short-circuits and reports failure`() = runTest {
        val client = ReaperOscClient()
        client.setTarget("", 8000)

        client.sendStop()

        // No datagram was attempted, and the UI is told so — not left at null (unknown)
        // and certainly not told the send worked.
        assertEquals(false, client.lastSendOk.value)
    }

    @Test
    fun `record and rec-arm short-circuit on an empty target too`() = runTest {
        val client = ReaperOscClient()
        client.setTarget("", 8000)

        client.sendRecArm(setOf(3, 4, 5))
        assertEquals(false, client.lastSendOk.value)

        client.sendRecord()
        assertEquals(false, client.lastSendOk.value)

        client.sendSongMarker("Sultans of Swing")
        assertEquals(false, client.lastSendOk.value)
    }

    @Test
    fun `positive control - a real host is actually sent to`() = runTest {
        val client = ReaperOscClient()
        // Loopback, a port nothing is bound to: UDP is fire-and-forget, so the send
        // itself succeeds. This proves the false above comes from the short-circuit.
        client.setTarget("127.0.0.1", 59999)
        assertTrue(client.hasTarget)

        client.sendStop()

        assertEquals(true, client.lastSendOk.value)
    }
}

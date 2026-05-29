package com.thegreentangerine.gigbooks.data.orchestrator

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Unit tests for [GigCommandQueue] using an in-memory [GigCommandQueue.Storage]
 * stand-in for SharedPreferences. Covers the four shapes the brief calls out:
 * enqueue, dequeue, flush-on-failure-retains, flush-on-success-drains.
 */
class GigCommandQueueTest {

    /** In-memory Storage — exposes the persisted blob so tests can assert
     *  on-disk shape, not just runtime behaviour. */
    private class MemStorage : GigCommandQueue.Storage {
        var blob: String? = null
        override fun read(): String? = blob
        override fun write(json: String) {
            blob = json
        }
    }

    private lateinit var storage: MemStorage
    private lateinit var queue: GigCommandQueue

    @Before
    fun setUp() {
        storage = MemStorage()
        queue = GigCommandQueue(storage)
    }

    @Test
    fun `enqueue persists to storage`() {
        assertEquals(0, queue.size())
        queue.enqueue("/gig", """{"action":"start","project_name":"Beddau"}""", tsMs = 100L)
        assertEquals(1, queue.size())
        assertNotNull(storage.blob)
        assertTrue(storage.blob!!.contains("Beddau"))
    }

    @Test
    fun `enqueue then peek returns oldest entry`() {
        queue.enqueue("/gig", "first", tsMs = 100L)
        queue.enqueue("/song-marker", "second", tsMs = 200L)
        queue.enqueue("/gig", "third", tsMs = 300L)
        val head = queue.peek()
        assertNotNull(head)
        assertEquals("/gig", head!!.path)
        assertEquals("first", head.body)
        assertEquals(100L, head.tsMs)
    }

    @Test
    fun `removeHead drains oldest first`() {
        queue.enqueue("/gig", "a", tsMs = 1L)
        queue.enqueue("/gig", "b", tsMs = 2L)
        queue.enqueue("/gig", "c", tsMs = 3L)

        assertEquals("a", queue.peek()?.body)
        queue.removeHead()
        assertEquals("b", queue.peek()?.body)
        queue.removeHead()
        assertEquals("c", queue.peek()?.body)
        queue.removeHead()
        assertNull(queue.peek())
        assertEquals(0, queue.size())
    }

    @Test
    fun `removeHead on empty queue is a no-op`() {
        queue.removeHead()
        queue.removeHead()
        assertEquals(0, queue.size())
    }

    @Test
    fun `flush-on-failure-retains - peek returns same entry after failed drain attempt`() {
        // Simulates: drainQueue() calls peek(), sends, sees failure, breaks
        // out of the loop. The entry MUST still be there for the next attempt.
        queue.enqueue("/gig", "first", tsMs = 1L)
        queue.enqueue("/gig", "second", tsMs = 2L)

        val attempt1 = queue.peek()
        // Caller's "send" returns false → do NOT removeHead.
        // (No call to removeHead here.)

        // Verify the queue is identical on next inspection.
        assertEquals(2, queue.size())
        val attempt2 = queue.peek()
        assertEquals(attempt1?.body, attempt2?.body)
        assertEquals(attempt1?.tsMs, attempt2?.tsMs)
    }

    @Test
    fun `flush-on-success-drains - removeHead progresses through queue oldest-first`() {
        queue.enqueue("/gig", "alpha", tsMs = 1L)
        queue.enqueue("/song-marker", "bravo", tsMs = 2L)
        queue.enqueue("/gig", "charlie", tsMs = 3L)

        // Simulate caller draining the queue: peek + (mock) send-ok + removeHead.
        val drained = mutableListOf<String>()
        while (true) {
            val head = queue.peek() ?: break
            // Pretend all sends succeed.
            drained.add(head.body)
            queue.removeHead()
        }

        assertEquals(listOf("alpha", "bravo", "charlie"), drained)
        assertEquals(0, queue.size())
        assertNull(queue.peek())
    }

    @Test
    fun `partial drain - half the entries succeed, the rest remain`() {
        queue.enqueue("/gig", "a", tsMs = 1L)
        queue.enqueue("/gig", "b", tsMs = 2L)
        queue.enqueue("/gig", "c", tsMs = 3L)
        queue.enqueue("/gig", "d", tsMs = 4L)

        // Drain only the first two (simulating "network came back briefly,
        // then dropped again after 2 successful sends").
        queue.removeHead()
        queue.removeHead()

        assertEquals(2, queue.size())
        assertEquals("c", queue.peek()?.body)
    }

    @Test
    fun `clear empties the queue`() {
        queue.enqueue("/gig", "a", tsMs = 1L)
        queue.enqueue("/gig", "b", tsMs = 2L)
        queue.clear()
        assertEquals(0, queue.size())
        assertNull(queue.peek())
    }

    @Test
    fun `enqueue past MAX_ENTRIES drops oldest`() {
        // Push MAX + 5 entries; verify the FIRST 5 got pushed out.
        for (i in 0 until GigCommandQueue.MAX_ENTRIES + 5) {
            queue.enqueue("/gig", "entry-$i", tsMs = i.toLong())
        }
        assertEquals(GigCommandQueue.MAX_ENTRIES, queue.size())
        // Head should be entry-5 (entries 0..4 were dropped).
        assertEquals("entry-5", queue.peek()?.body)
    }

    @Test
    fun `corrupt storage blob is treated as empty queue`() {
        storage.blob = "{not valid json["
        val q2 = GigCommandQueue(storage)
        assertEquals(0, q2.size())
        assertNull(q2.peek())
        // Subsequent enqueue should overwrite cleanly.
        q2.enqueue("/gig", "fresh", tsMs = 1L)
        assertEquals(1, q2.size())
    }

    @Test
    fun `snapshot returns ordered copy without mutating queue`() {
        queue.enqueue("/gig", "a", tsMs = 1L)
        queue.enqueue("/gig", "b", tsMs = 2L)
        val snap = queue.snapshot()
        assertEquals(2, snap.size)
        assertEquals("a", snap[0].body)
        assertEquals("b", snap[1].body)
        // Mutating snapshot must not touch the queue.
        // (snap is a List, immutable copy — just verify size after.)
        assertEquals(2, queue.size())
    }

    @Test
    fun `roundtrip survives recreate (simulating process restart)`() {
        queue.enqueue("/gig", """{"action":"start","project_name":"Beddau"}""", tsMs = 100L)
        queue.enqueue("/song-marker", """{"title":"Wonderwall"}""", tsMs = 200L)

        // Recreate the queue against the SAME storage — like cold-starting
        // the APK after a crash mid-set.
        val reloaded = GigCommandQueue(storage)
        assertEquals(2, reloaded.size())
        assertEquals("/gig", reloaded.peek()?.path)
        reloaded.removeHead()
        assertEquals("/song-marker", reloaded.peek()?.path)
    }
}

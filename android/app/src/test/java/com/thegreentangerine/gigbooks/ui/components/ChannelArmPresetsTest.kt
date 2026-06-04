package com.thegreentangerine.gigbooks.ui.components

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Unit tests for [computeArmedTracks] (S202 Slice 1).
 *
 * Asserts the exact 1-indexed Reaper track numbers each preset combination
 * arms. The armed set is what flows over OSC `/track/N/recarm`, so these are
 * the contract the live rig is verified against.
 */
class ChannelArmPresetsTest {

    @Test
    fun `GIG acoustic overheads fullkit music arms band kit and music`() {
        assertEquals(
            setOf(3, 4, 5, 6, 10, 11, 12, 13, 14, 15, 16, 17, 18),
            computeArmedTracks(
                ArmPresetMode.GIG, KitType.ACOUSTIC,
                overheads = true, fullKit = true, music = true,
            ),
        )
    }

    @Test
    fun `GIG acoustic kick-only with music`() {
        assertEquals(
            setOf(3, 4, 5, 6, 10, 17, 18),
            computeArmedTracks(
                ArmPresetMode.GIG, KitType.ACOUSTIC,
                overheads = false, fullKit = false, music = true,
            ),
        )
    }

    @Test
    fun `GIG ekit swaps in TD-4 and drops acoustic mics`() {
        assertEquals(
            setOf(1, 2, 3, 4, 5, 6, 17, 18),
            computeArmedTracks(
                ArmPresetMode.GIG, KitType.EKIT,
                overheads = true, fullKit = true, music = true,  // OH/fullKit ignored for ekit
            ),
        )
    }

    @Test
    fun `GIG acoustic full kit no music drops 17-18`() {
        assertEquals(
            setOf(3, 4, 5, 6, 10, 11, 12, 13, 14, 15, 16),
            computeArmedTracks(
                ArmPresetMode.GIG, KitType.ACOUSTIC,
                overheads = true, fullKit = true, music = false,
            ),
        )
    }

    @Test
    fun `TAKE acoustic drops band and music regardless of music flag`() {
        assertEquals(
            setOf(10, 11, 12, 13, 14, 15, 16),
            computeArmedTracks(
                ArmPresetMode.TAKE, KitType.ACOUSTIC,
                overheads = true, fullKit = true, music = true,  // music ignored in take mode
            ),
        )
    }

    @Test
    fun `TAKE ekit arms only TD-4`() {
        assertEquals(
            setOf(1, 2),
            computeArmedTracks(
                ArmPresetMode.TAKE, KitType.EKIT,
                overheads = true, fullKit = true, music = true,
            ),
        )
    }

    @Test
    fun `GIG acoustic everything plus EAD arms 8-9`() {
        assertEquals(
            setOf(3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18),
            computeArmedTracks(
                ArmPresetMode.GIG, KitType.ACOUSTIC,
                overheads = true, fullKit = true, music = true, ead = true,
            ),
        )
    }

    @Test
    fun `GIG ekit ignores EAD`() {
        assertEquals(
            setOf(1, 2, 3, 4, 5, 6),
            computeArmedTracks(
                ArmPresetMode.GIG, KitType.EKIT,
                overheads = false, fullKit = false, music = false, ead = true,
            ),
        )
    }

    @Test
    fun `TAKE acoustic full kit plus EAD`() {
        assertEquals(
            setOf(8, 9, 10, 11, 12, 13, 14, 15, 16),
            computeArmedTracks(
                ArmPresetMode.TAKE, KitType.ACOUSTIC,
                overheads = true, fullKit = true, music = true, ead = true,
            ),
        )
    }
}

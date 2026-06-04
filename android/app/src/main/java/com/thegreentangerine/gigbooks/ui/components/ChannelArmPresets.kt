package com.thegreentangerine.gigbooks.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.thegreentangerine.gigbooks.ui.theme.JetBrainsMono
import com.thegreentangerine.gigbooks.ui.theme.Karla
import com.thegreentangerine.gigbooks.ui.theme.TangerineColors

/**
 * S202 Slice 1 — gig-wizard channel-arm presets.
 *
 * The Reaper template's channel *layout* never changes (spec locked decision
 * #7); only the **record-arm set** changes per session. This is the one place
 * that maps the drummer's "what am I using today?" toggles to the 1-indexed
 * Reaper track numbers, sent over OSC as `/track/N/recarm`.
 *
 * Built ONCE, parameterised by [ArmPresetMode] so take mode (a later slice)
 * reuses the same selector: gig mode shows band + music + drum toggles; take
 * mode shows drum toggles only (band + music hidden). This slice wires GIG only.
 */
enum class ArmPresetMode { GIG, TAKE }
enum class KitType { ACOUSTIC, EKIT }

/** Hoisted preset state for [ChannelArmPresetSelector]. */
data class ArmPresetState(
    val kitType: KitType = KitType.ACOUSTIC,
    val overheads: Boolean = true,
    val fullKit: Boolean = true,
    val ead: Boolean = false,
    val music: Boolean = true,
)

/** Pure, unit-tested. Returns the 1-indexed Reaper track numbers to record-arm. */
fun computeArmedTracks(
    mode: ArmPresetMode,
    kitType: KitType,
    overheads: Boolean,
    fullKit: Boolean,
    music: Boolean,
    ead: Boolean = false,
): Set<Int> {
    val s = sortedSetOf<Int>()
    if (mode == ArmPresetMode.GIG) s += setOf(3, 4, 5, 6)   // band core (gig only)
    when (kitType) {
        KitType.ACOUSTIC -> {
            s += 10                                          // kick (always, acoustic)
            if (overheads) s += setOf(15, 16)
            if (fullKit) s += setOf(11, 12, 13, 14)
            if (ead) s += setOf(8, 9)                        // EAD = acoustic close mic; ignored in E-kit
        }
        KitType.EKIT -> s += setOf(1, 2)                     // TD-4 replaces acoustic mics
    }
    if (mode == ArmPresetMode.GIG && music) s += setOf(17, 18)
    return s
}

/**
 * Reusable preset selector. State is hoisted ([state] / [onState]) so the host
 * (wizard) owns it and can read it back to compute the armed set on Start.
 *
 * - Kit segmented switch: Acoustic | E-kit (E-kit swaps the acoustic drum mics
 *   for the TD-4 pair — mutually exclusive with overheads / full kit).
 * - Acoustic: Overheads (15·16) + Full kit (11–14) toggles. E-kit: a static
 *   TD-4 (1·2) chip; overheads/full-kit hidden.
 * - GIG mode: a Music (17·18) toggle + a static "Band 3·4·5·6" info chip.
 * - A live summary line of the resulting armed tracks + channel count.
 */
@Composable
fun ChannelArmPresetSelector(
    mode: ArmPresetMode,
    state: ArmPresetState,
    onState: (ArmPresetState) -> Unit,
) {
    val armed = computeArmedTracks(
        mode = mode,
        kitType = state.kitType,
        overheads = state.overheads,
        fullKit = state.fullKit,
        music = state.music,
        ead = state.ead,
    )

    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            "CHANNELS",
            fontFamily = JetBrainsMono, fontWeight = FontWeight.Bold,
            fontSize = 11.sp, letterSpacing = 2.sp,
            color = TangerineColors.orange,
        )
        Spacer(Modifier.height(8.dp))

        // Kit segmented switch ───────────────────────────────────────────────
        SegmentedSwitch(
            options = listOf("Acoustic" to KitType.ACOUSTIC, "E-kit" to KitType.EKIT),
            selected = state.kitType,
            onSelect = { onState(state.copy(kitType = it)) },
        )
        Spacer(Modifier.height(10.dp))

        // Kit-dependent controls ─────────────────────────────────────────────
        when (state.kitType) {
            KitType.ACOUSTIC -> {
                ToggleChip(
                    label = "Overheads",
                    detail = "15·16",
                    checked = state.overheads,
                    onToggle = { onState(state.copy(overheads = it)) },
                )
                Spacer(Modifier.height(6.dp))
                ToggleChip(
                    label = "Full kit",
                    detail = "11–14",
                    checked = state.fullKit,
                    onToggle = { onState(state.copy(fullKit = it)) },
                )
                Spacer(Modifier.height(6.dp))
                ToggleChip(
                    label = "EAD",
                    detail = "8·9",
                    checked = state.ead,
                    onToggle = { onState(state.copy(ead = it)) },
                )
            }
            KitType.EKIT -> {
                InfoChip(label = "TD-4", detail = "1·2")
            }
        }

        // GIG-only controls ──────────────────────────────────────────────────
        if (mode == ArmPresetMode.GIG) {
            Spacer(Modifier.height(6.dp))
            ToggleChip(
                label = "Music",
                detail = "17·18",
                checked = state.music,
                onToggle = { onState(state.copy(music = it)) },
            )
            Spacer(Modifier.height(6.dp))
            InfoChip(label = "Band", detail = "3·4·5·6")
        }

        // Live summary ───────────────────────────────────────────────────────
        Spacer(Modifier.height(10.dp))
        Text(
            "Arming: ${armed.joinToString(",")}  ·  ${armed.size} ch",
            fontFamily = JetBrainsMono, fontSize = 11.sp,
            color = TangerineColors.textDim,
        )
    }
}

@Composable
private fun <T> SegmentedSwitch(
    options: List<Pair<String, T>>,
    selected: T,
    onSelect: (T) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .border(1.dp, TangerineColors.textMuted.copy(alpha = 0.4f), RoundedCornerShape(10.dp)),
    ) {
        options.forEach { (label, value) ->
            val on = value == selected
            val tint = if (on) TangerineColors.orange else TangerineColors.textMuted
            Box(
                modifier = Modifier
                    .weight(1f)
                    .background(if (on) TangerineColors.orange.copy(alpha = 0.12f) else Color.Transparent)
                    .clickable { onSelect(value) }
                    .padding(vertical = 10.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    label,
                    fontFamily = Karla, fontWeight = if (on) FontWeight.Bold else FontWeight.Normal,
                    fontSize = 13.sp,
                    color = if (on) TangerineColors.orange else tint,
                )
            }
        }
    }
}

@Composable
private fun ToggleChip(
    label: String,
    detail: String,
    checked: Boolean,
    onToggle: (Boolean) -> Unit,
) {
    val tint = if (checked) TangerineColors.orange else TangerineColors.textMuted
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(tint.copy(alpha = if (checked) 0.1f else 0.04f))
            .border(1.dp, tint.copy(alpha = 0.5f), RoundedCornerShape(10.dp))
            .clickable { onToggle(!checked) }
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .width(14.dp)
                .height(14.dp)
                .clip(RoundedCornerShape(4.dp))
                .background(if (checked) TangerineColors.orange else Color.Transparent)
                .border(1.dp, tint.copy(alpha = 0.7f), RoundedCornerShape(4.dp)),
        )
        Spacer(Modifier.width(10.dp))
        Text(
            label,
            fontFamily = Karla, fontWeight = FontWeight.Bold,
            fontSize = 13.sp, color = if (checked) TangerineColors.text else TangerineColors.textDim,
        )
        Spacer(Modifier.weight(1f))
        Text(
            detail,
            fontFamily = JetBrainsMono, fontSize = 11.sp,
            color = tint,
        )
    }
}

@Composable
private fun InfoChip(label: String, detail: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(TangerineColors.surfaceInset)
            .border(1.dp, TangerineColors.textMuted.copy(alpha = 0.3f), RoundedCornerShape(10.dp))
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            label,
            fontFamily = Karla, fontWeight = FontWeight.Bold,
            fontSize = 13.sp, color = TangerineColors.textDim,
        )
        Spacer(Modifier.width(8.dp))
        Text(
            "always armed",
            fontFamily = Karla, fontSize = 11.sp,
            color = TangerineColors.textMuted,
        )
        Spacer(Modifier.weight(1f))
        Text(
            detail,
            fontFamily = JetBrainsMono, fontSize = 11.sp,
            color = TangerineColors.textDim,
        )
    }
}

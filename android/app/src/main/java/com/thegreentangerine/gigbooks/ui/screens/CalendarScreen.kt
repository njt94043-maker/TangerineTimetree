package com.thegreentangerine.gigbooks.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.thegreentangerine.gigbooks.data.supabase.models.Gig
import com.thegreentangerine.gigbooks.ui.AppViewModel
import com.thegreentangerine.gigbooks.ui.components.NeuCard
import com.thegreentangerine.gigbooks.ui.theme.GigColors
import com.thegreentangerine.gigbooks.ui.theme.Karla
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.TextStyle as JTextStyle
import java.util.Locale

@Composable
fun CalendarScreen(vm: AppViewModel, onMenuClick: () -> Unit) {
    val today      = remember { LocalDate.now() }
    val viewYear   = vm.calViewYear
    val viewMonth  = vm.calViewMonth

    val yearMonth      = YearMonth.of(viewYear, viewMonth)
    val daysInMonth    = yearMonth.lengthOfMonth()
    val firstDayOfWeek = yearMonth.atDay(1).dayOfWeek.value // 1=Mon..7=Sun
    val offset         = firstDayOfWeek - 1
    val isCurrentMonth = viewYear == today.year && viewMonth == today.monthValue

    var selectedDay by remember { mutableStateOf<LocalDate?>(null) }

    // Build lookup structures from ViewModel data
    val gigsByDate: Map<String, List<Gig>> = vm.calGigs.groupBy { it.date }
    val awayDays: Set<String> = buildSet {
        vm.calAwayDates.forEach { away ->
            var d   = LocalDate.parse(away.startDate)
            val end = LocalDate.parse(away.endDate)
            while (!d.isAfter(end)) { add(d.toString()); d = d.plusDays(1) }
        }
    }

    Column(
        modifier = Modifier.fillMaxSize().background(GigColors.background).padding(top = 48.dp),
    ) {
        // ── Header ──────────────────────────────────────────────────────────
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(GigColors.surface)
                .padding(horizontal = 8.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onMenuClick) {
                Icon(Icons.Default.Menu, "Menu", tint = GigColors.textDim, modifier = Modifier.size(22.dp))
            }
            Text(
                "GigBooks",
                fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 18.sp,
                style = TextStyle(color = GigColors.orange, shadow = Shadow(GigColors.orange.copy(0.4f), Offset.Zero, 14f)),
                modifier = Modifier.weight(1f),
                textAlign = TextAlign.Center,
            )
            if (vm.calLoading)
                CircularProgressIndicator(color = GigColors.orange, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
            else
                Spacer(Modifier.size(48.dp))
        }

        NeuCard(
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 8.dp).weight(1f),
        ) {
            // ── Month nav ────────────────────────────────────────────────────
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                IconButton(onClick = {
                    val prev = YearMonth.of(viewYear, viewMonth).minusMonths(1)
                    vm.calNavigate(prev.year, prev.monthValue)
                }) {
                    Icon(Icons.Default.ChevronLeft, "Previous", tint = GigColors.orange)
                }
                TextButton(onClick = { vm.calNavigate(today.year, today.monthValue) }) {
                    Text(
                        "${yearMonth.month.getDisplayName(JTextStyle.FULL, Locale.getDefault())} $viewYear",
                        fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = GigColors.text,
                    )
                }
                IconButton(onClick = {
                    val next = YearMonth.of(viewYear, viewMonth).plusMonths(1)
                    vm.calNavigate(next.year, next.monthValue)
                }) {
                    Icon(Icons.Default.ChevronRight, "Next", tint = GigColors.orange)
                }
            }

            if (!isCurrentMonth) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                    TextButton(
                        onClick = { vm.calNavigate(today.year, today.monthValue) },
                        modifier = Modifier.border(1.dp, GigColors.orange, RoundedCornerShape(10.dp)),
                    ) {
                        Text("Today", fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 10.sp, color = GigColors.orange)
                    }
                }
            }

            // ── Day headers ──────────────────────────────────────────────────
            Row(modifier = Modifier.fillMaxWidth()) {
                listOf("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN").forEachIndexed { i, d ->
                    Text(
                        d, modifier = Modifier.weight(1f), textAlign = TextAlign.Center,
                        fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 11.sp,
                        color = if (i >= 5) GigColors.textMuted else GigColors.textDim,
                    )
                }
            }

            Spacer(Modifier.height(4.dp))

            // ── Day grid ─────────────────────────────────────────────────────
            val rows = ((offset + daysInMonth) + 6) / 7

            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                for (row in 0 until rows) {
                    Row(
                        modifier = Modifier.fillMaxWidth().weight(1f),
                        horizontalArrangement = Arrangement.spacedBy(3.dp),
                    ) {
                        for (col in 0..6) {
                            val day = row * 7 + col - offset + 1
                            if (day < 1 || day > daysInMonth) {
                                Box(Modifier.weight(1f))
                            } else {
                                val dateStr = "%04d-%02d-%02d".format(viewYear, viewMonth, day)
                                val isToday = isCurrentMonth && day == today.dayOfMonth
                                val isPast  = LocalDate.of(viewYear, viewMonth, day).isBefore(today)
                                val dayGigs = gigsByDate[dateStr] ?: emptyList()
                                CalendarDayCell(
                                    day         = day,
                                    isToday     = isToday,
                                    isPast      = isPast,
                                    hasGig      = dayGigs.any { it.isGig },
                                    hasPractice = dayGigs.any { it.isPractice },
                                    hasAway     = dateStr in awayDays,
                                    isSelected  = selectedDay?.toString() == dateStr,
                                    modifier    = Modifier.weight(1f),
                                    onClick     = {
                                        val d = LocalDate.of(viewYear, viewMonth, day)
                                        selectedDay = if (selectedDay == d) null else d
                                    },
                                )
                            }
                        }
                    }
                }
            }

            Spacer(Modifier.height(6.dp))

            // ── Legend ───────────────────────────────────────────────────────
            Row(modifier = Modifier.fillMaxWidth().padding(top = 6.dp), horizontalArrangement = Arrangement.SpaceAround) {
                LegendItem(GigColors.calGig,      "Gig")
                LegendItem(GigColors.calPractice, "Practice")
                LegendItem(GigColors.calAway,     "Away")
            }
        }

        // ── Day detail panel (shown below grid when day with events is selected) ──
        selectedDay?.let { sel ->
            val dateStr = sel.toString()
            val dayGigs = gigsByDate[dateStr] ?: emptyList()
            val isAway  = dateStr in awayDays
            if (dayGigs.isNotEmpty() || isAway) {
                DayDetail(
                    date     = sel,
                    gigs     = dayGigs,
                    isAway   = isAway,
                    modifier = Modifier.padding(horizontal = 8.dp).padding(bottom = 8.dp),
                )
            }
        }
    }
}

// ─── Day cell ────────────────────────────────────────────────────────────────

@Composable
private fun CalendarDayCell(
    day: Int,
    isToday: Boolean,
    isPast: Boolean,
    hasGig: Boolean,
    hasPractice: Boolean,
    hasAway: Boolean,
    isSelected: Boolean,
    modifier: Modifier,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(6.dp)
    Box(
        modifier = modifier
            .clip(shape)
            .background(if (isSelected) GigColors.orange.copy(alpha = 0.1f) else GigColors.shadowDark.copy(alpha = 0.3f))
            .then(
                when {
                    isToday    -> Modifier.border(2.dp, GigColors.orange, shape).shadow(8.dp, shape, ambientColor = GigColors.orange)
                    isSelected -> Modifier.border(1.dp, GigColors.orange.copy(alpha = 0.5f), shape)
                    else       -> Modifier.border(1.dp, GigColors.neuBorder, shape)
                }
            )
            .clickable(onClick = onClick)
            .padding(start = 3.dp, top = 2.dp, bottom = 2.dp),
        contentAlignment = Alignment.TopStart,
    ) {
        Column {
            Text(
                "$day", fontFamily = Karla, fontSize = 12.sp,
                color = when { isToday -> GigColors.orange; isPast -> GigColors.textMuted; else -> GigColors.text },
            )
            val dots = buildList {
                if (hasGig)      add(GigColors.calGig)
                if (hasPractice) add(GigColors.calPractice)
                if (hasAway)     add(GigColors.calAway)
            }
            if (dots.isNotEmpty()) {
                Row(horizontalArrangement = Arrangement.spacedBy(2.dp), modifier = Modifier.padding(top = 1.dp)) {
                    dots.forEach { c -> Box(Modifier.size(4.dp).clip(RoundedCornerShape(2.dp)).background(c)) }
                }
            }
        }
    }
}

// ─── Day detail panel ────────────────────────────────────────────────────────

@Composable
private fun DayDetail(
    date: LocalDate,
    gigs: List<Gig>,
    isAway: Boolean,
    modifier: Modifier = Modifier,
) {
    NeuCard(modifier = modifier) {
        val dayLabel  = date.dayOfWeek.getDisplayName(JTextStyle.FULL, Locale.getDefault())
        val dateLabel = "${date.dayOfMonth} ${date.month.getDisplayName(JTextStyle.FULL, Locale.getDefault())} ${date.year}"
        Text(
            "$dayLabel · $dateLabel",
            fontFamily = Karla, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = GigColors.text,
        )
        Spacer(Modifier.height(6.dp))

        if (isAway) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(6.dp).clip(RoundedCornerShape(3.dp)).background(GigColors.calAway))
                Text("  Away", fontFamily = Karla, fontSize = 12.sp, color = GigColors.calAway)
            }
        }

        gigs.forEach { gig ->
            val color     = if (gig.isGig) GigColors.calGig else GigColors.calPractice
            val typeLabel = if (gig.isGig) "Gig" else "Practice"
            Row(modifier = Modifier.fillMaxWidth().padding(top = 4.dp), verticalAlignment = Alignment.Top) {
                Box(Modifier.size(6.dp).clip(RoundedCornerShape(3.dp)).background(color).padding(top = 4.dp))
                Column(Modifier.padding(start = 8.dp)) {
                    Text(
                        "$typeLabel${if (gig.venue.isNotBlank()) " · ${gig.venue}" else ""}",
                        fontFamily = Karla, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, color = color,
                    )
                    if (gig.clientName.isNotBlank()) {
                        Text(gig.clientName, fontFamily = Karla, fontSize = 11.sp, color = GigColors.textDim)
                    }
                    gig.startTimeFormatted?.let {
                        Text(it, fontFamily = Karla, fontSize = 11.sp, color = GigColors.textMuted)
                    }
                    if (gig.notes.isNotBlank()) {
                        Text(gig.notes, fontFamily = Karla, fontSize = 10.sp, color = GigColors.textMuted)
                    }
                }
            }
        }
    }
}

// ─── Legend ──────────────────────────────────────────────────────────────────

@Composable
private fun LegendItem(color: Color, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(8.dp).clip(RoundedCornerShape(4.dp)).background(color))
        Text(label, modifier = Modifier.padding(start = 4.dp), fontFamily = Karla, fontSize = 10.sp, color = GigColors.textDim)
    }
}

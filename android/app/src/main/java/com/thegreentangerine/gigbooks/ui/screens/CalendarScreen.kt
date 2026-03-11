package com.thegreentangerine.gigbooks.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
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
import androidx.compose.foundation.layout.width
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
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
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
        modifier = Modifier.fillMaxSize().background(GigColors.background),
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
            modifier = Modifier
                .padding(horizontal = 8.dp, vertical = 8.dp)
                .weight(1f)
                .pointerInput(viewYear, viewMonth) {
                    var totalDrag = 0f
                    detectHorizontalDragGestures(
                        onDragStart = { totalDrag = 0f },
                        onHorizontalDrag = { _, dragAmount -> totalDrag += dragAmount },
                        onDragEnd = {
                            if (totalDrag > 100f) {
                                // Swipe right → previous month
                                val prev = YearMonth.of(viewYear, viewMonth).minusMonths(1)
                                vm.calNavigate(prev.year, prev.monthValue)
                            } else if (totalDrag < -100f) {
                                // Swipe left → next month
                                val next = YearMonth.of(viewYear, viewMonth).plusMonths(1)
                                vm.calNavigate(next.year, next.monthValue)
                            }
                        },
                    )
                },
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
                                val dayGigs = (gigsByDate[dateStr] ?: emptyList()).filter { !it.isCancelled }
                                CalendarDayCell(
                                    day         = day,
                                    isToday     = isToday,
                                    isPast      = isPast,
                                    gigs        = dayGigs,
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

            // ── Legend (6 items, mirrors web exactly) ────────────────────────
            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
                horizontalArrangement = Arrangement.SpaceEvenly,
            ) {
                LegendItem(GigColors.calAvailable, "Available")
                LegendItem(GigColors.calGig,       "Pub Gig")
                LegendItem(GigColors.calClient,    "Client")
            }
            Spacer(Modifier.height(4.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
            ) {
                LegendItem(color = null, label = "Enquiry", dashed = true, dashColor = GigColors.calEnquiry)
                LegendItem(GigColors.calPractice,  "Practice")
                LegendItem(GigColors.calAway,      "Away")
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

// ─── Compute display type from gigs (mirrors web computeDayDisplay) ─────────

private enum class DayDisplay { Available, Pub, Client, Enquiry, Practice, Away }

private fun computeDayDisplay(gigs: List<Gig>, hasAway: Boolean): DayDisplay {
    if (hasAway && gigs.isEmpty()) return DayDisplay.Away
    val clientGigs = gigs.filter { it.isClient }
    val pubGigs    = gigs.filter { it.isPub }
    val hasPractice = gigs.any { it.isPractice }
    return when {
        clientGigs.isNotEmpty() -> {
            if (clientGigs.none { it.status == "confirmed" }) DayDisplay.Enquiry else DayDisplay.Client
        }
        pubGigs.isNotEmpty() -> DayDisplay.Pub
        hasPractice -> DayDisplay.Practice
        hasAway -> DayDisplay.Away
        else -> DayDisplay.Available
    }
}

private fun dayDisplayColor(display: DayDisplay): Color = when (display) {
    DayDisplay.Available -> GigColors.calAvailable
    DayDisplay.Pub       -> GigColors.calGig
    DayDisplay.Client    -> GigColors.calClient
    DayDisplay.Enquiry   -> GigColors.calEnquiry
    DayDisplay.Practice  -> GigColors.calPractice
    DayDisplay.Away      -> GigColors.calAway
}

// ─── Day cell (mirrors web: colored background, venue text, dots) ───────────

@Composable
private fun CalendarDayCell(
    day: Int,
    isToday: Boolean,
    isPast: Boolean,
    gigs: List<Gig>,
    hasAway: Boolean,
    isSelected: Boolean,
    modifier: Modifier,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(6.dp)
    val display = computeDayDisplay(gigs, hasAway)
    val hasEvents = gigs.isNotEmpty() || hasAway
    val accentColor = dayDisplayColor(display)

    // Cell background: colored tint when events exist (mirrors web)
    val bgColor = when {
        isSelected -> GigColors.orange.copy(alpha = 0.1f)
        hasEvents && display != DayDisplay.Available -> accentColor.copy(alpha = 0.08f)
        else -> GigColors.shadowDark.copy(alpha = 0.3f)
    }

    // Border color
    val borderMod = when {
        isToday    -> Modifier.border(2.dp, GigColors.orange, shape).shadow(8.dp, shape, ambientColor = GigColors.orange)
        isSelected -> Modifier.border(1.dp, GigColors.orange.copy(alpha = 0.5f), shape)
        hasEvents && display == DayDisplay.Enquiry -> Modifier // dashed border drawn in drawBehind
        hasEvents && display != DayDisplay.Available -> Modifier.border(1.dp, accentColor.copy(alpha = 0.15f), shape)
        else       -> Modifier.border(1.dp, GigColors.neuBorder, shape)
    }

    // Dashed border for enquiry
    val enquiryDraw = if (display == DayDisplay.Enquiry && !isToday && !isSelected) {
        Modifier.drawBehind {
            drawRoundRect(
                color = accentColor.copy(alpha = 0.4f),
                size = Size(size.width, size.height),
                cornerRadius = CornerRadius(6.dp.toPx()),
                style = Stroke(
                    width = 1.5.dp.toPx(),
                    pathEffect = PathEffect.dashPathEffect(floatArrayOf(6f, 4f)),
                ),
            )
        }
    } else Modifier

    Box(
        modifier = modifier
            .clip(shape)
            .background(bgColor)
            .then(borderMod)
            .then(enquiryDraw)
            .clickable(onClick = onClick)
            .padding(start = 3.dp, top = 2.dp, end = 2.dp, bottom = 2.dp),
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // Day number — bold + colored when events exist (mirrors web)
            Text(
                "$day", fontFamily = Karla,
                fontSize = 12.sp,
                fontWeight = if (hasEvents && display != DayDisplay.Available) FontWeight.Bold else FontWeight.Normal,
                color = when {
                    isToday -> GigColors.orange
                    hasEvents && display != DayDisplay.Available -> accentColor
                    isPast -> GigColors.textMuted
                    else -> GigColors.text
                },
            )

            // Venue text — first gig's venue, one word per line (mirrors web exactly)
            val firstVenue = gigs.firstOrNull { it.venue.isNotBlank() }?.venue
            if (firstVenue != null) {
                val venueColor = when {
                    gigs.first().isPractice -> GigColors.calPractice
                    gigs.first().isClient -> GigColors.calClient
                    else -> GigColors.calGig
                }
                val words = firstVenue.split(" ").take(3) // Max 3 words to fit cell
                words.forEach { word ->
                    Text(
                        word,
                        fontFamily = Karla,
                        fontSize = 7.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = venueColor.copy(alpha = 0.85f),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        lineHeight = 8.sp,
                    )
                }
            }

            Spacer(Modifier.weight(1f))

            // Dots at bottom (mirrors web: max 3 dots)
            val dots = buildList {
                if (gigs.any { it.isClient })    add(GigColors.calClient to false)
                if (gigs.any { it.isEnquiry })   add(GigColors.calEnquiry to true)
                if (gigs.any { it.isPub })       add(GigColors.calGig to false)
                if (gigs.any { it.isPractice })  add(GigColors.calPractice to false)
                if (hasAway)                     add(GigColors.calAway to false)
            }.take(3)

            if (dots.isNotEmpty()) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(2.dp),
                    modifier = Modifier.padding(bottom = 1.dp).align(Alignment.CenterHorizontally),
                ) {
                    dots.forEach { (c, isDashed) ->
                        if (isDashed) {
                            Box(
                                Modifier.size(5.dp).drawBehind {
                                    drawCircle(
                                        color = c.copy(alpha = 0.6f),
                                        style = Stroke(
                                            width = 1.5f,
                                            pathEffect = PathEffect.dashPathEffect(floatArrayOf(3f, 2f)),
                                        ),
                                    )
                                },
                            )
                        } else {
                            Box(Modifier.size(5.dp).clip(RoundedCornerShape(2.5.dp)).background(c))
                        }
                    }
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

        gigs.filter { !it.isCancelled }.forEach { gig ->
            val color = when {
                gig.isEnquiry  -> GigColors.calEnquiry
                gig.isClient   -> GigColors.calClient
                gig.isPractice -> GigColors.calPractice
                else           -> GigColors.calGig
            }
            val typeLabel = when {
                gig.isEnquiry  -> "Enquiry"
                gig.isClient   -> "Client"
                gig.isPractice -> "Practice"
                else           -> "Gig"
            }
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
private fun LegendItem(
    color: Color? = null,
    label: String,
    dashed: Boolean = false,
    dashColor: Color = Color.Transparent,
) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        if (dashed) {
            Box(
                Modifier.size(8.dp).drawBehind {
                    drawCircle(
                        color = dashColor,
                        style = Stroke(
                            width = 1.5f,
                            pathEffect = PathEffect.dashPathEffect(floatArrayOf(3f, 2f)),
                        ),
                    )
                },
            )
        } else {
            Box(Modifier.size(8.dp).clip(RoundedCornerShape(4.dp)).background(color ?: Color.Transparent))
        }
        Text(label, modifier = Modifier.padding(start = 4.dp), fontFamily = Karla, fontSize = 10.sp, color = GigColors.textDim)
    }
}

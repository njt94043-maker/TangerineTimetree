package com.thegreentangerine.gigbooks.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
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
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.thegreentangerine.gigbooks.ui.components.NeuCard
import com.thegreentangerine.gigbooks.ui.theme.GigColors
import com.thegreentangerine.gigbooks.ui.theme.Karla
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.TextStyle
import java.util.Locale

@Composable
fun CalendarScreen(onMenuClick: () -> Unit) {
    val today = remember { LocalDate.now() }
    var viewYear by remember { mutableIntStateOf(today.year) }
    var viewMonth by remember { mutableIntStateOf(today.monthValue) }

    val yearMonth = YearMonth.of(viewYear, viewMonth)
    val daysInMonth = yearMonth.lengthOfMonth()
    val firstDayOfWeek = yearMonth.atDay(1).dayOfWeek.value // 1=Mon, 7=Sun
    val offset = firstDayOfWeek - 1

    val isCurrentMonth = viewYear == today.year && viewMonth == today.monthValue

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(GigColors.background)
            .padding(top = 48.dp), // status bar
    ) {
        // Header with menu button
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onMenuClick) {
                Icon(Icons.Default.Menu, "Menu", tint = GigColors.orange)
            }
            Spacer(Modifier.weight(1f))
            Text(
                "GigBooks",
                fontFamily = Karla,
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp,
                color = GigColors.orange,
            )
            Spacer(Modifier.weight(1f))
            // Balance the menu button width
            Spacer(Modifier.size(48.dp))
        }

        NeuCard(
            modifier = Modifier
                .padding(horizontal = 8.dp)
                .weight(1f),
        ) {
            // Month navigation
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                IconButton(onClick = {
                    if (viewMonth == 1) { viewMonth = 12; viewYear-- }
                    else viewMonth--
                }) {
                    Icon(Icons.Default.ChevronLeft, "Previous", tint = GigColors.orange)
                }
                TextButton(onClick = {
                    viewYear = today.year; viewMonth = today.monthValue
                }) {
                    Text(
                        "${yearMonth.month.getDisplayName(TextStyle.FULL, Locale.getDefault())} $viewYear",
                        fontFamily = Karla,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        color = GigColors.text,
                    )
                }
                IconButton(onClick = {
                    if (viewMonth == 12) { viewMonth = 1; viewYear++ }
                    else viewMonth++
                }) {
                    Icon(Icons.Default.ChevronRight, "Next", tint = GigColors.orange)
                }
            }

            // Today button (when not viewing current month)
            if (!isCurrentMonth) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center,
                ) {
                    TextButton(
                        onClick = { viewYear = today.year; viewMonth = today.monthValue },
                        modifier = Modifier
                            .border(1.dp, GigColors.orange, RoundedCornerShape(10.dp)),
                    ) {
                        Text(
                            "Today",
                            fontFamily = Karla,
                            fontWeight = FontWeight.Bold,
                            fontSize = 10.sp,
                            color = GigColors.orange,
                        )
                    }
                }
            }

            // Day headers
            Row(modifier = Modifier.fillMaxWidth()) {
                listOf("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN").forEachIndexed { i, d ->
                    Text(
                        d,
                        modifier = Modifier.weight(1f),
                        textAlign = TextAlign.Center,
                        fontFamily = Karla,
                        fontWeight = FontWeight.Bold,
                        fontSize = 11.sp,
                        color = if (i >= 5) GigColors.textMuted else GigColors.textDim,
                    )
                }
            }

            Spacer(Modifier.height(4.dp))

            // Day grid
            val totalCells = offset + daysInMonth
            val rows = (totalCells + 6) / 7

            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(3.dp),
            ) {
                for (row in 0 until rows) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f),
                        horizontalArrangement = Arrangement.spacedBy(3.dp),
                    ) {
                        for (col in 0..6) {
                            val cellIndex = row * 7 + col
                            val day = cellIndex - offset + 1

                            if (day < 1 || day > daysInMonth) {
                                // Empty cell
                                Box(Modifier.weight(1f))
                            } else {
                                val isToday = viewYear == today.year &&
                                    viewMonth == today.monthValue &&
                                    day == today.dayOfMonth
                                val isPast = LocalDate.of(viewYear, viewMonth, day).isBefore(today)

                                val shape = RoundedCornerShape(6.dp)
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .clip(shape)
                                        .background(GigColors.shadowDark.copy(alpha = 0.3f))
                                        .then(
                                            if (isToday) Modifier
                                                .border(2.dp, GigColors.orange, shape)
                                                .shadow(8.dp, shape, ambientColor = GigColors.orange)
                                            else Modifier
                                                .border(1.dp, GigColors.neuBorder, shape)
                                        )
                                        .clickable {
                                            // TODO: open day detail
                                        }
                                        .padding(start = 3.dp, top = 3.dp),
                                    contentAlignment = Alignment.TopStart,
                                ) {
                                    Text(
                                        "$day",
                                        fontFamily = Karla,
                                        fontSize = 13.sp,
                                        color = when {
                                            isPast -> GigColors.textMuted
                                            else -> GigColors.text
                                        },
                                    )
                                }
                            }
                        }
                    }
                }
            }

            Spacer(Modifier.height(6.dp))

            // Legend
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 6.dp),
                horizontalArrangement = Arrangement.SpaceAround,
            ) {
                LegendItem(GigColors.calAvailable, "Available")
                LegendItem(GigColors.calGig, "Gig")
                LegendItem(GigColors.calPractice, "Practice")
                LegendItem(GigColors.calAway, "Away")
            }
        }
    }
}

@Composable
private fun LegendItem(color: androidx.compose.ui.graphics.Color, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .clip(RoundedCornerShape(4.dp))
                .background(color),
        )
        Text(
            label,
            modifier = Modifier.padding(start = 4.dp),
            fontFamily = Karla,
            fontSize = 10.sp,
            color = GigColors.textDim,
        )
    }
}

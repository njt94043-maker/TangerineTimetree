import React, { useState, useRef, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, PanResponder } from 'react-native';
import { COLORS, FONTS } from '../theme';
import { neuRaisedStyle } from '../theme/shadows';
import type { Gig, AwayDate, DayStatus } from '@shared/supabase/types';
import { computeDayStatus, isGigIncomplete } from '@shared/supabase/types';

interface GigCalendarProps {
  gigs: Gig[];
  awayDates: AwayDate[];
  totalMembers: number;
  onDatePress: (date: string) => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getMondayOffset(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return (day + 6) % 7;
}

function toISO(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const STATUS_COLORS: Record<DayStatus, string> = {
  available: COLORS.calAvailable,
  gig: COLORS.calGig,
  practice: COLORS.calPractice,
  partial: COLORS.calAway,
  unavailable: COLORS.calAway,
  past: 'transparent',
};

const CELL_SIZE = 42;

export function GigCalendar({ gigs, awayDates, totalMembers, onDatePress }: GigCalendarProps) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const offset = getMondayOffset(viewYear, viewMonth);

  function goToPrev() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  }

  function goToNext() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  }

  const goToPrevRef = useRef(goToPrev);
  goToPrevRef.current = goToPrev;
  const goToNextRef = useRef(goToNext);
  goToNextRef.current = goToNext;

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > Math.abs(gs.dy) && Math.abs(gs.dx) > 10,
    onPanResponderRelease: (_, gs) => {
      if (gs.dx > 50) goToPrevRef.current();
      else if (gs.dx < -50) goToNextRef.current();
    },
  }), []);

  // Build grid cells
  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }

  // Precompute gig lookup for incomplete indicator
  const gigsByDate = useMemo(() => {
    const map = new Map<string, Gig[]>();
    for (const g of gigs) {
      const existing = map.get(g.date) ?? [];
      existing.push(g);
      map.set(g.date, existing);
    }
    return map;
  }, [gigs]);

  return (
    <View style={styles.container}>
      {/* Month header */}
      <View style={styles.header}>
        <Pressable onPress={goToPrev} style={styles.arrowBtn} hitSlop={12}>
          <Text style={styles.arrow}>{'\u25C0'}</Text>
        </Pressable>
        <Text style={styles.monthYear}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </Text>
        <Pressable onPress={goToNext} style={styles.arrowBtn} hitSlop={12}>
          <Text style={styles.arrow}>{'\u25B6'}</Text>
        </Pressable>
      </View>

      {/* Day headers */}
      <View style={styles.row}>
        {DAY_HEADERS.map((d, i) => (
          <View key={d} style={styles.cell}>
            <Text style={[styles.dayHeader, i >= 5 && styles.weekendHeader]}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Day grid */}
      <View {...panResponder.panHandlers}>
        {rows.map((week, rowIdx) => (
          <View key={`week-${rowIdx}`} style={styles.row}>
            {week.map((day, colIdx) => {
              const cellIdx = rowIdx * 7 + colIdx;
              if (day === null) {
                return <View key={`empty-${cellIdx}`} style={styles.cell} />;
              }

              const iso = toISO(viewYear, viewMonth, day);
              const status = computeDayStatus(iso, today, gigs, awayDates, totalMembers);
              const isToday = iso === today;
              const dateGigs = gigsByDate.get(iso) ?? [];
              const hasIncomplete = dateGigs.some(isGigIncomplete);

              return (
                <Pressable
                  key={`day-${day}`}
                  style={styles.cell}
                  onPress={() => onDatePress(iso)}
                >
                  <View
                    style={[
                      styles.dayCircle,
                      status !== 'past' && { backgroundColor: STATUS_COLORS[status] + '30' },
                      isToday && styles.todayBorder,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        status === 'past' && styles.pastText,
                        status === 'gig' && styles.gigText,
                        status === 'practice' && styles.practiceText,
                        status === 'available' && styles.availableText,
                      ]}
                    >
                      {day}
                    </Text>
                    {/* Dot indicator for gigs */}
                    {status === 'gig' && (
                      <View style={[styles.dot, { backgroundColor: COLORS.calGig }]}>
                        {hasIncomplete && <View style={styles.incompleteDot} />}
                      </View>
                    )}
                    {/* Dot for practice */}
                    {status === 'practice' && (
                      <View style={[styles.dot, { backgroundColor: COLORS.calPractice }]} />
                    )}
                    {/* Dot for partial availability */}
                    {status === 'partial' && (
                      <View style={[styles.dot, { backgroundColor: COLORS.calAway }]} />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <LegendItem color={COLORS.calAvailable} label="Available" />
        <LegendItem color={COLORS.calGig} label="Gig" />
        <LegendItem color={COLORS.calPractice} label="Practice" />
        <LegendItem color={COLORS.calAway} label="Away" />
      </View>
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...neuRaisedStyle('normal'),
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  arrowBtn: { padding: 8 },
  arrow: { color: COLORS.teal, fontSize: 14 },
  monthYear: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: COLORS.text,
  },
  row: { flexDirection: 'row' },
  cell: {
    flex: 1,
    height: CELL_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 1,
  },
  dayHeader: {
    textAlign: 'center',
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    color: COLORS.textDim,
    textTransform: 'uppercase',
  },
  weekendHeader: { color: COLORS.textMuted },
  dayCircle: {
    width: CELL_SIZE - 4,
    height: CELL_SIZE - 4,
    borderRadius: (CELL_SIZE - 4) / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  todayBorder: {
    borderWidth: 2,
    borderColor: COLORS.teal,
  },
  dayText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.text,
  },
  pastText: { color: COLORS.textMuted },
  gigText: { color: COLORS.calGig, fontFamily: FONTS.bodyBold },
  practiceText: { color: COLORS.calPractice, fontFamily: FONTS.bodyBold },
  availableText: { color: COLORS.calAvailable },
  dot: {
    position: 'absolute',
    bottom: 2,
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  incompleteDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.danger,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.textMuted + '30',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  legendText: {
    fontFamily: FONTS.body,
    fontSize: 10,
    color: COLORS.textDim,
  },
});

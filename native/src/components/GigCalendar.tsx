import React, { useState, useRef, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, PanResponder } from 'react-native';
import { COLORS, FONTS } from '../theme';
import { neuRaisedStyle } from '../theme/shadows';
import type { Gig, AwayDate, DayStatus } from '@shared/supabase/types';
import { computeDayStatus, isGigIncomplete } from '@shared/supabase/types';

interface GigCalendarProps {
  gigs: Gig[];
  awayDates: AwayDate[];
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
  unavailable: COLORS.calAway,
  past: 'transparent',
};

export function GigCalendar({ gigs, awayDates, onDatePress }: GigCalendarProps) {
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

  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth();

  return (
    <View style={styles.container}>
      {/* Month header */}
      <View style={styles.header}>
        <Pressable onPress={goToPrev} style={styles.arrowBtn} hitSlop={12}>
          <Text style={styles.arrow}>{'\u25C0'}</Text>
        </Pressable>
        <Pressable onPress={() => { setViewYear(now.getFullYear()); setViewMonth(now.getMonth()); }}>
          <Text style={styles.monthYear}>
            {MONTH_NAMES[viewMonth]} {viewYear}
          </Text>
        </Pressable>
        <Pressable onPress={goToNext} style={styles.arrowBtn} hitSlop={12}>
          <Text style={styles.arrow}>{'\u25B6'}</Text>
        </Pressable>
      </View>
      {!isCurrentMonth && (
        <Pressable
          onPress={() => { setViewYear(now.getFullYear()); setViewMonth(now.getMonth()); }}
          style={styles.todayBtn}
        >
          <Text style={styles.todayBtnText}>Today</Text>
        </Pressable>
      )}

      {/* Day headers */}
      <View style={styles.dayHeaderRow}>
        {DAY_HEADERS.map((d, i) => (
          <View key={d} style={styles.headerCell}>
            <Text style={[styles.dayHeader, i >= 5 && styles.weekendHeader]}>{d.toUpperCase()}</Text>
          </View>
        ))}
      </View>

      {/* Day grid */}
      <View style={styles.grid} {...panResponder.panHandlers}>
        {rows.map((week, rowIdx) => (
          <View key={`week-${rowIdx}`} style={styles.gridRow}>
            {week.map((day, colIdx) => {
              const cellIdx = rowIdx * 7 + colIdx;
              if (day === null) {
                return <View key={`empty-${cellIdx}`} style={styles.cell} />;
              }

              const iso = toISO(viewYear, viewMonth, day);
              const status = computeDayStatus(iso, today, gigs, awayDates);
              const isToday = iso === today;
              const dateGigs = gigsByDate.get(iso) ?? [];

              // Venue words — split name into one word per line
              const venueWords = dateGigs.length > 0 ? (dateGigs[0].venue || '').split(/\s+/).filter(Boolean) : [];
              const venueColor = dateGigs.length > 0 && dateGigs[0].gig_type === 'practice' ? COLORS.calPractice : COLORS.calGig;

              return (
                <Pressable
                  key={`day-${day}`}
                  style={styles.cell}
                  onPress={() => onDatePress(iso)}
                >
                  <View
                    style={[
                      styles.dayRect,
                      status !== 'past' && status !== 'available' && {
                        backgroundColor: STATUS_COLORS[status] + '1A',
                        borderColor: STATUS_COLORS[status] + '26',
                      },
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
                    {/* Venue words — one per line, truncated */}
                    {venueWords.length > 0 && (
                      <View style={styles.venueWords}>
                        {venueWords.map((w, i) => (
                          <Text
                            key={i}
                            style={[styles.venueWord, { color: venueColor }]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {w}
                          </Text>
                        ))}
                      </View>
                    )}
                    {/* Dots — one per gig, max 2, colored by type */}
                    {dateGigs.length > 0 && (
                      <View style={styles.dotsRow}>
                        {dateGigs.slice(0, 2).map((g, i) => {
                          const color = g.gig_type === 'practice' ? COLORS.calPractice : COLORS.calGig;
                          const inc = g.gig_type !== 'practice' && isGigIncomplete(g);
                          return (
                            <View key={i} style={[styles.dot, { backgroundColor: color }]}>
                              {inc && <View style={styles.incompleteDot} />}
                            </View>
                          );
                        })}
                      </View>
                    )}
                    {/* Away dot (no gigs but member unavailable) */}
                    {status === 'unavailable' && dateGigs.length === 0 && (
                      <View style={styles.dotsRow}>
                        <View style={[styles.dot, { backgroundColor: COLORS.calAway }]} />
                      </View>
                    )}
                    {/* Count badge when >2 gigs */}
                    {dateGigs.length > 2 && (
                      <View style={styles.countBadge}>
                        <Text style={styles.countText}>+{dateGigs.length - 2}</Text>
                      </View>
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
    padding: 8,
    marginHorizontal: 8,
    marginVertical: 4,
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  arrowBtn: { padding: 8 },
  arrow: { color: COLORS.orange, fontSize: 18, fontWeight: '700' },
  monthYear: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: COLORS.text,
  },
  todayBtn: {
    alignSelf: 'center',
    backgroundColor: COLORS.green,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 3,
    marginBottom: 4,
  },
  todayBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: '#000',
    letterSpacing: 0.3,
  },
  dayHeaderRow: { flexDirection: 'row' },
  headerCell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 3,
  },
  grid: {
    flex: 1,
    gap: 3,
  },
  gridRow: {
    flexDirection: 'row',
    flex: 1,
    gap: 3,
  },
  cell: {
    flex: 1,
  },
  dayHeader: {
    textAlign: 'center',
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.textDim,
  },
  weekendHeader: { color: COLORS.textMuted },
  dayRect: {
    flex: 1,
    borderRadius: 6,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingTop: 3,
    paddingHorizontal: 3,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  todayBorder: {
    borderWidth: 2,
    borderColor: COLORS.orange,
  },
  dayText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.text,
  },
  pastText: { color: COLORS.textMuted },
  gigText: { color: COLORS.calGig, fontFamily: FONTS.bodyBold },
  practiceText: { color: COLORS.calPractice, fontFamily: FONTS.bodyBold },
  availableText: { color: COLORS.calAvailable },
  venueWords: {
    marginTop: 1,
    overflow: 'hidden',
    flex: 1,
  },
  venueWord: {
    fontFamily: FONTS.bodyBold,
    fontSize: 8,
    lineHeight: 10,
    opacity: 0.85,
  },
  dotsRow: {
    position: 'absolute',
    bottom: 2,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 2,
    justifyContent: 'center',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
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
  countBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countText: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    color: COLORS.text,
    fontWeight: '700',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 6,
    paddingTop: 6,
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

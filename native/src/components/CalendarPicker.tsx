import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, PanResponder } from 'react-native';
import { COLORS, FONTS } from '../theme';
import { neuRaisedStyle } from '../theme/shadows';
import { todayISO } from '../utils/formatDate';
import { NeuButton } from './NeuButton';

interface CalendarPickerProps {
  visible: boolean;
  selectedDate: string;
  onConfirm: (date: string) => void;
  onCancel: () => void;
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
  return (day + 6) % 7; // Monday=0, Sunday=6
}

function toISO(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const CELL_HEIGHT = 40;

export function CalendarPicker({ visible, selectedDate, onConfirm, onCancel }: CalendarPickerProps) {
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(0);
  const [tempDate, setTempDate] = useState(selectedDate);

  useEffect(() => {
    if (visible) {
      const d = new Date(selectedDate + 'T12:00:00');
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
      setTempDate(selectedDate);
    }
  }, [visible, selectedDate]);

  const today = todayISO();
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

  // Refs so PanResponder always calls latest versions
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

  function selectDay(day: number) {
    setTempDate(toISO(viewYear, viewMonth, day));
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  // Split cells into rows of 7 for reliable alignment
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={[styles.card, neuRaisedStyle('strong')]}>
          {/* Header */}
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

          {/* Day-of-week headers */}
          <View style={styles.row}>
            {DAY_HEADERS.map((d, i) => (
              <View key={d} style={styles.cell}>
                <Text style={[styles.dayHeader, i >= 5 && styles.weekendHeader]}>
                  {d}
                </Text>
              </View>
            ))}
          </View>

          {/* Day grid — explicit rows for guaranteed alignment */}
          <View {...panResponder.panHandlers}>
          {rows.map((week, rowIdx) => (
            <View key={`week-${rowIdx}`} style={styles.row}>
              {week.map((day, colIdx) => {
                const cellIdx = rowIdx * 7 + colIdx;
                if (day === null) {
                  return <View key={`empty-${cellIdx}`} style={styles.cell} />;
                }
                const iso = toISO(viewYear, viewMonth, day);
                const isSelected = iso === tempDate;
                const isToday = iso === today;
                const isWeekend = colIdx >= 5;

                return (
                  <Pressable
                    key={`day-${day}`}
                    style={styles.cell}
                    onPress={() => selectDay(day)}
                  >
                    <View
                      style={[
                        styles.dayCircle,
                        isSelected && styles.cellSelected,
                        isToday && !isSelected && styles.cellToday,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          isWeekend && !isSelected && styles.weekendText,
                          isSelected && styles.dayTextSelected,
                        ]}
                      >
                        {day}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <NeuButton label="Cancel" onPress={onCancel} small />
            <View style={{ width: 12 }} />
            <NeuButton label="Confirm" onPress={() => onConfirm(tempDate)} color={COLORS.teal} small />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  arrowBtn: {
    padding: 8,
  },
  arrow: {
    color: COLORS.teal,
    fontSize: 14,
  },
  monthYear: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: COLORS.text,
  },
  row: {
    flexDirection: 'row',
  },
  dayHeader: {
    textAlign: 'center',
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    color: COLORS.textDim,
    textTransform: 'uppercase',
  },
  weekendHeader: {
    color: COLORS.textMuted,
  },
  cell: {
    flex: 1,
    height: CELL_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
  },
  dayCircle: {
    width: CELL_HEIGHT - 4,
    height: CELL_HEIGHT - 4,
    borderRadius: (CELL_HEIGHT - 4) / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellSelected: {
    backgroundColor: COLORS.teal,
  },
  cellToday: {
    borderWidth: 1,
    borderColor: 'rgba(26,188,156,0.35)',
  },
  dayText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.text,
  },
  weekendText: {
    color: COLORS.textDim,
  },
  dayTextSelected: {
    color: '#ffffff',
    fontFamily: FONTS.bodyBold,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
  },
});

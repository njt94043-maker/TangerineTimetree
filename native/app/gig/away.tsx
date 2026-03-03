import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS } from '../../src/theme';
import { neuInsetStyle } from '../../src/theme/shadows';
import { NeuButton } from '../../src/components/NeuButton';
import { NeuCard } from '../../src/components/NeuCard';
import { CalendarPicker } from '../../src/components/CalendarPicker';
import { getMyAwayDates, createAwayDate, deleteAwayDate } from '@shared/supabase/queries';
import type { AwayDate } from '@shared/supabase/types';
import { TextInput } from 'react-native';

export default function AwayDatesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ date?: string }>();

  const [awayDates, setAwayDates] = useState<AwayDate[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [startDate, setStartDate] = useState(params.date ?? new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(params.date ?? new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [pickerTarget, setPickerTarget] = useState<'start' | 'end' | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchAwayDates = useCallback(async () => {
    try {
      const dates = await getMyAwayDates();
      setAwayDates(dates);
    } catch {
      // ignore
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchAwayDates();
    }, [fetchAwayDates]),
  );

  // Auto-show form if navigated from a date tap
  useEffect(() => {
    if (params.date) setShowForm(true);
  }, [params.date]);

  async function handleSave() {
    if (!startDate || !endDate) return;
    if (endDate < startDate) {
      Alert.alert('Invalid range', 'End date must be on or after start date');
      return;
    }
    setSaving(true);
    try {
      await createAwayDate({ start_date: startDate, end_date: endDate, reason });
      setShowForm(false);
      setReason('');
      fetchAwayDates();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    Alert.alert('Remove away date', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAwayDate(id);
            fetchAwayDates();
          } catch {
            Alert.alert('Error', 'Failed to delete');
          }
        },
      },
    ]);
  }

  function formatRange(start: string, end: string): string {
    const s = new Date(start + 'T12:00:00');
    const e = new Date(end + 'T12:00:00');
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    if (start === end) return s.toLocaleDateString('en-GB', { ...opts, year: 'numeric' });
    return `${s.toLocaleDateString('en-GB', opts)} - ${e.toLocaleDateString('en-GB', { ...opts, year: 'numeric' })}`;
  }

  function handleCalendarConfirm(date: string) {
    if (pickerTarget === 'start') {
      setStartDate(date);
      if (date > endDate) setEndDate(date);
    } else {
      setEndDate(date);
    }
    setPickerTarget(null);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.backText}>{'\u25C0'} Back</Text>
          </Pressable>
          <Text style={styles.title}>My Away Dates</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Existing away dates */}
        {awayDates.length === 0 && !showForm && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No away dates set</Text>
          </View>
        )}

        {awayDates.map(a => (
          <View key={a.id} style={[styles.awayCard, neuInsetStyle()]}>
            <View style={styles.awayCardContent}>
              <Text style={styles.awayRange}>{formatRange(a.start_date, a.end_date)}</Text>
              {a.reason ? <Text style={styles.awayReason}>{a.reason}</Text> : null}
            </View>
            <Pressable onPress={() => handleDelete(a.id)} hitSlop={8}>
              <Text style={styles.deleteBtn}>X</Text>
            </Pressable>
          </View>
        ))}

        {/* Add form */}
        {showForm ? (
          <View style={styles.formSection}>
            <Text style={styles.formTitle}>Add Away Period</Text>

            <Text style={styles.label}>FROM</Text>
            <Pressable onPress={() => setPickerTarget('start')}>
              <View style={[styles.fieldWrap, neuInsetStyle()]}>
                <Text style={styles.fieldText}>
                  {new Date(startDate + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' })}
                </Text>
              </View>
            </Pressable>

            <Text style={styles.label}>TO</Text>
            <Pressable onPress={() => setPickerTarget('end')}>
              <View style={[styles.fieldWrap, neuInsetStyle()]}>
                <Text style={styles.fieldText}>
                  {new Date(endDate + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' })}
                </Text>
              </View>
            </Pressable>

            <Text style={styles.label}>REASON (OPTIONAL)</Text>
            <View style={[styles.fieldWrap, neuInsetStyle()]}>
              <TextInput
                style={styles.input}
                placeholder="e.g. Holiday, family event"
                placeholderTextColor={COLORS.textMuted}
                value={reason}
                onChangeText={setReason}
              />
            </View>

            <View style={styles.formActions}>
              <NeuButton label="Cancel" onPress={() => setShowForm(false)} small />
              <View style={{ width: 12 }} />
              <NeuButton
                label={saving ? 'Saving...' : 'Save'}
                onPress={handleSave}
                color={COLORS.teal}
                small
              />
            </View>
          </View>
        ) : (
          <View style={styles.addBtnWrap}>
            <NeuButton label="Add Away Date" onPress={() => setShowForm(true)} color={COLORS.teal} />
          </View>
        )}
      </ScrollView>

      <CalendarPicker
        visible={pickerTarget !== null}
        selectedDate={pickerTarget === 'start' ? startDate : endDate}
        onConfirm={handleCalendarConfirm}
        onCancel={() => setPickerTarget(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: 12,
  },
  backText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.teal,
  },
  title: {
    fontFamily: FONTS.bodyBold,
    fontSize: 18,
    color: COLORS.text,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textDim,
  },
  awayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 10,
  },
  awayCardContent: { flex: 1 },
  awayRange: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: COLORS.text,
  },
  awayReason: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textDim,
    marginTop: 2,
  },
  deleteBtn: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: COLORS.danger,
    padding: 8,
  },
  formSection: {
    marginTop: 20,
  },
  formTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 12,
  },
  label: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    color: COLORS.textDim,
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 6,
    marginLeft: 2,
  },
  fieldWrap: {
    padding: 4,
  },
  fieldText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.text,
    padding: 12,
  },
  input: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.text,
    padding: 12,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  addBtnWrap: {
    marginTop: 20,
  },
});

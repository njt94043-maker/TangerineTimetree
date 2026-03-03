import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS } from '../../src/theme';
import { neuRaisedStyle, neuInsetStyle } from '../../src/theme/shadows';
import { NeuButton } from '../../src/components/NeuButton';
import { NeuCard } from '../../src/components/NeuCard';
import { CalendarPicker } from '../../src/components/CalendarPicker';
import { createGig, updateGig, deleteGig, getGigsByDate } from '@shared/supabase/queries';
import { supabase } from '../../src/supabase/client';
import type { Gig, GigType } from '@shared/supabase/types';

export default function GigFormScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ date?: string; gigId?: string; gigType?: string }>();

  const isEditing = !!params.gigId;
  const gigType: GigType = (params.gigType === 'practice') ? 'practice' : 'gig';
  const isPractice = gigType === 'practice';

  const [date, setDate] = useState(params.date ?? new Date().toISOString().split('T')[0]);
  const [venue, setVenue] = useState('');
  const [clientName, setClientName] = useState('');
  const [fee, setFee] = useState('');
  const [paymentType, setPaymentType] = useState<'cash' | 'invoice' | ''>('');
  const [loadTime, setLoadTime] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState('');
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load existing gig when editing
  useEffect(() => {
    if (params.gigId) {
      loadGig(params.gigId);
    }
  }, [params.gigId]);

  async function loadGig(gigId: string) {
    const { data, error } = await supabase.from('gigs').select('*').eq('id', gigId).single();
    if (data) {
      setDate(data.date);
      setVenue(data.venue ?? '');
      setClientName(data.client_name ?? '');
      setFee(data.fee != null ? String(data.fee) : '');
      setPaymentType(data.payment_type ?? '');
      setLoadTime(data.load_time ? data.load_time.slice(0, 5) : '');
      setStartTime(data.start_time ? data.start_time.slice(0, 5) : '');
      setEndTime(data.end_time ? data.end_time.slice(0, 5) : '');
      setNotes(data.notes ?? '');
    }
  }

  async function handleSave() {
    if (!date) return;
    setSaving(true);

    try {
      const gigData = {
        date,
        gig_type: gigType,
        venue,
        client_name: isPractice ? '' : clientName,
        fee: isPractice ? null : (fee ? parseFloat(fee) : null),
        payment_type: isPractice ? ('' as const) : paymentType,
        load_time: isPractice ? null : (loadTime || null),
        start_time: startTime || null,
        end_time: endTime || null,
        notes,
      };

      if (isEditing && params.gigId) {
        await updateGig(params.gigId, gigData);
      } else {
        await createGig(gigData);
      }
      router.back();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save gig');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!params.gigId) return;
    Alert.alert('Delete Gig', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteGig(params.gigId!);
            router.back();
          } catch (e) {
            Alert.alert('Error', 'Failed to delete gig');
          }
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.backText}>{'\u25C0'} Back</Text>
          </Pressable>
          <Text style={styles.title}>{isEditing ? (isPractice ? 'Edit Practice' : 'Edit Gig') : (isPractice ? 'New Practice' : 'New Gig')}</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Date field */}
        <Text style={styles.label}>DATE</Text>
        <Pressable onPress={() => setCalendarVisible(true)}>
          <View style={[styles.fieldWrap, neuInsetStyle()]}>
            <Text style={[styles.fieldText, !date && styles.placeholder]}>
              {date ? new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }) : 'Select date'}
            </Text>
          </View>
        </Pressable>

        {/* Venue */}
        <Text style={styles.label}>VENUE</Text>
        <View style={[styles.fieldWrap, neuInsetStyle()]}>
          <TextInput
            style={styles.input}
            placeholder="e.g. Gin & Juice, Mumbles"
            placeholderTextColor={COLORS.textMuted}
            value={venue}
            onChangeText={setVenue}
          />
        </View>

        {/* Client — gigs only */}
        {!isPractice && (
          <>
            <Text style={styles.label}>CLIENT / BOOKER</Text>
            <View style={[styles.fieldWrap, neuInsetStyle()]}>
              <TextInput
                style={styles.input}
                placeholder="e.g. Suave Agency"
                placeholderTextColor={COLORS.textMuted}
                value={clientName}
                onChangeText={setClientName}
              />
            </View>
          </>
        )}

        {/* Fee — gigs only */}
        {!isPractice && (
          <>
            <Text style={styles.label}>FEE</Text>
            <View style={[styles.fieldWrap, neuInsetStyle()]}>
              <TextInput
                style={styles.input}
                placeholder="e.g. 400"
                placeholderTextColor={COLORS.textMuted}
                value={fee}
                onChangeText={setFee}
                keyboardType="decimal-pad"
              />
            </View>
          </>
        )}

        {/* Payment type — gigs only */}
        {!isPractice && (
          <>
            <Text style={styles.label}>PAYMENT TYPE</Text>
            <View style={styles.toggleRow}>
              <Pressable
                style={[styles.toggleBtn, paymentType === 'cash' && styles.toggleActive]}
                onPress={() => setPaymentType('cash')}
              >
                <Text style={[styles.toggleText, paymentType === 'cash' && styles.toggleTextActive]}>Cash</Text>
              </Pressable>
              <View style={{ width: 10 }} />
              <Pressable
                style={[styles.toggleBtn, paymentType === 'invoice' && styles.toggleActive]}
                onPress={() => setPaymentType('invoice')}
              >
                <Text style={[styles.toggleText, paymentType === 'invoice' && styles.toggleTextActive]}>Invoice</Text>
              </Pressable>
            </View>
          </>
        )}

        {/* Load time — gigs only */}
        {!isPractice && (
          <>
            <Text style={styles.label}>LOAD-IN TIME</Text>
            <View style={[styles.fieldWrap, neuInsetStyle()]}>
              <TextInput
                style={styles.input}
                placeholder="e.g. 18:00"
                placeholderTextColor={COLORS.textMuted}
                value={loadTime}
                onChangeText={setLoadTime}
              />
            </View>
          </>
        )}

        {/* Start time */}
        <Text style={styles.label}>START TIME</Text>
        <View style={[styles.fieldWrap, neuInsetStyle()]}>
          <TextInput
            style={styles.input}
            placeholder="e.g. 21:00"
            placeholderTextColor={COLORS.textMuted}
            value={startTime}
            onChangeText={setStartTime}
          />
        </View>

        {/* End time */}
        <Text style={styles.label}>END TIME (OPTIONAL)</Text>
        <View style={[styles.fieldWrap, neuInsetStyle()]}>
          <TextInput
            style={styles.input}
            placeholder="e.g. 23:30"
            placeholderTextColor={COLORS.textMuted}
            value={endTime}
            onChangeText={setEndTime}
          />
        </View>

        {/* Notes */}
        <Text style={styles.label}>NOTES (OPTIONAL)</Text>
        <View style={[styles.fieldWrap, neuInsetStyle()]}>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Any extra details..."
            placeholderTextColor={COLORS.textMuted}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Save button */}
        <View style={styles.saveArea}>
          <NeuButton
            label={saving ? 'Saving...' : (isEditing ? (isPractice ? 'Update Practice' : 'Update Gig') : (isPractice ? 'Save Practice' : 'Save Gig'))}
            onPress={handleSave}
            color={isPractice ? COLORS.purple : COLORS.orange}
          />
          {isEditing && (
            <>
              <View style={{ height: 12 }} />
              <NeuButton label={isPractice ? 'Delete Practice' : 'Delete Gig'} onPress={handleDelete} color={COLORS.danger} />
            </>
          )}
        </View>
      </ScrollView>

      <CalendarPicker
        visible={calendarVisible}
        selectedDate={date}
        onConfirm={(d) => { setDate(d); setCalendarVisible(false); }}
        onCancel={() => setCalendarVisible(false)}
      />
    </KeyboardAvoidingView>
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
  label: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    color: COLORS.textDim,
    letterSpacing: 0.5,
    marginTop: 14,
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
  placeholder: {
    color: COLORS.textMuted,
  },
  input: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.text,
    padding: 12,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  toggleRow: {
    flexDirection: 'row',
  },
  toggleBtn: {
    flex: 1,
    ...neuRaisedStyle('normal'),
    padding: 12,
    alignItems: 'center',
  },
  toggleActive: {
    backgroundColor: COLORS.orange + '25',
    borderColor: COLORS.orange,
    borderWidth: 1,
  },
  toggleText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: COLORS.textDim,
  },
  toggleTextActive: {
    color: COLORS.orange,
  },
  saveArea: {
    marginTop: 24,
  },
});

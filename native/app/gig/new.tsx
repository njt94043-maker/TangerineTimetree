import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, Alert, KeyboardAvoidingView, Platform, ToastAndroid, Image, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WheelTimePicker } from '../../src/components/WheelTimePicker';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { COLORS, FONTS } from '../../src/theme';
import { neuRaisedStyle, neuInsetStyle } from '../../src/theme/shadows';
import { NeuButton } from '../../src/components/NeuButton';
import { NeuSelect } from '../../src/components/NeuSelect';
import { CalendarPicker } from '../../src/components/CalendarPicker';
import { createGig, updateGig, deleteGig, getGigAttachments, createGigAttachment, deleteGigAttachment, getGigFieldSuggestions, type GigFieldSuggestions } from '@shared/supabase/queries';
import { AutocompleteInput } from '../../src/components/AutocompleteInput';
import { EntityPicker } from '../../src/components/EntityPicker';
import { supabase } from '../../src/supabase/client';
import { isGigIncomplete } from '@shared/supabase/types';
import type { Gig, GigType, GigVisibility, GigAttachment } from '@shared/supabase/types';
import { isNetworkError, queueMutation } from '../../src/utils/offlineQueue';

const VISIBILITY_OPTIONS: { value: GigVisibility; label: string }[] = [
  { value: 'hidden', label: 'Not Shared' },
  { value: 'public', label: 'Public Gig' },
  { value: 'private', label: 'Private Booking' },
];

export default function GigFormScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ date?: string; gigId?: string; gigType?: string }>();

  const isEditing = !!params.gigId;
  const gigType: GigType = (params.gigType === 'practice') ? 'practice' : 'gig';
  const isPractice = gigType === 'practice';

  const [date, setDate] = useState(params.date ?? new Date().toISOString().split('T')[0]);
  const [venue, setVenue] = useState('');
  const [venueId, setVenueId] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientId, setClientId] = useState<string | null>(null);
  const [fee, setFee] = useState('');
  const [paymentType, setPaymentType] = useState<'cash' | 'invoice' | ''>('');
  const [loadTime, setLoadTime] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState('');
  const [visibility, setVisibility] = useState<GigVisibility>('hidden');
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [attachments, setAttachments] = useState<GigAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [timePickerTarget, setTimePickerTarget] = useState<'load' | 'start' | 'end' | null>(null);
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<GigFieldSuggestions>({ venues: [], clients: [], fees: [] });

  useEffect(() => {
    getGigFieldSuggestions().then(setSuggestions).catch(() => {});
  }, []);

  function handleTimeConfirm(val: string) {
    if (timePickerTarget === 'load') setLoadTime(val);
    else if (timePickerTarget === 'start') setStartTime(val);
    else if (timePickerTarget === 'end') setEndTime(val);
    setTimePickerTarget(null);
  }

  // Load existing gig when editing
  useEffect(() => {
    if (params.gigId) {
      loadGig(params.gigId);
    }
  }, [params.gigId]);

  async function loadGig(gigId: string) {
    const { data } = await supabase.from('gigs').select('*').eq('id', gigId).single();
    if (data) {
      setDate(data.date);
      setVenue(data.venue ?? '');
      setVenueId(data.venue_id ?? null);
      setClientName(data.client_name ?? '');
      setClientId(data.client_id ?? null);
      setFee(data.fee != null ? String(data.fee) : '');
      setPaymentType(data.payment_type ?? '');
      setLoadTime(data.load_time ? data.load_time.slice(0, 5) : '');
      setStartTime(data.start_time ? data.start_time.slice(0, 5) : '');
      setEndTime(data.end_time ? data.end_time.slice(0, 5) : '');
      setNotes(data.notes ?? '');
      setVisibility(data.visibility ?? 'hidden');
    }
    getGigAttachments(gigId).then(setAttachments).catch(() => {});
  }

  function buildGigData() {
    return {
      date,
      gig_type: gigType,
      venue,
      venue_id: isPractice ? null : venueId,
      client_name: isPractice ? '' : clientName,
      client_id: isPractice ? null : clientId,
      fee: isPractice ? null : (fee ? parseFloat(fee) : null),
      payment_type: isPractice ? ('' as const) : paymentType,
      load_time: isPractice ? null : (loadTime || null),
      start_time: startTime || null,
      end_time: endTime || null,
      notes,
      visibility: isPractice ? 'hidden' as GigVisibility : visibility,
    };
  }

  async function doSave() {
    setSaving(true);
    try {
      const gigData = buildGigData();
      if (isEditing && params.gigId) {
        await updateGig(params.gigId, gigData);
      } else {
        await createGig(gigData);
      }
      const msg = isEditing ? `${isPractice ? 'Practice' : 'Gig'} updated` : `${isPractice ? 'Practice' : 'Gig'} saved`;
      if (Platform.OS === 'android') {
        ToastAndroid.show(msg, ToastAndroid.SHORT);
      }
      router.back();
    } catch (e) {
      if (isNetworkError(e)) {
        const gigData = buildGigData();
        if (isEditing && params.gigId) {
          await queueMutation('updateGig', { id: params.gigId, updates: gigData });
        } else {
          await queueMutation('createGig', gigData);
        }
        if (Platform.OS === 'android') {
          ToastAndroid.show('Saved offline — will sync when connected', ToastAndroid.SHORT);
        }
        router.back();
        return;
      }
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save gig');
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (!date) return;

    const gigData = buildGigData();
    const checkGig = { ...gigData, id: '', created_by: '', created_at: '', updated_at: '', payment_type: gigData.payment_type || '' } as Gig;

    if (isGigIncomplete(checkGig)) {
      const missing: string[] = [];
      if (!venue) missing.push('venue');
      if (!isPractice && !clientName) missing.push('client');
      if (!isPractice && gigData.fee == null) missing.push('fee');
      if (!startTime) missing.push('start time');

      Alert.alert(
        'Incomplete',
        `This ${gigType} is missing: ${missing.join(', ')}.\n\nSave anyway? It will be marked INCOMPLETE.`,
        [
          { text: 'Go Back', style: 'cancel' },
          { text: 'Save Anyway', onPress: doSave },
        ],
      );
      return;
    }

    doSave();
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
            if (isNetworkError(e)) {
              await queueMutation('deleteGig', { id: params.gigId! });
              if (Platform.OS === 'android') {
                ToastAndroid.show('Queued for sync', ToastAndroid.SHORT);
              }
              router.back();
              return;
            }
            Alert.alert('Error', 'Failed to delete gig');
          }
        },
      },
    ]);
  }

  async function handleAddScreenshot() {
    if (!params.gigId || uploading) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (result.canceled || result.assets.length === 0) return;

    setUploading(true);
    for (const asset of result.assets) {
      try {
        // Compress
        const manipulated = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: 1200 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
        );
        const response = await fetch(manipulated.uri);
        const blob = await response.blob();
        const path = `${params.gigId}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;

        const { error: uploadErr } = await supabase.storage
          .from('gig-attachments')
          .upload(path, blob, { cacheControl: '31536000', upsert: false, contentType: 'image/jpeg' });

        if (uploadErr) continue;

        const { data: urlData } = await supabase.storage.from('gig-attachments').createSignedUrl(path, 60 * 60 * 24 * 365);
        const fileUrl = urlData?.signedUrl ?? '';
        await createGigAttachment(params.gigId!, fileUrl, path, blob.size);
      } catch { /* skip failed uploads */ }
    }
    setUploading(false);
    getGigAttachments(params.gigId!).then(setAttachments).catch(() => {});
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

        {/* Gig-only fields: Venue, Client, Fee, Payment, Load-in */}
        {!isPractice && (
          <>
            <Text style={styles.label}>VENUE</Text>
            <EntityPicker
              mode="venue"
              value={venue}
              entityId={venueId}
              onChange={(text, id) => { setVenue(text); setVenueId(id); }}
              placeholder="e.g. Gin & Juice, Mumbles"
            />

            <Text style={styles.label}>CLIENT / BOOKER</Text>
            <EntityPicker
              mode="client"
              value={clientName}
              entityId={clientId}
              onChange={(text, id) => { setClientName(text); setClientId(id); }}
              placeholder="e.g. Suave Agency"
            />

            <Text style={styles.label}>FEE</Text>
            <AutocompleteInput
              value={fee}
              onChangeText={setFee}
              suggestions={suggestions.fees.map(String)}
              placeholder="e.g. 400"
              keyboardType="decimal-pad"
            />

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

            <Text style={styles.label}>LOAD-IN TIME</Text>
            <Pressable onPress={() => setTimePickerTarget('load')}>
              <View style={[styles.fieldWrap, neuInsetStyle()]}>
                <Text style={[styles.fieldText, !loadTime && styles.placeholder]}>
                  {loadTime || 'Tap to set'}
                </Text>
              </View>
            </Pressable>
          </>
        )}

        {/* Start time */}
        <Text style={styles.label}>START TIME</Text>
        <Pressable onPress={() => setTimePickerTarget('start')}>
          <View style={[styles.fieldWrap, neuInsetStyle()]}>
            <Text style={[styles.fieldText, !startTime && styles.placeholder]}>
              {startTime || 'Tap to set'}
            </Text>
          </View>
        </Pressable>

        {/* End time */}
        <Text style={styles.label}>END TIME (OPTIONAL)</Text>
        <Pressable onPress={() => setTimePickerTarget('end')}>
          <View style={[styles.fieldWrap, neuInsetStyle()]}>
            <Text style={[styles.fieldText, !endTime && styles.placeholder]}>
              {endTime || 'Tap to set'}
            </Text>
          </View>
        </Pressable>

        {/* Practice-only: Location after time fields */}
        {isPractice && (
          <>
            <Text style={styles.label}>LOCATION (OPTIONAL)</Text>
            <AutocompleteInput
              value={venue}
              onChangeText={setVenue}
              suggestions={suggestions.venues}
              placeholder="e.g. Neil's garage"
            />
          </>
        )}

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

        {/* Website visibility — gigs only */}
        {!isPractice && (
          <>
            <Text style={styles.label}>WEBSITE VISIBILITY</Text>
            <NeuSelect
              value={visibility}
              options={VISIBILITY_OPTIONS}
              onChange={setVisibility}
            />
          </>
        )}

        {/* Attachments — only for saved gigs */}
        {isEditing && params.gigId && (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.label}>ATTACHMENTS</Text>
            {attachments.length > 0 && (
              <View style={styles.attachmentGrid}>
                {attachments.map(a => (
                  <Pressable key={a.id} onPress={() => setViewingImage(a.file_url)} onLongPress={() => {
                    Alert.alert('Delete', 'Delete this attachment?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: async () => {
                        try {
                          await deleteGigAttachment(a.id, a.storage_path);
                          getGigAttachments(params.gigId!).then(setAttachments).catch(() => {});
                        } catch { Alert.alert('Error', 'Failed to delete'); }
                      }},
                    ]);
                  }}>
                    <Image source={{ uri: a.file_url }} style={styles.attachmentThumb} />
                  </Pressable>
                ))}
              </View>
            )}
            <NeuButton
              label={uploading ? 'Uploading...' : '+ Add Screenshots'}
              onPress={handleAddScreenshot}
              color={COLORS.teal}
              small
            />
          </View>
        )}

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

      {/* Image lightbox */}
      <Modal visible={!!viewingImage} transparent animationType="fade" onRequestClose={() => setViewingImage(null)}>
        <Pressable style={styles.lightboxOverlay} onPress={() => setViewingImage(null)}>
          {viewingImage && (
            <Image source={{ uri: viewingImage }} style={styles.lightboxImage} resizeMode="contain" />
          )}
        </Pressable>
      </Modal>

      <WheelTimePicker
        visible={timePickerTarget !== null}
        title={timePickerTarget === 'load' ? 'Load-in Time' : timePickerTarget === 'start' ? 'Start Time' : 'End Time'}
        value={
          timePickerTarget === 'load' ? loadTime || '18:00'
          : timePickerTarget === 'start' ? startTime || '21:00'
          : endTime || '23:30'
        }
        onConfirm={handleTimeConfirm}
        onCancel={() => setTimePickerTarget(null)}
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
    fontSize: 14,
    color: COLORS.textDim,
  },
  toggleTextActive: {
    color: COLORS.orange,
  },
  attachmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  attachmentThumb: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: COLORS.card,
  },
  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxImage: {
    width: '90%',
    height: '80%',
  },
  saveArea: {
    marginTop: 24,
  },
});

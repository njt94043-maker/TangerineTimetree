import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, ScrollView, Image, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { NeuCard, NeuWell, NeuButton, StarRating } from '../../src/components';
import { COLORS, FONTS, LABEL } from '../../src/theme';
import { getVenue, updateVenue, deleteVenue, getVenuePhotos, uploadVenuePhoto, deleteVenuePhoto } from '../../src/db';
import type { VenuePhoto } from '../../src/db';
import { supabase } from '../../src/supabase/client';

export default function VenueDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [venueName, setVenueName] = useState('');
  const [address, setAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [ratingAtmosphere, setRatingAtmosphere] = useState<number | null>(null);
  const [ratingCrowd, setRatingCrowd] = useState<number | null>(null);
  const [ratingStage, setRatingStage] = useState<number | null>(null);
  const [ratingParking, setRatingParking] = useState<number | null>(null);
  const [photos, setPhotos] = useState<VenuePhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const originals = useRef({
    venueName: '', address: '', postcode: '', contactName: '', email: '', phone: '', notes: '',
    ratingAtmosphere: null as number | null, ratingCrowd: null as number | null,
    ratingStage: null as number | null, ratingParking: null as number | null,
  });

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const venue = await getVenue(id);
        if (venue) {
          setVenueName(venue.venue_name);
          setAddress(venue.address);
          setPostcode(venue.postcode);
          setContactName(venue.contact_name);
          setEmail(venue.email);
          setPhone(venue.phone);
          setNotes(venue.notes);
          setRatingAtmosphere(venue.rating_atmosphere);
          setRatingCrowd(venue.rating_crowd);
          setRatingStage(venue.rating_stage);
          setRatingParking(venue.rating_parking);
          originals.current = {
            venueName: venue.venue_name,
            address: venue.address,
            postcode: venue.postcode,
            contactName: venue.contact_name,
            email: venue.email,
            phone: venue.phone,
            notes: venue.notes,
            ratingAtmosphere: venue.rating_atmosphere,
            ratingCrowd: venue.rating_crowd,
            ratingStage: venue.rating_stage,
            ratingParking: venue.rating_parking,
          };
        }
        const photoList = await getVenuePhotos(id);
        setPhotos(photoList);
      } catch {
        Alert.alert('Error', 'Failed to load venue details.');
      }
      setLoaded(true);
    }
    load();
  }, [id]);

  async function handleSave() {
    if (!venueName.trim()) {
      Alert.alert('Required', 'Venue name is required.');
      return;
    }
    await updateVenue(id!, {
      venue_name: venueName.trim(),
      address: address.trim(),
      postcode: postcode.trim(),
      contact_name: contactName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      notes: notes.trim(),
      rating_atmosphere: ratingAtmosphere,
      rating_crowd: ratingCrowd,
      rating_stage: ratingStage,
      rating_parking: ratingParking,
    });
    router.back();
  }

  function handleDelete() {
    Alert.alert('Delete Venue', 'Are you sure? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteVenue(id!);
          router.back();
        },
      },
    ]);
  }

  function handleCancel() {
    const o = originals.current;
    const dirty = venueName !== o.venueName || address !== o.address || postcode !== o.postcode ||
      contactName !== o.contactName || email !== o.email || phone !== o.phone ||
      notes !== o.notes || ratingAtmosphere !== o.ratingAtmosphere || ratingCrowd !== o.ratingCrowd ||
      ratingStage !== o.ratingStage || ratingParking !== o.ratingParking;
    if (dirty) {
      Alert.alert('Unsaved Changes', 'You have unsaved changes. Discard?', [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      ]);
    } else {
      router.back();
    }
  }

  async function handleAddPhoto() {
    if (!id || uploading) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (result.canceled || result.assets.length === 0) return;

    setUploading(true);
    for (const asset of result.assets) {
      try {
        const manipulated = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: 1200 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
        );
        const response = await fetch(manipulated.uri);
        const blob = await response.blob();
        const path = `venues/${id}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;

        const { error: uploadErr } = await supabase.storage
          .from('venue-photos')
          .upload(path, blob, { cacheControl: '31536000', upsert: false, contentType: 'image/jpeg' });

        if (uploadErr) continue;

        const { data: urlData } = supabase.storage.from('venue-photos').getPublicUrl(path);
        await uploadVenuePhoto(id!, urlData.publicUrl, path);
      } catch { /* skip failed uploads */ }
    }
    setUploading(false);
    getVenuePhotos(id!).then(setPhotos).catch(() => {});
  }

  function handleDeletePhoto(photo: VenuePhoto) {
    Alert.alert('Delete Photo', 'Remove this photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteVenuePhoto(photo.id, photo.storage_path);
          setPhotos(prev => prev.filter(p => p.id !== photo.id));
        },
      },
    ]);
  }

  if (!loaded) return <View style={styles.container} />;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <NeuButton label="Cancel" onPress={handleCancel} small />
          <Text style={styles.title}>Edit Venue</Text>
          <NeuButton label="Save" onPress={handleSave} color={COLORS.teal} small />
        </View>

        {/* Venue Details */}
        <NeuCard>
          <Text style={LABEL}>VENUE DETAILS</Text>
          <View style={{ height: 8 }} />

          <Text style={styles.fieldLabel}>Venue Name *</Text>
          <NeuWell style={styles.inputWell}>
            <TextInput style={styles.input} value={venueName} onChangeText={setVenueName} placeholderTextColor={COLORS.textMuted} />
          </NeuWell>

          <Text style={styles.fieldLabel}>Address</Text>
          <NeuWell style={styles.inputWell}>
            <TextInput style={[styles.input, { minHeight: 60 }]} value={address} onChangeText={setAddress} multiline numberOfLines={3} textAlignVertical="top" placeholderTextColor={COLORS.textMuted} />
          </NeuWell>

          <Text style={styles.fieldLabel}>Postcode</Text>
          <NeuWell style={styles.inputWell}>
            <TextInput style={styles.input} value={postcode} onChangeText={setPostcode} autoCapitalize="characters" placeholderTextColor={COLORS.textMuted} />
          </NeuWell>
        </NeuCard>

        {/* Contact Info */}
        <NeuCard>
          <Text style={LABEL}>CONTACT INFO</Text>
          <View style={{ height: 8 }} />

          <Text style={styles.fieldLabel}>Contact Name</Text>
          <NeuWell style={styles.inputWell}>
            <TextInput style={styles.input} value={contactName} onChangeText={setContactName} placeholder="e.g. John Smith" placeholderTextColor={COLORS.textMuted} />
          </NeuWell>

          <Text style={styles.fieldLabel}>Email</Text>
          <NeuWell style={styles.inputWell}>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="e.g. bookings@venue.com" placeholderTextColor={COLORS.textMuted} keyboardType="email-address" autoCapitalize="none" />
          </NeuWell>

          <Text style={styles.fieldLabel}>Phone</Text>
          <NeuWell style={styles.inputWell}>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="e.g. 01234 567890" placeholderTextColor={COLORS.textMuted} keyboardType="phone-pad" />
          </NeuWell>
        </NeuCard>

        {/* Ratings */}
        <NeuCard>
          <Text style={LABEL}>RATINGS</Text>
          <View style={{ height: 8 }} />
          <StarRating label="Atmosphere" value={ratingAtmosphere} onChange={setRatingAtmosphere} />
          <StarRating label="Crowd" value={ratingCrowd} onChange={setRatingCrowd} />
          <StarRating label="Stage" value={ratingStage} onChange={setRatingStage} />
          <StarRating label="Parking" value={ratingParking} onChange={setRatingParking} />
        </NeuCard>

        {/* Notes */}
        <NeuCard>
          <Text style={LABEL}>NOTES</Text>
          <View style={{ height: 8 }} />
          <NeuWell style={styles.inputWell}>
            <TextInput
              style={[styles.input, { minHeight: 80 }]}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              placeholder="Notes about this venue..."
              placeholderTextColor={COLORS.textMuted}
            />
          </NeuWell>
        </NeuCard>

        {/* Photos */}
        <NeuCard>
          <Text style={LABEL}>PHOTOS</Text>
          <View style={{ height: 8 }} />

          {photos.length > 0 && (
            <View style={styles.photoGrid}>
              {photos.map(photo => (
                <View key={photo.id} style={styles.photoItem}>
                  <Image source={{ uri: photo.file_url }} style={styles.photoImage} />
                  <Pressable style={styles.photoDelete} onPress={() => handleDeletePhoto(photo)}>
                    <Text style={styles.photoDeleteText}>✕</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {photos.length === 0 && !uploading && (
            <Text style={styles.emptyText}>No photos yet</Text>
          )}

          {uploading && (
            <View style={styles.uploadingRow}>
              <ActivityIndicator size="small" color={COLORS.green} />
              <Text style={styles.uploadingText}>Uploading...</Text>
            </View>
          )}

          <NeuButton
            label="+ Add Photo"
            onPress={handleAddPhoto}
            color={COLORS.teal}
            small
            style={{ marginTop: 8 }}
          />
        </NeuCard>

        <NeuButton label="Delete Venue" onPress={handleDelete} color={COLORS.danger} style={{ marginTop: 16, marginBottom: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontFamily: FONTS.bodyBold, fontSize: 18, color: COLORS.text },
  fieldLabel: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.textDim, marginBottom: 4, marginTop: 8 },
  inputWell: { padding: 0 },
  input: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.text, padding: 10 },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoItem: {
    width: '48%' as unknown as number,
    aspectRatio: 4 / 3,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  photoDelete: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoDeleteText: {
    color: COLORS.danger,
    fontSize: 14,
    fontFamily: FONTS.bodyBold,
  },
  emptyText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textDim,
    fontStyle: 'italic',
  },
  uploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  uploadingText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textDim,
  },
});

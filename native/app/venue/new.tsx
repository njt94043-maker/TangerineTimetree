import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NeuCard, NeuWell, NeuButton } from '../../src/components';
import { COLORS, FONTS, LABEL } from '../../src/theme';
import { addVenue } from '../../src/db';

export default function NewVenueScreen() {
  const router = useRouter();
  const [venueName, setVenueName] = useState('');
  const [address, setAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  async function handleSave() {
    if (!venueName.trim()) {
      Alert.alert('Required', 'Venue name is required.');
      return;
    }
    await addVenue({
      venue_name: venueName.trim(),
      address: address.trim(),
      postcode: postcode.trim(),
      contact_name: contactName.trim(),
      email: email.trim(),
      phone: phone.trim(),
    });
    router.back();
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <NeuButton label="Cancel" onPress={() => router.back()} small />
          <Text style={styles.title}>New Venue</Text>
          <NeuButton label="Save" onPress={handleSave} color={COLORS.teal} small />
        </View>

        <NeuCard>
          <Text style={LABEL}>VENUE DETAILS</Text>
          <View style={{ height: 8 }} />

          <Text style={styles.fieldLabel}>Venue Name *</Text>
          <NeuWell style={styles.inputWell}>
            <TextInput style={styles.input} value={venueName} onChangeText={setVenueName} placeholder="e.g. The Rose & Crown" placeholderTextColor={COLORS.textMuted} />
          </NeuWell>

          <Text style={styles.fieldLabel}>Address</Text>
          <NeuWell style={styles.inputWell}>
            <TextInput style={[styles.input, { minHeight: 60 }]} value={address} onChangeText={setAddress} placeholder="Full address" placeholderTextColor={COLORS.textMuted} multiline numberOfLines={3} textAlignVertical="top" />
          </NeuWell>

          <Text style={styles.fieldLabel}>Postcode</Text>
          <NeuWell style={styles.inputWell}>
            <TextInput style={styles.input} value={postcode} onChangeText={setPostcode} placeholder="e.g. SW1A 1AA" placeholderTextColor={COLORS.textMuted} autoCapitalize="characters" />
          </NeuWell>
        </NeuCard>

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
});

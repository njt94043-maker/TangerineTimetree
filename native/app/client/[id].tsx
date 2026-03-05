import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NeuCard, NeuWell, NeuButton } from '../../src/components';
import { COLORS, FONTS, LABEL } from '../../src/theme';
import { getClient, updateClient, deleteClient } from '../../src/db';

export default function EditClientScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loaded, setLoaded] = useState(false);
  const originals = useRef({ companyName: '', contactName: '', address: '', email: '', phone: '' });

  useEffect(() => {
    async function load() {
      if (!id) return;
      const client = await getClient(id);
      if (client) {
        setCompanyName(client.company_name);
        setContactName(client.contact_name);
        setAddress(client.address);
        setEmail(client.email);
        setPhone(client.phone);
        originals.current = {
          companyName: client.company_name,
          contactName: client.contact_name,
          address: client.address,
          email: client.email,
          phone: client.phone,
        };
      }
      setLoaded(true);
    }
    load();
  }, [id]);

  async function handleSave() {
    if (!companyName.trim()) {
      Alert.alert('Required', 'Company name is required.');
      return;
    }
    await updateClient(id!, {
      company_name: companyName.trim(),
      contact_name: contactName.trim(),
      address: address.trim(),
      email: email.trim(),
      phone: phone.trim(),
    });
    router.back();
  }

  function handleDelete() {
    Alert.alert('Delete Client', 'Are you sure? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteClient(id!);
          router.back();
        },
      },
    ]);
  }

  function handleCancel() {
    const o = originals.current;
    const dirty = companyName !== o.companyName || contactName !== o.contactName || address !== o.address || email !== o.email || phone !== o.phone;
    if (dirty) {
      Alert.alert('Unsaved Changes', 'You have unsaved changes. Discard?', [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      ]);
    } else {
      router.back();
    }
  }

  if (!loaded) return <View style={styles.container} />;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <NeuButton label="Cancel" onPress={handleCancel} small />
          <Text style={styles.title}>Edit Client</Text>
          <NeuButton label="Save" onPress={handleSave} color={COLORS.teal} small />
        </View>

        <NeuCard>
          <Text style={LABEL}>CLIENT DETAILS</Text>
          <View style={{ height: 8 }} />

          <Text style={styles.fieldLabel}>Company Name *</Text>
          <NeuWell style={styles.inputWell}>
            <TextInput style={styles.input} value={companyName} onChangeText={setCompanyName} placeholderTextColor={COLORS.textMuted} />
          </NeuWell>

          <Text style={styles.fieldLabel}>Contact Name</Text>
          <NeuWell style={styles.inputWell}>
            <TextInput style={styles.input} value={contactName} onChangeText={setContactName} placeholderTextColor={COLORS.textMuted} />
          </NeuWell>

          <Text style={styles.fieldLabel}>Address</Text>
          <NeuWell style={styles.inputWell}>
            <TextInput style={[styles.input, { minHeight: 60 }]} value={address} onChangeText={setAddress} multiline numberOfLines={3} textAlignVertical="top" placeholderTextColor={COLORS.textMuted} />
          </NeuWell>

          <Text style={styles.fieldLabel}>Email</Text>
          <NeuWell style={styles.inputWell}>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" placeholderTextColor={COLORS.textMuted} />
          </NeuWell>

          <Text style={styles.fieldLabel}>Phone</Text>
          <NeuWell style={styles.inputWell}>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholderTextColor={COLORS.textMuted} />
          </NeuWell>
        </NeuCard>

        <NeuButton label="Delete Client" onPress={handleDelete} color={COLORS.danger} style={{ marginTop: 16 }} />
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

import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { NeuCard, NeuWell, NeuButton } from '../../src/components';
import { COLORS, FONTS, LABEL } from '../../src/theme';
import { createSetlist } from '../../src/db';

export default function NewSetlistScreen() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');

  async function handleSave() {
    if (!name.trim()) { setError('Setlist name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const created = await createSetlist({ name: name.trim(), description: description.trim(), notes: notes.trim() });
      router.replace({ pathname: '/setlist/[id]', params: { id: created.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <NeuButton label="Cancel" onPress={() => router.back()} small />
        <Text style={styles.title}>New Setlist</Text>
        <NeuButton label={saving ? 'Creating...' : 'Create'} onPress={handleSave} color={COLORS.green} small disabled={saving} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <NeuCard>
        <Text style={LABEL}>SETLIST NAME *</Text>
        <NeuWell style={styles.well}>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Friday Night Set" placeholderTextColor={COLORS.textMuted} />
        </NeuWell>

        <Text style={LABEL}>DESCRIPTION</Text>
        <NeuWell style={styles.well}>
          <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="Optional" placeholderTextColor={COLORS.textMuted} />
        </NeuWell>

        <Text style={LABEL}>NOTES</Text>
        <NeuWell style={styles.well}>
          <TextInput style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]} value={notes} onChangeText={setNotes} placeholder="Performance notes..." placeholderTextColor={COLORS.textMuted} multiline numberOfLines={3} />
        </NeuWell>
      </NeuCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 80 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontFamily: FONTS.bodyBold, fontSize: 17, color: COLORS.text },
  error: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.danger, marginBottom: 8 },
  well: { padding: 0, marginBottom: 4 },
  input: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.text, padding: 10 },
});

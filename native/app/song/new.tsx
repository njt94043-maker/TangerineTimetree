import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { NeuCard, NeuWell, NeuButton, NeuSelect } from '../../src/components';
import { COLORS, FONTS, LABEL } from '../../src/theme';
import { createSong } from '../../src/db';
import type { ClickSound } from '../../src/db';

const CLICK_SOUNDS: ClickSound[] = ['default', 'high', 'low', 'wood', 'rim'];
const TIME_SIG_TOPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12];
const TIME_SIG_BOTTOMS = [2, 4, 8, 16];

export default function NewSongScreen() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [artist, setArtist] = useState('');
  const [bpm, setBpm] = useState('120');
  const [timeSigTop, setTimeSigTop] = useState(4);
  const [timeSigBottom, setTimeSigBottom] = useState(4);
  const [subdivision, setSubdivision] = useState(1);
  const [swingPercent, setSwingPercent] = useState('50');
  const [clickSound, setClickSound] = useState<ClickSound>('default');
  const [countInBars, setCountInBars] = useState(1);
  const [durationSeconds, setDurationSeconds] = useState('');
  const [key, setKey] = useState('');
  const [notes, setNotes] = useState('');

  async function handleSave() {
    if (!name.trim()) { setError('Song name is required'); return; }
    const bpmNum = parseFloat(bpm);
    if (isNaN(bpmNum) || bpmNum < 20 || bpmNum > 400) { setError('BPM must be 20-400'); return; }

    setSaving(true);
    setError('');
    try {
      await createSong({
        name: name.trim(),
        artist: artist.trim(),
        bpm: bpmNum,
        time_signature_top: timeSigTop,
        time_signature_bottom: timeSigBottom,
        subdivision,
        swing_percent: parseFloat(swingPercent) || 50,
        click_sound: clickSound,
        count_in_bars: countInBars,
        duration_seconds: durationSeconds ? parseInt(durationSeconds) : null,
        key: key.trim(),
        notes: notes.trim(),
      });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <NeuButton label="Cancel" onPress={() => router.back()} small />
        <Text style={styles.title}>New Song</Text>
        <NeuButton label={saving ? 'Saving...' : 'Save'} onPress={handleSave} color={COLORS.green} small disabled={saving} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <NeuCard>
        <Text style={LABEL}>SONG NAME *</Text>
        <NeuWell style={styles.well}>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Sweet Child O' Mine" placeholderTextColor={COLORS.textMuted} />
        </NeuWell>

        <Text style={LABEL}>ARTIST</Text>
        <NeuWell style={styles.well}>
          <TextInput style={styles.input} value={artist} onChangeText={setArtist} placeholder="e.g. Guns N' Roses" placeholderTextColor={COLORS.textMuted} />
        </NeuWell>

        <Text style={LABEL}>KEY</Text>
        <NeuWell style={styles.well}>
          <TextInput style={styles.input} value={key} onChangeText={setKey} placeholder="e.g. D major" placeholderTextColor={COLORS.textMuted} />
        </NeuWell>

        <Text style={LABEL}>DURATION (SECONDS)</Text>
        <NeuWell style={styles.well}>
          <TextInput style={styles.input} value={durationSeconds} onChangeText={setDurationSeconds} placeholder="e.g. 240" placeholderTextColor={COLORS.textMuted} keyboardType="number-pad" />
        </NeuWell>
      </NeuCard>

      <NeuCard>
        <Text style={styles.sectionTitle}>Metronome</Text>

        <View style={styles.row2}>
          <View style={styles.col}>
            <Text style={LABEL}>BPM *</Text>
            <NeuWell style={styles.well}>
              <TextInput style={styles.input} value={bpm} onChangeText={setBpm} keyboardType="decimal-pad" />
            </NeuWell>
          </View>
          <View style={styles.col}>
            <Text style={LABEL}>TIME SIGNATURE</Text>
            <View style={styles.timeSigRow}>
              <View style={{ flex: 1 }}>
                <NeuSelect
                  value={String(timeSigTop)}
                  options={TIME_SIG_TOPS.map(n => ({ label: String(n), value: String(n) }))}
                  onChange={v => setTimeSigTop(Number(v))}
                />
              </View>
              <Text style={styles.timeSigSlash}>/</Text>
              <View style={{ flex: 1 }}>
                <NeuSelect
                  value={String(timeSigBottom)}
                  options={TIME_SIG_BOTTOMS.map(n => ({ label: String(n), value: String(n) }))}
                  onChange={v => setTimeSigBottom(Number(v))}
                />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.row2}>
          <View style={styles.col}>
            <Text style={LABEL}>SUBDIVISION</Text>
            <NeuSelect
              value={String(subdivision)}
              options={[
                { label: 'Quarter', value: '1' },
                { label: 'Eighth', value: '2' },
                { label: 'Triplet', value: '3' },
                { label: '16th', value: '4' },
              ]}
              onChange={v => setSubdivision(Number(v))}
            />
          </View>
          <View style={styles.col}>
            <Text style={LABEL}>SWING %</Text>
            <NeuWell style={styles.well}>
              <TextInput style={styles.input} value={swingPercent} onChangeText={setSwingPercent} keyboardType="number-pad" />
            </NeuWell>
          </View>
        </View>

        <View style={styles.row2}>
          <View style={styles.col}>
            <Text style={LABEL}>CLICK SOUND</Text>
            <NeuSelect
              value={clickSound}
              options={CLICK_SOUNDS.map(s => ({ label: s.charAt(0).toUpperCase() + s.slice(1), value: s }))}
              onChange={v => setClickSound(v as ClickSound)}
            />
          </View>
          <View style={styles.col}>
            <Text style={LABEL}>COUNT-IN BARS</Text>
            <NeuSelect
              value={String(countInBars)}
              options={[0, 1, 2, 4, 8].map(n => ({ label: n === 0 ? 'None' : `${n}`, value: String(n) }))}
              onChange={v => setCountInBars(Number(v))}
            />
          </View>
        </View>
      </NeuCard>

      <NeuCard>
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
  sectionTitle: { fontFamily: FONTS.bodyBold, fontSize: 13, color: COLORS.green, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  well: { padding: 0, marginBottom: 4 },
  input: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.text, padding: 10 },
  row2: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  col: { flex: 1 },
  timeSigRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeSigSlash: { fontFamily: FONTS.body, fontSize: 16, color: COLORS.textDim },
});

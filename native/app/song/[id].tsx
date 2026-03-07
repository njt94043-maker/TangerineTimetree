import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { NeuCard, NeuWell, NeuButton, NeuSelect } from '../../src/components';
import { COLORS, FONTS, LABEL } from '../../src/theme';
import { getSong, updateSong, deleteSong, uploadPracticeTrack, deletePracticeTrack } from '../../src/db';
import type { Song, ClickSound } from '../../src/db';
import { useAuth } from '../../src/supabase/AuthContext';

const CLICK_SOUNDS: ClickSound[] = ['default', 'high', 'low', 'wood', 'rim'];
const TIME_SIG_TOPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12];
const TIME_SIG_BOTTOMS = [2, 4, 8, 16];

export default function EditSongScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const isDrummer = profile?.band_role === 'Drums';
  const [loaded, setLoaded] = useState(false);
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
  const [lyrics, setLyrics] = useState('');
  const [chords, setChords] = useState('');

  // Audio track
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioUploading, setAudioUploading] = useState(false);
  const [audioError, setAudioError] = useState('');

  useEffect(() => {
    if (!id) return;
    getSong(id).then(song => {
      if (!song) { setError('Song not found'); setLoaded(true); return; }
      setName(song.name);
      setArtist(song.artist);
      setBpm(String(song.bpm));
      setTimeSigTop(song.time_signature_top);
      setTimeSigBottom(song.time_signature_bottom);
      setSubdivision(song.subdivision);
      setSwingPercent(String(song.swing_percent));
      setClickSound(song.click_sound);
      setCountInBars(song.count_in_bars);
      setDurationSeconds(song.duration_seconds ? String(song.duration_seconds) : '');
      setKey(song.key);
      setNotes(song.notes);
      setLyrics(song.lyrics);
      setChords(song.chords);
      setAudioUrl(song.audio_url);
      setLoaded(true);
    }).catch(err => {
      setError(err instanceof Error ? err.message : 'Failed to load');
      setLoaded(true);
    });
  }, [id]);

  async function handleSave() {
    if (!name.trim()) { setError('Song name is required'); return; }
    const bpmNum = parseFloat(bpm);
    if (isNaN(bpmNum) || bpmNum < 20 || bpmNum > 400) { setError('BPM must be 20-400'); return; }

    setSaving(true);
    setError('');
    try {
      await updateSong(id!, {
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
        lyrics: lyrics.trim(),
        chords: chords.trim(),
      });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    Alert.alert('Delete Song', `Delete "${name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deleteSong(id!);
            router.back();
          } catch {
            Alert.alert('Error', 'Failed to delete song');
          }
        },
      },
    ]);
  }

  async function handlePickAudio() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-m4a', 'audio/mp4'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setAudioUploading(true);
      setAudioError('');

      const fileInfo = await FileSystem.getInfoAsync(asset.uri);
      if (!fileInfo.exists) { setAudioError('File not found'); setAudioUploading(false); return; }

      // Read file as base64 and convert to ArrayBuffer
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

      const url = await uploadPracticeTrack(id!, asset.name, bytes.buffer as ArrayBuffer, asset.mimeType ?? 'audio/mpeg');
      setAudioUrl(url);
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setAudioUploading(false);
    }
  }

  function handleRemoveAudio() {
    Alert.alert('Remove Track', 'Delete the practice track from cloud storage?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deletePracticeTrack(id!);
            setAudioUrl(null);
          } catch (err) {
            setAudioError(err instanceof Error ? err.message : 'Failed to remove');
          }
        },
      },
    ]);
  }

  if (!loaded) return <View style={styles.container}><Text style={styles.emptyText}>Loading...</Text></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <NeuButton label="Cancel" onPress={() => router.back()} small />
        <Text style={styles.title}>Edit Song</Text>
        <NeuButton label={saving ? 'Saving...' : 'Save'} onPress={handleSave} color={COLORS.green} small disabled={saving} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <NeuCard>
        <Text style={LABEL}>SONG NAME *</Text>
        <NeuWell style={styles.well}>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Song name" placeholderTextColor={COLORS.textMuted} />
        </NeuWell>

        <Text style={LABEL}>ARTIST</Text>
        <NeuWell style={styles.well}>
          <TextInput style={styles.input} value={artist} onChangeText={setArtist} placeholder="Artist" placeholderTextColor={COLORS.textMuted} />
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
      </NeuCard>

      {isDrummer && (
        <NeuCard>
          <Text style={styles.sectionTitle}>Metronome</Text>

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
      )}

      <NeuCard>
        <Text style={LABEL}>CHORDS</Text>
        <NeuWell style={styles.well}>
          <TextInput style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]} value={chords} onChangeText={setChords} placeholder="e.g. Am - F - C - G" placeholderTextColor={COLORS.textMuted} multiline numberOfLines={3} />
        </NeuWell>

        <Text style={LABEL}>LYRICS</Text>
        <NeuWell style={styles.well}>
          <TextInput style={[styles.input, { minHeight: 100, textAlignVertical: 'top' }]} value={lyrics} onChangeText={setLyrics} placeholder="Song lyrics..." placeholderTextColor={COLORS.textMuted} multiline numberOfLines={5} />
        </NeuWell>
      </NeuCard>

      <NeuCard>
        <Text style={LABEL}>NOTES</Text>
        <NeuWell style={styles.well}>
          <TextInput style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]} value={notes} onChangeText={setNotes} placeholder="Performance notes..." placeholderTextColor={COLORS.textMuted} multiline numberOfLines={3} />
        </NeuWell>
      </NeuCard>

      <NeuCard>
        <Text style={styles.sectionTitle}>Practice Track</Text>
        {audioUploading ? (
          <View style={styles.audioRow}>
            <ActivityIndicator color={COLORS.teal} />
            <Text style={styles.audioStatus}>Uploading...</Text>
          </View>
        ) : audioUrl ? (
          <View>
            <View style={styles.audioRow}>
              <Text style={styles.audioAttached}>Track attached</Text>
            </View>
            <View style={styles.audioActions}>
              <NeuButton label="Replace Track" onPress={handlePickAudio} color={COLORS.orange} small />
              <NeuButton label="Remove" onPress={handleRemoveAudio} color={COLORS.danger} small />
            </View>
          </View>
        ) : (
          <NeuButton label="+ Add MP3 / Audio" onPress={handlePickAudio} color={COLORS.teal} small />
        )}
        {audioError ? <Text style={styles.audioErrorText}>{audioError}</Text> : null}
      </NeuCard>

      <NeuButton label="Delete Song" onPress={handleDelete} color={COLORS.danger} style={{ marginTop: 12 }} />
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
  emptyText: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textDim, textAlign: 'center', marginTop: 40 },
  audioRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  audioAttached: { fontFamily: FONTS.bodyBold, fontSize: 13, color: COLORS.green },
  audioStatus: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textDim },
  audioActions: { flexDirection: 'row', gap: 8 },
  audioErrorText: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.danger, marginTop: 6 },
});

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, Pressable, StyleSheet, Alert, Modal, FlatList,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { NeuCard, NeuWell, NeuButton } from '../../src/components';
import { COLORS, FONTS, LABEL } from '../../src/theme';
import {
  getSetlistWithSongs, updateSetlist, getSongs, setSetlistSongs,
  removeSongFromSetlist, deleteSetlist,
} from '../../src/db';
import type { SetlistWithSongs, SetlistSongWithDetails, Song } from '../../src/db';
import { getSetlistHtml } from '@shared/templates';
import { generateAndSharePdf } from '../../src/pdf/generatePdf';

export default function SetlistDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [setlist, setSetlist] = useState<SetlistWithSongs | null>(null);
  const [error, setError] = useState('');

  // Edit meta
  const [editingMeta, setEditingMeta] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');

  // Add song modal
  const [showAddSong, setShowAddSong] = useState(false);
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [songSearch, setSongSearch] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getSetlistWithSongs(id);
      if (!data) { setError('Setlist not found'); return; }
      setSetlist(data);
      setName(data.name);
      setDescription(data.description);
      setNotes(data.notes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleSaveMeta() {
    if (!name.trim()) { setError('Name is required'); return; }
    try {
      await updateSetlist(id!, { name: name.trim(), description: description.trim(), notes: notes.trim() });
      setEditingMeta(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  }

  async function handleAddSong(song: Song) {
    if (!setlist) return;
    const newSongs = [
      ...setlist.songs.map((s, i) => ({ song_id: s.song_id, position: i, notes: s.notes })),
      { song_id: song.id, position: setlist.songs.length, notes: '' },
    ];
    try {
      await setSetlistSongs(id!, newSongs);
      setShowAddSong(false);
      setSongSearch('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add song');
    }
  }

  function confirmRemoveSong(item: SetlistSongWithDetails) {
    Alert.alert('Remove Song', `Remove "${item.song_name}" from this setlist?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            await removeSongFromSetlist(id!, item.id);
            await load();
          } catch { Alert.alert('Error', 'Failed to remove song'); }
        },
      },
    ]);
  }

  async function moveItem(fromIdx: number, toIdx: number) {
    if (!setlist || fromIdx === toIdx) return;
    const songs = [...setlist.songs];
    const [moved] = songs.splice(fromIdx, 1);
    songs.splice(toIdx, 0, moved);
    const reordered = songs.map((s, i) => ({ song_id: s.song_id, position: i, notes: s.notes }));
    setSetlist({ ...setlist, songs: songs.map((s, i) => ({ ...s, position: i })), song_count: songs.length });
    try {
      await setSetlistSongs(id!, reordered);
    } catch {
      await load();
    }
  }

  function handleDeleteSetlist() {
    Alert.alert('Delete Setlist', `Delete "${setlist?.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try { await deleteSetlist(id!); router.back(); } catch { Alert.alert('Error', 'Failed to delete'); }
        },
      },
    ]);
  }

  async function handleSharePdf() {
    if (!setlist) return;
    const html = getSetlistHtml({
      setlistName: setlist.name,
      description: setlist.description || undefined,
      songs: setlist.songs.map(s => ({
        position: s.position + 1,
        name: s.song_name,
        artist: s.song_artist,
        duration: formatDuration(s.song_duration_seconds),
      })),
      totalDuration: formatTotalDuration(setlist.total_duration_seconds),
      bandName: 'The Green Tangerine',
      contactEmail: 'bookings@thegreentangerine.com',
      website: 'www.thegreentangerine.com',
      generatedDate: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    });
    try {
      await generateAndSharePdf(html, `setlist-${setlist.name.replace(/\s+/g, '-').toLowerCase()}`, `Setlist: ${setlist.name}`);
    } catch (err) {
      Alert.alert('Error', 'Failed to generate PDF');
    }
  }

  async function openAddSong() {
    setShowAddSong(true);
    setSongSearch('');
    try { setAllSongs(await getSongs()); } catch { /* ignore */ }
  }

  function formatDuration(seconds: number | null) {
    if (!seconds) return null;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function formatTotalDuration(seconds: number | null) {
    if (!seconds) return null;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  const existingSongIds = new Set(setlist?.songs.map(s => s.song_id) ?? []);
  const filteredSongs = allSongs.filter(s => {
    if (existingSongIds.has(s.id)) return false;
    if (!songSearch.trim()) return true;
    const q = songSearch.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q);
  });

  if (!setlist) return <View style={styles.container}><Text style={styles.emptyText}>Loading...</Text></View>;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <NeuButton label="Back" onPress={() => router.back()} small />
          <Text style={styles.title}>{setlist.name}</Text>
          <NeuButton label="Share PDF" onPress={handleSharePdf} color={COLORS.teal} small />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Setlist meta */}
        <NeuCard>
          {editingMeta ? (
            <>
              <Text style={LABEL}>SETLIST NAME *</Text>
              <NeuWell style={styles.well}>
                <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={COLORS.textMuted} />
              </NeuWell>
              <Text style={LABEL}>DESCRIPTION</Text>
              <NeuWell style={styles.well}>
                <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholderTextColor={COLORS.textMuted} />
              </NeuWell>
              <Text style={LABEL}>NOTES</Text>
              <NeuWell style={styles.well}>
                <TextInput style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]} value={notes} onChangeText={setNotes} placeholderTextColor={COLORS.textMuted} multiline />
              </NeuWell>
              <View style={styles.metaActions}>
                <NeuButton label="Save" onPress={handleSaveMeta} color={COLORS.green} small />
                <NeuButton label="Cancel" onPress={() => setEditingMeta(false)} small />
              </View>
            </>
          ) : (
            <View style={styles.metaView}>
              <View style={{ flex: 1 }}>
                {setlist.description ? <Text style={styles.descText}>{setlist.description}</Text> : null}
                <Text style={styles.metaInfo}>
                  {setlist.song_count} song{setlist.song_count !== 1 ? 's' : ''}
                  {setlist.total_duration_seconds ? ` \u2022 ${formatTotalDuration(setlist.total_duration_seconds)}` : ''}
                </Text>
              </View>
              <NeuButton label="Edit" onPress={() => setEditingMeta(true)} color={COLORS.orange} small />
            </View>
          )}
        </NeuCard>

        {/* Songs */}
        <View style={styles.songsHeader}>
          <Text style={styles.songsTitle}>Songs</Text>
          <NeuButton label="+ Add Song" onPress={openAddSong} color={COLORS.green} small />
        </View>

        {setlist.songs.map((song, idx) => (
          <NeuCard key={song.id} style={styles.songRow}>
            <Text style={styles.songPos}>{idx + 1}</Text>
            <View style={styles.songInfo}>
              <Text style={styles.songName}>{song.song_name}</Text>
              <Text style={styles.songMeta}>
                {song.song_artist ? `${song.song_artist} \u2022 ` : ''}
                {song.song_bpm} BPM
                {song.song_duration_seconds ? ` \u2022 ${formatDuration(song.song_duration_seconds)}` : ''}
              </Text>
            </View>
            <View style={styles.songControls}>
              <Pressable onPress={() => idx > 0 && moveItem(idx, idx - 1)} disabled={idx === 0} style={styles.controlBtn}>
                <Text style={[styles.controlText, idx === 0 && styles.controlDisabled]}>{'\u25B2'}</Text>
              </Pressable>
              <Pressable onPress={() => idx < setlist.songs.length - 1 && moveItem(idx, idx + 1)} disabled={idx === setlist.songs.length - 1} style={styles.controlBtn}>
                <Text style={[styles.controlText, idx === setlist.songs.length - 1 && styles.controlDisabled]}>{'\u25BC'}</Text>
              </Pressable>
              <Pressable onPress={() => confirmRemoveSong(song)} style={styles.controlBtn}>
                <Text style={[styles.controlText, { color: COLORS.danger }]}>{'\u2715'}</Text>
              </Pressable>
            </View>
          </NeuCard>
        ))}

        {setlist.songs.length === 0 && (
          <Text style={styles.emptyText}>No songs in this setlist. Add some!</Text>
        )}

        <NeuButton label="Delete Setlist" onPress={handleDeleteSetlist} color={COLORS.danger} style={{ marginTop: 24 }} />
      </ScrollView>

      {/* Add Song Modal */}
      <Modal visible={showAddSong} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Song to Setlist</Text>
            <NeuWell style={styles.searchWell}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search songs..."
                placeholderTextColor={COLORS.textMuted}
                value={songSearch}
                onChangeText={setSongSearch}
                autoFocus
              />
            </NeuWell>
            <FlatList
              data={filteredSongs}
              keyExtractor={item => item.id}
              style={styles.pickerList}
              renderItem={({ item }) => (
                <Pressable style={styles.pickerItem} onPress={() => handleAddSong(item)}>
                  <Text style={styles.pickerName}>{item.name}</Text>
                  <Text style={styles.pickerMeta}>{item.artist ? `${item.artist} \u2022 ` : ''}{item.bpm} BPM</Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>{allSongs.length === 0 ? 'No songs in library' : 'No matching songs'}</Text>}
            />
            <NeuButton label="Close" onPress={() => setShowAddSong(false)} style={{ marginTop: 8 }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 80 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontFamily: FONTS.bodyBold, fontSize: 17, color: COLORS.text, flex: 1, textAlign: 'center' },
  error: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.danger, marginBottom: 8 },
  well: { padding: 0, marginBottom: 4 },
  input: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.text, padding: 10 },
  metaView: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  metaActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  descText: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textDim, marginBottom: 4 },
  metaInfo: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textMuted },
  songsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 8 },
  songsTitle: { fontFamily: FONTS.bodyBold, fontSize: 15, color: COLORS.text },
  songRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  songPos: { fontFamily: FONTS.mono, fontSize: 14, fontWeight: '700', color: COLORS.green, minWidth: 24, textAlign: 'center' },
  songInfo: { flex: 1 },
  songName: { fontFamily: FONTS.bodyBold, fontSize: 14, color: COLORS.text },
  songMeta: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.textMuted },
  songControls: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  controlBtn: { padding: 6 },
  controlText: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textDim },
  controlDisabled: { opacity: 0.3 },
  emptyText: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textDim, textAlign: 'center', padding: 20 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: COLORS.card, borderRadius: 12, padding: 16, maxHeight: '80%' },
  modalTitle: { fontFamily: FONTS.bodyBold, fontSize: 17, color: COLORS.text, marginBottom: 12 },
  searchWell: { padding: 0, marginBottom: 8 },
  searchInput: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.text, padding: 12 },
  pickerList: { maxHeight: 300 },
  pickerItem: { paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  pickerName: { fontFamily: FONTS.bodyBold, fontSize: 14, color: COLORS.text },
  pickerMeta: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
});

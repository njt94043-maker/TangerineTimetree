import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { NeuCard, NeuWell, NeuButton } from '../../src/components';
import { COLORS, FONTS } from '../../src/theme';
import { getSongs, searchSongs, deleteSong } from '../../src/db';
import type { Song } from '../../src/db';

export default function SongsScreen() {
  const router = useRouter();
  const [songs, setSongs] = useState<Song[]>([]);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const list = search.trim() ? await searchSongs(search.trim()) : await getSongs();
      setSongs(list);
    } catch (err) {
      console.error('Failed to load songs', err);
    }
  }, [search]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function handleDelete(song: Song) {
    Alert.alert('Delete Song', `Delete "${song.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try { await deleteSong(song.id); load(); } catch { Alert.alert('Error', 'Failed to delete song'); }
        },
      },
    ]);
  }

  function renderSong({ item }: { item: Song }) {
    return (
      <NeuCard>
        <Pressable onPress={() => router.push({ pathname: '/song/[id]', params: { id: item.id } })}>
          <Text style={styles.songName}>{item.name}</Text>
          {item.artist ? <Text style={styles.songArtist}>{item.artist}</Text> : null}
          <View style={styles.metaRow}>
            <View style={styles.metaTag}><Text style={styles.metaText}>{item.bpm} BPM</Text></View>
            <View style={styles.metaTag}><Text style={styles.metaText}>{item.time_signature_top}/{item.time_signature_bottom}</Text></View>
            {item.key ? <View style={styles.metaTag}><Text style={styles.metaText}>{item.key}</Text></View> : null}
            {item.duration_seconds ? (
              <View style={styles.metaTag}>
                <Text style={styles.metaText}>{Math.floor(item.duration_seconds / 60)}:{(item.duration_seconds % 60).toString().padStart(2, '0')}</Text>
              </View>
            ) : null}
          </View>
        </Pressable>
        <View style={styles.songActions}>
          <Pressable style={styles.actionBtn} onPress={() => router.push({ pathname: '/song/[id]', params: { id: item.id } })}>
            <Text style={[styles.actionBtnText, { color: COLORS.orange }]}>Edit</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => handleDelete(item)}>
            <Text style={[styles.actionBtnText, { color: COLORS.danger }]}>Del</Text>
          </Pressable>
        </View>
      </NeuCard>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <NeuButton label="+ Add Song" onPress={() => router.push('/song/new')} color={COLORS.green} small />
      </View>

      <NeuWell style={styles.searchWell}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search songs..."
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </NeuWell>

      {songs.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{search ? 'No songs match your search' : 'No songs yet'}</Text>
          {!search && (
            <NeuButton
              label="Add Your First Song"
              onPress={() => router.push('/song/new')}
              color={COLORS.teal}
              style={{ marginTop: 16 }}
            />
          )}
        </View>
      ) : (
        <FlatList
          data={songs}
          keyExtractor={item => item.id}
          renderItem={renderSong}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchWell: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 0,
  },
  searchInput: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.text,
    padding: 12,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  songName: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: COLORS.text,
  },
  songArtist: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textDim,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  metaTag: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  metaText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  songActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  actionBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  actionBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textDim,
    textAlign: 'center',
  },
});

import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { NeuCard, NeuButton } from '../../src/components';
import { COLORS, FONTS } from '../../src/theme';
import { getSetlists, deleteSetlist } from '../../src/db';
import type { Setlist } from '../../src/db';

export default function SetlistsScreen() {
  const router = useRouter();
  const [setlists, setSetlistsState] = useState<Setlist[]>([]);

  const load = useCallback(async () => {
    try {
      setSetlistsState(await getSetlists());
    } catch (err) {
      console.error('Failed to load setlists', err);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function handleDelete(sl: Setlist) {
    Alert.alert('Delete Setlist', `Delete "${sl.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try { await deleteSetlist(sl.id); load(); } catch { Alert.alert('Error', 'Failed to delete setlist'); }
        },
      },
    ]);
  }

  function renderSetlist({ item }: { item: Setlist }) {
    return (
      <NeuCard>
        <Pressable onPress={() => router.push({ pathname: '/setlist/[id]', params: { id: item.id } })}>
          <Text style={styles.setlistName}>{item.name}</Text>
          {item.description ? <Text style={styles.setlistDesc}>{item.description}</Text> : null}
        </Pressable>
        <View style={styles.actions}>
          <Pressable style={styles.actionBtn} onPress={() => router.push({ pathname: '/setlist/[id]', params: { id: item.id } })}>
            <Text style={[styles.actionBtnText, { color: COLORS.teal }]}>Open</Text>
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
        <NeuButton label="+ New Setlist" onPress={() => router.push('/setlist/new')} color={COLORS.green} small />
      </View>

      {setlists.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No setlists yet</Text>
          <NeuButton
            label="Create Your First Setlist"
            onPress={() => router.push('/setlist/new')}
            color={COLORS.teal}
            style={{ marginTop: 16 }}
          />
        </View>
      ) : (
        <FlatList
          data={setlists}
          keyExtractor={item => item.id}
          renderItem={renderSetlist}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  list: { paddingHorizontal: 16, paddingBottom: 80 },
  setlistName: { fontFamily: FONTS.bodyBold, fontSize: 16, color: COLORS.text },
  setlistDesc: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textDim, marginTop: 2 },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  actionBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  actionBtnText: { fontFamily: FONTS.bodyBold, fontSize: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textDim, textAlign: 'center' },
});

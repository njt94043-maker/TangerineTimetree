import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TextInput, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { NeuCard, NeuWell, NeuButton, StarRating } from '../../src/components';
import { COLORS, FONTS } from '../../src/theme';
import { getVenues, searchVenues, deleteVenue } from '../../src/db';
import type { Venue } from '../../src/db';

function avgRating(v: Venue): number | null {
  const vals = [v.rating_atmosphere, v.rating_crowd, v.rating_stage, v.rating_parking].filter(
    (r): r is number => r !== null,
  );
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((s, n) => s + n, 0) / vals.length);
}

export default function VenuesScreen() {
  const router = useRouter();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const list = search.trim() ? await searchVenues(search.trim()) : await getVenues();
      setVenues(list);
    } catch (err) {
      console.error('Failed to load venues', err);
    }
  }, [search]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function handleDelete(venue: Venue) {
    Alert.alert('Delete Venue', `Delete "${venue.venue_name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try { await deleteVenue(venue.id); load(); } catch { Alert.alert('Error', 'Failed to delete venue'); }
        },
      },
    ]);
  }

  function renderVenue({ item }: { item: Venue }) {
    const avg = avgRating(item);
    return (
      <NeuCard>
        <Pressable onPress={() => router.push(`/venue/${item.id}`)}>
          <Text style={styles.venueName}>{item.venue_name}</Text>
          {item.address ? <Text style={styles.venueAddress}>{item.address}</Text> : null}
          {item.postcode ? <Text style={styles.venuePostcode}>{item.postcode}</Text> : null}
          {avg !== null && (
            <View style={styles.ratingRow}>
              <StarRating value={avg} compact />
            </View>
          )}
        </Pressable>
        <View style={styles.venueActions}>
          <Pressable style={styles.actionBtn} onPress={() => router.push(`/venue/${item.id}`)}>
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
        <NeuButton label="+ Add Venue" onPress={() => router.push('/venue/new')} color={COLORS.green} small />
      </View>

      <NeuWell style={styles.searchWell}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search venues..."
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </NeuWell>

      {venues.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{search ? 'No venues match your search' : 'No venues yet'}</Text>
          {!search && (
            <NeuButton
              label="Add Your First Venue"
              onPress={() => router.push('/venue/new')}
              color={COLORS.teal}
              style={{ marginTop: 16 }}
            />
          )}
        </View>
      ) : (
        <FlatList
          data={venues}
          keyExtractor={item => item.id}
          renderItem={renderVenue}
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
  venueName: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: COLORS.text,
  },
  venueAddress: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textDim,
    marginTop: 2,
  },
  venuePostcode: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  ratingRow: {
    marginTop: 4,
  },
  venueActions: {
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
    color: COLORS.teal,
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

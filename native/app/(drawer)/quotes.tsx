import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, FlatList, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { NeuCard, NeuWell, StatusBadge } from '../../src/components';
import { COLORS, FONTS, LABEL } from '../../src/theme';
import { getQuotes, QuoteWithClient } from '../../src/db';
import { formatGBP } from '../../src/utils/formatCurrency';
import { formatDateShort } from '../../src/utils/formatDate';
import type { QuoteStatus } from '@shared/supabase/types';

const FILTERS: { label: string; value: QuoteStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Sent', value: 'sent' },
  { label: 'Accepted', value: 'accepted' },
  { label: 'Declined', value: 'declined' },
  { label: 'Expired', value: 'expired' },
];

export default function QuotesScreen() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<QuoteWithClient[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<QuoteStatus | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadQuotes();
    }, [])
  );

  async function loadQuotes() {
    const list = await getQuotes();
    setQuotes(list);
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadQuotes();
    setRefreshing(false);
  }

  const filtered = quotes.filter(q => {
    if (filter !== 'all' && q.status !== filter) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      return (
        q.quote_number.toLowerCase().includes(s) ||
        q.client_company_name.toLowerCase().includes(s) ||
        q.venue_name.toLowerCase().includes(s)
      );
    }
    return true;
  });

  // Stats
  const totalQuoted = quotes.reduce((sum, q) => sum + q.total, 0);
  const pendingValue = quotes.filter(q => q.status === 'sent').reduce((sum, q) => sum + q.total, 0);
  const acceptedValue = quotes.filter(q => q.status === 'accepted').reduce((sum, q) => sum + q.total, 0);

  function renderQuote({ item }: { item: QuoteWithClient }) {
    return (
      <Pressable onPress={() => router.push(`/quote/${item.id}`)}>
        <NeuCard intensity="subtle">
          <View style={styles.quoteRow}>
            <View style={styles.quoteInfo}>
              <View style={styles.quoteTopRow}>
                <Text style={styles.quoteNumber}>{item.quote_number}</Text>
                <StatusBadge status={item.status} />
              </View>
              <Text style={styles.quoteClient}>{item.client_company_name}</Text>
              <Text style={styles.quoteVenue}>
                {item.venue_name} - {formatDateShort(item.event_date)}
              </Text>
            </View>
            <Text style={styles.quoteAmount}>{formatGBP(item.total)}</Text>
          </View>
        </NeuCard>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable style={styles.addBtn} onPress={() => router.push('/quote/new')}>
          <Text style={styles.addBtnText}>+ New Quote</Text>
        </Pressable>
      </View>

      {/* Stats bar */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Total Quoted</Text>
          <Text style={styles.statValue}>{formatGBP(totalQuoted)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Pending</Text>
          <Text style={[styles.statValue, { color: COLORS.orange }]}>{formatGBP(pendingValue)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Accepted</Text>
          <Text style={[styles.statValue, { color: COLORS.success }]}>{formatGBP(acceptedValue)}</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <NeuWell style={styles.searchWell}>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search quotes..."
            placeholderTextColor={COLORS.textMuted}
          />
        </NeuWell>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <Pressable
            key={f.value}
            style={[styles.filterTab, filter === f.value && styles.filterTabActive]}
            onPress={() => setFilter(f.value)}
          >
            <Text style={[styles.filterText, filter === f.value && styles.filterTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {filtered.length > 0 ? (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderQuote}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.teal} />}
        />
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{search || filter !== 'all' ? 'No matching quotes' : 'No quotes yet'}</Text>
          <Text style={styles.emptyText}>{search || filter !== 'all' ? 'Try a different search or filter' : 'Tap + to create your first quote'}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8, gap: 8 },
  stat: { flex: 1, backgroundColor: COLORS.card, borderRadius: 10, padding: 10, alignItems: 'center' },
  statLabel: { fontFamily: FONTS.body, fontSize: 10, color: COLORS.textDim },
  statValue: { fontFamily: FONTS.mono, fontSize: 14, color: COLORS.text, marginTop: 2 },
  searchWrap: { paddingHorizontal: 16, marginBottom: 8 },
  searchWell: { padding: 0 },
  searchInput: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.text, padding: 10 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8, gap: 4 },
  filterTab: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: COLORS.card },
  filterTabActive: { backgroundColor: COLORS.teal + '33' },
  filterText: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.textDim },
  filterTextActive: { color: COLORS.teal, fontFamily: FONTS.bodyBold },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  quoteRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  quoteInfo: { flex: 1, marginRight: 12 },
  quoteTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  quoteNumber: { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.teal },
  quoteClient: { fontFamily: FONTS.bodyBold, fontSize: 13, color: COLORS.text },
  quoteVenue: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.textDim },
  quoteAmount: { fontFamily: FONTS.mono, fontSize: 16, color: COLORS.text },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontFamily: FONTS.bodyBold, fontSize: 16, color: COLORS.textDim },
  emptyText: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted, marginTop: 8, textAlign: 'center' },
  addBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { fontSize: 13, color: '#fff', fontFamily: FONTS.bodyBold },
});

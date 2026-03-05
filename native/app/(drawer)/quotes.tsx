import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TextInput, FlatList, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { NeuCard, NeuWell, NeuSelect, StatusBadge } from '../../src/components';
import { COLORS, FONTS, LABEL } from '../../src/theme';
import { neuRaisedStyle } from '../../src/theme/shadows';
import { getQuotes, QuoteWithClient } from '../../src/db';
import { formatGBP } from '../../src/utils/formatCurrency';
import { formatDateShort } from '../../src/utils/formatDate';
import type { QuoteStatus } from '@shared/supabase/types';

type FilterTab = 'all' | QuoteStatus;
type SortKey = 'date-desc' | 'date-asc' | 'total-desc' | 'total-asc' | 'status';

const FILTER_OPTIONS: { label: string; value: FilterTab }[] = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Sent', value: 'sent' },
  { label: 'Accepted', value: 'accepted' },
  { label: 'Declined', value: 'declined' },
  { label: 'Expired', value: 'expired' },
];

const SORT_OPTIONS: { label: string; value: SortKey }[] = [
  { label: 'Newest', value: 'date-desc' },
  { label: 'Oldest', value: 'date-asc' },
  { label: 'Highest', value: 'total-desc' },
  { label: 'Lowest', value: 'total-asc' },
  { label: 'Status', value: 'status' },
];

const STATUS_ORDER: Record<QuoteStatus, number> = { draft: 0, sent: 1, accepted: 2, declined: 3, expired: 4 };

export default function QuotesScreen() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<QuoteWithClient[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterTab>('all');
  const [sortKey, setSortKey] = useState<SortKey>('date-desc');
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadQuotes();
    }, [])
  );

  async function loadQuotes() {
    try {
      const list = await getQuotes();
      setQuotes(list);
    } catch (err) {
      console.error('Failed to load quotes', err);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadQuotes();
    setRefreshing(false);
  }

  const stats = useMemo(() => {
    const totalQuoted = quotes.reduce((sum, q) => sum + q.total, 0);
    const pendingValue = quotes.filter(q => q.status === 'sent').reduce((sum, q) => sum + q.total, 0);
    const acceptedValue = quotes.filter(q => q.status === 'accepted').reduce((sum, q) => sum + q.total, 0);
    return { totalQuoted, pendingValue, acceptedValue };
  }, [quotes]);

  const filtered = useMemo(() => {
    let list = filter === 'all' ? quotes : quotes.filter(q => q.status === filter);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(q =>
        q.quote_number.toLowerCase().includes(s) ||
        q.client_company_name.toLowerCase().includes(s) ||
        q.venue_name.toLowerCase().includes(s)
      );
    }
    const sorted = [...list];
    switch (sortKey) {
      case 'date-desc': sorted.sort((a, b) => b.event_date.localeCompare(a.event_date)); break;
      case 'date-asc': sorted.sort((a, b) => a.event_date.localeCompare(b.event_date)); break;
      case 'total-desc': sorted.sort((a, b) => b.total - a.total); break;
      case 'total-asc': sorted.sort((a, b) => a.total - b.total); break;
      case 'status': sorted.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]); break;
    }
    return sorted;
  }, [quotes, filter, sortKey, search]);

  function renderQuote({ item }: { item: QuoteWithClient }) {
    return (
      <Pressable onPress={() => router.push(`/quote/${item.id}`)}>
        <NeuCard intensity="subtle" style={{ borderLeftWidth: 3, borderLeftColor: item.status === 'accepted' ? COLORS.success : item.status === 'sent' ? COLORS.orange : item.status === 'declined' ? COLORS.danger : COLORS.textMuted }}>
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
          <Text style={styles.statLabel}>Quoted</Text>
          <Text style={styles.statValue}>{formatGBP(stats.totalQuoted)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Pending</Text>
          <Text style={[styles.statValue, { color: COLORS.orange }]}>{formatGBP(stats.pendingValue)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Accepted</Text>
          <Text style={[styles.statValue, { color: COLORS.success }]}>{formatGBP(stats.acceptedValue)}</Text>
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

      {/* Filter + Sort dropdowns */}
      <View style={styles.controlsRow}>
        <View style={styles.controlItem}>
          <NeuSelect value={filter} options={FILTER_OPTIONS} onChange={setFilter} />
        </View>
        <View style={styles.controlItem}>
          <NeuSelect value={sortKey} options={SORT_OPTIONS} onChange={setSortKey} />
        </View>
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
  stat: { flex: 1, ...neuRaisedStyle('subtle'), borderRadius: 10, padding: 10, alignItems: 'center' },
  statLabel: { fontFamily: FONTS.body, fontSize: 10, color: COLORS.textDim },
  statValue: { fontFamily: FONTS.mono, fontSize: 14, color: COLORS.text, marginTop: 2 },
  searchWrap: { paddingHorizontal: 16, marginBottom: 8 },
  searchWell: { padding: 0 },
  searchInput: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.text, paddingVertical: 12, paddingHorizontal: 14 },
  controlsRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8, gap: 8 },
  controlItem: { flex: 1 },
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
  emptyText: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textMuted, marginTop: 8, textAlign: 'center' },
  addBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.green,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { fontSize: 13, color: '#000', fontFamily: FONTS.bodyBold },
});

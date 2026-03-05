import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TextInput, FlatList, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { NeuCard, NeuWell, NeuSelect, StatusBadge } from '../../src/components';
import { COLORS, FONTS, LABEL } from '../../src/theme';
import { neuRaisedStyle } from '../../src/theme/shadows';
import { getInvoices, InvoiceWithClient } from '../../src/db';
import { formatGBP } from '../../src/utils/formatCurrency';
import { formatDateShort } from '../../src/utils/formatDate';
import type { InvoiceStatus } from '@shared/supabase/types';

type FilterTab = 'all' | InvoiceStatus;
type SortKey = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'status';

const FILTER_OPTIONS: { label: string; value: FilterTab }[] = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Sent', value: 'sent' },
  { label: 'Paid', value: 'paid' },
];

const SORT_OPTIONS: { label: string; value: SortKey }[] = [
  { label: 'Newest', value: 'date-desc' },
  { label: 'Oldest', value: 'date-asc' },
  { label: 'Highest', value: 'amount-desc' },
  { label: 'Lowest', value: 'amount-asc' },
  { label: 'Status', value: 'status' },
];

const STATUS_ORDER: Record<InvoiceStatus, number> = { sent: 0, draft: 1, paid: 2 };

export default function InvoicesScreen() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<InvoiceWithClient[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterTab>('all');
  const [sortKey, setSortKey] = useState<SortKey>('date-desc');
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadInvoices();
    }, [])
  );

  async function loadInvoices() {
    try {
      const list = await getInvoices();
      setInvoices(list);
    } catch (err) {
      console.error('Failed to load invoices', err);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadInvoices();
    setRefreshing(false);
  }

  const stats = useMemo(() => {
    const totalInvoiced = invoices.reduce((s, i) => s + i.amount, 0);
    const totalOutstanding = invoices.filter(i => i.status === 'sent').reduce((s, i) => s + i.amount, 0);
    const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
    return { totalInvoiced, totalOutstanding, totalPaid };
  }, [invoices]);

  const filtered = useMemo(() => {
    let list = filter === 'all' ? invoices : invoices.filter(i => i.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(inv =>
        inv.invoice_number.toLowerCase().includes(q) ||
        inv.client_company_name.toLowerCase().includes(q) ||
        inv.venue.toLowerCase().includes(q) ||
        inv.venue_name.toLowerCase().includes(q)
      );
    }
    const sorted = [...list];
    switch (sortKey) {
      case 'date-desc': sorted.sort((a, b) => b.gig_date.localeCompare(a.gig_date)); break;
      case 'date-asc': sorted.sort((a, b) => a.gig_date.localeCompare(b.gig_date)); break;
      case 'amount-desc': sorted.sort((a, b) => b.amount - a.amount); break;
      case 'amount-asc': sorted.sort((a, b) => a.amount - b.amount); break;
      case 'status': sorted.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]); break;
    }
    return sorted;
  }, [invoices, filter, sortKey, search]);

  function renderInvoice({ item }: { item: InvoiceWithClient }) {
    return (
      <Pressable onPress={() => router.push(`/invoice/${item.id}`)}>
        <NeuCard intensity="subtle" style={{ borderLeftWidth: 3, borderLeftColor: item.status === 'paid' ? COLORS.success : item.status === 'sent' ? COLORS.orange : COLORS.textMuted }}>
          <View style={styles.invoiceRow}>
            <View style={styles.invoiceInfo}>
              <View style={styles.invoiceTopRow}>
                <Text style={styles.invoiceNumber}>{item.invoice_number}</Text>
                <StatusBadge status={item.status} />
              </View>
              <Text style={styles.invoiceClient}>{item.client_company_name || item.venue_name || 'No client'}</Text>
              <Text style={styles.invoiceVenue}>{item.venue} - {formatDateShort(item.gig_date)}</Text>
            </View>
            <Text style={styles.invoiceAmount}>{formatGBP(item.amount)}</Text>
          </View>
        </NeuCard>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable style={styles.addBtn} onPress={() => router.push('/invoice/new')}>
          <Text style={styles.addBtnText}>+ New Invoice</Text>
        </Pressable>
      </View>

      {/* Stats bar */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Invoiced</Text>
          <Text style={styles.statValue}>{formatGBP(stats.totalInvoiced)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Outstanding</Text>
          <Text style={[styles.statValue, { color: COLORS.orange }]}>{formatGBP(stats.totalOutstanding)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Paid</Text>
          <Text style={[styles.statValue, { color: COLORS.success }]}>{formatGBP(stats.totalPaid)}</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <NeuWell style={styles.searchWell}>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search invoices..."
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
          renderItem={renderInvoice}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.teal} />}
        />
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{search ? 'No matching invoices' : 'No invoices yet'}</Text>
          <Text style={styles.emptyText}>{search ? 'Try a different search' : 'Tap + to create your first invoice'}</Text>
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
  controlsRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8, gap: 8 },
  controlItem: { flex: 1 },
  searchWell: { padding: 0 },
  searchInput: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.text, paddingVertical: 12, paddingHorizontal: 14 },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  invoiceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  invoiceInfo: { flex: 1, marginRight: 12 },
  invoiceTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  invoiceNumber: { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.teal },
  invoiceClient: { fontFamily: FONTS.bodyBold, fontSize: 13, color: COLORS.text },
  invoiceVenue: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.textDim },
  invoiceAmount: { fontFamily: FONTS.mono, fontSize: 16, color: COLORS.text },
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

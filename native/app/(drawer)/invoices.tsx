import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, FlatList, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { NeuCard, NeuWell, StatusBadge } from '../../src/components';
import { COLORS, FONTS, LABEL } from '../../src/theme';
import { getInvoices, InvoiceWithClient } from '../../src/db';
import { formatGBP } from '../../src/utils/formatCurrency';
import { formatDateShort } from '../../src/utils/formatDate';

export default function InvoicesScreen() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<InvoiceWithClient[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadInvoices();
    }, [])
  );

  async function loadInvoices() {
    const list = await getInvoices();
    setInvoices(list);
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadInvoices();
    setRefreshing(false);
  }

  const filtered = search.trim()
    ? invoices.filter(inv => {
        const q = search.toLowerCase();
        return (
          inv.invoice_number.toLowerCase().includes(q) ||
          inv.client_company_name.toLowerCase().includes(q) ||
          inv.venue.toLowerCase().includes(q)
        );
      })
    : invoices;

  function renderInvoice({ item }: { item: InvoiceWithClient }) {
    return (
      <Pressable onPress={() => router.push(`/invoice/${item.id}`)}>
        <NeuCard intensity="subtle">
          <View style={styles.invoiceRow}>
            <View style={styles.invoiceInfo}>
              <View style={styles.invoiceTopRow}>
                <Text style={styles.invoiceNumber}>{item.invoice_number}</Text>
                <StatusBadge status={item.status} />
              </View>
              <Text style={styles.invoiceClient}>{item.client_company_name}</Text>
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
  searchWrap: { paddingHorizontal: 16, marginBottom: 8 },
  searchWell: { padding: 0 },
  searchInput: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.text, padding: 10 },
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

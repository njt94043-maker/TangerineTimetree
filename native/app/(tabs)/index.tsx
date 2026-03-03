import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NeuCard, StatusBadge } from '../../src/components';
import { COLORS, FONTS, LABEL, DATA_VALUE } from '../../src/theme';
import { getDashboardStats, DashboardStats, InvoiceWithClient } from '../../src/db';
import { formatGBP } from '../../src/utils/formatCurrency';
import { formatDateShort } from '../../src/utils/formatDate';

export default function DashboardScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function loadStats() {
    const s = await getDashboardStats();
    setStats(s);
  }

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [])
  );

  async function handleRefresh() {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  }

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
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>GigBooks</Text>
        <Pressable style={styles.addBtn} onPress={() => router.push('/invoice/new')}>
          <Text style={styles.addBtnText}>+</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.teal} />}
      >
        {stats && (
          <>
            {/* Stats Grid */}
            <View style={styles.statsGrid}>
              <StatCard label="INVOICED" value={formatGBP(stats.totalInvoiced)} color={COLORS.teal} />
              <StatCard label="PAID" value={formatGBP(stats.totalPaid)} color={COLORS.success} />
              <StatCard label="OUTSTANDING" value={formatGBP(stats.totalOutstanding)} color={COLORS.orange} />
              <StatCard label="INVOICES" value={String(stats.invoiceCount)} color={COLORS.textDim} />
            </View>

            {/* Recent Invoices */}
            {stats.recentInvoices.length > 0 ? (
              <View style={styles.recentSection}>
                <Text style={[LABEL, { marginHorizontal: 16, marginBottom: 8 }]}>RECENT INVOICES</Text>
                <FlatList
                  data={stats.recentInvoices}
                  keyExtractor={item => item.id}
                  renderItem={renderInvoice}
                  contentContainerStyle={styles.list}
                  scrollEnabled={false}
                />
                <Pressable onPress={() => router.push('/(tabs)/invoices')} style={styles.viewAllBtn}>
                  <Text style={styles.viewAllText}>View All Invoices</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No invoices yet</Text>
                <Text style={styles.emptyText}>Tap + in the header to create your first invoice</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <NeuCard intensity="subtle" style={styles.statCard}>
      <Text style={LABEL}>{label}</Text>
      <Text style={[DATA_VALUE, { color, fontSize: 18, marginTop: 4 }]}>{value}</Text>
    </NeuCard>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontFamily: FONTS.bodyBold, fontSize: 24, color: COLORS.text },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10 },
  statCard: { width: '46%', marginHorizontal: '2%', padding: 12 },
  recentSection: { flex: 1, marginTop: 8 },
  list: { paddingHorizontal: 16, paddingBottom: 80 },
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { fontSize: 20, color: '#fff', fontWeight: 'bold', marginTop: -1 },
  scrollContent: { paddingBottom: 80 },
  viewAllBtn: { alignItems: 'center', paddingVertical: 12, marginHorizontal: 16 },
  viewAllText: { fontFamily: FONTS.bodyBold, fontSize: 13, color: COLORS.teal },
});

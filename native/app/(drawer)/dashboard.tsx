import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { NeuCard, StatusBadge } from '../../src/components';
import { COLORS, FONTS, LABEL, DATA_VALUE } from '../../src/theme';
import { getDashboardStats, DashboardStats, InvoiceWithClient, getInvoices } from '../../src/db';
import { formatGBP } from '../../src/utils/formatCurrency';
import { formatDateShort } from '../../src/utils/formatDate';
import { exportInvoicesCsv } from '../../src/utils/csvExport';

interface MonthlyBreakdown {
  label: string;
  invoiced: number;
  paid: number;
  count: number;
}

function getMonthlyBreakdown(invoices: InvoiceWithClient[]): MonthlyBreakdown[] {
  const months = new Map<string, MonthlyBreakdown>();
  for (const inv of invoices) {
    const d = new Date(inv.gig_date + 'T12:00:00');
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    if (!months.has(key)) months.set(key, { label, invoiced: 0, paid: 0, count: 0 });
    const m = months.get(key)!;
    m.invoiced += inv.amount;
    if (inv.status === 'paid') m.paid += inv.amount;
    m.count++;
  }
  return Array.from(months.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([, v]) => v)
    .slice(0, 6);
}

function getCurrentTaxYear() {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    label: `${year}/${String(year + 1).slice(2)}`,
    start: `${year}-04-01`,
    end: `${year + 1}-03-31`,
  };
}

export default function DashboardScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [allInvoices, setAllInvoices] = useState<InvoiceWithClient[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function loadStats() {
    const [s, invs] = await Promise.all([getDashboardStats(), getInvoices()]);
    setStats(s);
    setAllInvoices(invs);
  }

  useFocusEffect(useCallback(() => { loadStats(); }, []));

  async function handleRefresh() {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  }

  const taxYear = getCurrentTaxYear();
  const taxYearInvoices = allInvoices.filter(i => i.gig_date >= taxYear.start && i.gig_date <= taxYear.end);
  const taxYearTotal = taxYearInvoices.reduce((sum, i) => sum + i.amount, 0);
  const monthly = getMonthlyBreakdown(allInvoices);
  const overdue = allInvoices.filter(i => {
    if (i.status !== 'sent') return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return new Date(i.due_date + 'T12:00:00') < today;
  });

  function renderInvoice(item: InvoiceWithClient, isOverdue?: boolean) {
    return (
      <Pressable key={item.id} onPress={() => router.push(`/invoice/${item.id}`)}>
        <NeuCard intensity="subtle">
          <View style={s.invoiceRow}>
            <View style={s.invoiceInfo}>
              <View style={s.invoiceTopRow}>
                <Text style={s.invoiceNumber}>{item.invoice_number}</Text>
                {isOverdue ? <Text style={s.overdueBadge}>OVERDUE</Text> : <StatusBadge status={item.status} />}
              </View>
              <Text style={s.invoiceClient}>{item.client_company_name}</Text>
              <Text style={s.invoiceVenue}>
                {isOverdue ? `Due ${formatDateShort(item.due_date)}` : `${item.venue} - ${formatDateShort(item.gig_date)}`}
              </Text>
            </View>
            <Text style={s.invoiceAmount}>{formatGBP(item.amount)}</Text>
          </View>
        </NeuCard>
      </Pressable>
    );
  }

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.teal} />}
    >
      {stats && (
        <>
          {/* Stats Grid */}
          <View style={s.statsGrid}>
            <StatCard label="TOTAL INVOICED" value={formatGBP(stats.totalInvoiced)} sub={`${stats.invoiceCount} invoice${stats.invoiceCount !== 1 ? 's' : ''}`} color={COLORS.teal} />
            <StatCard label="OUTSTANDING" value={formatGBP(stats.totalOutstanding)} sub={overdue.length > 0 ? `${overdue.length} overdue` : undefined} color={COLORS.orange} subColor={COLORS.danger} />
            <StatCard label="PAID" value={formatGBP(stats.totalPaid)} color={COLORS.success} />
            <StatCard label={`TAX YEAR ${taxYear.label}`} value={formatGBP(taxYearTotal)} sub={`${taxYearInvoices.length} invoice${taxYearInvoices.length !== 1 ? 's' : ''}`} color={COLORS.textDim} />
          </View>

          {/* Overdue */}
          {overdue.length > 0 && (
            <View style={s.section}>
              <Text style={[s.sectionTitle, { color: COLORS.danger }]}>Overdue</Text>
              {overdue.map(inv => renderInvoice(inv, true))}
            </View>
          )}

          {/* Recent Invoices */}
          {stats.recentInvoices.length > 0 && (
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>Recent Invoices</Text>
                <Pressable onPress={() => router.push('/(drawer)/invoices')}>
                  <Text style={s.viewAllText}>View All</Text>
                </Pressable>
              </View>
              {stats.recentInvoices.map(inv => renderInvoice(inv))}
            </View>
          )}

          {/* Monthly Breakdown */}
          {monthly.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Monthly Breakdown</Text>
              {monthly.map(m => (
                <NeuCard key={m.label} intensity="subtle" style={s.monthRow}>
                  <View>
                    <Text style={s.monthName}>{m.label}</Text>
                    <Text style={s.monthCount}>{m.count} inv</Text>
                  </View>
                  <View style={s.monthRight}>
                    <Text style={s.monthInvoiced}>{formatGBP(m.invoiced)}</Text>
                    <Text style={s.monthPaid}>{formatGBP(m.paid)} paid</Text>
                  </View>
                </NeuCard>
              ))}
            </View>
          )}

          {/* Export */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Export</Text>
            <Pressable style={s.outlineBtn} onPress={async () => { setExporting(true); try { await exportInvoicesCsv(allInvoices); } catch {} setExporting(false); }} disabled={exporting}>
              <Text style={s.outlineBtnText}>Export All Invoices (CSV)</Text>
            </Pressable>
            <Pressable style={s.outlineBtn} onPress={async () => { setExporting(true); try { await exportInvoicesCsv(taxYearInvoices); } catch {} setExporting(false); }} disabled={exporting}>
              <Text style={s.outlineBtnText}>Export Tax Year {taxYear.label} (CSV)</Text>
            </Pressable>
          </View>

          {/* Quick nav */}
          <View style={s.section}>
            <Pressable style={s.primaryBtn} onPress={() => router.push('/invoice/new')}>
              <Text style={s.primaryBtnText}>+ New Invoice</Text>
            </Pressable>
            <Pressable style={[s.primaryBtn, { backgroundColor: COLORS.green }]} onPress={() => router.push('/(drawer)/index')}>
              <Text style={s.primaryBtnText}>Calendar</Text>
            </Pressable>
            <Pressable style={s.outlineBtn} onPress={() => router.push('/(drawer)/invoices')}>
              <Text style={s.outlineBtnText}>Invoices</Text>
            </Pressable>
            <Pressable style={s.outlineBtn} onPress={() => router.push('/(drawer)/clients')}>
              <Text style={s.outlineBtnText}>Clients</Text>
            </Pressable>
            <Pressable style={s.outlineBtn} onPress={() => router.push('/(drawer)/settings')}>
              <Text style={s.outlineBtnText}>Settings</Text>
            </Pressable>
          </View>

          {/* Empty state */}
          {stats.invoiceCount === 0 && (
            <View style={s.empty}>
              <Text style={s.emptyTitle}>No invoices yet</Text>
              <Text style={s.emptyText}>Create your first invoice to see stats here.</Text>
              <Pressable style={s.primaryBtn} onPress={() => router.push('/invoice/new')}>
                <Text style={s.primaryBtnText}>Create First Invoice</Text>
              </Pressable>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

function StatCard({ label, value, sub, color, subColor }: { label: string; value: string; sub?: string; color: string; subColor?: string }) {
  return (
    <NeuCard intensity="subtle" style={s.statCard}>
      <Text style={LABEL}>{label}</Text>
      <Text style={[DATA_VALUE, { color, fontSize: 18, marginTop: 4 }]}>{value}</Text>
      {sub && <Text style={[s.statSub, subColor ? { color: subColor } : undefined]}>{sub}</Text>}
    </NeuCard>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 80, paddingTop: 8 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  statCard: { width: '46%', marginHorizontal: '2%', padding: 12 },
  statSub: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  section: { marginTop: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontFamily: FONTS.bodyBold, fontSize: 12, color: COLORS.textDim, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 },
  viewAllText: { fontFamily: FONTS.bodyBold, fontSize: 12, color: COLORS.teal },
  invoiceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  invoiceInfo: { flex: 1, marginRight: 12 },
  invoiceTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  invoiceNumber: { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.teal },
  invoiceClient: { fontFamily: FONTS.bodyBold, fontSize: 13, color: COLORS.text },
  invoiceVenue: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.textDim },
  invoiceAmount: { fontFamily: FONTS.mono, fontSize: 16, color: COLORS.text },
  overdueBadge: { fontFamily: FONTS.bodyBold, fontSize: 10, color: COLORS.danger, letterSpacing: 0.5 },
  monthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
  monthName: { fontFamily: FONTS.bodyBold, fontSize: 13, color: COLORS.text },
  monthCount: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.textMuted },
  monthRight: { alignItems: 'flex-end' },
  monthInvoiced: { fontFamily: FONTS.mono, fontSize: 14, color: COLORS.text },
  monthPaid: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.success },
  outlineBtn: { paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', marginBottom: 8 },
  outlineBtnText: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textDim },
  primaryBtn: { paddingVertical: 14, borderRadius: 8, backgroundColor: COLORS.green, alignItems: 'center', marginBottom: 8 },
  primaryBtnText: { fontFamily: FONTS.bodyBold, fontSize: 14, color: COLORS.background },
  empty: { alignItems: 'center', padding: 40 },
  emptyTitle: { fontFamily: FONTS.bodyBold, fontSize: 16, color: COLORS.textDim },
  emptyText: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted, marginTop: 8, textAlign: 'center', marginBottom: 16 },
});

import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NeuCard, NeuButton, StatusBadge } from '../../src/components';
import { COLORS, FONTS, LABEL } from '../../src/theme';
import {
  getInvoice, InvoiceWithClient,
  updateInvoiceStatus, updateInvoicePdfUri,
  getReceiptsForInvoice, ReceiptWithMember,
  getSettings, GigBooksSettings,
  deleteInvoice, markInvoicePaid,
} from '../../src/db';
import { formatGBP } from '../../src/utils/formatCurrency';
import { formatDateLong } from '../../src/utils/formatDate';
import { getInvoiceHtml } from '../../src/pdf/getInvoiceTemplate';
import { InvoiceStyle, INVOICE_STYLES } from '../../src/pdf/invoiceStyles';
import { generatePdf, sharePdf, deletePdf } from '../../src/pdf/generatePdf';

export default function InvoiceDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [invoice, setInvoice] = useState<InvoiceWithClient | null>(null);
  const [settings, setSettings] = useState<GigBooksSettings | null>(null);
  const [receipts, setReceipts] = useState<ReceiptWithMember[]>([]);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        if (!id) return;
        const [inv, s, r] = await Promise.all([
          getInvoice(id),
          getSettings(),
          getReceiptsForInvoice(id),
        ]);
        setInvoice(inv);
        setSettings(s);
        setReceipts(r);
      }
      load();
    }, [id])
  );

  if (!invoice || !settings) return <View style={styles.container} />;

  async function handleStatusChange(status: 'draft' | 'sent' | 'paid') {
    if (status === 'paid') {
      // Atomic: mark paid + generate receipts in one transaction
      const newReceipts = await markInvoicePaid(invoice!.id);
      setReceipts(newReceipts);
    } else {
      await updateInvoiceStatus(invoice!.id, status);
    }
    const updated = await getInvoice(invoice!.id);
    setInvoice(updated);
  }

  async function handleRegeneratePdf() {
    if (!invoice || !settings) return;
    const style = (invoice.style || 'classic') as InvoiceStyle;
    const html = getInvoiceHtml(style, {
      invoiceNumber: invoice.invoice_number,
      issueDate: formatDateLong(invoice.issue_date),
      dueDate: formatDateLong(invoice.due_date),
      fromName: settings.your_name,
      tradingAs: settings.trading_as,
      businessType: settings.business_type,
      website: settings.website,
      toCompany: invoice.client_company_name,
      toContact: invoice.client_contact_name,
      toAddress: invoice.client_address,
      description: invoice.description,
      amount: invoice.amount,
      bankAccountName: settings.bank_account_name,
      bankName: settings.bank_name,
      bankSortCode: settings.bank_sort_code,
      bankAccountNumber: settings.bank_account_number,
      paymentTermsDays: settings.payment_terms_days,
    });

    const uri = await generatePdf(html, invoice.invoice_number);
    await updateInvoicePdfUri(invoice.id, uri);
    setInvoice({ ...invoice, pdf_uri: uri });
  }

  async function handleSharePdf() {
    if (invoice?.pdf_uri) {
      await sharePdf(invoice.pdf_uri, `Share ${invoice.invoice_number}`);
    } else {
      await handleRegeneratePdf();
    }
    // Auto-mark as sent (only upgrade from draft, never downgrade from paid)
    if (invoice?.status === 'draft') {
      await updateInvoiceStatus(invoice.id, 'sent');
      const updated = await getInvoice(invoice.id);
      setInvoice(updated);
    }
  }

  function handleDuplicate() {
    router.push({
      pathname: '/invoice/new',
      params: {
        prefill_client_id: invoice!.client_id,
        prefill_venue: invoice!.venue,
        prefill_amount: String(invoice!.amount),
        prefill_style: invoice!.style || 'classic',
      },
    });
  }

  function handleReceipts() {
    router.push({ pathname: '/invoice/receipts', params: { invoiceId: invoice!.id } });
  }

  function handlePreview() {
    router.push({ pathname: '/invoice/preview', params: { id: invoice!.id } });
  }

  function handleDelete() {
    Alert.alert(
      'Delete Invoice',
      'This will also delete any receipts and PDFs. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const pdfUris = await deleteInvoice(invoice!.id);
            for (const uri of pdfUris) {
              deletePdf(uri);
            }
            router.back();
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <NeuButton label="Back" onPress={() => router.back()} small />
          <Text style={styles.title}>{invoice.invoice_number}</Text>
          <StatusBadge status={invoice.status} />
        </View>

        {/* Details */}
        <NeuCard>
          <Text style={LABEL}>INVOICE DETAILS</Text>
          <View style={{ height: 8 }} />
          <DetailRow label="Client" value={invoice.client_company_name} />
          <DetailRow label="Venue" value={invoice.venue} />
          <DetailRow label="Gig Date" value={formatDateLong(invoice.gig_date)} />
          <DetailRow label="Amount" value={formatGBP(invoice.amount)} highlight />
          <DetailRow label="Description" value={invoice.description} />
          <View style={styles.divider} />
          <DetailRow label="Issue Date" value={formatDateLong(invoice.issue_date)} />
          <DetailRow label="Due Date" value={formatDateLong(invoice.due_date)} />
          {invoice.paid_date ? <DetailRow label="Paid Date" value={formatDateLong(invoice.paid_date)} /> : null}
          <DetailRow label="Style" value={INVOICE_STYLES.find(s => s.id === invoice.style)?.name || 'Classic'} />
        </NeuCard>

        {/* Status Controls */}
        <NeuCard>
          <Text style={LABEL}>STATUS</Text>
          <View style={{ height: 8 }} />
          <View style={styles.statusRow}>
            {(['draft', 'sent', 'paid'] as const).map(s => (
              <NeuButton
                key={s}
                label={s.charAt(0).toUpperCase() + s.slice(1)}
                onPress={() => handleStatusChange(s)}
                color={invoice.status === s ? COLORS.teal : COLORS.textDim}
                small
                style={{ flex: 1, marginHorizontal: 3 }}
              />
            ))}
          </View>
        </NeuCard>

        {/* Receipts */}
        {receipts.length > 0 && (
          <NeuCard>
            <Text style={LABEL}>RECEIPTS ({receipts.length})</Text>
            <View style={{ height: 8 }} />
            {receipts.map(r => (
              <View key={r.id} style={styles.receiptRow}>
                <Text style={styles.receiptName}>{r.member_name}</Text>
                <Text style={styles.receiptAmount}>{formatGBP(r.amount)}</Text>
              </View>
            ))}
          </NeuCard>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <NeuButton label="Preview Invoice" onPress={handlePreview} color={COLORS.teal} />
          <View style={{ height: 8 }} />
          <NeuButton label="Share Invoice PDF" onPress={handleSharePdf} color={COLORS.teal} />
          <View style={{ height: 8 }} />
          <NeuButton label="Regenerate PDF" onPress={handleRegeneratePdf} color={COLORS.orange} />
          <View style={{ height: 8 }} />
          <NeuButton label={receipts.length > 0 ? 'View Receipts' : 'Generate Receipts'} onPress={handleReceipts} color={COLORS.orange} />
          <View style={{ height: 8 }} />
          <NeuButton label="Create Similar Invoice" onPress={handleDuplicate} color={COLORS.textDim} />
          <View style={{ height: 8 }} />
          <NeuButton label="Delete Invoice" onPress={handleDelete} color={COLORS.danger} />
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, highlight && { color: COLORS.teal, fontFamily: FONTS.mono, fontSize: 18 }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontFamily: FONTS.mono, fontSize: 16, color: COLORS.teal },
  detailRow: { flexDirection: 'row', marginBottom: 8 },
  detailLabel: { fontFamily: FONTS.bodyBold, fontSize: 11, color: COLORS.textDim, width: 80, paddingTop: 2 },
  detailValue: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.text, flex: 1 },
  divider: { height: 1, backgroundColor: COLORS.cardLight, marginVertical: 8 },
  statusRow: { flexDirection: 'row' },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.cardLight },
  receiptName: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.text },
  receiptAmount: { fontFamily: FONTS.monoRegular, fontSize: 13, color: COLORS.textDim },
  actions: { marginTop: 12 },
});

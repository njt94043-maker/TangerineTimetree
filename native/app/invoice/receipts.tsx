import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NeuCard, NeuButton } from '../../src/components';
import { COLORS, FONTS, LABEL } from '../../src/theme';
import {
  getInvoice, InvoiceWithClient,
  getBandMembers, BandMember,
  createReceipts, getReceiptsForInvoice, ReceiptWithMember,
  updateReceiptPdfUri, getSettings, GigBooksSettings,
} from '../../src/db';
import { formatGBP } from '../../src/utils/formatCurrency';
import { formatDateLong } from '../../src/utils/formatDate';
import { getReceiptHtml } from '../../src/pdf/getReceiptTemplate';
import { InvoiceStyle } from '../../src/pdf/invoiceStyles';
import { generatePdf, sharePdf } from '../../src/pdf/generatePdf';

export default function ReceiptsScreen() {
  const router = useRouter();
  const { invoiceId } = useLocalSearchParams<{ invoiceId: string }>();

  const [invoice, setInvoice] = useState<InvoiceWithClient | null>(null);
  const [settings, setSettings] = useState<GigBooksSettings | null>(null);
  const [members, setMembers] = useState<BandMember[]>([]);
  const [receipts, setReceipts] = useState<ReceiptWithMember[]>([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    async function load() {
      if (!invoiceId) return;
      const [inv, s, m, r] = await Promise.all([
        getInvoice(invoiceId),
        getSettings(),
        getBandMembers(),
        getReceiptsForInvoice(invoiceId),
      ]);
      setInvoice(inv);
      setSettings(s);
      setMembers(m);
      setReceipts(r);
    }
    load();
  }, [invoiceId]);

  if (!invoice || !settings) return <View style={styles.container} />;

  const totalMembers = members.length;
  const perPerson = Math.round((invoice.amount / totalMembers) * 100) / 100;
  const otherMembers = members.filter(m => !m.is_self);
  const hasReceipts = receipts.length > 0;

  async function handleGenerate() {
    if (!invoice || !settings) return;
    setGenerating(true);

    try {
      const newReceipts = await createReceipts(invoice.id);

      // Generate PDFs for each receipt
      for (const receipt of newReceipts) {
        const style = (invoice.style || 'classic') as InvoiceStyle;
        const html = getReceiptHtml(style, {
          receiptDate: formatDateLong(receipt.date),
          paidTo: receipt.member_name,
          paidBy: settings.your_name,
          amount: receipt.amount,
          venue: invoice.venue,
          gigDate: formatDateLong(invoice.gig_date),
          invoiceNumber: invoice.invoice_number,
          description: invoice.description,
          website: settings.website,
        });

        const filename = `RECEIPT-${invoice.invoice_number}-${receipt.member_name.replace(/\s+/g, '-')}`;
        const uri = await generatePdf(html, filename);
        await updateReceiptPdfUri(receipt.id, uri);
      }

      // Reload receipts
      const updated = await getReceiptsForInvoice(invoice.id);
      setReceipts(updated);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to generate receipts');
    } finally {
      setGenerating(false);
    }
  }

  async function handleShareReceipt(receipt: ReceiptWithMember) {
    if (receipt.pdf_uri) {
      await sharePdf(receipt.pdf_uri, `Receipt for ${receipt.member_name}`);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <NeuButton label="Back" onPress={() => router.back()} small />
          <Text style={styles.title}>Receipts</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Gig Summary */}
        <NeuCard>
          <Text style={LABEL}>GIG SUMMARY</Text>
          <View style={{ height: 8 }} />
          <Text style={styles.summaryText}>{invoice.venue} - {formatDateLong(invoice.gig_date)}</Text>
          <Text style={styles.summaryAmount}>{formatGBP(invoice.amount)}</Text>
          <View style={{ height: 8 }} />
          <Text style={styles.splitText}>{totalMembers} members = {formatGBP(perPerson)} each</Text>
        </NeuCard>

        {/* Receipts to generate / already generated */}
        <NeuCard>
          <Text style={LABEL}>MEMBER PAYMENTS</Text>
          <View style={{ height: 8 }} />
          {hasReceipts ? (
            receipts.map(r => (
              <View key={r.id} style={styles.receiptRow}>
                <View style={styles.receiptInfo}>
                  <Text style={styles.receiptName}>{r.member_name}</Text>
                  <Text style={styles.receiptAmount}>{formatGBP(r.amount)}</Text>
                </View>
                <NeuButton
                  label="Share"
                  onPress={() => handleShareReceipt(r)}
                  color={COLORS.teal}
                  small
                />
              </View>
            ))
          ) : (
            otherMembers.map(m => (
              <View key={m.id} style={styles.receiptRow}>
                <View style={styles.receiptInfo}>
                  <Text style={styles.receiptName}>{m.name}</Text>
                  <Text style={styles.receiptAmount}>{formatGBP(perPerson)}</Text>
                </View>
              </View>
            ))
          )}
        </NeuCard>

        {!hasReceipts && (
          <NeuButton
            label={generating ? 'Generating...' : 'Generate All Receipts'}
            onPress={handleGenerate}
            color={COLORS.orange}
            style={{ marginTop: 8 }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontFamily: FONTS.bodyBold, fontSize: 18, color: COLORS.text },
  summaryText: { fontFamily: FONTS.bodyBold, fontSize: 14, color: COLORS.text },
  summaryAmount: { fontFamily: FONTS.mono, fontSize: 28, color: COLORS.teal, marginTop: 4 },
  splitText: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.orange },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.cardLight },
  receiptInfo: { flex: 1 },
  receiptName: { fontFamily: FONTS.bodyBold, fontSize: 14, color: COLORS.text },
  receiptAmount: { fontFamily: FONTS.monoRegular, fontSize: 13, color: COLORS.textDim },
});

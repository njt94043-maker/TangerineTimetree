import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NeuCard, NeuButton, StatusBadge } from '../../src/components';
import { COLORS, FONTS, LABEL } from '../../src/theme';
import {
  getQuote, QuoteWithClient,
  getQuoteLineItems, QuoteLineItem,
  getSettings, GigBooksSettings,
  getBandSettings,
  sendQuote, acceptQuote, declineQuote, expireQuote, deleteQuote,
  getFormalInvoiceByQuote, FormalInvoiceWithClient,
  getFormalInvoiceLineItems, FormalInvoiceLineItem,
  sendFormalInvoice, markFormalInvoicePaid,
  getFormalReceipts, FormalReceipt,
  getBandMembers, BandMember,
} from '../../src/db';
import { formatGBP } from '../../src/utils/formatCurrency';
import { formatDateLong, addDays } from '../../src/utils/formatDate';
import { getQuoteHtml, getFormalInvoiceHtml, INVOICE_STYLES } from '@shared/templates';
import type { InvoiceStyle, BandSettings } from '@shared/supabase/types';
import { createGig } from '@shared/supabase/queries';
import { generatePdf, sharePdf } from '../../src/pdf/generatePdf';

const PROGRESS_STAGES = ['Draft', 'Sent', 'Accepted', 'Invoice Sent', 'Paid'];

function stageIndex(status: string): number {
  switch (status) {
    case 'draft': return 0;
    case 'sent': return 1;
    case 'accepted': return 2;
    case 'invoice-sent': return 3;
    case 'paid': return 4;
    default: return -1; // declined/expired
  }
}

export default function QuoteDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [quote, setQuote] = useState<QuoteWithClient | null>(null);
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([]);
  const [settings, setSettings] = useState<GigBooksSettings | null>(null);
  const [bandSettings, setBandSettings] = useState<BandSettings | null>(null);
  const [formalInvoice, setFormalInvoice] = useState<FormalInvoiceWithClient | null>(null);
  const [formalLineItems, setFormalLineItems] = useState<FormalInvoiceLineItem[]>([]);
  const [formalReceipts, setFormalReceipts] = useState<FormalReceipt[]>([]);
  const [members, setMembers] = useState<BandMember[]>([]);

  const reload = useCallback(async () => {
    if (!id) return;
    try {
      const [q, li, s, bs, m] = await Promise.all([
        getQuote(id),
        getQuoteLineItems(id),
        getSettings(),
        getBandSettings(),
        getBandMembers(),
      ]);
      setQuote(q);
      setLineItems(li);
      setSettings(s);
      setBandSettings(bs);
      setMembers(m);

      // Load formal invoice for accepted/sent/paid quotes
      if (q && q.status === 'accepted') {
        try {
          const fi = await getFormalInvoiceByQuote(id);
          if (fi) {
            setFormalInvoice(fi);
            const [fiLi, fr] = await Promise.all([
              getFormalInvoiceLineItems(fi.id),
              getFormalReceipts(fi.id),
            ]);
            setFormalLineItems(fiLi);
            setFormalReceipts(fr);
          }
        } catch {
          // No formal invoice yet
        }
      } else {
        setFormalInvoice(null);
        setFormalLineItems([]);
        setFormalReceipts([]);
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to load quote');
    }
  }, [id]);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  if (!quote || !settings) return <View style={styles.container} />;

  const subtotal = lineItems.reduce((sum, li) => sum + li.line_total, 0);
  const isTerminal = quote.status === 'declined' || quote.status === 'expired';
  const currentStage = stageIndex(quote.status);
  const createdDate = quote.created_at.split('T')[0];
  const validUntilDate = addDays(createdDate, quote.validity_days || 30);

  // ─── Actions ───

  async function handleSend() {
    try {
      await sendQuote(quote!.id);
      await reload();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to send quote');
    }
  }

  async function handleAccept() {
    Alert.alert('Accept Quote', 'This will generate a formal invoice from this quote.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Accept',
        onPress: async () => {
          try {
            await acceptQuote(quote!.id);
            await reload();
            // Prompt to add gig to calendar
            Alert.alert(
              'Quote Accepted!',
              `Add a gig to the calendar for ${formatDateLong(quote!.event_date)} at ${quote!.venue_name}?`,
              [
                { text: 'Not Now', style: 'cancel' },
                {
                  text: 'Add Gig',
                  onPress: async () => {
                    try {
                      await createGig({
                        date: quote!.event_date,
                        venue: quote!.venue_name,
                        venue_id: quote!.venue_id,
                        client_id: quote!.client_id,
                        client_name: quote!.client_company_name || '',
                        fee: quote!.total,
                        payment_type: 'invoice',
                        visibility: 'hidden',
                      });
                    } catch { /* gig creation is optional */ }
                  },
                },
              ],
            );
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to accept quote');
          }
        },
      },
    ]);
  }

  async function handleDecline() {
    Alert.alert('Decline Quote', 'Mark this quote as declined?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline',
        style: 'destructive',
        onPress: async () => {
          try {
            await declineQuote(quote!.id);
            await reload();
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to decline quote');
          }
        },
      },
    ]);
  }

  async function handleExpire() {
    try {
      await expireQuote(quote!.id);
      await reload();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to expire quote');
    }
  }

  async function handleSendFormalInvoice() {
    if (!formalInvoice) return;
    try {
      await sendFormalInvoice(formalInvoice.id);
      await reload();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to send invoice');
    }
  }

  async function handleMarkPaid() {
    if (!formalInvoice) return;
    try {
      await markFormalInvoicePaid(formalInvoice.id);
      await reload();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to mark as paid');
    }
  }

  async function handleShareQuotePdf() {
    if (!quote || !settings || !bandSettings) return;
    try {
      const style = (quote.style || 'classic') as InvoiceStyle;
      const html = getQuoteHtml(style, {
        quoteNumber: quote.quote_number,
        quoteDate: formatDateLong(createdDate),
        validUntil: formatDateLong(validUntilDate),
        fromName: settings.your_name,
        tradingAs: settings.trading_as,
        businessType: settings.business_type,
        website: settings.website,
        toCompany: quote.client_company_name,
        toContact: quote.client_contact_name,
        toAddress: quote.client_address,
        toEmail: quote.client_email || '',
        toPhone: quote.client_phone || '',
        eventType: quote.event_type,
        eventDate: formatDateLong(quote.event_date),
        venueName: quote.venue_name,
        venueAddress: quote.venue_address || '',
        lineItems: lineItems.map(li => ({
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unit_price,
          lineTotal: li.line_total,
        })),
        subtotal,
        discountAmount: quote.discount_amount || 0,
        total: quote.total,
        pliOption: quote.pli_option || 'none',
        pliInsurer: bandSettings.pli_insurer || '',
        pliPolicyNumber: bandSettings.pli_policy_number || '',
        pliCoverAmount: bandSettings.pli_cover_amount || '',
        pliExpiryDate: bandSettings.pli_expiry_date ? formatDateLong(bandSettings.pli_expiry_date) : '',
        termsAndConditions: quote.terms_and_conditions || '',
        validityDays: quote.validity_days || 30,
        notes: quote.notes || '',
      });

      const uri = await generatePdf(html, quote.quote_number);
      await sharePdf(uri, `Share ${quote.quote_number}`);

      // Auto-mark as sent if draft
      if (quote.status === 'draft') {
        await sendQuote(quote.id);
        await reload();
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to generate PDF');
    }
  }

  function handlePreview() {
    router.push({ pathname: '/quote/preview', params: { id: quote!.id } });
  }

  function handleDelete() {
    Alert.alert('Delete Quote', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteQuote(quote!.id);
            router.back();
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to delete quote');
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <NeuButton label="Back" onPress={() => router.back()} small />
          <Text style={styles.title}>{quote.quote_number}</Text>
          <StatusBadge status={quote.status} />
        </View>

        {/* Progress tracker */}
        {!isTerminal && (
          <View style={styles.progressRow}>
            {PROGRESS_STAGES.map((stage, idx) => (
              <View key={stage} style={styles.progressItem}>
                <View style={[
                  styles.progressDot,
                  idx <= currentStage && styles.progressDotActive,
                  idx === currentStage && styles.progressDotCurrent,
                ]} />
                <Text style={[
                  styles.progressLabel,
                  idx <= currentStage && styles.progressLabelActive,
                ]}>
                  {stage}
                </Text>
                {idx < PROGRESS_STAGES.length - 1 && (
                  <View style={[styles.progressLine, idx < currentStage && styles.progressLineActive]} />
                )}
              </View>
            ))}
          </View>
        )}

        {/* Quote Details */}
        <NeuCard>
          <Text style={LABEL}>QUOTE DETAILS</Text>
          <View style={{ height: 8 }} />
          <DetailRow label="Client" value={quote.client_company_name} />
          {quote.client_contact_name ? <DetailRow label="Contact" value={quote.client_contact_name} /> : null}
          <DetailRow label="Event" value={quote.event_type.charAt(0).toUpperCase() + quote.event_type.slice(1)} />
          <DetailRow label="Date" value={formatDateLong(quote.event_date)} />
          <DetailRow label="Venue" value={quote.venue_name} />
          {quote.venue_address ? <DetailRow label="Address" value={quote.venue_address} /> : null}
          <View style={styles.divider} />
          <DetailRow label="Subtotal" value={formatGBP(subtotal)} />
          {quote.discount_amount > 0 && <DetailRow label="Discount" value={`-${formatGBP(quote.discount_amount)}`} />}
          <DetailRow label="Total" value={formatGBP(quote.total)} highlight />
          <View style={styles.divider} />
          <DetailRow label="Valid Until" value={formatDateLong(validUntilDate)} />
          <DetailRow label="Style" value={INVOICE_STYLES.find(s => s.id === quote.style)?.name || 'Classic'} />
          <DetailRow label="PLI" value={quote.pli_option === 'none' ? 'Not included' : quote.pli_option.charAt(0).toUpperCase() + quote.pli_option.slice(1)} />
        </NeuCard>

        {/* Line Items */}
        <NeuCard>
          <Text style={LABEL}>LINE ITEMS ({lineItems.length})</Text>
          <View style={{ height: 8 }} />
          {lineItems.map(li => (
            <View key={li.id} style={styles.lineItemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.lineItemDesc}>{li.description}</Text>
                <Text style={styles.lineItemQty}>{li.quantity} x {formatGBP(li.unit_price)}</Text>
              </View>
              <Text style={styles.lineItemTotal}>{formatGBP(li.line_total)}</Text>
            </View>
          ))}
        </NeuCard>

        {/* Notes & T&Cs */}
        {(quote.notes || quote.terms_and_conditions) && (
          <NeuCard>
            {quote.notes ? (
              <>
                <Text style={LABEL}>NOTES</Text>
                <Text style={styles.noteText}>{quote.notes}</Text>
              </>
            ) : null}
            {quote.terms_and_conditions ? (
              <>
                <Text style={[LABEL, quote.notes ? { marginTop: 12 } : undefined]}>TERMS & CONDITIONS</Text>
                <Text style={styles.noteText}>{quote.terms_and_conditions}</Text>
              </>
            ) : null}
          </NeuCard>
        )}

        {/* History */}
        <NeuCard>
          <Text style={LABEL}>HISTORY</Text>
          <View style={{ height: 8 }} />
          <DetailRow label="Created" value={formatDateLong(createdDate)} />
          {quote.sent_at && <DetailRow label="Sent" value={formatDateLong(quote.sent_at.split('T')[0])} />}
          {quote.responded_at && <DetailRow label="Responded" value={formatDateLong(quote.responded_at.split('T')[0])} />}
        </NeuCard>

        {/* Formal Invoice section */}
        {formalInvoice && (
          <NeuCard>
            <Text style={LABEL}>FORMAL INVOICE</Text>
            <View style={{ height: 8 }} />
            <DetailRow label="Invoice #" value={formalInvoice.invoice_number} />
            <DetailRow label="Status" value={formalInvoice.status.toUpperCase()} />
            <DetailRow label="Total" value={formatGBP(formalInvoice.total)} highlight />
            {formalInvoice.paid_date && <DetailRow label="Paid" value={formatDateLong(formalInvoice.paid_date)} />}

            {formalReceipts.length > 0 && (
              <>
                <View style={styles.divider} />
                <Text style={[LABEL, { marginTop: 4 }]}>RECEIPTS</Text>
                {formalReceipts.map(r => {
                  const memberName = members.find(m => m.id === r.member_id)?.name || 'Member';
                  return (
                    <View key={r.id} style={styles.receiptRow}>
                      <Text style={styles.receiptName}>{memberName}</Text>
                      <Text style={styles.receiptAmount}>{formatGBP(r.amount)}</Text>
                    </View>
                  );
                })}
              </>
            )}
          </NeuCard>
        )}

        {/* Stage-dependent Actions */}
        <View style={styles.actions}>
          <NeuButton label="Preview Quote" onPress={handlePreview} color={COLORS.teal} />
          <View style={{ height: 8 }} />
          <NeuButton label="Share Quote PDF" onPress={handleShareQuotePdf} color={COLORS.teal} />

          {quote.status === 'draft' && (
            <>
              <View style={{ height: 8 }} />
              <NeuButton label="Mark as Sent" onPress={handleSend} color={COLORS.orange} />
            </>
          )}

          {quote.status === 'sent' && (
            <>
              <View style={{ height: 8 }} />
              <NeuButton label="Accept Quote" onPress={handleAccept} color={COLORS.success} />
              <View style={{ height: 8 }} />
              <NeuButton label="Decline Quote" onPress={handleDecline} color={COLORS.danger} />
              <View style={{ height: 8 }} />
              <NeuButton label="Mark Expired" onPress={handleExpire} color={COLORS.textDim} />
            </>
          )}

          {quote.status === 'accepted' && formalInvoice && formalInvoice.status === 'draft' && (
            <>
              <View style={{ height: 8 }} />
              <NeuButton label="Send Formal Invoice" onPress={handleSendFormalInvoice} color={COLORS.orange} />
            </>
          )}

          {quote.status === 'accepted' && formalInvoice && formalInvoice.status === 'sent' && (
            <>
              <View style={{ height: 8 }} />
              <NeuButton label="Mark as Paid" onPress={handleMarkPaid} color={COLORS.success} />
            </>
          )}

          <View style={{ height: 8 }} />
          <NeuButton label="Delete Quote" onPress={handleDelete} color={COLORS.danger} />
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
  // Progress tracker
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16, paddingHorizontal: 8 },
  progressItem: { alignItems: 'center', flex: 1, position: 'relative' },
  progressDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.cardLight, marginBottom: 4 },
  progressDotActive: { backgroundColor: COLORS.teal + '55' },
  progressDotCurrent: { backgroundColor: COLORS.teal, borderWidth: 2, borderColor: COLORS.teal + '88' },
  progressLine: { position: 'absolute', top: 5, left: '60%', right: '-40%', height: 2, backgroundColor: COLORS.cardLight },
  progressLineActive: { backgroundColor: COLORS.teal + '55' },
  progressLabel: { fontFamily: FONTS.body, fontSize: 8, color: COLORS.textMuted, textAlign: 'center' },
  progressLabelActive: { color: COLORS.teal },
  // Details
  detailRow: { flexDirection: 'row', marginBottom: 8 },
  detailLabel: { fontFamily: FONTS.bodyBold, fontSize: 11, color: COLORS.textDim, width: 80, paddingTop: 2 },
  detailValue: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.text, flex: 1 },
  divider: { height: 1, backgroundColor: COLORS.cardLight, marginVertical: 8 },
  // Line items
  lineItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.cardLight },
  lineItemDesc: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.text },
  lineItemQty: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.textDim, marginTop: 2 },
  lineItemTotal: { fontFamily: FONTS.mono, fontSize: 13, color: COLORS.text },
  // Notes
  noteText: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.text, marginTop: 6, lineHeight: 18 },
  // Receipts
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.cardLight },
  receiptName: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.text },
  receiptAmount: { fontFamily: FONTS.mono, fontSize: 13, color: COLORS.textDim },
  // Actions
  actions: { marginTop: 12 },
});

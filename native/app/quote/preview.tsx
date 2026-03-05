import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Dimensions, ViewToken } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import { NeuButton } from '../../src/components';
import { COLORS, FONTS } from '../../src/theme';
import {
  getQuote,
  getQuoteLineItems,
  getSettings,
  getBandSettings,
  getFormalInvoiceByQuote,
  getFormalInvoiceLineItems,
  getFormalReceipts,
  getBandMembers,
} from '../../src/db';
import { formatDateLong, addDays } from '../../src/utils/formatDate';
import { getQuoteHtml, getFormalInvoiceHtml, INVOICE_STYLES } from '@shared/templates';
import type { QuoteTemplateData, FormalInvoiceTemplateData } from '@shared/templates';
import type { InvoiceStyle } from '@shared/supabase/types';
import { generatePdf, sharePdf } from '../../src/pdf/generatePdf';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function toPreviewHtml(html: string): string {
  return html.replace('width=device-width, initial-scale=1.0', 'width=800');
}

interface PreviewPage {
  key: string;
  label: string;
  html: string;
  shareTitle: string;
  pdfFilename: string;
}

export default function QuotePreviewScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [pages, setPages] = useState<PreviewPage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const carouselRef = useRef<FlatList<PreviewPage>>(null);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
    []
  );
  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  useEffect(() => {
    async function load() {
      if (!id) return;
      const [quote, lineItems, s, bs] = await Promise.all([
        getQuote(id),
        getQuoteLineItems(id),
        getSettings(),
        getBandSettings(),
      ]);
      if (!quote || !s) return;

      const style = (quote.style || 'classic') as InvoiceStyle;
      const styleName = INVOICE_STYLES.find(st => st.id === style)?.name || 'Classic';

      const subtotal = lineItems.reduce((sum, li) => sum + li.line_total, 0);
      const total = subtotal - (quote.discount_amount || 0);

      // Compute valid_until from created_at + validity_days
      const createdDate = quote.created_at.split('T')[0];
      const validUntilDate = addDays(createdDate, quote.validity_days || 30);

      const quoteData: QuoteTemplateData = {
        quoteNumber: quote.quote_number,
        quoteDate: formatDateLong(createdDate),
        validUntil: formatDateLong(validUntilDate),
        fromName: s.your_name,
        tradingAs: s.trading_as,
        businessType: s.business_type,
        website: s.website,
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
        total,
        pliOption: quote.pli_option || 'none',
        pliInsurer: bs?.pli_insurer || '',
        pliPolicyNumber: bs?.pli_policy_number || '',
        pliCoverAmount: bs?.pli_cover_amount || '',
        pliExpiryDate: bs?.pli_expiry_date ? formatDateLong(bs.pli_expiry_date) : '',
        termsAndConditions: quote.terms_and_conditions || '',
        validityDays: quote.validity_days || 30,
        notes: quote.notes || '',
      };

      const allPages: PreviewPage[] = [
        {
          key: 'quote',
          label: `Quote \u00B7 ${styleName}`,
          html: getQuoteHtml(style, quoteData),
          shareTitle: `Share ${quote.quote_number}`,
          pdfFilename: quote.quote_number,
        },
      ];

      // Add formal invoice page if accepted
      if (quote.status === 'accepted') {
        try {
          const formalInvoice = await getFormalInvoiceByQuote(id);
          if (formalInvoice) {
            const fiLineItems = await getFormalInvoiceLineItems(formalInvoice.id);
            const fiSubtotal = fiLineItems.reduce((sum, li) => sum + li.line_total, 0);
            const fiTotal = fiSubtotal - (formalInvoice.discount_amount || 0);

            const fiData: FormalInvoiceTemplateData = {
              invoiceNumber: formalInvoice.invoice_number,
              issueDate: formatDateLong(formalInvoice.issue_date),
              dueDate: formatDateLong(formalInvoice.due_date),
              fromName: s.your_name,
              tradingAs: s.trading_as,
              businessType: s.business_type,
              website: s.website,
              toCompany: formalInvoice.client_company_name,
              toContact: formalInvoice.client_contact_name,
              toAddress: formalInvoice.client_address,
              venueName: quote.venue_name,
              eventDate: formatDateLong(quote.event_date),
              lineItems: fiLineItems.map(li => ({
                description: li.description,
                quantity: li.quantity,
                unitPrice: li.unit_price,
                lineTotal: li.line_total,
              })),
              subtotal: fiSubtotal,
              discountAmount: formalInvoice.discount_amount || 0,
              total: fiTotal,
              bankAccountName: s.bank_account_name,
              bankName: s.bank_name,
              bankSortCode: s.bank_sort_code,
              bankAccountNumber: s.bank_account_number,
              paymentTermsDays: s.payment_terms_days,
              notes: formalInvoice.notes || '',
            };

            allPages.push({
              key: 'formal-invoice',
              label: `Invoice \u00B7 ${formalInvoice.invoice_number}`,
              html: getFormalInvoiceHtml(style, fiData),
              shareTitle: `Share ${formalInvoice.invoice_number}`,
              pdfFilename: formalInvoice.invoice_number,
            });

            // Add receipts if paid
            if (formalInvoice.status === 'paid') {
              const receipts = await getFormalReceipts(formalInvoice.id);
              for (const r of receipts) {
                const members = await getBandMembers();
                const memberName = members.find(m => m.id === r.member_id)?.name || 'Member';
                allPages.push({
                  key: `receipt-${r.id}`,
                  label: `Receipt \u00B7 ${memberName}`,
                  html: `<html><body style="padding:40px;font-family:sans-serif"><h2>Receipt</h2><p>Member: ${memberName}</p><p>Amount: \u00A3${r.amount.toFixed(2)}</p><p>Date: ${formatDateLong(r.date)}</p></body></html>`,
                  shareTitle: `Receipt for ${memberName}`,
                  pdfFilename: `RECEIPT-${formalInvoice.invoice_number}-${memberName.replace(/\s+/g, '-')}`,
                });
              }
            }
          }
        } catch {
          // No formal invoice yet
        }
      }

      setPages(allPages);
    }
    load().catch(err => {
      console.error('Quote preview load failed', err);
      setPages([]);
    });
  }, [id]);

  function goToIndex(index: number) {
    if (index >= 0 && index < pages.length) {
      carouselRef.current?.scrollToIndex({ index, animated: true });
    }
  }

  async function handleShare() {
    const page = pages[currentIndex];
    if (!page) return;
    try {
      const uri = await generatePdf(page.html, page.pdfFilename);
      await sharePdf(uri, page.shareTitle);
    } catch (err) {
      console.error('Share failed', err);
    }
  }

  if (pages.length === 0) return <View style={styles.container} />;

  const currentPage = pages[currentIndex];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <NeuButton label="Back" onPress={() => router.back()} small />
        <Text style={styles.topTitle}>Preview</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.labelBar}>
        <Text style={styles.labelText}>{currentPage?.label ?? ''}</Text>
        {pages.length > 1 && (
          <Text style={styles.counter}>{currentIndex + 1} / {pages.length}</Text>
        )}
      </View>

      <FlatList
        ref={carouselRef}
        data={pages}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={item => item.key}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        windowSize={3}
        maxToRenderPerBatch={2}
        initialNumToRender={1}
        renderItem={({ item }) => (
          <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
            <WebView
              source={{ html: toPreviewHtml(item.html) }}
              style={styles.webview}
              scrollEnabled={true}
              nestedScrollEnabled={false}
            />
          </View>
        )}
      />

      {currentIndex > 0 && (
        <Pressable style={[styles.arrow, styles.arrowLeft]} onPress={() => goToIndex(currentIndex - 1)}>
          <Text style={styles.arrowText}>{'\u2039'}</Text>
        </Pressable>
      )}
      {currentIndex < pages.length - 1 && (
        <Pressable style={[styles.arrow, styles.arrowRight]} onPress={() => goToIndex(currentIndex + 1)}>
          <Text style={styles.arrowText}>{'\u203A'}</Text>
        </Pressable>
      )}

      <View style={styles.actionBar}>
        <NeuButton
          label={currentIndex === 0 ? 'Share Quote PDF' : 'Share PDF'}
          onPress={handleShare}
          color={COLORS.teal}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  topTitle: { fontFamily: FONTS.bodyBold, fontSize: 18, color: COLORS.text },
  labelBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: COLORS.card },
  labelText: { fontFamily: FONTS.bodyBold, fontSize: 14, color: COLORS.text, flex: 1 },
  counter: { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.textDim },
  webview: { flex: 1, backgroundColor: 'transparent' },
  arrow: { position: 'absolute', top: '50%', width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  arrowLeft: { left: 8 },
  arrowRight: { right: 8 },
  arrowText: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginTop: -2 },
  actionBar: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 8, backgroundColor: COLORS.background },
});

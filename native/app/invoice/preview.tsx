import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Dimensions, ViewToken } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import { NeuButton } from '../../src/components';
import { COLORS, FONTS } from '../../src/theme';
import {
  getInvoice, InvoiceWithClient,
  getSettings, GigBooksSettings,
  getReceiptsForInvoice, ReceiptWithMember,
} from '../../src/db';
import { formatDateLong } from '../../src/utils/formatDate';
import type { InvoiceTemplateData } from '@shared/templates';
import { getInvoiceHtml, getReceiptHtml, INVOICE_STYLES } from '@shared/templates';
import type { InvoiceStyle } from '@shared/supabase/types';
import { generatePdf, sharePdf } from '../../src/pdf/generatePdf';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/** Replace device-width viewport with A4-width so WebView matches PDF proportions */
function previewHtml(html: string): string {
  return html.replace('width=device-width, initial-scale=1.0', 'width=800');
}

interface PreviewPage {
  key: string;
  label: string;
  html: string;
  shareTitle: string;
  pdfFilename: string;
}

export default function InvoicePreviewScreen() {
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
      const [inv, s, receipts] = await Promise.all([
        getInvoice(id),
        getSettings(),
        getReceiptsForInvoice(id),
      ]);
      if (!inv || !s) return;

      const style = (inv.style || 'classic') as InvoiceStyle;
      const styleName = INVOICE_STYLES.find(st => st.id === style)?.name || 'Classic';

      const templateData: InvoiceTemplateData = {
        invoiceNumber: inv.invoice_number,
        issueDate: formatDateLong(inv.issue_date),
        dueDate: formatDateLong(inv.due_date),
        fromName: s.your_name,
        tradingAs: s.trading_as,
        businessType: s.business_type,
        website: s.website,
        toCompany: inv.client_company_name,
        toContact: inv.client_contact_name,
        toAddress: inv.client_address,
        description: inv.description,
        amount: inv.amount,
        bankAccountName: s.bank_account_name,
        bankName: s.bank_name,
        bankSortCode: s.bank_sort_code,
        bankAccountNumber: s.bank_account_number,
        paymentTermsDays: s.payment_terms_days,
      };

      // Build pages: invoice first, then receipts
      const allPages: PreviewPage[] = [
        {
          key: 'invoice',
          label: `Invoice \u00B7 ${styleName}`,
          html: getInvoiceHtml(style, templateData),
          shareTitle: `Share ${inv.invoice_number}`,
          pdfFilename: inv.invoice_number,
        },
      ];

      for (const r of receipts) {
        allPages.push({
          key: `receipt-${r.id}`,
          label: `Receipt \u00B7 ${r.member_name}`,
          html: getReceiptHtml(style, {
            receiptDate: formatDateLong(r.date),
            paidTo: r.member_name,
            paidBy: s.your_name,
            amount: r.amount,
            venue: inv.venue,
            gigDate: formatDateLong(inv.gig_date),
            invoiceNumber: inv.invoice_number,
            description: inv.description,
            website: s.website,
          }),
          shareTitle: `Receipt for ${r.member_name}`,
          pdfFilename: `RECEIPT-${inv.invoice_number}-${r.member_name.replace(/\s+/g, '-')}`,
        });
      }

      setPages(allPages);
    }
    load();
  }, [id]);

  function goToIndex(index: number) {
    if (index >= 0 && index < pages.length) {
      carouselRef.current?.scrollToIndex({ index, animated: true });
    }
  }

  async function handleShare() {
    const page = pages[currentIndex];
    if (!page) return;
    // Generate PDF on demand from HTML
    const uri = await generatePdf(page.html, page.pdfFilename);
    await sharePdf(uri, page.shareTitle);
  }

  if (pages.length === 0) return <View style={styles.container} />;

  const currentPage = pages[currentIndex];

  return (
    <SafeAreaView style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <NeuButton label="Back" onPress={() => router.back()} small />
        <Text style={styles.topTitle}>Preview</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Page label bar */}
      <View style={styles.labelBar}>
        <Text style={styles.labelText}>{currentPage?.label ?? ''}</Text>
        {pages.length > 1 && (
          <Text style={styles.counter}>{currentIndex + 1} / {pages.length}</Text>
        )}
      </View>

      {/* Swipeable preview */}
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
              source={{ html: previewHtml(item.html) }}
              style={styles.webview}
              scrollEnabled={true}
              nestedScrollEnabled={false}
            />
          </View>
        )}
      />

      {/* Navigation arrows */}
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

      {/* Share button — always available, generates PDF on demand */}
      <View style={styles.actionBar}>
        <NeuButton
          label={currentIndex === 0 ? 'Share Invoice PDF' : 'Share Receipt'}
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

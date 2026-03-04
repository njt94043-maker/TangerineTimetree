import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, FlatList, Pressable, ScrollView, Modal, StyleSheet, Alert, Dimensions, ViewToken } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import { NeuCard, NeuWell, NeuButton, StepIndicator, CalendarPicker, VenuePicker } from '../../src/components';
import { COLORS, FONTS, LABEL } from '../../src/theme';
import {
  getClients, searchClients, addClient, Client,
  getSettings, GigBooksSettings,
  createInvoice, updateInvoicePdfUri,
} from '../../src/db';
import { formatDateLong, formatDateDisplay, todayISO, addDays } from '../../src/utils/formatDate';
import { formatGBP } from '../../src/utils/formatCurrency';
import { formatInvoiceNumber } from '../../src/utils/invoiceNumber';
import { InvoiceTemplateData } from '../../src/pdf/invoiceTemplate';
import { getInvoiceHtml } from '../../src/pdf/getInvoiceTemplate';
import { InvoiceStyle, DEFAULT_INVOICE_STYLE, INVOICE_STYLES, InvoiceStyleMeta } from '../../src/pdf/invoiceStyles';
import { generatePdf } from '../../src/pdf/generatePdf';

const STEP_LABELS = ['Client', 'Details', 'Preview'];
const { width: SCREEN_WIDTH } = Dimensions.get('window');

/** Replace device-width viewport with A4-width so WebView matches PDF proportions */
function previewHtml(html: string): string {
  return html.replace('width=device-width, initial-scale=1.0', 'width=800');
}

interface PreviewItem {
  style: InvoiceStyleMeta;
  html: string;
}

export default function NewInvoiceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    prefill_client_id?: string;
    prefill_venue?: string;
    prefill_amount?: string;
    prefill_style?: string;
  }>();

  const [step, setStep] = useState(1);
  const [settings, setSettings] = useState<GigBooksSettings | null>(null);

  // Step 1 - client
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showNewClient, setShowNewClient] = useState(false);

  // New client modal fields
  const [newCompany, setNewCompany] = useState('');
  const [newContact, setNewContact] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');

  // Step 2 - details
  const [venue, setVenue] = useState(params.prefill_venue || '');
  const [gigDate, setGigDate] = useState(todayISO());
  const [showCalendar, setShowCalendar] = useState(false);
  const [amount, setAmount] = useState(params.prefill_amount || '');
  const [description, setDescription] = useState('');
  const [descriptionEdited, setDescriptionEdited] = useState(false);

  // Step 3 - preview carousel
  const [selectedStyle, setSelectedStyle] = useState<InvoiceStyle>(
    (params.prefill_style as InvoiceStyle) || DEFAULT_INVOICE_STYLE
  );
  const [previewHtmls, setPreviewHtmls] = useState<PreviewItem[]>([]);
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
  const [generating, setGenerating] = useState(false);
  const carouselRef = useRef<FlatList<PreviewItem>>(null);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentPreviewIndex(viewableItems[0].index);
      }
    },
    []
  );
  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  useEffect(() => {
    async function init() {
      const s = await getSettings();
      setSettings(s);
      const c = await getClients();
      setClients(c);

      // Handle prefill from duplicate
      if (params.prefill_client_id) {
        const match = c.find(cl => cl.id === params.prefill_client_id);
        if (match) {
          setSelectedClient(match);
          setStep(2);
        }
      }
    }
    init();
  }, []);

  // Auto-generate description when venue or date changes
  useEffect(() => {
    if (!descriptionEdited && venue.trim()) {
      setDescription(`Live music performance at ${venue.trim()} on ${formatDateLong(gigDate)}`);
    }
  }, [venue, gigDate, descriptionEdited]);

  async function loadClients() {
    const list = clientSearch.trim() ? await searchClients(clientSearch.trim()) : await getClients();
    setClients(list);
  }

  useEffect(() => { loadClients(); }, [clientSearch]);

  function selectClient(client: Client) {
    setSelectedClient(client);
    setStep(2);
  }

  async function saveNewClient() {
    if (!newCompany.trim()) {
      Alert.alert('Required', 'Company name is required.');
      return;
    }
    const id = await addClient({
      company_name: newCompany.trim(),
      contact_name: newContact.trim(),
      address: newAddress.trim(),
      email: newEmail.trim(),
      phone: newPhone.trim(),
    });
    const newClient: Client = {
      id,
      company_name: newCompany.trim(),
      contact_name: newContact.trim(),
      address: newAddress.trim(),
      email: newEmail.trim(),
      phone: newPhone.trim(),
      created_at: new Date().toISOString(),
    };
    setShowNewClient(false);
    setNewCompany(''); setNewContact(''); setNewAddress(''); setNewEmail(''); setNewPhone('');
    selectClient(newClient);
  }

  function goToStep3() {
    if (!venue.trim()) { Alert.alert('Required', 'Venue name is required.'); return; }
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) { Alert.alert('Required', 'Enter a valid amount.'); return; }
    if (!settings || !selectedClient) return;

    // Build template data for previews
    const templateData: InvoiceTemplateData = {
      invoiceNumber: formatInvoiceNumber(settings.next_invoice_number),
      issueDate: formatDateLong(todayISO()),
      dueDate: formatDateLong(addDays(todayISO(), settings.payment_terms_days)),
      fromName: settings.your_name,
      tradingAs: settings.trading_as,
      businessType: settings.business_type,
      website: settings.website,
      toCompany: selectedClient.company_name,
      toContact: selectedClient.contact_name,
      toAddress: selectedClient.address,
      description: description.trim() || `Live music performance at ${venue.trim()} on ${formatDateLong(gigDate)}`,
      amount: parsedAmount,
      bankAccountName: settings.bank_account_name,
      bankName: settings.bank_name,
      bankSortCode: settings.bank_sort_code,
      bankAccountNumber: settings.bank_account_number,
      paymentTermsDays: settings.payment_terms_days,
    };

    // Pre-render all 4 styles
    const previews = INVOICE_STYLES.map(styleMeta => ({
      style: styleMeta,
      html: getInvoiceHtml(styleMeta.id, templateData),
    }));

    setPreviewHtmls(previews);

    // Scroll to the preferred style
    const prefIndex = previews.findIndex(p => p.style.id === selectedStyle);
    setCurrentPreviewIndex(prefIndex >= 0 ? prefIndex : 0);
    setStep(3);

    // Scroll carousel to preferred style after render
    if (prefIndex > 0) {
      setTimeout(() => {
        carouselRef.current?.scrollToIndex({ index: prefIndex, animated: false });
      }, 100);
    }
  }

  async function handleApproveStyle() {
    if (!settings || !selectedClient) return;
    const style = previewHtmls[currentPreviewIndex]?.style.id || 'classic';
    setSelectedStyle(style);
    setGenerating(true);

    try {
      const parsedAmount = parseFloat(amount);

      const invoice = await createInvoice({
        client_id: selectedClient.id,
        venue: venue.trim(),
        gig_date: gigDate,
        amount: parsedAmount,
        description: description.trim(),
        style,
      });

      const templateData: InvoiceTemplateData = {
        invoiceNumber: invoice.invoice_number,
        issueDate: formatDateLong(invoice.issue_date),
        dueDate: formatDateLong(invoice.due_date),
        fromName: settings.your_name,
        tradingAs: settings.trading_as,
        businessType: settings.business_type,
        website: settings.website,
        toCompany: selectedClient.company_name,
        toContact: selectedClient.contact_name,
        toAddress: selectedClient.address,
        description: invoice.description,
        amount: parsedAmount,
        bankAccountName: settings.bank_account_name,
        bankName: settings.bank_name,
        bankSortCode: settings.bank_sort_code,
        bankAccountNumber: settings.bank_account_number,
        paymentTermsDays: settings.payment_terms_days,
      };

      const html = getInvoiceHtml(style, templateData);
      const pdfUri = await generatePdf(html, invoice.invoice_number);
      await updateInvoicePdfUri(invoice.id, pdfUri);

      router.replace(`/invoice/${invoice.id}`);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to generate invoice');
    } finally {
      setGenerating(false);
    }
  }

  function goToCarouselIndex(index: number) {
    if (index >= 0 && index < previewHtmls.length) {
      carouselRef.current?.scrollToIndex({ index, animated: true });
    }
  }

  if (!settings) return <View style={styles.container} />;

  const currentStyleMeta = previewHtmls[currentPreviewIndex]?.style;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <NeuButton label={step === 1 ? 'Cancel' : 'Back'} onPress={() => step === 1 ? router.back() : setStep(step - 1 as 1 | 2)} small />
        <Text style={styles.topTitle}>New Invoice</Text>
        <View style={{ width: 60 }} />
      </View>

      <StepIndicator currentStep={step} labels={STEP_LABELS} />

      {/* ─── Step 1: Pick Client ─── */}
      {step === 1 && (
        <View style={styles.stepContent}>
          <NeuWell style={styles.searchWell}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search clients..."
              placeholderTextColor={COLORS.textMuted}
              value={clientSearch}
              onChangeText={setClientSearch}
            />
          </NeuWell>

          <NeuButton
            label="+ Add New Client"
            onPress={() => setShowNewClient(true)}
            color={COLORS.teal}
            small
            style={{ marginBottom: 8 }}
          />

          <FlatList
            data={clients}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <Pressable onPress={() => selectClient(item)}>
                <NeuCard intensity="subtle">
                  <Text style={styles.clientName}>{item.company_name}</Text>
                  {item.contact_name ? <Text style={styles.clientDetail}>{item.contact_name}</Text> : null}
                </NeuCard>
              </Pressable>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                {clientSearch ? 'No matching clients' : 'No clients yet. Add one above.'}
              </Text>
            }
          />

          {/* New Client Modal */}
          <Modal visible={showNewClient} animationType="slide" transparent>
            <Pressable style={styles.modalOverlay} onPress={() => setShowNewClient(false)}>
              <Pressable style={styles.modalContent} onPress={() => {}}>
                <Text style={styles.modalTitle}>New Client</Text>

                <Text style={styles.fieldLabel}>Company Name *</Text>
                <NeuWell style={styles.inputWell}>
                  <TextInput style={styles.input} value={newCompany} onChangeText={setNewCompany} placeholder="Company name" placeholderTextColor={COLORS.textMuted} />
                </NeuWell>

                <Text style={styles.fieldLabel}>Contact Name</Text>
                <NeuWell style={styles.inputWell}>
                  <TextInput style={styles.input} value={newContact} onChangeText={setNewContact} placeholder="Optional" placeholderTextColor={COLORS.textMuted} />
                </NeuWell>

                <Text style={styles.fieldLabel}>Address</Text>
                <NeuWell style={styles.inputWell}>
                  <TextInput style={[styles.input, { minHeight: 50 }]} value={newAddress} onChangeText={setNewAddress} placeholder="Full address" placeholderTextColor={COLORS.textMuted} multiline textAlignVertical="top" />
                </NeuWell>

                <Text style={styles.fieldLabel}>Email</Text>
                <NeuWell style={styles.inputWell}>
                  <TextInput style={styles.input} value={newEmail} onChangeText={setNewEmail} placeholder="Optional" placeholderTextColor={COLORS.textMuted} keyboardType="email-address" />
                </NeuWell>

                <Text style={styles.fieldLabel}>Phone</Text>
                <NeuWell style={styles.inputWell}>
                  <TextInput style={styles.input} value={newPhone} onChangeText={setNewPhone} placeholder="Optional" placeholderTextColor={COLORS.textMuted} keyboardType="phone-pad" />
                </NeuWell>

                <View style={styles.modalActions}>
                  <NeuButton label="Cancel" onPress={() => setShowNewClient(false)} small style={{ flex: 1, marginRight: 8 }} />
                  <NeuButton label="Save & Select" onPress={saveNewClient} color={COLORS.teal} small style={{ flex: 1 }} />
                </View>
              </Pressable>
            </Pressable>
          </Modal>
        </View>
      )}

      {/* ─── Step 2: Gig Details ─── */}
      {step === 2 && selectedClient && (
        <ScrollView contentContainerStyle={styles.stepScrollContent}>
          <NeuCard>
            <Text style={styles.selectedClientLabel}>Client: {selectedClient.company_name}</Text>
          </NeuCard>

          <NeuCard>
            <Text style={LABEL}>GIG DETAILS</Text>
            <View style={{ height: 8 }} />

            <Text style={styles.fieldLabel}>Venue Name *</Text>
            <VenuePicker
              clientId={selectedClient.id}
              selectedVenue={venue}
              onSelectVenue={setVenue}
            />

            <Text style={styles.fieldLabel}>Gig Date</Text>
            <Pressable onPress={() => setShowCalendar(true)}>
              <NeuWell style={styles.inputWell}>
                <Text style={[styles.input, { paddingVertical: 12 }]}>
                  {formatDateDisplay(gigDate)}
                </Text>
              </NeuWell>
            </Pressable>
            <CalendarPicker
              visible={showCalendar}
              selectedDate={gigDate}
              onConfirm={(date) => { setGigDate(date); setShowCalendar(false); }}
              onCancel={() => setShowCalendar(false)}
            />

            <Text style={styles.fieldLabel}>Amount (GBP) *</Text>
            <NeuWell style={styles.inputWell}>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                onBlur={() => { const n = parseFloat(amount); if (!isNaN(n) && n > 0) setAmount(n.toFixed(2)); }}
                placeholder="e.g. 400"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="decimal-pad"
              />
            </NeuWell>

            <Text style={styles.fieldLabel}>Description</Text>
            <NeuWell style={styles.inputWell}>
              <TextInput
                style={[styles.input, { minHeight: 50 }]}
                value={description}
                onChangeText={v => { setDescription(v); setDescriptionEdited(true); }}
                placeholder="Auto-generated from venue + date"
                placeholderTextColor={COLORS.textMuted}
                multiline
                textAlignVertical="top"
              />
            </NeuWell>
            <Text style={styles.hintText}>Edit above to customise, or leave as-is</Text>
          </NeuCard>

          <NeuButton label="Preview Invoice" onPress={goToStep3} color={COLORS.teal} style={{ marginTop: 8 }} />
        </ScrollView>
      )}

      {/* ─── Step 3: Full-Screen Style Preview ─── */}
      {step === 3 && previewHtmls.length > 0 && (
        <View style={{ flex: 1 }}>
          {/* Style name bar */}
          <View style={styles.styleNameBar}>
            <Text style={styles.styleName}>{currentStyleMeta?.name ?? ''}</Text>
            <Text style={styles.styleDesc}>{currentStyleMeta?.description ?? ''}</Text>
            <Text style={styles.styleCounter}>{currentPreviewIndex + 1} / {previewHtmls.length}</Text>
          </View>

          {/* Preview carousel */}
          <FlatList
            ref={carouselRef}
            data={previewHtmls}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={item => item.style.id}
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
          {currentPreviewIndex > 0 && (
            <Pressable style={[styles.arrow, styles.arrowLeft]} onPress={() => goToCarouselIndex(currentPreviewIndex - 1)}>
              <Text style={styles.arrowText}>{'‹'}</Text>
            </Pressable>
          )}
          {currentPreviewIndex < previewHtmls.length - 1 && (
            <Pressable style={[styles.arrow, styles.arrowRight]} onPress={() => goToCarouselIndex(currentPreviewIndex + 1)}>
              <Text style={styles.arrowText}>{'›'}</Text>
            </Pressable>
          )}

          {/* Approve button */}
          <View style={styles.approveBar}>
            <NeuButton
              label={generating ? 'Saving...' : 'Approve & Save'}
              onPress={handleApproveStyle}
              color={COLORS.teal}
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  topTitle: { fontFamily: FONTS.bodyBold, fontSize: 18, color: COLORS.text },
  stepContent: { flex: 1, paddingHorizontal: 16 },
  stepScrollContent: { paddingHorizontal: 16, paddingBottom: 30 },
  searchWell: { padding: 0, marginBottom: 8 },
  searchInput: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.text, padding: 12 },
  clientName: { fontFamily: FONTS.bodyBold, fontSize: 14, color: COLORS.text },
  clientDetail: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textDim, marginTop: 2 },
  emptyText: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textDim, textAlign: 'center', paddingTop: 40 },
  selectedClientLabel: { fontFamily: FONTS.bodyBold, fontSize: 14, color: COLORS.teal },
  fieldLabel: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.textDim, marginBottom: 4, marginTop: 8 },
  inputWell: { padding: 0 },
  input: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.text, padding: 10 },
  hintText: { fontFamily: FONTS.body, fontSize: 10, color: COLORS.textMuted, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: COLORS.card, borderRadius: 16, padding: 20, maxHeight: '85%' },
  modalTitle: { fontFamily: FONTS.bodyBold, fontSize: 18, color: COLORS.text, marginBottom: 12 },
  modalActions: { flexDirection: 'row', marginTop: 16 },
  // Step 3 - preview carousel
  styleNameBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: COLORS.card },
  styleName: { fontFamily: FONTS.bodyBold, fontSize: 16, color: COLORS.text },
  styleDesc: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textDim, marginLeft: 8, flex: 1 },
  styleCounter: { fontFamily: FONTS.mono, fontSize: 12, color: COLORS.textDim },
  webview: { flex: 1, backgroundColor: 'transparent' },
  arrow: { position: 'absolute', top: '50%', width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  arrowLeft: { left: 8 },
  arrowRight: { right: 8 },
  arrowText: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginTop: -2 },
  approveBar: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 8, backgroundColor: COLORS.background },
});

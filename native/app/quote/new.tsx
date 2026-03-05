import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, Pressable, ScrollView, Modal,
  StyleSheet, Alert, Dimensions, ViewToken,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import { NeuCard, NeuWell, NeuButton, StepIndicator, CalendarPicker, EntityPicker } from '../../src/components';
import { COLORS, FONTS, LABEL } from '../../src/theme';
import {
  getClients, searchClients, addClient, Client,
  getSettings, GigBooksSettings,
  getBandSettings,
  getServiceCatalogue, ServiceCatalogueItem,
  createQuote, getVenue,
} from '../../src/db';
import { formatDateLong, formatDateDisplay, todayISO, addDays } from '../../src/utils/formatDate';
import { formatGBP } from '../../src/utils/formatCurrency';
import type { QuoteTemplateData, InvoiceStyleMeta } from '@shared/templates';
import { getQuoteHtml, INVOICE_STYLES } from '@shared/templates';
import type { InvoiceStyle, EventType, PLIOption, BandSettings, Venue } from '@shared/supabase/types';

type BillToType = 'client' | 'venue';
const STEP_LABELS = ['Bill To', 'Package', 'Extras', 'Preview'];
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const EVENT_TYPES: { label: string; value: EventType }[] = [
  { label: 'Wedding', value: 'wedding' },
  { label: 'Corporate', value: 'corporate' },
  { label: 'Private', value: 'private' },
  { label: 'Festival', value: 'festival' },
  { label: 'Other', value: 'other' },
];

function previewHtml(html: string): string {
  return html.replace('width=device-width, initial-scale=1.0', 'width=800');
}

interface LineItem {
  key: string;
  service_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
}

interface PreviewItem {
  style: InvoiceStyleMeta;
  html: string;
}

export default function NewQuoteScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [settings, setSettings] = useState<GigBooksSettings | null>(null);
  const [bandSettings, setBandSettings] = useState<BandSettings | null>(null);

  // Step 1 — Bill To & Event
  const [billToType, setBillToType] = useState<BillToType>('client');
  const [billToVenue, setBillToVenue] = useState<Venue | null>(null);
  const [billToVenueName, setBillToVenueName] = useState('');
  const [billToVenueId, setBillToVenueId] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newCompany, setNewCompany] = useState('');
  const [newContact, setNewContact] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [eventType, setEventType] = useState<EventType>('wedding');
  const [eventDate, setEventDate] = useState(todayISO());
  const [showCalendar, setShowCalendar] = useState(false);
  const [venueName, setVenueName] = useState('');
  const [venueId, setVenueId] = useState<string | null>(null);
  const [venueAddress, setVenueAddress] = useState('');

  // Step 2 — Package builder
  const [services, setServices] = useState<ServiceCatalogueItem[]>([]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [discount, setDiscount] = useState('0');

  // Step 3 — Extras
  const [pliOption, setPliOption] = useState<PLIOption>('none');
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [validityDays, setValidityDays] = useState('30');
  const [notes, setNotes] = useState('');

  // Step 4 — Preview carousel
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
      try {
        const [s, bs, c, svc] = await Promise.all([
          getSettings(),
          getBandSettings(),
          getClients(),
          getServiceCatalogue(),
        ]);
        setSettings(s);
        setBandSettings(bs);
        setClients(c);
        setServices(svc);

        // Pre-fill defaults from band settings
        if (bs) {
          setTermsAndConditions(bs.default_terms_and_conditions || '');
          setValidityDays(String(bs.default_quote_validity_days || 30));
        }
      } catch (err) {
        Alert.alert('Error', err instanceof Error ? err.message : 'Failed to load data');
      }
    }
    init();
  }, []);

  useEffect(() => {
    async function search() {
      try {
        const list = clientSearch.trim() ? await searchClients(clientSearch.trim()) : await getClients();
        setClients(list);
      } catch { /* search non-critical */ }
    }
    search();
  }, [clientSearch]);

  // Auto-fill venue address when venue is selected from DB
  useEffect(() => {
    if (venueId) {
      getVenue(venueId).then(v => {
        if (v) setVenueAddress([v.address, v.postcode].filter(Boolean).join(', '));
      }).catch(() => {});
    }
  }, [venueId]);

  // Line item calculations
  const subtotal = lineItems.reduce((sum, li) => sum + li.quantity * li.unit_price, 0);
  const discountAmount = parseFloat(discount) || 0;
  const total = Math.max(0, subtotal - discountAmount);

  function selectClient(client: Client) {
    setSelectedClient(client);
  }

  async function selectBillToVenue(name: string, id: string | null) {
    setBillToVenueName(name);
    setBillToVenueId(id);
    if (id) {
      try {
        const v = await getVenue(id);
        if (v) {
          setBillToVenue(v);
          // Pre-fill gig venue from bill-to venue
          setVenueName(v.venue_name);
          setVenueId(v.id);
          setVenueAddress([v.address, v.postcode].filter(Boolean).join(', '));
        }
      } catch { /* non-critical */ }
    } else {
      setBillToVenue(null);
    }
  }

  async function saveNewClient() {
    if (!newCompany.trim()) {
      Alert.alert('Required', 'Company name is required.');
      return;
    }
    const newClient = await addClient({
      company_name: newCompany.trim(),
      contact_name: newContact.trim(),
      address: newAddress.trim(),
      email: newEmail.trim(),
      phone: newPhone.trim(),
    });
    setShowNewClient(false);
    setNewCompany(''); setNewContact(''); setNewAddress(''); setNewEmail(''); setNewPhone('');
    selectClient(newClient);
  }

  function goToStep2() {
    if (billToType === 'client' && !selectedClient) { Alert.alert('Required', 'Select a client.'); return; }
    if (billToType === 'venue' && !billToVenueId) { Alert.alert('Required', 'Select a venue to bill.'); return; }
    if (!venueName.trim()) { Alert.alert('Required', 'Venue name is required.'); return; }
    setStep(2);
  }

  function addServiceItem(svc: ServiceCatalogueItem) {
    setLineItems(prev => [...prev, {
      key: `${svc.id}-${Date.now()}`,
      service_id: svc.id,
      description: svc.name + (svc.description ? ` - ${svc.description}` : ''),
      quantity: 1,
      unit_price: svc.default_price,
    }]);
  }

  function addCustomItem() {
    setLineItems(prev => [...prev, {
      key: `custom-${Date.now()}`,
      service_id: null,
      description: '',
      quantity: 1,
      unit_price: 0,
    }]);
  }

  function updateLineItem(key: string, field: keyof LineItem, value: string | number) {
    setLineItems(prev => prev.map(li =>
      li.key === key ? { ...li, [field]: value } : li
    ));
  }

  function removeLineItem(key: string) {
    setLineItems(prev => prev.filter(li => li.key !== key));
  }

  function goToStep3() {
    if (lineItems.length === 0) { Alert.alert('Required', 'Add at least one line item.'); return; }
    const invalid = lineItems.find(li => !li.description.trim());
    if (invalid) { Alert.alert('Required', 'All line items need a description.'); return; }
    setStep(3);
  }

  function getBillToInfo() {
    if (billToType === 'client' && selectedClient) {
      return {
        toCompany: selectedClient.company_name,
        toContact: selectedClient.contact_name,
        toAddress: selectedClient.address,
        toEmail: selectedClient.email || '',
        toPhone: selectedClient.phone || '',
      };
    }
    if (billToType === 'venue' && billToVenue) {
      return {
        toCompany: billToVenue.venue_name,
        toContact: billToVenue.contact_name || '',
        toAddress: [billToVenue.address, billToVenue.postcode].filter(Boolean).join(', '),
        toEmail: billToVenue.email || '',
        toPhone: billToVenue.phone || '',
      };
    }
    return { toCompany: '', toContact: '', toAddress: '', toEmail: '', toPhone: '' };
  }

  function goToStep4() {
    if (!settings) return;
    if (billToType === 'client' && !selectedClient) return;
    if (billToType === 'venue' && !billToVenue) return;
    const parsedValidity = Math.max(1, Math.min(365, parseInt(validityDays) || 30));
    const createdDate = todayISO();
    const validUntilDate = addDays(createdDate, parsedValidity);
    const billTo = getBillToInfo();

    const templateData: QuoteTemplateData = {
      quoteNumber: `QTE-???`,
      quoteDate: formatDateLong(createdDate),
      validUntil: formatDateLong(validUntilDate),
      fromName: settings.your_name,
      tradingAs: settings.trading_as,
      businessType: settings.business_type,
      website: settings.website,
      toCompany: billTo.toCompany,
      toContact: billTo.toContact,
      toAddress: billTo.toAddress,
      toEmail: billTo.toEmail,
      toPhone: billTo.toPhone,
      eventType,
      eventDate: formatDateLong(eventDate),
      venueName: venueName.trim(),
      venueAddress: venueAddress.trim(),
      lineItems: lineItems.map(li => ({
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unit_price,
        lineTotal: li.quantity * li.unit_price,
      })),
      subtotal,
      discountAmount,
      total,
      pliOption,
      pliInsurer: bandSettings?.pli_insurer || '',
      pliPolicyNumber: bandSettings?.pli_policy_number || '',
      pliCoverAmount: bandSettings?.pli_cover_amount || '',
      pliExpiryDate: bandSettings?.pli_expiry_date ? formatDateLong(bandSettings.pli_expiry_date) : '',
      termsAndConditions,
      validityDays: parsedValidity,
      notes,
    };

    const previews = INVOICE_STYLES.map(styleMeta => ({
      style: styleMeta,
      html: getQuoteHtml(styleMeta.id, templateData),
    }));

    setPreviewHtmls(previews);
    setCurrentPreviewIndex(0);
    setStep(4);
  }

  async function handleApproveStyle() {
    if (!settings) return;
    if (billToType === 'client' && !selectedClient) return;
    if (billToType === 'venue' && !billToVenueId) return;
    const style = previewHtmls[currentPreviewIndex]?.style.id || 'classic';
    setGenerating(true);

    try {
      const parsedValidity = Math.max(1, Math.min(365, parseInt(validityDays) || 30));

      const quote = await createQuote({
        client_id: billToType === 'client' ? selectedClient!.id : null,
        venue_id: billToType === 'venue' ? billToVenueId : venueId,
        event_type: eventType,
        event_date: eventDate,
        venue_name: venueName.trim(),
        venue_address: venueAddress.trim(),
        subtotal,
        discount_amount: discountAmount,
        total,
        pli_option: pliOption,
        terms_and_conditions: termsAndConditions,
        validity_days: parsedValidity,
        notes,
        style,
        line_items: lineItems.map((li, i) => ({
          service_id: li.service_id,
          description: li.description,
          quantity: li.quantity,
          unit_price: li.unit_price,
          line_total: li.quantity * li.unit_price,
          sort_order: i,
        })),
      });

      router.replace(`/quote/${quote.id}`);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create quote');
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
        <NeuButton
          label={step === 1 ? 'Cancel' : 'Back'}
          onPress={() => step === 1 ? router.back() : setStep((step - 1) as 1 | 2 | 3)}
          small
        />
        <Text style={styles.topTitle}>New Quote</Text>
        <View style={{ width: 60 }} />
      </View>

      <StepIndicator currentStep={step} labels={STEP_LABELS} />

      {/* ─── Step 1: Bill To & Event ─── */}
      {step === 1 && (
        <ScrollView contentContainerStyle={styles.stepScrollContent}>
          {/* Bill To toggle */}
          <NeuCard>
            <Text style={LABEL}>BILL TO</Text>
            <View style={styles.billToToggle}>
              <Pressable
                style={[styles.billToBtn, billToType === 'client' && styles.billToBtnActive]}
                onPress={() => setBillToType('client')}
              >
                <Text style={[styles.billToText, billToType === 'client' && styles.billToTextActive]}>Bill Client</Text>
              </Pressable>
              <Pressable
                style={[styles.billToBtn, billToType === 'venue' && styles.billToBtnActive]}
                onPress={() => setBillToType('venue')}
              >
                <Text style={[styles.billToText, billToType === 'venue' && styles.billToTextActive]}>Bill Venue</Text>
              </Pressable>
            </View>

            {billToType === 'client' ? (
              <>
                {selectedClient ? (
                  <View>
                    <Text style={styles.selectedClientLabel}>{selectedClient.company_name}</Text>
                    <Pressable onPress={() => setSelectedClient(null)}>
                      <Text style={styles.changeLink}>Change client</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View>
                    <NeuWell style={styles.inputWell}>
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
                      style={{ marginVertical: 8 }}
                    />
                    {clients.slice(0, 10).map(c => (
                      <Pressable key={c.id} onPress={() => selectClient(c)}>
                        <View style={styles.clientRow}>
                          <Text style={styles.clientName}>{c.company_name}</Text>
                          {c.contact_name ? <Text style={styles.clientDetail}>{c.contact_name}</Text> : null}
                        </View>
                      </Pressable>
                    ))}
                  </View>
                )}
              </>
            ) : (
              <>
                <Text style={styles.fieldLabel}>Select Venue to Bill</Text>
                <EntityPicker
                  mode="venue"
                  value={billToVenueName}
                  entityId={billToVenueId}
                  onChange={(text, id) => selectBillToVenue(text, id)}
                  placeholder="Search venues..."
                />
                {billToVenue && (
                  <View style={{ marginTop: 4 }}>
                    <Text style={styles.selectedClientLabel}>{billToVenue.venue_name}</Text>
                    {billToVenue.contact_name ? <Text style={styles.clientDetail}>{billToVenue.contact_name}</Text> : null}
                  </View>
                )}
              </>
            )}
          </NeuCard>

          {/* Event details */}
          <NeuCard>
            <Text style={LABEL}>EVENT DETAILS</Text>
            <View style={{ height: 8 }} />

            <Text style={styles.fieldLabel}>Event Type</Text>
            <View style={styles.eventTypeRow}>
              {EVENT_TYPES.map(et => (
                <Pressable
                  key={et.value}
                  style={[styles.eventTypeBtn, eventType === et.value && styles.eventTypeBtnActive]}
                  onPress={() => setEventType(et.value)}
                >
                  <Text style={[styles.eventTypeText, eventType === et.value && styles.eventTypeTextActive]}>
                    {et.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Event Date</Text>
            <Pressable onPress={() => setShowCalendar(true)}>
              <NeuWell style={styles.inputWell}>
                <Text style={[styles.input, { paddingVertical: 12 }]}>
                  {formatDateDisplay(eventDate)}
                </Text>
              </NeuWell>
            </Pressable>
            <CalendarPicker
              visible={showCalendar}
              selectedDate={eventDate}
              onConfirm={(date) => { setEventDate(date); setShowCalendar(false); }}
              onCancel={() => setShowCalendar(false)}
            />

            <Text style={styles.fieldLabel}>Venue *</Text>
            <EntityPicker
              mode="venue"
              value={venueName}
              entityId={venueId}
              onChange={(text, id) => { setVenueName(text); setVenueId(id); if (!id) setVenueAddress(''); }}
              placeholder="e.g. The Grand Hotel"
            />

            <Text style={styles.fieldLabel}>Venue Address</Text>
            <NeuWell style={styles.inputWell}>
              <TextInput
                style={[styles.input, { minHeight: 50 }]}
                value={venueAddress}
                onChangeText={setVenueAddress}
                placeholder="Optional"
                placeholderTextColor={COLORS.textMuted}
                multiline
                textAlignVertical="top"
              />
            </NeuWell>
          </NeuCard>

          <NeuButton label="Next: Package Builder" onPress={goToStep2} color={COLORS.teal} style={{ marginTop: 8 }} />
          <View style={{ height: 30 }} />

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
        </ScrollView>
      )}

      {/* ─── Step 2: Package Builder ─── */}
      {step === 2 && (
        <ScrollView contentContainerStyle={styles.stepScrollContent}>
          {/* Service catalogue */}
          {services.length > 0 && (
            <NeuCard>
              <Text style={LABEL}>SERVICE CATALOGUE</Text>
              <View style={{ height: 8 }} />
              <View style={styles.serviceGrid}>
                {services.map(svc => (
                  <Pressable key={svc.id} style={styles.serviceBtn} onPress={() => addServiceItem(svc)}>
                    <Text style={styles.serviceName}>{svc.name}</Text>
                    <Text style={styles.servicePrice}>{formatGBP(svc.default_price)}</Text>
                  </Pressable>
                ))}
              </View>
            </NeuCard>
          )}

          {/* Line items */}
          <NeuCard>
            <Text style={LABEL}>LINE ITEMS ({lineItems.length})</Text>
            <View style={{ height: 8 }} />

            {lineItems.map((li, idx) => (
              <View key={li.key} style={styles.lineItem}>
                <View style={styles.lineItemHeader}>
                  <Text style={styles.lineItemIndex}>#{idx + 1}</Text>
                  <Pressable onPress={() => removeLineItem(li.key)}>
                    <Text style={styles.removeBtn}>X</Text>
                  </Pressable>
                </View>

                <Text style={styles.fieldLabel}>Description</Text>
                <NeuWell style={styles.inputWell}>
                  <TextInput
                    style={styles.input}
                    value={li.description}
                    onChangeText={v => updateLineItem(li.key, 'description', v)}
                    placeholder="Service description"
                    placeholderTextColor={COLORS.textMuted}
                  />
                </NeuWell>

                <View style={styles.lineItemRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.fieldLabel}>Qty</Text>
                    <NeuWell style={styles.inputWell}>
                      <TextInput
                        style={styles.input}
                        value={String(li.quantity)}
                        onChangeText={v => updateLineItem(li.key, 'quantity', parseInt(v) || 1)}
                        keyboardType="number-pad"
                      />
                    </NeuWell>
                  </View>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.fieldLabel}>Unit Price</Text>
                    <NeuWell style={styles.inputWell}>
                      <TextInput
                        style={styles.input}
                        value={String(li.unit_price)}
                        onChangeText={v => updateLineItem(li.key, 'unit_price', parseFloat(v) || 0)}
                        onBlur={() => {
                          const n = li.unit_price;
                          if (!isNaN(n) && n >= 0) updateLineItem(li.key, 'unit_price', parseFloat(n.toFixed(2)));
                        }}
                        keyboardType="decimal-pad"
                      />
                    </NeuWell>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Total</Text>
                    <View style={styles.lineItemTotal}>
                      <Text style={styles.lineItemTotalText}>{formatGBP(li.quantity * li.unit_price)}</Text>
                    </View>
                  </View>
                </View>
              </View>
            ))}

            <NeuButton label="+ Add Custom Item" onPress={addCustomItem} color={COLORS.textDim} small style={{ marginTop: 8 }} />
          </NeuCard>

          {/* Running total */}
          <NeuCard>
            <Text style={LABEL}>TOTALS</Text>
            <View style={{ height: 8 }} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>{formatGBP(subtotal)}</Text>
            </View>

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Discount</Text>
              <View style={{ width: 100 }}>
                <NeuWell style={styles.inputWell}>
                  <TextInput
                    style={[styles.input, { textAlign: 'right' }]}
                    value={discount}
                    onChangeText={setDiscount}
                    onBlur={() => {
                      const n = parseFloat(discount);
                      setDiscount(!isNaN(n) && n >= 0 ? n.toFixed(2) : '0');
                    }}
                    keyboardType="decimal-pad"
                  />
                </NeuWell>
              </View>
            </View>

            <View style={[styles.totalRow, { borderTopWidth: 1, borderTopColor: COLORS.cardLight, paddingTop: 8, marginTop: 4 }]}>
              <Text style={[styles.totalLabel, { fontFamily: FONTS.bodyBold, fontSize: 16, color: COLORS.teal }]}>Total</Text>
              <Text style={[styles.totalValue, { fontSize: 18, color: COLORS.teal }]}>{formatGBP(total)}</Text>
            </View>
          </NeuCard>

          <NeuButton label="Next: Extras" onPress={goToStep3} color={COLORS.teal} style={{ marginTop: 8 }} />
          <View style={{ height: 30 }} />
        </ScrollView>
      )}

      {/* ─── Step 3: Extras ─── */}
      {step === 3 && (
        <ScrollView contentContainerStyle={styles.stepScrollContent}>
          {/* PLI */}
          <NeuCard>
            <Text style={LABEL}>PUBLIC LIABILITY INSURANCE</Text>
            <View style={{ height: 8 }} />
            <View style={styles.eventTypeRow}>
              {([
                { label: 'None', value: 'none' as PLIOption },
                { label: 'Show Details', value: 'details' as PLIOption },
                { label: 'Certificate', value: 'certificate' as PLIOption },
              ]).map(opt => (
                <Pressable
                  key={opt.value}
                  style={[styles.eventTypeBtn, pliOption === opt.value && styles.eventTypeBtnActive]}
                  onPress={() => setPliOption(opt.value)}
                >
                  <Text style={[styles.eventTypeText, pliOption === opt.value && styles.eventTypeTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {pliOption !== 'none' && bandSettings && (
              <View style={{ marginTop: 8 }}>
                <Text style={styles.hintText}>
                  Insurer: {bandSettings.pli_insurer || 'Not set'} | Policy: {bandSettings.pli_policy_number || 'Not set'}
                </Text>
                <Text style={styles.hintText}>
                  Cover: {bandSettings.pli_cover_amount || 'Not set'} | Expiry: {bandSettings.pli_expiry_date || 'Not set'}
                </Text>
                <Text style={[styles.hintText, { marginTop: 4 }]}>
                  Edit PLI details in Settings
                </Text>
              </View>
            )}
          </NeuCard>

          {/* Terms */}
          <NeuCard>
            <Text style={LABEL}>TERMS & CONDITIONS</Text>
            <View style={{ height: 8 }} />
            <NeuWell style={styles.inputWell}>
              <TextInput
                style={[styles.input, { minHeight: 100 }]}
                value={termsAndConditions}
                onChangeText={setTermsAndConditions}
                placeholder="Enter terms and conditions..."
                placeholderTextColor={COLORS.textMuted}
                multiline
                textAlignVertical="top"
              />
            </NeuWell>
          </NeuCard>

          {/* Quote validity */}
          <NeuCard>
            <Text style={LABEL}>QUOTE VALIDITY</Text>
            <View style={{ height: 8 }} />
            <View style={styles.totalRow}>
              <Text style={styles.fieldLabel}>Valid for (days)</Text>
              <View style={{ width: 80 }}>
                <NeuWell style={styles.inputWell}>
                  <TextInput
                    style={[styles.input, { textAlign: 'center' }]}
                    value={validityDays}
                    onChangeText={setValidityDays}
                    onBlur={() => {
                      const n = parseInt(validityDays) || 30;
                      setValidityDays(String(Math.max(1, Math.min(365, n))));
                    }}
                    keyboardType="number-pad"
                  />
                </NeuWell>
              </View>
            </View>
          </NeuCard>

          {/* Notes */}
          <NeuCard>
            <Text style={LABEL}>NOTES</Text>
            <View style={{ height: 8 }} />
            <NeuWell style={styles.inputWell}>
              <TextInput
                style={[styles.input, { minHeight: 60 }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Optional notes for the client..."
                placeholderTextColor={COLORS.textMuted}
                multiline
                textAlignVertical="top"
              />
            </NeuWell>
          </NeuCard>

          <NeuButton label="Preview Quote" onPress={goToStep4} color={COLORS.teal} style={{ marginTop: 8 }} />
          <View style={{ height: 30 }} />
        </ScrollView>
      )}

      {/* ─── Step 4: Preview Carousel ─── */}
      {step === 4 && previewHtmls.length > 0 && (
        <View style={{ flex: 1 }}>
          <View style={styles.styleNameBar}>
            <Text style={styles.styleName}>{currentStyleMeta?.name ?? ''}</Text>
            <Text style={styles.styleDesc}>{currentStyleMeta?.description ?? ''}</Text>
            <Text style={styles.styleCounter}>{currentPreviewIndex + 1} / {previewHtmls.length}</Text>
          </View>

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

          {currentPreviewIndex > 0 && (
            <Pressable style={[styles.arrow, styles.arrowLeft]} onPress={() => goToCarouselIndex(currentPreviewIndex - 1)}>
              <Text style={styles.arrowText}>{'\u2039'}</Text>
            </Pressable>
          )}
          {currentPreviewIndex < previewHtmls.length - 1 && (
            <Pressable style={[styles.arrow, styles.arrowRight]} onPress={() => goToCarouselIndex(currentPreviewIndex + 1)}>
              <Text style={styles.arrowText}>{'\u203A'}</Text>
            </Pressable>
          )}

          <View style={styles.approveBar}>
            <NeuButton
              label={generating ? 'Saving...' : 'Approve & Create Quote'}
              onPress={handleApproveStyle}
              color={COLORS.teal}
              disabled={generating}
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
  stepScrollContent: { paddingHorizontal: 16, paddingBottom: 30 },
  inputWell: { padding: 0 },
  input: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.text, padding: 10 },
  searchInput: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.text, padding: 12 },
  fieldLabel: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.textDim, marginBottom: 4, marginTop: 8 },
  hintText: { fontFamily: FONTS.body, fontSize: 10, color: COLORS.textMuted },
  selectedClientLabel: { fontFamily: FONTS.bodyBold, fontSize: 14, color: COLORS.teal },
  changeLink: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.orange, marginTop: 4 },
  clientRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.cardLight },
  clientName: { fontFamily: FONTS.bodyBold, fontSize: 14, color: COLORS.text },
  clientDetail: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textDim, marginTop: 2 },
  // Bill-to toggle
  billToToggle: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  billToBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: COLORS.card, alignItems: 'center' as const },
  billToBtnActive: { backgroundColor: COLORS.teal + '33' },
  billToText: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textDim },
  billToTextActive: { color: COLORS.teal, fontFamily: FONTS.bodyBold },
  // Event type
  eventTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  eventTypeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: COLORS.card },
  eventTypeBtnActive: { backgroundColor: COLORS.teal + '33' },
  eventTypeText: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textDim },
  eventTypeTextActive: { color: COLORS.teal, fontFamily: FONTS.bodyBold },
  // Services
  serviceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  serviceBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: COLORS.cardLight, minWidth: 80, alignItems: 'center' },
  serviceName: { fontFamily: FONTS.bodyBold, fontSize: 11, color: COLORS.text },
  servicePrice: { fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textDim, marginTop: 2 },
  // Line items
  lineItem: { borderBottomWidth: 1, borderBottomColor: COLORS.cardLight, paddingBottom: 12, marginBottom: 8 },
  lineItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lineItemIndex: { fontFamily: FONTS.mono, fontSize: 11, color: COLORS.textDim },
  removeBtn: { fontFamily: FONTS.bodyBold, fontSize: 14, color: COLORS.danger, paddingHorizontal: 8 },
  lineItemRow: { flexDirection: 'row', marginTop: 4 },
  lineItemTotal: { padding: 10, justifyContent: 'center' },
  lineItemTotalText: { fontFamily: FONTS.mono, fontSize: 14, color: COLORS.teal },
  // Totals
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  totalLabel: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.text },
  totalValue: { fontFamily: FONTS.mono, fontSize: 14, color: COLORS.text },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: COLORS.card, borderRadius: 16, padding: 20, maxHeight: '85%' },
  modalTitle: { fontFamily: FONTS.bodyBold, fontSize: 18, color: COLORS.text, marginBottom: 12 },
  modalActions: { flexDirection: 'row', marginTop: 16 },
  // Preview
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

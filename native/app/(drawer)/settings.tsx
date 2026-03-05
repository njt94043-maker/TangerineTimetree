import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { NeuCard, NeuWell, NeuButton } from '../../src/components';
import { COLORS, FONTS, LABEL } from '../../src/theme';
import {
  getSettings, updateSettings, GigBooksSettings,
  getBandMembers, BandMember,
  getInvoices,
  getBandSettings, updateBandSettingsExtended,
  getServiceCatalogue, createServiceItem, updateServiceItem, deleteServiceItem,
  ServiceCatalogueItem,
} from '../../src/db';
import { exportInvoicesCsv } from '../../src/utils/csvExport';
import { formatGBP } from '../../src/utils/formatCurrency';
import type { BandSettings } from '@shared/supabase/types';

export default function SettingsScreen() {
  const [settings, setSettings] = useState<GigBooksSettings | null>(null);
  const [bandSettings, setBandSettings] = useState<BandSettings | null>(null);
  const [members, setMembers] = useState<BandMember[]>([]);
  const [dirty, setDirty] = useState(false);

  // Service catalogue
  const [services, setServices] = useState<ServiceCatalogueItem[]>([]);
  const [showAddService, setShowAddService] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [svcName, setSvcName] = useState('');
  const [svcDescription, setSvcDescription] = useState('');
  const [svcPrice, setSvcPrice] = useState('');
  const [svcUnit, setSvcUnit] = useState('');

  // PLI fields
  const [pliInsurer, setPliInsurer] = useState('');
  const [pliPolicy, setPliPolicy] = useState('');
  const [pliCover, setPliCover] = useState('');
  const [pliExpiry, setPliExpiry] = useState('');

  // Quote defaults
  const [defaultTnC, setDefaultTnC] = useState('');
  const [defaultValidity, setDefaultValidity] = useState('30');

  const [extendedDirty, setExtendedDirty] = useState(false);

  const load = useCallback(async () => {
    const [s, bs, m, svc] = await Promise.all([
      getSettings(),
      getBandSettings(),
      getBandMembers(),
      getServiceCatalogue(),
    ]);
    setSettings(s);
    setBandSettings(bs);
    setMembers(m);
    setServices(svc);
    setDirty(false);
    setExtendedDirty(false);

    if (bs) {
      setPliInsurer(bs.pli_insurer || '');
      setPliPolicy(bs.pli_policy_number || '');
      setPliCover(bs.pli_cover_amount || '');
      setPliExpiry(bs.pli_expiry_date || '');
      setDefaultTnC(bs.default_terms_and_conditions || '');
      setDefaultValidity(String(bs.default_quote_validity_days || 30));
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function updateField(field: keyof GigBooksSettings, value: string | number) {
    if (!settings) return;
    setSettings({ ...settings, [field]: value });
    setDirty(true);
  }

  function handleSortCodeChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 6);
    let formatted = digits;
    if (digits.length > 4) formatted = `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
    else if (digits.length > 2) formatted = `${digits.slice(0, 2)}-${digits.slice(2)}`;
    updateField('bank_sort_code', formatted);
  }

  function handlePaymentTermsChange(raw: string) {
    const parsed = parseInt(raw) || 0;
    const clamped = Math.max(1, Math.min(365, parsed));
    updateField('payment_terms_days', clamped);
  }

  async function save() {
    if (!settings) return;
    await updateSettings(settings);

    // Save extended band settings if changed
    if (extendedDirty) {
      await updateBandSettingsExtended({
        pli_insurer: pliInsurer,
        pli_policy_number: pliPolicy,
        pli_cover_amount: pliCover,
        pli_expiry_date: pliExpiry || null,
        default_terms_and_conditions: defaultTnC,
        default_quote_validity_days: Math.max(1, Math.min(365, parseInt(defaultValidity) || 30)),
      });
    }

    setDirty(false);
    setExtendedDirty(false);
    Alert.alert('Saved', 'Settings updated.');
  }

  async function handleExport() {
    const invoices = await getInvoices();
    if (invoices.length === 0) {
      Alert.alert('No invoices', 'Create an invoice first.');
      return;
    }
    await exportInvoicesCsv(invoices);
  }

  // ─── Service Catalogue ───

  function resetServiceForm() {
    setSvcName(''); setSvcDescription(''); setSvcPrice(''); setSvcUnit('');
    setShowAddService(false);
    setEditingServiceId(null);
  }

  function startEditService(svc: ServiceCatalogueItem) {
    setSvcName(svc.name);
    setSvcDescription(svc.description || '');
    setSvcPrice(String(svc.default_price));
    setSvcUnit(svc.unit_label || '');
    setEditingServiceId(svc.id);
    setShowAddService(false);
  }

  async function saveService() {
    if (!svcName.trim()) { Alert.alert('Required', 'Service name is required.'); return; }
    const price = parseFloat(svcPrice) || 0;
    if (price < 0) { Alert.alert('Invalid', 'Price must be >= 0.'); return; }

    if (editingServiceId) {
      await updateServiceItem(editingServiceId, {
        name: svcName.trim(),
        description: svcDescription.trim(),
        default_price: price,
        unit_label: svcUnit.trim(),
      });
    } else {
      await createServiceItem({
        name: svcName.trim(),
        description: svcDescription.trim(),
        default_price: price,
        unit_label: svcUnit.trim(),
      });
    }

    resetServiceForm();
    const svc = await getServiceCatalogue();
    setServices(svc);
  }

  async function handleDeleteService(id: string) {
    Alert.alert('Delete Service', 'Remove this service from the catalogue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteServiceItem(id);
          const svc = await getServiceCatalogue();
          setServices(svc);
          if (editingServiceId === id) resetServiceForm();
        },
      },
    ]);
  }

  if (!settings) return <View style={styles.container} />;

  const isEditing = editingServiceId !== null;
  const showServiceForm = showAddService || isEditing;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Your Details */}
        <NeuCard>
          <Text style={LABEL}>YOUR DETAILS</Text>
          <View style={styles.spacer} />
          <SettingsField label="Name" value={settings.your_name} onChangeText={v => updateField('your_name', v)} />
          <SettingsField label="Trading As" value={settings.trading_as} onChangeText={v => updateField('trading_as', v)} />
          <SettingsField label="Business Type" value={settings.business_type} onChangeText={v => updateField('business_type', v)} />
          <SettingsField label="Website" value={settings.website} onChangeText={v => updateField('website', v)} keyboardType="url" />
          <SettingsField label="Email" value={settings.email} onChangeText={v => updateField('email', v)} keyboardType="email-address" />
          <SettingsField label="Phone" value={settings.phone} onChangeText={v => updateField('phone', v)} keyboardType="phone-pad" />
        </NeuCard>

        {/* Bank Details */}
        <NeuCard>
          <Text style={LABEL}>BANK DETAILS</Text>
          <View style={styles.spacer} />
          <SettingsField label="Account Name" value={settings.bank_account_name} onChangeText={v => updateField('bank_account_name', v)} />
          <SettingsField label="Bank" value={settings.bank_name} onChangeText={v => updateField('bank_name', v)} />
          <SettingsField label="Sort Code" value={settings.bank_sort_code} onChangeText={handleSortCodeChange} placeholder="XX-XX-XX" maxLength={8} />
          <SettingsField label="Account Number" value={settings.bank_account_number} onChangeText={v => updateField('bank_account_number', v)} keyboardType="number-pad" />
        </NeuCard>

        {/* Invoice Defaults */}
        <NeuCard>
          <Text style={LABEL}>INVOICE DEFAULTS</Text>
          <View style={styles.spacer} />
          <SettingsField
            label="Payment Terms (days)"
            value={String(settings.payment_terms_days)}
            onChangeText={handlePaymentTermsChange}
            keyboardType="number-pad"
            hint="1–365 days"
          />
          <View style={styles.row}>
            <Text style={styles.fieldLabel}>Next Invoice</Text>
            <Text style={styles.fieldValueReadonly}>TGT-{String(settings.next_invoice_number).padStart(4, '0')}</Text>
          </View>
        </NeuCard>

        {/* Service Catalogue */}
        <NeuCard>
          <Text style={LABEL}>SERVICE CATALOGUE</Text>
          <View style={styles.spacer} />
          {services.length > 0 ? (
            services.map(svc => (
              <View key={svc.id} style={styles.serviceRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.serviceName}>{svc.name}</Text>
                  {svc.description ? <Text style={styles.serviceDesc}>{svc.description}</Text> : null}
                </View>
                <Text style={styles.servicePrice}>{formatGBP(svc.default_price)}</Text>
                <Pressable onPress={() => startEditService(svc)} style={styles.svcBtn}>
                  <Text style={styles.svcBtnText}>Edit</Text>
                </Pressable>
                <Pressable onPress={() => handleDeleteService(svc.id)} style={styles.svcBtn}>
                  <Text style={[styles.svcBtnText, { color: COLORS.danger }]}>X</Text>
                </Pressable>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No services yet</Text>
          )}

          {showServiceForm && (
            <View style={styles.serviceForm}>
              <SettingsField label="Service Name *" value={svcName} onChangeText={setSvcName} />
              <SettingsField label="Description" value={svcDescription} onChangeText={setSvcDescription} />
              <SettingsField label="Default Price" value={svcPrice} onChangeText={setSvcPrice} keyboardType="decimal-pad" />
              <SettingsField label="Unit Label" value={svcUnit} onChangeText={setSvcUnit} placeholder="e.g. per hour" />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <NeuButton label="Cancel" onPress={resetServiceForm} small style={{ flex: 1 }} />
                <NeuButton label={isEditing ? 'Update' : 'Add'} onPress={saveService} color={COLORS.teal} small style={{ flex: 1 }} />
              </View>
            </View>
          )}

          {!showServiceForm && (
            <NeuButton label="+ Add Service" onPress={() => { resetServiceForm(); setShowAddService(true); }} color={COLORS.teal} small style={{ marginTop: 8 }} />
          )}
        </NeuCard>

        {/* PLI Insurance */}
        <NeuCard>
          <Text style={LABEL}>PUBLIC LIABILITY INSURANCE</Text>
          <View style={styles.spacer} />
          <SettingsField label="Insurer" value={pliInsurer} onChangeText={v => { setPliInsurer(v); setExtendedDirty(true); }} />
          <SettingsField label="Policy Number" value={pliPolicy} onChangeText={v => { setPliPolicy(v); setExtendedDirty(true); }} />
          <SettingsField label="Cover Amount" value={pliCover} onChangeText={v => { setPliCover(v); setExtendedDirty(true); }} placeholder="e.g. £10,000,000" />
          <SettingsField label="Expiry Date" value={pliExpiry} onChangeText={v => { setPliExpiry(v); setExtendedDirty(true); }} placeholder="YYYY-MM-DD" />
        </NeuCard>

        {/* Default Terms & Conditions */}
        <NeuCard>
          <Text style={LABEL}>DEFAULT TERMS & CONDITIONS</Text>
          <View style={styles.spacer} />
          <NeuWell style={styles.fieldInput}>
            <TextInput
              style={[styles.input, { minHeight: 100 }]}
              value={defaultTnC}
              onChangeText={v => { setDefaultTnC(v); setExtendedDirty(true); }}
              placeholder="Default T&Cs for new quotes..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              textAlignVertical="top"
            />
          </NeuWell>
        </NeuCard>

        {/* Quote Defaults */}
        <NeuCard>
          <Text style={LABEL}>QUOTE DEFAULTS</Text>
          <View style={styles.spacer} />
          <SettingsField
            label="Default Validity (days)"
            value={defaultValidity}
            onChangeText={v => { setDefaultValidity(v); setExtendedDirty(true); }}
            keyboardType="number-pad"
            hint="1–365 days"
          />
        </NeuCard>

        {/* Band Members (read-only from Supabase profiles) */}
        <NeuCard>
          <Text style={LABEL}>BAND MEMBERS</Text>
          <View style={styles.spacer} />
          {members.map(m => (
            <SettingsField
              key={m.id}
              label={m.is_self ? `Member ${m.sort_order} (You)` : `Member ${m.sort_order}`}
              value={m.name}
              onChangeText={() => {}}
              editable={false}
            />
          ))}
        </NeuCard>

        {/* Actions */}
        <View style={styles.actions}>
          {(dirty || extendedDirty) && (
            <NeuButton label="Save Settings" onPress={save} color={COLORS.teal} />
          )}
          <View style={styles.spacer} />
          <NeuButton label="Export Invoices (CSV)" onPress={handleExport} color={COLORS.orange} small />
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

function SettingsField({ label, value, onChangeText, placeholder, keyboardType, editable = true, maxLength, hint }: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: TextInput['props']['keyboardType'];
  editable?: boolean;
  maxLength?: number;
  hint?: string;
}) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}{hint ? <Text style={styles.hintText}> ({hint})</Text> : null}</Text>
      <NeuWell style={styles.fieldInput}>
        <TextInput
          style={[styles.input, !editable && styles.inputDisabled]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          keyboardType={keyboardType}
          editable={editable}
          maxLength={maxLength}
        />
      </NeuWell>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    padding: 16,
  },
  spacer: {
    height: 8,
  },
  fieldRow: {
    marginBottom: 10,
  },
  fieldLabel: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textDim,
    marginBottom: 4,
  },
  fieldInput: {
    padding: 0,
  },
  input: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.text,
    padding: 10,
  },
  inputDisabled: {
    color: COLORS.textDim,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  fieldValueReadonly: {
    fontFamily: FONTS.mono,
    fontSize: 14,
    color: COLORS.teal,
  },
  hintText: {
    fontFamily: FONTS.body,
    fontSize: 10,
    color: COLORS.textMuted,
  },
  actions: {
    marginTop: 12,
  },
  // Service catalogue
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardLight,
  },
  serviceName: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: COLORS.text,
  },
  serviceDesc: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textDim,
  },
  servicePrice: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: COLORS.teal,
    marginHorizontal: 8,
  },
  svcBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  svcBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.orange,
  },
  serviceForm: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardLight,
    paddingTop: 12,
  },
  emptyText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: 8,
  },
});

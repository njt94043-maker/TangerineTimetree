import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NeuCard, NeuWell, NeuButton } from '../../src/components';
import { COLORS, FONTS, LABEL } from '../../src/theme';
import { getSettings, updateSettings, GigBooksSettings, getBandMembers, updateBandMember, BandMember, getInvoices } from '../../src/db';
import { exportInvoicesCsv } from '../../src/utils/csvExport';

export default function SettingsScreen() {
  const [settings, setSettings] = useState<GigBooksSettings | null>(null);
  const [members, setMembers] = useState<BandMember[]>([]);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    const s = await getSettings();
    setSettings(s);
    const m = await getBandMembers();
    setMembers(m);
    setDirty(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function updateField(field: keyof GigBooksSettings, value: string | number) {
    if (!settings) return;
    setSettings({ ...settings, [field]: value });
    setDirty(true);
  }

  function updateMemberName(id: string, name: string) {
    setMembers(prev => prev.map(m => m.id === id ? { ...m, name } : m));
    setDirty(true);
  }

  async function save() {
    if (!settings) return;
    await updateSettings(settings);
    for (const m of members) {
      await updateBandMember(m.id, m.name);
    }
    setDirty(false);
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

  if (!settings) return <View style={styles.container} />;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Settings</Text>

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
          <SettingsField label="Sort Code" value={settings.bank_sort_code} onChangeText={v => updateField('bank_sort_code', v)} placeholder="XX-XX-XX" />
          <SettingsField label="Account Number" value={settings.bank_account_number} onChangeText={v => updateField('bank_account_number', v)} keyboardType="number-pad" />
        </NeuCard>

        {/* Invoice Defaults */}
        <NeuCard>
          <Text style={LABEL}>INVOICE DEFAULTS</Text>
          <View style={styles.spacer} />
          <SettingsField
            label="Payment Terms (days)"
            value={String(settings.payment_terms_days)}
            onChangeText={v => updateField('payment_terms_days', parseInt(v) || 14)}
            keyboardType="number-pad"
          />
          <View style={styles.row}>
            <Text style={styles.fieldLabel}>Next Invoice</Text>
            <Text style={styles.fieldValueReadonly}>INV-{String(settings.next_invoice_number).padStart(3, '0')}</Text>
          </View>
        </NeuCard>

        {/* Band Members */}
        <NeuCard>
          <Text style={LABEL}>BAND MEMBERS</Text>
          <View style={styles.spacer} />
          {members.map(m => (
            <SettingsField
              key={m.id}
              label={m.is_self ? `Member ${m.sort_order} (You)` : `Member ${m.sort_order}`}
              value={m.name}
              onChangeText={v => updateMemberName(m.id, v)}
              editable={!m.is_self}
            />
          ))}
        </NeuCard>

        {/* Actions */}
        <View style={styles.actions}>
          {dirty && (
            <NeuButton label="Save Settings" onPress={save} color={COLORS.teal} />
          )}
          <View style={styles.spacer} />
          <NeuButton label="Export Invoices (CSV)" onPress={handleExport} color={COLORS.orange} small />
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingsField({ label, value, onChangeText, placeholder, keyboardType, editable = true }: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: TextInput['props']['keyboardType'];
  editable?: boolean;
}) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <NeuWell style={styles.fieldInput}>
        <TextInput
          style={[styles.input, !editable && styles.inputDisabled]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          keyboardType={keyboardType}
          editable={editable}
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
  title: {
    fontFamily: FONTS.bodyBold,
    fontSize: 22,
    color: COLORS.text,
    marginBottom: 12,
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
  actions: {
    marginTop: 12,
  },
});

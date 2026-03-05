import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, TextInput, FlatList, Pressable, StyleSheet, Keyboard, Alert } from 'react-native';
import { COLORS, FONTS } from '../theme';
import { neuInsetStyle } from '../theme/shadows';
import { searchVenues, searchClients, getVenues, getClients, createVenue, createClient } from '@shared/supabase/queries';
import type { Venue, Client } from '@shared/supabase/types';

interface EntityPickerProps {
  mode: 'venue' | 'client';
  value: string;
  entityId: string | null;
  onChange: (text: string, id: string | null) => void;
  placeholder?: string;
}

type Entity = Venue | Client;

function getName(entity: Entity, mode: 'venue' | 'client'): string {
  return mode === 'venue' ? (entity as Venue).venue_name : (entity as Client).company_name;
}

function getSubtitle(entity: Entity, mode: 'venue' | 'client'): string {
  if (mode === 'venue') {
    const v = entity as Venue;
    return [v.address, v.postcode].filter(Boolean).join(', ');
  }
  return (entity as Client).contact_name || '';
}

export function EntityPicker({ mode, value, entityId, onChange, placeholder }: EntityPickerProps) {
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState<Entity[]>([]);
  const [showAddNew, setShowAddNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [creating, setCreating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (query: string) => {
    try {
      if (!query.trim()) {
        const all = mode === 'venue' ? await getVenues() : await getClients();
        setResults(all.slice(0, 6));
      } else {
        const found = mode === 'venue' ? await searchVenues(query) : await searchClients(query);
        setResults(found.slice(0, 6));
      }
    } catch {
      setResults([]);
    }
  }, [mode]);

  function handleInputChange(text: string) {
    onChange(text, null);
    setShowAddNew(false);
    if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(text), 300);
  }

  function handleSelect(entity: Entity) {
    onChange(getName(entity, mode), entity.id);
    setFocused(false);
    setShowAddNew(false);
    Keyboard.dismiss();
  }

  async function handleCreateNew() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      if (mode === 'venue') {
        const venue = await createVenue({ venue_name: newName.trim(), address: newAddress.trim() });
        onChange(venue.venue_name, venue.id);
      } else {
        const client = await createClient({ company_name: newName.trim() });
        onChange(client.company_name, client.id);
      }
      setShowAddNew(false);
      setFocused(false);
      setNewName('');
      setNewAddress('');
      Keyboard.dismiss();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : `Failed to create ${label.toLowerCase()}`);
    } finally {
      setCreating(false);
    }
  }

  // Clean up debounce timer on unmount
  useEffect(() => () => {
    if (debounceRef.current !== null) clearTimeout(debounceRef.current);
  }, []);

  function handleFocus() {
    setFocused(true);
    doSearch(value);
  }

  const showDropdown = focused;
  const label = mode === 'venue' ? 'Venue' : 'Client';

  return (
    <View style={styles.wrap}>
      <View style={[styles.fieldWrap, neuInsetStyle()]}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={handleInputChange}
            onFocus={handleFocus}
            onBlur={() => setTimeout(() => { setFocused(false); setShowAddNew(false); }, 200)}
            placeholder={placeholder}
            placeholderTextColor={COLORS.textMuted}
          />
          {entityId && <Text style={styles.linkedBadge}>Linked</Text>}
        </View>
      </View>
      {showDropdown && (
        <View style={styles.dropdown}>
          <FlatList
            data={results}
            keyExtractor={item => item.id}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            renderItem={({ item }) => {
              const subtitle = getSubtitle(item, mode);
              return (
                <Pressable
                  style={[styles.option, item.id === entityId && styles.optionActive]}
                  onPress={() => handleSelect(item)}
                >
                  <Text style={[styles.optionText, item.id === entityId && styles.optionTextActive]}>
                    {getName(item, mode)}
                  </Text>
                  {!!subtitle && <Text style={styles.optionSubtitle}>{subtitle}</Text>}
                </Pressable>
              );
            }}
            ListFooterComponent={
              !showAddNew ? (
                <Pressable style={styles.addNewOption} onPress={() => setShowAddNew(true)}>
                  <Text style={styles.addNewText}>+ Add New {label}</Text>
                </Pressable>
              ) : (
                <View style={styles.miniForm}>
                  <TextInput
                    style={[styles.miniInput, neuInsetStyle()]}
                    placeholder={mode === 'venue' ? 'Venue name' : 'Company name'}
                    placeholderTextColor={COLORS.textMuted}
                    value={newName}
                    onChangeText={setNewName}
                    autoFocus
                  />
                  {mode === 'venue' && (
                    <TextInput
                      style={[styles.miniInput, neuInsetStyle(), { marginTop: 6 }]}
                      placeholder="Address (optional)"
                      placeholderTextColor={COLORS.textMuted}
                      value={newAddress}
                      onChangeText={setNewAddress}
                    />
                  )}
                  <View style={styles.miniFormActions}>
                    <Pressable style={styles.miniSaveBtn} onPress={handleCreateNew} disabled={creating}>
                      <Text style={styles.miniSaveBtnText}>{creating ? 'Saving...' : 'Save'}</Text>
                    </Pressable>
                    <Pressable
                      style={styles.miniCancelBtn}
                      onPress={() => { setShowAddNew(false); setNewName(''); setNewAddress(''); }}
                    >
                      <Text style={styles.miniCancelBtnText}>Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              )
            }
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    zIndex: 10,
  },
  fieldWrap: {
    padding: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.text,
    padding: 12,
    minHeight: 44,
  },
  linkedBadge: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    color: COLORS.teal,
    marginRight: 8,
    textTransform: 'uppercase',
  },
  dropdown: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 280,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  option: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  optionActive: {
    backgroundColor: 'rgba(0,230,118,0.08)',
  },
  optionText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.text,
  },
  optionTextActive: {
    color: COLORS.green,
  },
  optionSubtitle: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  addNewOption: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  addNewText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: COLORS.teal,
  },
  miniForm: {
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  miniInput: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.text,
    padding: 10,
  },
  miniFormActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  miniSaveBtn: {
    backgroundColor: COLORS.green,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  miniSaveBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    color: '#000',
  },
  miniCancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.textMuted,
  },
  miniCancelBtnText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
  },
});

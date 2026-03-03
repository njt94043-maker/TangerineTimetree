import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, Pressable, Modal, StyleSheet, Alert } from 'react-native';
import { NeuCard } from './NeuCard';
import { NeuWell } from './NeuWell';
import { NeuButton } from './NeuButton';
import { COLORS, FONTS } from '../theme';
import { Venue, getVenuesForClient, addVenue } from '../db';

interface VenuePickerProps {
  clientId: string;
  selectedVenue: string;
  onSelectVenue: (name: string) => void;
}

export function VenuePicker({ clientId, selectedVenue, onSelectVenue }: VenuePickerProps) {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [showNewVenue, setShowNewVenue] = useState(false);
  const [newVenueName, setNewVenueName] = useState('');

  useEffect(() => {
    loadVenues();
  }, [clientId]);

  async function loadVenues() {
    const list = await getVenuesForClient(clientId);
    setVenues(list);
  }

  function handleSelect(name: string) {
    onSelectVenue(name);
    setShowPicker(false);
  }

  async function handleAddVenue() {
    const trimmed = newVenueName.trim();
    if (!trimmed) {
      Alert.alert('Required', 'Venue name is required.');
      return;
    }
    const venue = await addVenue(clientId, trimmed);
    setVenues(prev => [...prev, venue].sort((a, b) => a.venue_name.localeCompare(b.venue_name)));
    setNewVenueName('');
    setShowNewVenue(false);
    handleSelect(trimmed);
  }

  return (
    <View>
      <Pressable onPress={() => setShowPicker(true)}>
        <NeuWell style={styles.inputWell}>
          <Text style={[styles.inputText, !selectedVenue && { color: COLORS.textMuted }]}>
            {selectedVenue || 'Select or add a venue...'}
          </Text>
        </NeuWell>
      </Pressable>

      <Modal visible={showPicker} animationType="slide" transparent>
        <Pressable style={styles.modalOverlay} onPress={() => setShowPicker(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>Select Venue</Text>

            <NeuButton
              label="+ Add New Venue"
              onPress={() => setShowNewVenue(true)}
              color={COLORS.teal}
              small
              style={{ marginBottom: 8 }}
            />

            {showNewVenue && (
              <View style={styles.newVenueRow}>
                <NeuWell style={{ ...styles.inputWell, flex: 1 }}>
                  <TextInput
                    style={styles.input}
                    value={newVenueName}
                    onChangeText={setNewVenueName}
                    placeholder="New venue name"
                    placeholderTextColor={COLORS.textMuted}
                    autoFocus
                  />
                </NeuWell>
                <NeuButton label="Save" onPress={handleAddVenue} color={COLORS.teal} small style={{ marginLeft: 8 }} />
                <NeuButton label="X" onPress={() => { setShowNewVenue(false); setNewVenueName(''); }} small style={{ marginLeft: 4 }} />
              </View>
            )}

            <FlatList
              data={venues}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <Pressable onPress={() => handleSelect(item.venue_name)}>
                  <NeuCard intensity="subtle">
                    <Text style={[styles.venueName, item.venue_name === selectedVenue && { color: COLORS.teal }]}>
                      {item.venue_name}
                    </Text>
                  </NeuCard>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No venues yet. Add one above.</Text>
              }
              style={{ maxHeight: 300 }}
            />

            <NeuButton label="Cancel" onPress={() => setShowPicker(false)} small style={{ marginTop: 12 }} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  inputWell: { padding: 0 },
  inputText: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.text, padding: 10 },
  input: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.text, padding: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: COLORS.card, borderRadius: 16, padding: 20, maxHeight: '80%' },
  modalTitle: { fontFamily: FONTS.bodyBold, fontSize: 18, color: COLORS.text, marginBottom: 12 },
  newVenueRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  venueName: { fontFamily: FONTS.bodyBold, fontSize: 14, color: COLORS.text },
  emptyText: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textDim, textAlign: 'center', paddingTop: 20 },
});

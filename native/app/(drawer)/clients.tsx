import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { NeuCard, NeuWell, NeuButton } from '../../src/components';
import { COLORS, FONTS, LABEL } from '../../src/theme';
import { getClients, searchClients, deleteClient, Client } from '../../src/db';

export default function ClientsScreen() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const list = search.trim() ? await searchClients(search.trim()) : await getClients();
      setClients(list);
    } catch (err) {
      console.error('Failed to load clients', err);
    }
  }, [search]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function handleDeleteClient(client: Client) {
    Alert.alert('Delete Client', `Delete "${client.company_name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try { await deleteClient(client.id); load(); } catch { Alert.alert('Error', 'Failed to delete client'); }
        },
      },
    ]);
  }

  function renderClient({ item }: { item: Client }) {
    return (
      <NeuCard>
        <Pressable onPress={() => router.push(`/client/${item.id}`)}>
          <Text style={styles.clientName}>{item.company_name}</Text>
          {item.contact_name ? <Text style={styles.clientContact}>{item.contact_name}</Text> : null}
          {item.address ? <Text style={styles.clientAddress}>{item.address}</Text> : null}
          {item.email ? <Text style={styles.clientEmail}>{item.email}</Text> : null}
        </Pressable>
        <View style={styles.clientActions}>
          <Pressable style={styles.actionBtn} onPress={() => router.push(`/client/${item.id}`)}>
            <Text style={styles.actionBtnText}>Venues</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => router.push(`/client/${item.id}`)}>
            <Text style={[styles.actionBtnText, { color: COLORS.orange }]}>Edit</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => handleDeleteClient(item)}>
            <Text style={[styles.actionBtnText, { color: COLORS.danger }]}>Del</Text>
          </Pressable>
        </View>
      </NeuCard>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <NeuButton label="+ Add Client" onPress={() => router.push('/client/new')} color={COLORS.green} small />
      </View>

      <NeuWell style={styles.searchWell}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search clients..."
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </NeuWell>

      {clients.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{search ? 'No clients match your search' : 'No clients yet'}</Text>
          {!search && (
            <NeuButton
              label="Add Your First Client"
              onPress={() => router.push('/client/new')}
              color={COLORS.teal}
              style={{ marginTop: 16 }}
            />
          )}
        </View>
      ) : (
        <FlatList
          data={clients}
          keyExtractor={item => item.id}
          renderItem={renderClient}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchWell: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 0,
  },
  searchInput: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.text,
    padding: 12,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  clientName: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: COLORS.text,
  },
  clientContact: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textDim,
    marginTop: 2,
  },
  clientAddress: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  clientEmail: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.teal,
    marginTop: 2,
  },
  clientActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  actionBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  actionBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    color: COLORS.teal,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textDim,
    textAlign: 'center',
  },
});

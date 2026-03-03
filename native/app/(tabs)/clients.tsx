import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, FlatList, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NeuCard, NeuWell, NeuButton } from '../../src/components';
import { COLORS, FONTS, LABEL } from '../../src/theme';
import { getClients, searchClients, Client } from '../../src/db';

export default function ClientsScreen() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    const list = search.trim() ? await searchClients(search.trim()) : await getClients();
    setClients(list);
  }, [search]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function renderClient({ item }: { item: Client }) {
    return (
      <Pressable onPress={() => router.push(`/client/${item.id}`)}>
        <NeuCard>
          <Text style={styles.clientName}>{item.company_name}</Text>
          {item.contact_name ? <Text style={styles.clientContact}>{item.contact_name}</Text> : null}
          {item.address ? <Text style={styles.clientAddress} numberOfLines={1}>{item.address}</Text> : null}
        </NeuCard>
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Clients</Text>
        <NeuButton label="+ Add" onPress={() => router.push('/client/new')} color={COLORS.teal} small />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontFamily: FONTS.bodyBold,
    fontSize: 22,
    color: COLORS.text,
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
    fontSize: 15,
    color: COLORS.text,
  },
  clientContact: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textDim,
    marginTop: 2,
  },
  clientAddress: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
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

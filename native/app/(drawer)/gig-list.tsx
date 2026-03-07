import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../../src/theme';
import { GigList } from '../../src/components/GigList';

function todayISO(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

export default function GigListScreen() {
  const router = useRouter();

  function handleGigPress(gigId: string, gigType: string) {
    router.push({ pathname: '/gig/new', params: { gigId, gigType } });
  }

  function handleAddGig(date: string, type: 'gig' | 'practice') {
    router.push({ pathname: '/gig/new', params: { date, gigType: type } });
  }

  return (
    <View style={styles.container}>
      <GigList onGigPress={handleGigPress} onAddGig={handleAddGig} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
});

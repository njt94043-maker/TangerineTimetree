import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl, ActivityIndicator, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { COLORS, FONTS } from '../theme';
import { neuRaisedStyle } from '../theme/shadows';
import { NeuButton } from './NeuButton';
import { getUpcomingGigs } from '@shared/supabase/queries';
import { isGigIncomplete } from '@shared/supabase/types';
import type { GigWithCreator } from '@shared/supabase/types';
import { supabase } from '../supabase/client';

interface GigListProps {
  onGigPress: (gigId: string, gigType: string) => void;
  onAddGig: (date: string, type: 'gig' | 'practice') => void;
}

function fmt(time: string | null): string {
  return time ? time.slice(0, 5) : '\u2014';
}

function fmtFee(fee: number | null): string {
  return fee != null ? `\u00A3${fee.toFixed(2)}` : '';
}

function formatGroupDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function daysUntil(iso: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso + 'T00:00:00');
  const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return `${diff} days`;
}

function todayISO(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

interface DateGroup {
  date: string;
  gigs: GigWithCreator[];
}

export function GigList({ onGigPress, onAddGig }: GigListProps) {
  const [groups, setGroups] = useState<DateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeRef = useRef(true);

  const loadGigs = useCallback(async () => {
    try {
      const gigs = await getUpcomingGigs();
      if (!activeRef.current) return;
      const map = new Map<string, GigWithCreator[]>();
      for (const gig of gigs) {
        const existing = map.get(gig.date) ?? [];
        existing.push(gig);
        map.set(gig.date, existing);
      }
      setGroups(Array.from(map.entries()).map(([date, gigs]) => ({ date, gigs })));
      setError(null);
    } catch {
      if (activeRef.current) {
        setError('Failed to load gigs');
      }
    } finally {
      if (activeRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  // Fetch on focus
  useFocusEffect(
    useCallback(() => {
      activeRef.current = true;
      loadGigs();
      return () => { activeRef.current = false; };
    }, [loadGigs]),
  );

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('gig-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gigs' }, () => {
        loadGigs();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadGigs]);

  function handleRefresh() {
    setRefreshing(true);
    loadGigs();
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={COLORS.teal} size="small" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.empty}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable onPress={loadGigs} style={styles.retryBtn}>
          <Text style={styles.retryText}>Tap to retry</Text>
        </Pressable>
      </View>
    );
  }

  const footer = (
    <View style={styles.footer}>
      <NeuButton label="Add Gig" onPress={() => onAddGig(todayISO(), 'gig')} color={COLORS.calGig} small />
      <View style={{ height: 8 }} />
      <NeuButton label="Add Practice" onPress={() => onAddGig(todayISO(), 'practice')} color={COLORS.purple} small />
    </View>
  );

  if (groups.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No upcoming gigs</Text>
        {footer}
      </View>
    );
  }

  return (
    <FlatList
      data={groups}
      keyExtractor={item => item.date}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.teal} />
      }
      ListFooterComponent={footer}
      renderItem={({ item }) => (
        <View style={styles.group}>
          <View style={styles.dateHeader}>
            <Text style={styles.dateText}>{formatGroupDate(item.date)}</Text>
            <Text style={styles.countdown}>{daysUntil(item.date)}</Text>
          </View>
          {item.gigs.map(gig => (
            <GigCard
              key={gig.id}
              gig={gig}
              onPress={() => onGigPress(gig.id, gig.gig_type)}
            />
          ))}
        </View>
      )}
    />
  );
}

function GigCard({ gig, onPress }: { gig: GigWithCreator; onPress: () => void }) {
  const isPractice = gig.gig_type === 'practice';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        neuRaisedStyle('normal'),
        styles.card,
        isPractice ? styles.cardPractice : styles.cardGig,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardLeft}>
          {isPractice && (
            <View style={styles.practiceBadge}>
              <Text style={styles.practiceBadgeText}>PRACTICE</Text>
            </View>
          )}
          {!isPractice && isGigIncomplete(gig) && (
            <View style={styles.incompleteBadge}>
              <Text style={styles.incompleteBadgeText}>INCOMPLETE</Text>
            </View>
          )}
          <Text style={[styles.venue, isPractice && { color: COLORS.purple }]} numberOfLines={2}>
            {isPractice ? (gig.venue || 'Practice') : (gig.venue || 'Venue TBC')}
          </Text>
          {!isPractice && (
            <Text style={styles.client} numberOfLines={1}>{gig.client_name || 'Client TBC'}</Text>
          )}
        </View>
        {!isPractice && gig.fee != null && (
          <Text style={styles.fee}>{fmtFee(gig.fee)}</Text>
        )}
      </View>

      <View style={styles.meta}>
        <Text style={styles.metaText}>
          {fmt(gig.start_time)}{gig.end_time ? ` \u2013 ${fmt(gig.end_time)}` : ''}
        </Text>
        {!isPractice && gig.load_time && (
          <Text style={styles.metaText}>Load {fmt(gig.load_time)}</Text>
        )}
        {!isPractice && gig.payment_type && (
          <Text style={styles.paymentType}>{gig.payment_type}</Text>
        )}
      </View>

      {gig.notes ? (
        <Text style={styles.notes} numberOfLines={1}>{gig.notes}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  empty: {
    paddingVertical: 40,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textDim,
  },
  errorText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.danger,
    textAlign: 'center',
    marginBottom: 12,
  },
  retryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  retryText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: COLORS.teal,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  group: {
    marginBottom: 4,
  },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  dateText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: COLORS.text,
  },
  countdown: {
    fontFamily: FONTS.monoRegular,
    fontSize: 11,
    color: COLORS.orange,
  },
  card: {
    padding: 14,
    marginBottom: 8,
  },
  cardGig: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.calGig,
  },
  cardPractice: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.purple,
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardLeft: {
    flex: 1,
  },
  practiceBadge: {
    backgroundColor: 'rgba(187,134,252,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  practiceBadgeText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 9,
    color: COLORS.purple,
    letterSpacing: 0.5,
  },
  incompleteBadge: {
    backgroundColor: 'rgba(255,82,82,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  incompleteBadgeText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 9,
    color: COLORS.danger,
    letterSpacing: 0.5,
  },
  venue: {
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    color: COLORS.text,
  },
  client: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textDim,
    marginTop: 1,
  },
  fee: {
    fontFamily: FONTS.mono,
    fontSize: 14,
    color: COLORS.calGig,
    marginLeft: 12,
  },
  meta: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  metaText: {
    fontFamily: FONTS.monoRegular,
    fontSize: 12,
    color: COLORS.textDim,
  },
  paymentType: {
    fontFamily: FONTS.monoRegular,
    fontSize: 12,
    color: COLORS.orange,
    textTransform: 'capitalize',
  },
  notes: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textDim,
    fontStyle: 'italic',
    marginTop: 6,
  },
  footer: {
    marginTop: 16,
    paddingHorizontal: 4,
    marginBottom: 20,
  },
});

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { COLORS, FONTS } from '../../src/theme';
import { NeuButton } from '../../src/components/NeuButton';
import { GigCalendar } from '../../src/components/GigCalendar';
import { GigDaySheet } from '../../src/components/GigDaySheet';
import { GigList } from '../../src/components/GigList';
import { useAuth } from '../../src/supabase/AuthContext';
import { getGigsForMonth, getAwayDatesForMonth, getProfiles, getChangesSince, updateLastOpened } from '@shared/supabase/queries';
import { supabase } from '../../src/supabase/client';
import type { Gig, AwayDateWithUser, Profile } from '@shared/supabase/types';
import { cacheCalendarData, getCachedCalendarData } from '../../src/utils/offlineCache';
import { startOfflineQueueListener } from '../../src/utils/offlineQueue';

export default function GigsTab() {
  const { profile } = useAuth();

  // Auth is guaranteed by _layout.tsx LoginGate
  return <GigsMainView profile={profile} />;
}

// ─── Main view (calendar + list toggle) ─────────────────

type ViewMode = 'calendar' | 'list';

function GigsMainView({ profile }: { profile: Profile | null }) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [awayDates, setAwayDates] = useState<AwayDateWithUser[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const [calendarError, setCalendarError] = useState<string | null>(null);

  // Change summary on first focus
  const changeSummaryChecked = useRef(false);

  useEffect(() => {
    if (!profile?.last_opened_at || changeSummaryChecked.current) return;
    changeSummaryChecked.current = true;
    getChangesSince(profile.last_opened_at)
      .then(items => {
        if (items.length === 0) return;
        const summary = items.map(i => `${i.user_name} ${i.description}`).join('\n');
        Alert.alert("What's Changed", summary, [
          { text: 'OK', onPress: () => updateLastOpened().catch(() => {}) },
        ]);
      })
      .catch(() => {});
  }, [profile]);

  const [usingCache, setUsingCache] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [g, a, p] = await Promise.all([
        getGigsForMonth(viewYear, viewMonth),
        getAwayDatesForMonth(viewYear, viewMonth),
        getProfiles(),
      ]);
      setGigs(g);
      setAwayDates(a);
      setProfiles(p);
      setCalendarError(null);
      setUsingCache(false);
      // Cache for offline use
      cacheCalendarData(viewYear, viewMonth, g, a, p);
    } catch (e) {
      // Try loading from cache
      const cached = await getCachedCalendarData(viewYear, viewMonth);
      if (cached) {
        setGigs(cached.gigs);
        setAwayDates(cached.awayDates);
        setProfiles(cached.profiles);
        setUsingCache(true);
        setCalendarError(null);
      } else {
        setCalendarError('Failed to load calendar data');
      }
    }
  }, [viewYear, viewMonth]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('gig-calendar')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gigs' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'away_dates' }, () => {
        fetchData();
      })
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('Calendar realtime error', status, err);
        }
      });

    // Replay offline queue when connectivity returns
    const stopQueueListener = startOfflineQueueListener(() => fetchData());

    return () => {
      supabase.removeChannel(channel);
      stopQueueListener();
    };
  }, [fetchData]);

  // Build sorted list of dates with events
  const eventDates = useMemo(() => {
    const dateSet = new Set<string>();
    gigs.forEach(g => dateSet.add(g.date));
    awayDates.forEach(a => {
      const start = new Date(a.start_date + 'T12:00:00');
      const end = new Date(a.end_date + 'T12:00:00');
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dateSet.add(d.toISOString().slice(0, 10));
      }
    });
    return [...dateSet].sort();
  }, [gigs, awayDates]);

  function handleDatePress(date: string) {
    setSelectedDate(date);
    setSheetVisible(true);
  }

  function handleAddGig(date: string, type: 'gig' | 'practice') {
    setSheetVisible(false);
    router.push({ pathname: '/gig/new', params: { date, gigType: type } });
  }

  function handleEditGig(gigId: string) {
    setSheetVisible(false);
    const gig = gigs.find(g => g.id === gigId);
    router.push({ pathname: '/gig/new', params: { gigId, gigType: gig?.gig_type ?? 'gig' } });
  }

  function handleMarkAway() {
    setSheetVisible(false);
    router.push({ pathname: '/gig/away', params: { date: selectedDate ?? '' } });
  }

  function handleGigPressFromList(gigId: string, gigType: string) {
    router.push({ pathname: '/gig/new', params: { gigId, gigType } });
  }

  function handleAddGigFromList(date: string, type: 'gig' | 'practice') {
    router.push({ pathname: '/gig/new', params: { date, gigType: type } });
  }

  return (
    <View style={styles.container}>

      {usingCache && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>Offline — showing cached data</Text>
        </View>
      )}

      {calendarError && viewMode === 'calendar' && (
        <Pressable onPress={fetchData} style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{calendarError}. Tap to retry.</Text>
        </Pressable>
      )}

      {viewMode === 'calendar' && (
        <GigCalendar
          gigs={gigs}
          awayDates={awayDates}
          onDatePress={handleDatePress}
        />
      )}

      {viewMode === 'list' && (
        <GigList
          onGigPress={handleGigPressFromList}
          onAddGig={handleAddGigFromList}
        />
      )}

      {/* Cal/List toggle + away dates */}
      <View style={styles.bottomActions}>
        <View style={styles.viewToggle}>
          <Pressable
            onPress={() => setViewMode('calendar')}
            style={[styles.toggleBtn, viewMode === 'calendar' && styles.toggleBtnActive]}
          >
            <Text style={[styles.toggleText, viewMode === 'calendar' && styles.toggleTextActive]}>Cal</Text>
          </Pressable>
          <Pressable
            onPress={() => setViewMode('list')}
            style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]}
          >
            <Text style={[styles.toggleText, viewMode === 'list' && styles.toggleTextActive]}>List</Text>
          </Pressable>
        </View>

        <NeuButton
          label="My Away Dates"
          onPress={() => router.push('/gig/away')}
          color={COLORS.teal}
          small
        />
      </View>

      <GigDaySheet
        visible={sheetVisible}
        date={selectedDate ?? ''}
        awayDates={awayDates}
        eventDates={eventDates}
        onClose={() => setSheetVisible(false)}
        onAddGig={handleAddGig}
        onEditGig={handleEditGig}
        onMarkAway={handleMarkAway}
        onDateChange={setSelectedDate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  offlineBanner: {
    backgroundColor: 'rgba(243,156,18,0.12)',
    paddingVertical: 8,
    paddingHorizontal: 20,
    marginHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  offlineBannerText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    color: COLORS.orange,
    textAlign: 'center',
  },
  errorBanner: {
    backgroundColor: 'rgba(255,82,82,0.1)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  errorBannerText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.danger,
    textAlign: 'center',
  },
  bottomActions: {
    paddingHorizontal: 20,
    marginTop: 12,
    gap: 10,
    alignItems: 'center',
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.3)',
  },
  toggleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  toggleBtnActive: {
    backgroundColor: 'rgba(243,156,18,0.12)',
  },
  toggleText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  toggleTextActive: {
    color: COLORS.orange,
  },
});

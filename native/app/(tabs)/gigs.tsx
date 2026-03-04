import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS } from '../../src/theme';
import { neuRaisedStyle, neuInsetStyle } from '../../src/theme/shadows';
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
  const { user, profile, loading: authLoading, signIn } = useAuth();
  const insets = useSafeAreaInsets();

  if (authLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ActivityIndicator color={COLORS.teal} size="large" />
      </View>
    );
  }

  if (!user) {
    return <LoginGate signIn={signIn} insetTop={insets.top} />;
  }

  return <GigsMainView insetTop={insets.top} insetBottom={insets.bottom} profile={profile} />;
}

// ─── Login gate ─────────────────────────────────────────

function LoginGate({ signIn, insetTop }: { signIn: (e: string, p: string) => Promise<string | null>; insetTop: number }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSignIn() {
    if (!email || !password) return;
    setSubmitting(true);
    setError('');
    const err = await signIn(email.trim().toLowerCase(), password);
    if (err) setError(err);
    setSubmitting(false);
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insetTop + 40 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.loginContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.loginTitle}>Gig Calendar</Text>
        <Text style={styles.loginSubtitle}>Sign in to see shared gigs</Text>

        <View style={[styles.inputWrap, neuInsetStyle()]}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={COLORS.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={[styles.inputWrap, neuInsetStyle()]}>
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={COLORS.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <NeuButton
          label={submitting ? 'Signing in...' : 'Sign In'}
          onPress={handleSignIn}
          color={COLORS.teal}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Main view (calendar + list toggle) ─────────────────

type ViewMode = 'calendar' | 'list';

function GigsMainView({ insetTop, insetBottom, profile }: { insetTop: number; insetBottom: number; profile: Profile | null }) {
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
      .subscribe();

    // Replay offline queue when connectivity returns
    const stopQueueListener = startOfflineQueueListener(() => fetchData());

    return () => {
      supabase.removeChannel(channel);
      stopQueueListener();
    };
  }, [fetchData]);

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
    <View style={[styles.container, { paddingTop: insetTop + 8, paddingBottom: insetBottom + 70 }]}>
      <Text style={styles.screenTitle}>Gigs</Text>

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
          totalMembers={profiles.length || 4}
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
        onClose={() => setSheetVisible(false)}
        onAddGig={handleAddGig}
        onEditGig={handleEditGig}
        onMarkAway={handleMarkAway}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  screenTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 22,
    color: COLORS.text,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  loginContent: {
    paddingHorizontal: 24,
  },
  loginTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 24,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  loginSubtitle: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textDim,
    textAlign: 'center',
    marginBottom: 30,
  },
  inputWrap: {
    marginBottom: 14,
    padding: 4,
  },
  input: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.text,
    padding: 12,
  },
  errorText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.danger,
    textAlign: 'center',
    marginBottom: 14,
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

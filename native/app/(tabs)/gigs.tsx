import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS } from '../../src/theme';
import { neuRaisedStyle, neuInsetStyle } from '../../src/theme/shadows';
import { NeuButton } from '../../src/components/NeuButton';
import { GigCalendar } from '../../src/components/GigCalendar';
import { GigDaySheet } from '../../src/components/GigDaySheet';
import { useAuth } from '../../src/supabase/AuthContext';
import { getGigsForMonth, getAwayDatesForMonth, getProfiles } from '@shared/supabase/queries';
import { supabase } from '../../src/supabase/client';
import type { Gig, AwayDateWithUser, Profile } from '@shared/supabase/types';

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

  return <GigsCalendarView insetTop={insets.top} insetBottom={insets.bottom} />;
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

// ─── Calendar view ──────────────────────────────────────

function GigsCalendarView({ insetTop, insetBottom }: { insetTop: number; insetBottom: number }) {
  const router = useRouter();
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [awayDates, setAwayDates] = useState<AwayDateWithUser[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

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
    } catch (e) {
      // Silently handle — user sees empty calendar
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

    return () => {
      supabase.removeChannel(channel);
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
    // Find the gig to pass its type to the form
    const gig = gigs.find(g => g.id === gigId);
    router.push({ pathname: '/gig/new', params: { gigId, gigType: gig?.gig_type ?? 'gig' } });
  }

  function handleMarkAway() {
    setSheetVisible(false);
    router.push({ pathname: '/gig/away', params: { date: selectedDate ?? '' } });
  }

  return (
    <View style={[styles.container, { paddingTop: insetTop + 8, paddingBottom: insetBottom + 70 }]}>
      <Text style={styles.screenTitle}>Gig Calendar</Text>

      <GigCalendar
        gigs={gigs}
        awayDates={awayDates}
        totalMembers={profiles.length || 4}
        onDatePress={handleDatePress}
      />

      {/* Quick away dates button */}
      <View style={styles.quickActions}>
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
  quickActions: {
    paddingHorizontal: 20,
    marginTop: 12,
  },
});

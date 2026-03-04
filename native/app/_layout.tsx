import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Karla_400Regular, Karla_700Bold } from '@expo-google-fonts/karla';
import { JetBrainsMono_400Regular, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import { initDatabase } from '../src/db';
import { COLORS } from '../src/theme';
import { AuthProvider } from '../src/supabase/AuthContext';
import { ErrorBoundary } from '../src/components/ErrorBoundary';

SplashScreen.preventAutoHideAsync();

function ErrorScreen({ errors }: { errors: string[] }) {
  return (
    <View style={styles.errorContainer}>
      <StatusBar style="light" />
      <ScrollView style={styles.errorScroll} contentContainerStyle={styles.errorContent}>
        <Text style={styles.errorTitle}>STARTUP ERRORS</Text>
        <Text style={styles.errorHint}>Screenshot this and send to Claude</Text>
        {errors.map((err, i) => (
          <Text key={i} style={styles.errorText}>{err}</Text>
        ))}
      </ScrollView>
    </View>
  );
}

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const [initErrors, setInitErrors] = useState<string[]>([]);

  const [fontsLoaded, fontError] = useFonts({
    Karla_400Regular,
    Karla_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_700Bold,
  });

  useEffect(() => {
    async function init() {
      try {
        await initDatabase();
      } catch (e) {
        setInitErrors(prev => [...prev, `[DB] ${e instanceof Error ? e.message : String(e)}`]);
      }
      setDbReady(true);
    }
    init();
  }, []);

  useEffect(() => {
    if (fontError) {
      setInitErrors(prev => [...prev, `[FONTS] ${fontError.message}`]);
    }
  }, [fontError]);

  useEffect(() => {
    if ((fontsLoaded || fontError) && dbReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, dbReady]);

  if ((!fontsLoaded && !fontError) || !dbReady) {
    return <View style={styles.loading} />;
  }

  if (initErrors.length > 0) {
    return <ErrorScreen errors={initErrors} />;
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: COLORS.background },
            animation: 'fade',
          }}
        />
      </AuthProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#1a0000',
  },
  errorScroll: {
    flex: 1,
  },
  errorContent: {
    padding: 24,
    paddingTop: 60,
  },
  errorTitle: {
    color: '#ef5350',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  errorHint: {
    color: '#888',
    fontSize: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#ffb74d',
    fontSize: 13,
    fontFamily: 'monospace',
    marginBottom: 12,
    lineHeight: 18,
  },
});

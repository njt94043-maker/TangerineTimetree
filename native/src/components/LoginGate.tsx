import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { COLORS, FONTS } from '../theme';
import { neuInsetStyle } from '../theme/shadows';
import { NeuButton } from './NeuButton';

interface LoginGateProps {
  signIn: (email: string, password: string) => Promise<string | null>;
  insetTop: number;
}

export function LoginGate({ signIn, insetTop }: LoginGateProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
        <Text style={styles.loginTitle}>GigBooks</Text>
        <Text style={styles.loginSubtitle}>Sign in to continue</Text>

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

        <View style={[styles.inputWrap, neuInsetStyle(), { flexDirection: 'row', alignItems: 'center' }]}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Password"
            placeholderTextColor={COLORS.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <Pressable onPress={() => setShowPassword(s => !s)} hitSlop={8} style={{ paddingHorizontal: 12 }}>
            <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.teal }}>
              {showPassword ? 'Hide' : 'Show'}
            </Text>
          </Pressable>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
});

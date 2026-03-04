import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { COLORS, FONTS } from '../theme';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.message}>{this.state.error?.message ?? 'An unexpected error occurred'}</Text>
            <TouchableOpacity
              style={styles.button}
              onPress={() => this.setState({ hasError: false, error: null })}
            >
              <Text style={styles.buttonText}>Try again</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontFamily: FONTS.bodyBold,
    fontSize: 18,
    color: '#ff5252',
    marginBottom: 8,
  },
  message: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textDim,
    textAlign: 'center',
    marginBottom: 20,
    maxWidth: 300,
  },
  button: {
    backgroundColor: COLORS.teal,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  buttonText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: '#000',
  },
});

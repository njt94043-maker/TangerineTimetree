import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { neuRaisedStyle, ShadowIntensity } from '../theme';

interface NeuCardProps {
  children: React.ReactNode;
  intensity?: ShadowIntensity;
  style?: ViewStyle;
}

export function NeuCard({ children, intensity = 'normal', style }: NeuCardProps) {
  return (
    <View style={[neuRaisedStyle(intensity), styles.base, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    padding: 16,
    marginVertical: 6,
  },
});

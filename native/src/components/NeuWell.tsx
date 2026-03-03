import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { neuInsetStyle, ShadowIntensity } from '../theme';

interface NeuWellProps {
  children: React.ReactNode;
  intensity?: ShadowIntensity;
  style?: ViewStyle;
}

export function NeuWell({ children, intensity = 'normal', style }: NeuWellProps) {
  return (
    <View style={[neuInsetStyle(intensity), styles.base, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    padding: 12,
  },
});

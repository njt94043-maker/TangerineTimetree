import React from 'react';
import { Pressable, Text, ViewStyle, TextStyle, StyleSheet } from 'react-native';
import { neuRaisedStyle, neuInsetStyle, COLORS, FONTS } from '../theme';

interface NeuButtonProps {
  label: string;
  onPress: () => void;
  color?: string;
  icon?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
  small?: boolean;
  disabled?: boolean;
}

export function NeuButton({ label, onPress, color, icon, style, textStyle, small, disabled }: NeuButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        pressed ? neuInsetStyle('normal') : neuRaisedStyle('normal'),
        small ? styles.baseSmall : styles.base,
        disabled ? { opacity: 0.5 } : null,
        style,
      ]}
    >
      <Text style={[styles.text, color ? { color } : null, small ? styles.textSmall : null, textStyle]}>
        {icon ? `${icon} ` : ''}{label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  baseSmall: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: COLORS.text,
    textAlign: 'center',
  },
  textSmall: {
    fontSize: 12,
  },
});

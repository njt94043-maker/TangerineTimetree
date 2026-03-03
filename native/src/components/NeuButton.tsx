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
}

export function NeuButton({ label, onPress, color, icon, style, textStyle, small }: NeuButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        pressed ? neuInsetStyle('normal') : neuRaisedStyle('normal'),
        small ? styles.baseSmall : styles.base,
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
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  baseSmall: {
    padding: 10,
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
    fontSize: 11,
  },
});

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../theme';

interface StatusBadgeProps {
  status: 'draft' | 'sent' | 'paid';
}

const STATUS_COLORS = {
  draft: COLORS.textMuted,
  sent: COLORS.orange,
  paid: COLORS.success,
} as const;

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: STATUS_COLORS[status] + '22', borderColor: STATUS_COLORS[status] }]}>
      <Text style={[styles.text, { color: STATUS_COLORS[status] }]}>
        {status.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  text: {
    fontFamily: FONTS.bodyBold,
    fontSize: 9,
    letterSpacing: 1,
  },
});

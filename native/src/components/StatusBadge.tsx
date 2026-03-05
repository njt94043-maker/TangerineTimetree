import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../theme';

interface StatusBadgeProps {
  status: 'draft' | 'sent' | 'paid' | 'accepted' | 'declined' | 'expired' | 'invoice-sent';
}

const STATUS_COLORS: Record<string, string> = {
  draft: COLORS.textMuted,
  sent: COLORS.orange,
  paid: COLORS.success,
  accepted: COLORS.success,
  declined: COLORS.danger,
  expired: COLORS.textMuted,
  'invoice-sent': COLORS.teal,
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const color = STATUS_COLORS[status] || COLORS.textMuted;
  return (
    <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color }]}>
      <Text style={[styles.text, { color }]}>
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
    fontSize: 10,
    letterSpacing: 1,
  },
});

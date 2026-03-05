import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../theme';

interface StarRatingProps {
  value: number | null;
  onChange?: (rating: number | null) => void;
  size?: number;
  label?: string;
  compact?: boolean;
}

export function StarRating({ value, onChange, size = 24, label, compact }: StarRatingProps) {
  const stars = [1, 2, 3, 4, 5];

  function handlePress(star: number) {
    if (!onChange) return;
    onChange(value === star ? null : star);
  }

  return (
    <View style={styles.container}>
      {label && (
        <Text style={[styles.label, compact && styles.labelCompact]}>{label}</Text>
      )}
      <View style={styles.starRow}>
        {stars.map(star => (
          <Pressable
            key={star}
            onPress={() => handlePress(star)}
            hitSlop={8}
            disabled={!onChange}
          >
            <Text style={[
              { fontSize: compact ? 14 : size },
              star <= (value ?? 0) ? styles.starFilled : styles.starEmpty,
            ]}>
              {star <= (value ?? 0) ? '\u2605' : '\u2606'}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  label: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textDim,
    flex: 1,
  },
  labelCompact: {
    fontSize: 11,
  },
  starRow: {
    flexDirection: 'row',
    gap: 4,
  },
  starFilled: {
    color: '#f39c12',
  },
  starEmpty: {
    color: COLORS.textMuted,
  },
});

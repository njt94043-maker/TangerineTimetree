import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../theme';

interface StepIndicatorProps {
  currentStep: number;
  labels: string[];
}

export function StepIndicator({ currentStep, labels }: StepIndicatorProps) {
  return (
    <View style={styles.container}>
      {labels.map((label, i) => {
        const step = i + 1;
        const isActive = step === currentStep;
        const isCompleted = step < currentStep;

        return (
          <View key={i} style={styles.stepRow}>
            {i > 0 && (
              <View style={[styles.line, isCompleted ? styles.lineActive : null]} />
            )}
            <View style={styles.stepItem}>
              <View style={[
                styles.circle,
                isActive && styles.circleActive,
                isCompleted && styles.circleCompleted,
              ]}>
                <Text style={[
                  styles.circleText,
                  (isActive || isCompleted) && styles.circleTextActive,
                ]}>
                  {isCompleted ? '\u2713' : step}
                </Text>
              </View>
              <Text style={[
                styles.label,
                isActive && styles.labelActive,
              ]}>
                {label}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  line: {
    height: 2,
    flex: 1,
    backgroundColor: COLORS.textMuted,
    marginTop: 14,
    marginHorizontal: -4,
  },
  lineActive: {
    backgroundColor: COLORS.teal,
  },
  stepItem: {
    alignItems: 'center',
    minWidth: 60,
  },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleActive: {
    borderColor: COLORS.teal,
    backgroundColor: COLORS.teal,
  },
  circleCompleted: {
    borderColor: COLORS.teal,
    backgroundColor: COLORS.teal,
  },
  circleText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  circleTextActive: {
    color: '#fff',
  },
  label: {
    fontFamily: FONTS.body,
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  labelActive: {
    color: COLORS.teal,
  },
});

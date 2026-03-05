import React, { useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../theme';
import { neuInsetStyle } from '../theme/shadows';

interface Option<T extends string> {
  label: string;
  value: T;
}

interface NeuSelectProps<T extends string> {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
}

export function NeuSelect<T extends string>({ value, options, onChange }: NeuSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const current = options.find(o => o.value === value);

  return (
    <>
      <Pressable style={[neuInsetStyle('normal'), styles.trigger]} onPress={() => setOpen(true)}>
        <Text style={styles.triggerText} numberOfLines={1}>{current?.label ?? value}</Text>
        <Text style={styles.chevron}>{'\u25BC'}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <View style={styles.dropdown}>
            {options.map(opt => (
              <Pressable
                key={opt.value}
                style={[styles.option, opt.value === value && styles.optionActive]}
                onPress={() => { onChange(opt.value); setOpen(false); }}
              >
                <Text style={[styles.optionText, opt.value === value && styles.optionTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  triggerText: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.text,
  },
  chevron: {
    fontFamily: FONTS.body,
    fontSize: 8,
    color: COLORS.textDim,
    marginLeft: 6,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdown: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 4,
    minWidth: 200,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  optionActive: {
    backgroundColor: COLORS.teal + '22',
  },
  optionText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.text,
  },
  optionTextActive: {
    fontFamily: FONTS.bodyBold,
    color: COLORS.teal,
  },
});

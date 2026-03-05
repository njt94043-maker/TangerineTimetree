import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, FlatList, Pressable, StyleSheet, Keyboard } from 'react-native';
import { COLORS, FONTS } from '../theme';
import { neuInsetStyle } from '../theme/shadows';

interface AutocompleteInputProps {
  value: string;
  onChangeText: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  keyboardType?: 'default' | 'decimal-pad' | 'numeric';
}

export function AutocompleteInput({
  value,
  onChangeText,
  suggestions,
  placeholder,
  keyboardType = 'default',
}: AutocompleteInputProps) {
  const [focused, setFocused] = useState(false);

  const filtered = useMemo(() => {
    if (!focused) return [];
    if (!value.trim()) return suggestions.slice(0, 6);
    const lower = value.toLowerCase();
    return suggestions.filter(s => s.toLowerCase().includes(lower)).slice(0, 6);
  }, [value, suggestions, focused]);

  const showDropdown = focused && filtered.length > 0 && !(filtered.length === 1 && filtered[0] === value);

  return (
    <View style={styles.wrap}>
      <View style={[styles.fieldWrap, neuInsetStyle()]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          keyboardType={keyboardType}
        />
      </View>
      {showDropdown && (
        <View style={styles.dropdown}>
          <FlatList
            data={filtered}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            renderItem={({ item }) => (
              <Pressable
                style={[styles.option, item === value && styles.optionActive]}
                onPress={() => {
                  onChangeText(item);
                  setFocused(false);
                  Keyboard.dismiss();
                }}
              >
                <Text style={[styles.optionText, item === value && styles.optionTextActive]}>
                  {item}
                </Text>
              </Pressable>
            )}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    zIndex: 10,
  },
  fieldWrap: {
    padding: 4,
  },
  input: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.text,
    padding: 12,
  },
  dropdown: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 200,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  optionActive: {
    backgroundColor: 'rgba(0,230,118,0.08)',
  },
  optionText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.text,
  },
  optionTextActive: {
    color: COLORS.green,
  },
});

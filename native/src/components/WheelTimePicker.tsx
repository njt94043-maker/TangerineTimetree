import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  View, Text, Modal, Pressable, StyleSheet,
  NativeScrollEvent, NativeSyntheticEvent, FlatList,
} from 'react-native';
import { COLORS, FONTS } from '../theme';
import { neuRaisedStyle } from '../theme/shadows';

const ITEM_HEIGHT = 56;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

// Generate arrays once
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

interface WheelColumnProps {
  data: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

function WheelColumn({ data, selectedIndex, onSelect }: WheelColumnProps) {
  const listRef = useRef<FlatList>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Scroll to initial position on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (listRef.current && mounted.current) {
        listRef.current.scrollToOffset({
          offset: selectedIndex * ITEM_HEIGHT,
          animated: false,
        });
      }
    }, 50);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMomentumEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.round(y / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(data.length - 1, idx));
    if (clamped !== selectedIndex) {
      onSelect(clamped);
    }
  }, [data.length, selectedIndex, onSelect]);

  const renderItem = useCallback(({ item, index }: { item: string; index: number }) => {
    const isSelected = index === selectedIndex;
    return (
      <View style={styles.wheelItem}>
        <Text style={[
          styles.wheelItemText,
          isSelected && styles.wheelItemTextSelected,
          !isSelected && styles.wheelItemTextDim,
        ]}>
          {item}
        </Text>
      </View>
    );
  }, [selectedIndex]);

  const getItemLayout = useCallback((_: unknown, index: number) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  }), []);

  return (
    <View style={styles.wheelColumn}>
      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={(item) => item}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        nestedScrollEnabled
        onMomentumScrollEnd={handleMomentumEnd}
        contentContainerStyle={{
          paddingTop: ITEM_HEIGHT * 2,
          paddingBottom: ITEM_HEIGHT * 2,
        }}
        bounces={false}
      />
    </View>
  );
}

interface WheelTimePickerProps {
  visible: boolean;
  value: string; // "HH:MM"
  title?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export function WheelTimePicker({ visible, value, title, onConfirm, onCancel }: WheelTimePickerProps) {
  const [hourIdx, setHourIdx] = useState(0);
  const [minIdx, setMinIdx] = useState(0);

  // Reset when opening
  useEffect(() => {
    if (visible) {
      const [hh, mm] = (value || '12:00').split(':').map(Number);
      setHourIdx(hh);
      setMinIdx(mm);
    }
  }, [visible, value]);

  function handleConfirm() {
    const hh = HOURS[hourIdx] ?? '12';
    const mm = MINUTES[minIdx] ?? '00';
    onConfirm(`${hh}:${mm}`);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay} onStartShouldSetResponder={() => true}>
        <Pressable style={styles.overlayBg} onPress={onCancel} />
        <View style={styles.pickerContainer}>
          {title && <Text style={styles.pickerTitle}>{title}</Text>}

          <View style={styles.wheelsRow}>
            <WheelColumn data={HOURS} selectedIndex={hourIdx} onSelect={setHourIdx} />
            <Text style={styles.colonText}>:</Text>
            <WheelColumn data={MINUTES} selectedIndex={minIdx} onSelect={setMinIdx} />
          </View>

          {/* Selection indicator overlay */}
          <View style={styles.selectionIndicator} pointerEvents="none" />

          <View style={styles.buttonRow}>
            <Pressable style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.confirmBtn} onPress={handleConfirm}>
              <Text style={styles.confirmBtnText}>Set</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  pickerContainer: {
    width: 320,
    ...neuRaisedStyle('strong'),
    backgroundColor: COLORS.card,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  pickerTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: COLORS.textDim,
    letterSpacing: 0.5,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  wheelsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: PICKER_HEIGHT,
    overflow: 'hidden',
  },
  colonText: {
    fontFamily: FONTS.mono,
    fontSize: 36,
    color: COLORS.green,
    marginHorizontal: 8,
  },
  wheelColumn: {
    width: 90,
    height: PICKER_HEIGHT,
    overflow: 'hidden',
  },
  wheelItem: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelItemText: {
    fontFamily: FONTS.mono,
    fontSize: 26,
    color: COLORS.textMuted,
  },
  wheelItemTextSelected: {
    color: COLORS.green,
    fontSize: 34,
    fontFamily: FONTS.mono,
  },
  wheelItemTextDim: {
    opacity: 0.35,
  },
  selectionIndicator: {
    position: 'absolute',
    top: 24 + ITEM_HEIGHT * 2, // account for paddingVertical + 2 items
    left: 28,
    right: 28,
    height: ITEM_HEIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.green + '40',
    backgroundColor: COLORS.green + '08',
    borderRadius: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cancelBtnText: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textDim,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: COLORS.green,
  },
  confirmBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    color: COLORS.background,
  },
});

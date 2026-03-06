import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, Modal, Animated,
  useWindowDimensions, PanResponder,
} from 'react-native';
import { COLORS, FONTS } from '../theme';

interface TutorialSlide {
  title: string;
  body: string;
  icon: string;
  accent: string;
}

const SLIDES: TutorialSlide[] = [
  {
    title: 'Welcome to GigBooks',
    body: 'Your mobile gig manager, invoicing hub, and band calendar \u2014 all in one app. Swipe through to learn the basics.',
    icon: '\uD83C\uDF4A',
    accent: COLORS.orange,
  },
  {
    title: 'Calendar',
    body: 'The home screen shows your gig calendar. Tap any day to see details, add gigs, mark practice sessions, or set yourself as away. Swipe left/right to change month.',
    icon: '\uD83D\uDCC5',
    accent: COLORS.calAvailable,
  },
  {
    title: 'Day View',
    body: 'Tap a day to open the day sheet. From here you can add a gig or practice, mark yourself as away, view gig details, or jump straight to creating an invoice.',
    icon: '\uD83D\uDC41\uFE0F',
    accent: COLORS.calGig,
  },
  {
    title: 'Colour Coding',
    body: 'Green = available, orange = gig booked, purple = practice, red = someone is away. Venue names appear on each day so you can see at a glance.',
    icon: '\uD83C\uDFA8',
    accent: COLORS.calPractice,
  },
  {
    title: 'Invoices',
    body: 'Create professional invoices with your band details, generate and share PDFs, and track payment status. Choose from 7 beautiful styles. Create invoices directly from a gig.',
    icon: '\uD83D\uDCC4',
    accent: COLORS.calGig,
  },
  {
    title: 'Quotes',
    body: 'Send quotes to potential clients with a 4-step wizard. Track their lifecycle from draft through to accepted or declined. Accepted quotes can become gigs automatically.',
    icon: '\uD83D\uDCDD',
    accent: COLORS.green,
  },
  {
    title: 'Clients & Venues',
    body: 'Keep a directory of your clients and venues. Rate venues with stars, add notes and photos. Invoices and quotes link to your client/venue records.',
    icon: '\uD83D\uDC65',
    accent: COLORS.calPractice,
  },
  {
    title: 'Dashboard',
    body: 'See your business at a glance \u2014 overdue invoices, monthly earnings breakdown, tax year stats, and quick-nav buttons. Export your data as CSV for your accountant.',
    icon: '\uD83D\uDCCA',
    accent: COLORS.orange,
  },
  {
    title: 'Away Dates',
    body: 'Mark dates when you\'re unavailable. Other band members can see who\'s away so you avoid booking conflicts. The calendar shows away dates in red.',
    icon: '\u2708\uFE0F',
    accent: COLORS.calAway,
  },
  {
    title: 'Settings',
    body: 'Set up your bank details for invoices, customise your service catalogue, add PLI insurance info, and configure quote defaults. Your details flow into every invoice and quote.',
    icon: '\u2699\uFE0F',
    accent: COLORS.green,
  },
  {
    title: 'You\'re All Set!',
    body: 'That\'s the tour! You can replay this guide anytime from the drawer menu. Now go book some gigs!',
    icon: '\uD83C\uDF89',
    accent: COLORS.orange,
  },
];

interface AppTutorialProps {
  visible: boolean;
  onClose: () => void;
}

export function AppTutorial({ visible, onClose }: AppTutorialProps) {
  const { width: screenWidth } = useWindowDimensions();
  const [current, setCurrent] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const total = SLIDES.length;
  const slide = SLIDES[current];

  const animateTo = useCallback((idx: number) => {
    const dir = idx > current ? -1 : 1;
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: dir * 40, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setCurrent(idx);
      slideAnim.setValue(dir * -40);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  }, [current, fadeAnim, slideAnim]);

  const next = useCallback(() => {
    if (current < total - 1) animateTo(current + 1);
    else { setCurrent(0); onClose(); }
  }, [current, total, animateTo, onClose]);

  const prev = useCallback(() => {
    if (current > 0) animateTo(current - 1);
  }, [current, animateTo]);

  // Swipe gesture
  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > Math.abs(gs.dy) && Math.abs(gs.dx) > 15,
    onPanResponderRelease: (_, gs) => {
      if (gs.dx > 60) prev();
      else if (gs.dx < -60) next();
    },
  })).current;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modal, { width: Math.min(screenWidth - 40, 400) }]} {...panResponder.panHandlers}>
          {/* Close */}
          <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={12}>
            <Text style={styles.closeText}>{'\u2715'}</Text>
          </Pressable>

          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, {
              width: `${((current + 1) / total) * 100}%`,
              backgroundColor: slide.accent,
            }]} />
          </View>

          {/* Slide */}
          <Animated.View style={[styles.slide, {
            opacity: fadeAnim,
            transform: [{ translateX: slideAnim }],
          }]}>
            <Text style={[styles.icon, { color: slide.accent }]}>{slide.icon}</Text>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.body}>{slide.body}</Text>
          </Animated.View>

          {/* Dots */}
          <View style={styles.dots}>
            {SLIDES.map((_, i) => (
              <Pressable key={i} onPress={() => animateTo(i)} hitSlop={6}>
                <View style={[
                  styles.dot,
                  i === current && { backgroundColor: slide.accent, transform: [{ scale: 1.3 }] },
                ]} />
              </Pressable>
            ))}
          </View>

          {/* Nav */}
          <View style={styles.nav}>
            <Pressable
              style={[styles.navBtn, current === 0 && styles.navBtnDisabled]}
              onPress={prev}
              disabled={current === 0}
            >
              <Text style={[styles.navBtnText, current === 0 && styles.navBtnTextDisabled]}>Back</Text>
            </Pressable>

            <Text style={styles.counter}>{current + 1} / {total}</Text>

            <Pressable
              style={[styles.navBtn, styles.navBtnPrimary, { backgroundColor: slide.accent }]}
              onPress={next}
            >
              <Text style={styles.navBtnPrimaryText}>
                {current === total - 1 ? 'Done' : 'Next'}
              </Text>
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 24,
    paddingTop: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  closeBtn: {
    position: 'absolute',
    top: 10,
    right: 14,
    zIndex: 2,
    padding: 4,
  },
  closeText: {
    color: COLORS.textDim,
    fontSize: 18,
  },
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 2,
    marginBottom: 24,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  slide: {
    alignItems: 'center',
    minHeight: 200,
    justifyContent: 'center',
  },
  icon: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    fontFamily: FONTS.bodyBold,
    fontSize: 20,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.textDim,
    textAlign: 'center',
    maxWidth: 320,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
    marginBottom: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navBtn: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    minWidth: 72,
    alignItems: 'center',
  },
  navBtnDisabled: {
    opacity: 0.3,
  },
  navBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: COLORS.textDim,
  },
  navBtnTextDisabled: {
    color: COLORS.textMuted,
  },
  navBtnPrimary: {
    borderColor: 'transparent',
  },
  navBtnPrimaryText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: '#000',
  },
  counter: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textMuted,
  },
});

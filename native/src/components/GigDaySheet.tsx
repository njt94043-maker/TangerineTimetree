import React, { useEffect, useState, useMemo, useRef } from 'react';
import { View, Text, Modal, ScrollView, Pressable, StyleSheet, ActivityIndicator, PanResponder, Animated, Linking } from 'react-native';
import { COLORS, FONTS } from '../theme';
import { neuRaisedStyle, neuInsetStyle } from '../theme/shadows';
import { NeuButton } from './NeuButton';
import type { GigWithCreator, AwayDateWithUser, GigChangelogWithUser } from '@shared/supabase/types';
import { isGigIncomplete } from '@shared/supabase/types';
import { getGigsByDate, getGigChangelog, getVenue, getInvoiceByGigId } from '@shared/supabase/queries';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface GigDaySheetProps {
  visible: boolean;
  date: string;
  awayDates: AwayDateWithUser[];
  eventDates?: string[];
  onClose: () => void;
  onAddGig: (date: string, type: 'gig' | 'practice') => void;
  onEditGig: (gigId: string) => void;
  onMarkAway: () => void;
  onDateChange?: (date: string) => void;
  onCreateInvoice?: (gig: GigWithCreator) => void;
}

function formatDisplayDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTime(time: string | null): string {
  if (!time) return '—';
  const [hStr, mStr] = time.slice(0, 5).split(':');
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'pm' : 'am';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${mStr}${ampm}`;
}

function formatFee(fee: number | null): string {
  if (fee == null) return '—';
  return `\u00A3${fee.toFixed(2)}`;
}

export function GigDaySheet({ visible, date, awayDates, eventDates = [], onClose, onAddGig, onEditGig, onMarkAway, onDateChange, onCreateInvoice }: GigDaySheetProps) {
  const [gigs, setGigs] = useState<GigWithCreator[]>([]);
  const [changelog, setChangelog] = useState<Map<string, GigChangelogWithUser[]>>(new Map());
  const [expandedChangelog, setExpandedChangelog] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [venueAddresses, setVenueAddresses] = useState<Map<string, string>>(new Map());
  const [invoicedGigIds, setInvoicedGigIds] = useState<Set<string>>(new Set());
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && date) {
      setLoading(true);
      setFetchError(false);
      setExpandedChangelog(null);
      getGigsByDate(date)
        .then(setGigs)
        .catch(() => { setGigs([]); setFetchError(true); })
        .finally(() => setLoading(false));
    }
  }, [visible, date]);

  // Fetch venue addresses for gigs with venue_id
  useEffect(() => {
    const gigsWithVenue = gigs.filter(g => g.venue_id);
    if (gigsWithVenue.length === 0) { setVenueAddresses(new Map()); return; }
    Promise.all(
      gigsWithVenue.map(async g => {
        const venue = await getVenue(g.venue_id!);
        const addr = venue ? [venue.address, venue.postcode].filter(Boolean).join(', ') : '';
        return [g.id, addr] as const;
      })
    ).then(entries => {
      setVenueAddresses(new Map(entries.filter(([, addr]) => !!addr)));
    }).catch(() => {});
  }, [gigs]);

  // Check which gigs already have invoices
  useEffect(() => {
    const invoiceGigs = gigs.filter(g => g.gig_type !== 'practice' && g.payment_type === 'invoice');
    if (invoiceGigs.length === 0) { setInvoicedGigIds(new Set()); return; }
    Promise.all(
      invoiceGigs.map(async g => {
        const inv = await getInvoiceByGigId(g.id);
        return inv ? g.id : null;
      })
    ).then(ids => {
      setInvoicedGigIds(new Set(ids.filter(Boolean) as string[]));
    }).catch(() => {});
  }, [gigs]);

  async function toggleChangelog(gigId: string) {
    if (expandedChangelog === gigId) {
      setExpandedChangelog(null);
      return;
    }
    if (!changelog.has(gigId)) {
      try {
        const entries = await getGigChangelog(gigId);
        setChangelog(prev => new Map(prev).set(gigId, entries));
      } catch { return; }
    }
    setExpandedChangelog(gigId);
  }

  const awayOnDate = awayDates.filter(
    a => date >= a.start_date && date <= a.end_date,
  );

  // Navigation between event dates
  const currentIdx = eventDates.indexOf(date);
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx >= 0 && currentIdx < eventDates.length - 1;

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onDateChangeRef = useRef(onDateChange);
  onDateChangeRef.current = onDateChange;
  const eventDatesRef = useRef(eventDates);
  eventDatesRef.current = eventDates;
  const dateRef = useRef(date);
  dateRef.current = date;

  function navigateToDate(newDate: string, direction: 'left' | 'right') {
    if (!onDateChangeRef.current) return;
    const slideOut = direction === 'left' ? -30 : 30;
    const slideIn = direction === 'left' ? 30 : -30;
    Animated.timing(slideAnim, { toValue: slideOut, duration: 100, useNativeDriver: true }).start(() => {
      onDateChangeRef.current!(newDate);
      slideAnim.setValue(slideIn);
      Animated.timing(slideAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    });
  }

  // Combined PanResponder: horizontal swipe = navigate, vertical swipe = dismiss
  const swipePan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 10 || gs.dy > 10,
    onPanResponderRelease: (_, gs) => {
      const absX = Math.abs(gs.dx);
      const absY = Math.abs(gs.dy);
      // Vertical dismiss
      if (absY > absX && gs.dy > 60) {
        onCloseRef.current();
        return;
      }
      // Horizontal navigation
      if (absX > absY && absX > 50) {
        const dates = eventDatesRef.current;
        const idx = dates.indexOf(dateRef.current);
        if (gs.dx < 0 && idx >= 0 && idx < dates.length - 1) {
          navigateToDate(dates[idx + 1], 'left');
        } else if (gs.dx > 0 && idx > 0) {
          navigateToDate(dates[idx - 1], 'right');
        }
      }
    },
  }), []);

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={styles.dismissArea} onPress={onClose} />
        <View style={[styles.sheet, neuRaisedStyle('strong')]}>
          <View {...swipePan.panHandlers} style={styles.handleArea}>
            <View style={styles.handle} />
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Navigation row */}
            <View style={styles.navRow}>
              <Pressable
                onPress={() => hasPrev && navigateToDate(eventDates[currentIdx - 1], 'right')}
                style={[styles.navBtn, !hasPrev && styles.navBtnDisabled]}
                disabled={!hasPrev}
              >
                <Text style={[styles.navBtnText, !hasPrev && styles.navBtnTextDisabled]}>{'\u2039'}</Text>
              </Pressable>
              <Animated.View style={{ flex: 1, transform: [{ translateX: slideAnim }] }}>
                <Text style={styles.dateTitle}>{formatDisplayDate(date)}</Text>
              </Animated.View>
              <Pressable
                onPress={() => hasNext && navigateToDate(eventDates[currentIdx + 1], 'left')}
                style={[styles.navBtn, !hasNext && styles.navBtnDisabled]}
                disabled={!hasNext}
              >
                <Text style={[styles.navBtnText, !hasNext && styles.navBtnTextDisabled]}>{'\u203A'}</Text>
              </Pressable>
            </View>

            {loading && <ActivityIndicator color={COLORS.teal} style={{ marginVertical: 20 }} />}

            {/* Gigs section */}
            {!loading && fetchError && (
              <View style={styles.emptySection}>
                <Text style={[styles.emptyText, { color: COLORS.danger }]}>Failed to load gigs</Text>
              </View>
            )}
            {!loading && !fetchError && gigs.length === 0 && (
              <View style={styles.emptySection}>
                <Text style={styles.emptyText}>No gig booked</Text>
              </View>
            )}

            {gigs.map(gig => {
              const isPractice = gig.gig_type === 'practice';
              return (
              <Pressable key={gig.id} onPress={() => onEditGig(gig.id)} style={[styles.gigCard, neuInsetStyle()]}>
                {isPractice && (
                  <View style={styles.practiceBadge}>
                    <Text style={styles.practiceBadgeText}>PRACTICE</Text>
                  </View>
                )}
                {!isPractice && isGigIncomplete(gig) && (
                  <View style={styles.incompleteBadge}>
                    <Text style={styles.incompleteBadgeText}>INCOMPLETE</Text>
                  </View>
                )}

                <Text style={styles.gigVenue}>{isPractice ? (gig.venue || 'Practice') : (gig.venue || 'Venue TBC')}</Text>
                {!isPractice && venueAddresses.has(gig.id) && (
                  <Pressable
                    style={styles.navigateBtn}
                    onPress={async () => {
                      const addr = encodeURIComponent(venueAddresses.get(gig.id)!);
                      const pref = (await AsyncStorage.getItem('tgt_map_app')) || 'google';
                      const urls: Record<string, string> = {
                        google: `https://www.google.com/maps/search/?api=1&query=${addr}`,
                        waze: `https://waze.com/ul?q=${addr}`,
                        apple: `https://maps.apple.com/?q=${addr}`,
                      };
                      Linking.openURL(urls[pref] || urls.google);
                    }}
                  >
                    <Text style={styles.navigateBtnText}>Navigate</Text>
                  </Pressable>
                )}
                {!isPractice && <Text style={styles.gigClient}>{gig.client_name || 'Client TBC'}</Text>}
                {!isPractice && invoicedGigIds.has(gig.id) && (
                  <View style={styles.invoicedBadge}>
                    <Text style={styles.invoicedBadgeText}>Invoiced</Text>
                  </View>
                )}

                <View style={styles.gigDetails}>
                  {!isPractice && <DetailRow label="Fee" value={formatFee(gig.fee)} />}
                  {!isPractice && <DetailRow label="Payment" value={gig.payment_type || '—'} />}
                  {!isPractice && <DetailRow label="Load-in" value={formatTime(gig.load_time)} />}
                  <DetailRow label="Start" value={formatTime(gig.start_time)} />
                  {gig.end_time && <DetailRow label="End" value={formatTime(gig.end_time)} />}
                </View>

                {gig.notes ? <Text style={styles.gigNotes}>{gig.notes}</Text> : null}

                <Text style={styles.gigCreator}>Added by {gig.creator_name}</Text>

                {/* Changelog toggle */}
                <Pressable onPress={() => toggleChangelog(gig.id)} style={styles.changelogToggle}>
                  <Text style={styles.changelogToggleText}>
                    {expandedChangelog === gig.id ? 'Hide history' : 'Show history'}
                  </Text>
                </Pressable>

                {expandedChangelog === gig.id && (
                  <View style={styles.changelogSection}>
                    {(changelog.get(gig.id) ?? []).map(entry => (
                      <View key={entry.id} style={styles.changelogEntry}>
                        <Text style={styles.changelogText}>
                          {entry.action === 'created'
                            ? `${entry.user_name} created this gig`
                            : entry.action === 'deleted'
                              ? `${entry.user_name} deleted this gig`
                              : `${entry.user_name} changed ${entry.field_changed} from "${entry.old_value}" to "${entry.new_value}"`}
                        </Text>
                        <Text style={styles.changelogTime}>
                          {new Date(entry.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    ))}
                    {(changelog.get(gig.id) ?? []).length === 0 && (
                      <Text style={styles.changelogText}>No history yet</Text>
                    )}
                  </View>
                )}

                {/* Create Invoice button — invoice-type gigs only, not yet invoiced */}
                {!isPractice && gig.payment_type === 'invoice' && !invoicedGigIds.has(gig.id) && onCreateInvoice && (
                  <Pressable
                    style={styles.createInvoiceBtn}
                    onPress={(e) => { e.stopPropagation?.(); onCreateInvoice(gig); }}
                  >
                    <Text style={styles.createInvoiceBtnText}>Create Invoice</Text>
                  </Pressable>
                )}
              </Pressable>
              );
            })}

            {/* Away section */}
            {awayOnDate.length > 0 && (
              <View style={styles.awaySection}>
                <Text style={styles.sectionTitle}>Away</Text>
                {awayOnDate.map(a => (
                  <View key={a.id} style={styles.awayRow}>
                    <Text style={styles.awayName}>{a.user_name}</Text>
                    {a.reason ? <Text style={styles.awayReason}>{a.reason}</Text> : null}
                  </View>
                ))}
              </View>
            )}

            {/* Action buttons — matches web layout */}
            <View style={styles.actions}>
              <NeuButton label="Add Gig" onPress={() => onAddGig(date, 'gig')} color={COLORS.calGig} />
              <View style={{ height: 10 }} />
              <View style={styles.actionsRow}>
                <View style={{ flex: 1 }}>
                  <NeuButton label="Add Practice" onPress={() => onAddGig(date, 'practice')} color={COLORS.calPractice} />
                </View>
                <View style={{ width: 10 }} />
                <View style={{ flex: 1 }}>
                  <NeuButton label="I'm Away" onPress={onMarkAway} color={COLORS.teal} />
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  dismissArea: { flex: 1 },
  sheet: {
    maxHeight: '80%',
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: 30,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handleArea: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.textMuted,
  },
  scroll: { flexGrow: 1 },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: {
    opacity: 0.2,
  },
  navBtnText: {
    fontSize: 22,
    color: COLORS.calGig,
    marginTop: -2,
  },
  navBtnTextDisabled: {
    color: COLORS.textMuted,
  },
  dateTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 18,
    color: COLORS.text,
    textAlign: 'center',
  },
  emptySection: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textDim,
  },
  gigCard: {
    padding: 16,
    marginBottom: 12,
  },
  practiceBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.purple + '30',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 8,
  },
  practiceBadgeText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 9,
    color: COLORS.purple,
    letterSpacing: 0.5,
  },
  incompleteBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.danger + '30',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 8,
  },
  incompleteBadgeText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 9,
    color: COLORS.danger,
    letterSpacing: 0.5,
  },
  gigVenue: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: COLORS.text,
  },
  gigClient: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textDim,
    marginBottom: 10,
  },
  navigateBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: COLORS.teal,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 4,
    marginBottom: 4,
  },
  navigateBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.teal,
  },
  gigDetails: {
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  detailLabel: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textDim,
  },
  detailValue: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.text,
  },
  gigNotes: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textDim,
    fontStyle: 'italic',
    marginTop: 6,
  },
  gigCreator: {
    fontFamily: FONTS.body,
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 8,
  },
  invoicedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.success + '33',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  invoicedBadgeText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    color: COLORS.success,
  },
  createInvoiceBtn: {
    marginTop: 10,
    backgroundColor: COLORS.teal + '22',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center' as const,
  },
  createInvoiceBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    color: COLORS.teal,
  },
  changelogToggle: {
    marginTop: 8,
    paddingVertical: 4,
  },
  changelogToggleText: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.teal,
  },
  changelogSection: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.textMuted + '30',
  },
  changelogEntry: {
    marginBottom: 6,
  },
  changelogText: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textDim,
  },
  changelogTime: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.textMuted,
  },
  awaySection: {
    marginTop: 16,
  },
  sectionTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: COLORS.textDim,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  awayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  awayName: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: COLORS.warning,
  },
  awayReason: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textDim,
    marginLeft: 8,
  },
  actions: {
    marginTop: 20,
    marginBottom: 10,
  },
  actionsRow: {
    flexDirection: 'row',
  },
});

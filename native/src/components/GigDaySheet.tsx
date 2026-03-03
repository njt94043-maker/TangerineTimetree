import React, { useEffect, useState } from 'react';
import { View, Text, Modal, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { COLORS, FONTS } from '../theme';
import { neuRaisedStyle, neuInsetStyle } from '../theme/shadows';
import { NeuButton } from './NeuButton';
import type { GigWithCreator, AwayDateWithUser, GigChangelogWithUser } from '@shared/supabase/types';
import { isGigIncomplete } from '@shared/supabase/types';
import { getGigsByDate, getGigChangelog } from '@shared/supabase/queries';

interface GigDaySheetProps {
  visible: boolean;
  date: string;
  awayDates: AwayDateWithUser[];
  onClose: () => void;
  onAddGig: (date: string, type: 'gig' | 'practice') => void;
  onEditGig: (gigId: string) => void;
  onMarkAway: () => void;
}

function formatDisplayDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTime(time: string | null): string {
  if (!time) return '—';
  return time.slice(0, 5);
}

function formatFee(fee: number | null): string {
  if (fee == null) return '—';
  return `\u00A3${fee.toFixed(2)}`;
}

export function GigDaySheet({ visible, date, awayDates, onClose, onAddGig, onEditGig, onMarkAway }: GigDaySheetProps) {
  const [gigs, setGigs] = useState<GigWithCreator[]>([]);
  const [changelog, setChangelog] = useState<Map<string, GigChangelogWithUser[]>>(new Map());
  const [expandedChangelog, setExpandedChangelog] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && date) {
      setLoading(true);
      setExpandedChangelog(null);
      getGigsByDate(date)
        .then(setGigs)
        .catch(() => setGigs([]))
        .finally(() => setLoading(false));
    }
  }, [visible, date]);

  async function toggleChangelog(gigId: string) {
    if (expandedChangelog === gigId) {
      setExpandedChangelog(null);
      return;
    }
    if (!changelog.has(gigId)) {
      const entries = await getGigChangelog(gigId);
      setChangelog(prev => new Map(prev).set(gigId, entries));
    }
    setExpandedChangelog(gigId);
  }

  const awayOnDate = awayDates.filter(
    a => date >= a.start_date && date <= a.end_date,
  );

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={styles.dismissArea} onPress={onClose} />
        <View style={[styles.sheet, neuRaisedStyle('strong')]}>
          <View style={styles.handle} />

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.dateTitle}>{formatDisplayDate(date)}</Text>

            {loading && <ActivityIndicator color={COLORS.teal} style={{ marginVertical: 20 }} />}

            {/* Gigs section */}
            {!loading && gigs.length === 0 && (
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
                {!isPractice && <Text style={styles.gigClient}>{gig.client_name || 'Client TBC'}</Text>}

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

            {/* Action buttons */}
            <View style={styles.actions}>
              <NeuButton label="Add Gig" onPress={() => onAddGig(date, 'gig')} color={COLORS.calGig} />
              <View style={{ height: 10 }} />
              <NeuButton label="Add Practice" onPress={() => onAddGig(date, 'practice')} color={COLORS.calPractice} />
              <View style={{ height: 10 }} />
              <NeuButton label="I'm Away" onPress={onMarkAway} color={COLORS.teal} />
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
    backgroundColor: 'rgba(0,0,0,0.5)',
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
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.textMuted,
    alignSelf: 'center',
    marginBottom: 12,
  },
  scroll: { flexGrow: 0 },
  dateTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 18,
    color: COLORS.text,
    marginBottom: 16,
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
    padding: 14,
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
    fontSize: 13,
    color: COLORS.textDim,
    marginBottom: 10,
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
    fontSize: 13,
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
});

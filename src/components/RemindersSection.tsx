import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { CommonActions } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { colors, typography, spacing, radius } from '../theme';
import {
  openWhatsAppMessage,
  buildGuestConfirmationMessage,
} from '../utils/whatsapp';
import type { Reminder, ReminderPriority } from '../hooks/useTodayReminders';
import type { MainTabsParamList } from '../navigation/MainTabs';
import { useI18n } from '../i18n';

// ─── Priority config ──────────────────────────────────────────────────────────

type PriorityConfig = { color: string; bgColor: string };

const PRIORITY_CONFIG: Record<ReminderPriority, PriorityConfig> = {
  urgent: { color: colors.cta,       bgColor: colors.ctaLight    },
  todo:   { color: colors.gold,      bgColor: colors.goldLight   },
  info:   { color: colors.textMuted, bgColor: colors.borderLight },
};

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  reminders:    Reminder[];
  urgentCount:  number;
  loading:      boolean;
  error:        string | null;
  onRefresh:    () => void;
};

type NavProp = BottomTabNavigationProp<MainTabsParamList>;

// ─── Sub-components ───────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: ReminderPriority }): React.JSX.Element {
  const { t } = useI18n();
  const cfg = PRIORITY_CONFIG[priority];
  const labelKey = priority === 'urgent'
    ? 'reminder_priority_urgent'
    : priority === 'todo'
      ? 'reminder_priority_todo'
      : 'reminder_priority_info';
  return (
    <View style={[styles.priorityBadge, { backgroundColor: cfg.bgColor }]}>
      <Text style={[styles.priorityLabel, { color: cfg.color }]}>{t(labelKey)}</Text>
    </View>
  );
}

function TimeChip({ label }: { label: string }): React.JSX.Element {
  if (!label) return <View style={styles.timeChipEmpty} />;
  return (
    <View style={styles.timeChip}>
      <Text style={styles.timeText}>{label}</Text>
    </View>
  );
}

// ─── Reminder card ────────────────────────────────────────────────────────────

function ReminderCard({ reminder }: { reminder: Reminder }): React.JSX.Element {
  const navigation = useNavigation<NavProp>();

  const handlePrimaryAction = useCallback((): void => {
    if (reminder.actionType === 'open_reservation' && reminder.reservationId) {
      navigation.dispatch(
        CommonActions.navigate({
          name: 'Reservations',
          params: {
            screen: 'ReservationDetail',
            params: { reservationId: reminder.reservationId },
          },
        }),
      );
    } else if (reminder.actionType === 'open_waitlist') {
      navigation.dispatch(
        CommonActions.navigate({
          name: 'Reservations',
          params: { screen: 'Waitlist' },
        }),
      );
    }
  }, [navigation, reminder]);

  const handleWhatsApp = useCallback((): void => {
    if (!reminder.guestPhone) return;
    void openWhatsAppMessage(reminder.guestPhone, buildGuestConfirmationMessage());
  }, [reminder.guestPhone]);

  const hasAction = Boolean(reminder.actionType);
  const hasWhatsApp =
    (reminder.type === 'pending_confirmation' || reminder.type === 'to_call') &&
    Boolean(reminder.guestPhone);

  return (
    <View style={[styles.card, styles.cardShadow]}>
      <View style={styles.cardRow}>
        <TimeChip label={reminder.timeLabel} />
        <View style={styles.cardContent}>
          <View style={styles.titleRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>{reminder.title}</Text>
            <PriorityBadge priority={reminder.priority} />
          </View>
          <Text style={styles.cardDescription} numberOfLines={2}>{reminder.description}</Text>
          {hasAction && (
            <View style={styles.actionsRow}>
              <TouchableOpacity onPress={handlePrimaryAction} style={styles.actionLink}>
                <Text style={styles.actionLinkText}>{reminder.actionLabel}</Text>
                <Ionicons name="chevron-forward" size={13} color={colors.cta} />
              </TouchableOpacity>
              {hasWhatsApp && (
                <TouchableOpacity onPress={handleWhatsApp} style={styles.whatsappButton}>
                  <Ionicons name="logo-whatsapp" size={16} color={colors.whatsapp} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  count,
  urgentCount,
  onRefresh,
}: {
  count:       number;
  urgentCount: number;
  onRefresh:   () => void;
}): React.JSX.Element {
  const { t } = useI18n();
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>{t('reminder_title')}</Text>
        {count > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{count}</Text>
          </View>
        )}
        {urgentCount > 0 && (
          <View style={styles.urgentBadge}>
            <Text style={styles.urgentBadgeText}>{urgentCount} urgent{urgentCount > 1 ? 's' : ''}</Text>
          </View>
        )}
      </View>
      <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
        <Ionicons name="refresh-outline" size={14} color={colors.cta} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Main section component ───────────────────────────────────────────────────

export default function RemindersSection({
  reminders,
  urgentCount,
  loading,
  error,
  onRefresh,
}: Props): React.JSX.Element {
  const { t } = useI18n();

  if (loading) {
    return (
      <View style={styles.wrapper}>
        <SectionHeader count={0} urgentCount={0} onRefresh={onRefresh} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.gold} />
          <Text style={styles.loadingText}>{t('reminder_loading')}</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.wrapper}>
        <SectionHeader count={0} urgentCount={0} onRefresh={onRefresh} />
        <View style={[styles.emptyCard, styles.cardShadow]}>
          <Text style={styles.errorText}>{t('reminder_error')}</Text>
          <TouchableOpacity onPress={onRefresh} style={styles.retryLink}>
            <Text style={styles.retryText}>{t('common_retry')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <SectionHeader count={reminders.length} urgentCount={urgentCount} onRefresh={onRefresh} />
      {reminders.length === 0 ? (
        <View style={[styles.emptyCard, styles.cardShadow]}>
          <Text style={styles.emptyTitle}>{t('reminder_empty')}</Text>
          <Text style={styles.emptySubtitle}>{t('reminder_empty_sub')}</Text>
        </View>
      ) : (
        reminders.map((r) => <ReminderCard key={r.id} reminder={r} />)
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const cardShadowValues = {
  shadowColor:   colors.primary,
  shadowOffset:  { width: 0, height: 1 } as const,
  shadowOpacity: 0.06,
  shadowRadius:  4,
  elevation:     1,
};

const styles = StyleSheet.create({
  wrapper: {
    marginTop: spacing.xxl,
  },

  // Section header
  sectionHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   spacing.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
    flex:          1,
    flexWrap:      'wrap',
  },
  sectionTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  countBadge: {
    backgroundColor:   colors.border,
    borderRadius:      radius.xl,
    paddingHorizontal: spacing.sm,
    paddingVertical:   2,
  },
  countBadgeText: {
    ...typography.label,
    color: colors.textSecondary,
  },
  urgentBadge: {
    backgroundColor:   colors.ctaLight,
    borderRadius:      radius.xl,
    paddingHorizontal: spacing.sm,
    paddingVertical:   2,
  },
  urgentBadgeText: {
    ...typography.label,
    color: colors.cta,
  },
  refreshButton: {
    padding:         spacing.sm,
    borderRadius:    radius.md,
    backgroundColor: colors.ctaLight,
  },

  // Card
  card: {
    backgroundColor: colors.surface,
    borderRadius:    radius.lg,
    padding:         spacing.lg,
    marginBottom:    spacing.sm,
  },
  cardShadow: cardShadowValues,
  cardRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
  },
  cardContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   spacing.xs,
    gap:            spacing.sm,
  },
  cardTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    flex:  1,
  },
  cardDescription: {
    ...typography.small,
    color:        colors.textSecondary,
    marginBottom: spacing.sm,
  },

  // Priority badge
  priorityBadge: {
    borderRadius:      radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   2,
    flexShrink:        0,
  },
  priorityLabel: {
    ...typography.label,
    fontSize: 10,
  },

  // Time chip
  timeChip: {
    backgroundColor:   colors.goldLight,
    borderRadius:      radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs,
    marginRight:       spacing.md,
    minWidth:          48,
    alignItems:        'center',
    justifyContent:    'center',
    alignSelf:         'flex-start',
  },
  timeChipEmpty: {
    width:       0,
    marginRight: 0,
  },
  timeText: {
    fontFamily: typography.stat.fontFamily,
    fontSize:   typography.small.fontSize,
    color:      colors.gold,
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.md,
  },
  actionLink: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           2,
  },
  actionLinkText: {
    ...typography.small,
    color:          colors.cta,
    fontFamily:     typography.bodyMedium.fontFamily,
  },
  whatsappButton: {
    padding:         spacing.xs,
    borderRadius:    radius.sm,
    backgroundColor: colors.whatsappLight,
  },

  // Loading
  loadingContainer: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            spacing.sm,
    padding:        spacing.lg,
    backgroundColor: colors.surface,
    borderRadius:   radius.lg,
    ...cardShadowValues,
  },
  loadingText: {
    ...typography.small,
    color: colors.textMuted,
  },

  // Empty / error
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius:    radius.lg,
    padding:         spacing.xl,
    alignItems:      'center',
  },
  emptyTitle: {
    ...typography.bodyMedium,
    color:        colors.textPrimary,
    marginBottom: spacing.xs,
    textAlign:    'center',
  },
  emptySubtitle: {
    ...typography.small,
    color:     colors.textMuted,
    textAlign: 'center',
  },
  errorText: {
    ...typography.small,
    color:        colors.cta,
    marginBottom: spacing.sm,
    textAlign:    'center',
  },
  retryLink: {
    paddingVertical:   spacing.xs,
    paddingHorizontal: spacing.md,
  },
  retryText: {
    ...typography.bodyMedium,
    color: colors.cta,
  },
});

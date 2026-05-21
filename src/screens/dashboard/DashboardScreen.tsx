import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { colors, typography, spacing, radius, layout } from '../../theme';
import { useI18n } from '../../i18n';
import { useTodayDashboard, type DashboardReservation } from '../../hooks/useTodayDashboard';
import { useDashboardExtended } from '../../hooks/useDashboardExtended';
import { useTodayReminders } from '../../hooks/useTodayReminders';
import { formatReadableDate, formatTimeSlot } from '../../utils/date';
import { reservationNeedsPhoneConfirmation } from '../../utils/reservationConfirmation';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import RemindersSection from '../../components/RemindersSection';
import type { MainTabsParamList } from '../../navigation/MainTabs';

type NavProp = BottomTabNavigationProp<MainTabsParamList>;
type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const MAX_RESERVATIONS = 8;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGuestName(r: DashboardReservation, noName: string): string {
  if (!r.guests) return noName;
  const parts = [r.guests.first_name, r.guests.last_name]
    .filter((p): p is string => Boolean(p));
  return parts.length > 0 ? parts.join(' ') : noName;
}

function getTableLabel(r: DashboardReservation, unassigned: string): string {
  return r.tables?.label ?? unassigned;
}

// ─── Primitive sub-components ─────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }): React.JSX.Element {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function KpiRow({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <View style={styles.kpiRow}>{children}</View>;
}

function KpiGap(): React.JSX.Element {
  return <View style={styles.kpiGap} />;
}

function EmptyCard({ title, subtitle }: { title: string; subtitle?: string }): React.JSX.Element {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

// ─── Reservation list item ────────────────────────────────────────────────────

function ReservationRow({ r }: { r: DashboardReservation }): React.JSX.Element {
  const { t } = useI18n();
  const isVip = r.guests?.vip === true;
  return (
    <View style={styles.reservationCard}>
      <View style={styles.timeChip}>
        <Text style={styles.timeText}>{formatTimeSlot(r.time_slot)}</Text>
      </View>
      <View style={styles.reservationInfo}>
        <View style={styles.nameRow}>
          <Text style={styles.guestName} numberOfLines={1}>{getGuestName(r, t('dashboard_guest_no_name'))}</Text>
          {isVip && (
            <View style={styles.vipBadge}>
              <Text style={styles.vipText}>VIP</Text>
            </View>
          )}
        </View>
        <Text style={styles.reservationMeta}>
          {t('guest_cover_count', { n: r.party_size, s: r.party_size > 1 ? 's' : '' })} · {getTableLabel(r, t('dashboard_table_unassigned'))}
        </Text>
        <StatusBadge status={r.status} />
      </View>
    </View>
  );
}

// ─── Action button ────────────────────────────────────────────────────────────

function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: IoniconsName;
  label: string;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <TouchableOpacity style={styles.actionButton} onPress={onPress}>
      <Ionicons name={icon} size={20} color={colors.cta} />
      <Text style={styles.actionLabel} numberOfLines={2}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DashboardScreen(): React.JSX.Element {
  const { t } = useI18n();
  const navigation = useNavigation<NavProp>();
  const { loading, error, reservations, stats, restaurantId, refresh: todayRefresh } = useTodayDashboard();
  const { loading: extLoading, stats: ext, refresh: extRefresh } = useDashboardExtended(restaurantId);
  const {
    reminders,
    urgentCount,
    loading: remindersLoading,
    error:   remindersError,
    refresh: remindersRefresh,
  } = useTodayReminders(reservations, restaurantId);

  const readableDate = formatReadableDate(new Date());
  const toCallCount  = reservations.filter(reservationNeedsPhoneConfirmation).length;

  const handleRefresh = (): void => {
    todayRefresh();
    extRefresh();
    remindersRefresh();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} size="large" />
          <Text style={styles.loadingText}>{t('dashboard_loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>{t('dashboard_error')}</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
              <Text style={styles.retryButtonText}>{t('common_retry')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const visible = reservations.slice(0, MAX_RESERVATIONS);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>

          {/* ── Header ── */}
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <Text style={styles.headerLabel}>{t('dashboard_label')}</Text>
              <Text style={styles.headerTitle}>{t('dashboard_title')}</Text>
              <Text style={styles.headerDate}>{readableDate}</Text>
            </View>
            <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
              <Ionicons name="refresh-outline" size={16} color={colors.cta} />
              <Text style={styles.refreshText}>{t('common_refresh')}</Text>
            </TouchableOpacity>
          </View>

          {/* ── Vue d'ensemble ── */}
          <View style={styles.section}>
            <SectionHeader title={t('dashboard_overview')} />
            <KpiRow>
              <StatCard label={t('dashboard_stat_reservations')} value={stats.total} />
              <KpiGap />
              <StatCard label={t('dashboard_stat_covers')} value={stats.totalCovers} />
            </KpiRow>
            <KpiRow>
              <StatCard label={t('dashboard_stat_confirmed')} value={stats.confirmed} accent={colors.gold} />
              <KpiGap />
              <StatCard label={t('dashboard_stat_seated')} value={stats.seated} accent={colors.cta} />
            </KpiRow>
            <KpiRow>
              <StatCard label={t('dashboard_stat_pending')} value={stats.byStatus.pending} />
              <KpiGap />
              <StatCard label={t('dashboard_stat_completed')} value={stats.byStatus.completed} />
            </KpiRow>
            {!extLoading && (ext.waitlistPending > 0 || toCallCount > 0) && (
              <KpiRow>
                <StatCard
                  label={t('dashboard_stat_waitlist')}
                  value={ext.waitlistPending}
                  accent={ext.waitlistPending > 0 ? colors.gold : colors.textMuted}
                />
                <KpiGap />
                <StatCard
                  label={t('dashboard_stat_to_call')}
                  value={toCallCount}
                  accent={toCallCount > 0 ? colors.cta : colors.textMuted}
                />
              </KpiRow>
            )}
          </View>

          {/* ── Rappels du jour ── */}
          <RemindersSection
            reminders={reminders}
            urgentCount={urgentCount}
            loading={remindersLoading}
            error={remindersError}
            onRefresh={remindersRefresh}
          />

          {/* ── Prochaines arrivées ── */}
          <View style={styles.section}>
            <SectionHeader title={t('dashboard_upcoming')} />
            {visible.length === 0 ? (
              <EmptyCard
                title={t('dashboard_no_reservations')}
                subtitle={t('dashboard_no_reservations_sub')}
              />
            ) : (
              visible.map(r => <ReservationRow key={r.id} r={r} />)
            )}
          </View>

          {/* ── Actions rapides ── */}
          <View style={styles.section}>
            <SectionHeader title={t('dashboard_quick_actions')} />
            <View style={styles.actionGrid}>
              <ActionButton
                icon="calendar-outline"
                label={t('dashboard_new_reservation')}
                onPress={() => { navigation.navigate('Reservations'); }}
              />
              <ActionButton
                icon="grid-outline"
                label={t('dashboard_see_floor')}
                onPress={() => { navigation.navigate('FloorPlan'); }}
              />
              <ActionButton
                icon="time-outline"
                label={t('dashboard_waitlist_link')}
                onPress={() => { navigation.navigate('Reservations'); }}
              />
              <ActionButton
                icon="people-outline"
                label={t('dashboard_guests_link')}
                onPress={() => { navigation.navigate('Guests'); }}
              />
            </View>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CARD_SHADOW = {
  shadowColor:   colors.primary,
  shadowOffset:  { width: 0, height: 1 } as const,
  shadowOpacity: 0.06,
  shadowRadius:  4,
  elevation:     1,
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xxl },
  container: {
    padding:   spacing.xl,
    maxWidth:  layout.contentMaxWidth,
    width:     '100%',
    alignSelf: 'center',
  },
  centered: {
    flex:           1,
    justifyContent: 'center',
    alignItems:     'center',
    padding:        spacing.xl,
  },

  // Loading
  loadingText: {
    ...typography.body,
    color:     colors.textMuted,
    marginTop: spacing.md,
    textAlign: 'center',
  },

  // Error
  errorCard: {
    backgroundColor: colors.surface,
    borderRadius:    radius.lg,
    padding:         spacing.xl,
    width:           '100%',
    maxWidth:        400,
    ...CARD_SHADOW,
  },
  errorTitle: {
    ...typography.h2,
    color:        colors.textPrimary,
    marginBottom: spacing.sm,
  },
  errorMessage: {
    ...typography.body,
    color:        colors.textSecondary,
    marginBottom: spacing.xl,
  },
  retryButton: {
    backgroundColor: colors.cta,
    borderRadius:    radius.md,
    paddingVertical: spacing.md,
    alignItems:      'center',
  },
  retryButtonText: {
    ...typography.bodyMedium,
    color: colors.textOnDark,
  },

  // Header
  headerRow: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
    marginBottom:   spacing.lg,
  },
  headerText: { flex: 1 },
  headerLabel: {
    ...typography.label,
    color:        colors.textMuted,
    marginBottom: spacing.xs,
  },
  headerTitle: {
    ...typography.h1,
    color:        colors.textPrimary,
    marginBottom: spacing.xs,
  },
  headerDate: {
    ...typography.body,
    color: colors.textMuted,
  },
  refreshButton: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.xs,
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor:   colors.ctaLight,
    borderRadius:      radius.md,
    marginTop:         spacing.sm,
  },
  refreshText: {
    ...typography.bodyMedium,
    color: colors.cta,
  },

  // Sections
  section: {
    marginTop: spacing.xxl,
  },
  sectionTitle: {
    ...typography.h2,
    color:        colors.textPrimary,
    marginBottom: spacing.md,
  },

  // KPI grid
  kpiRow: {
    flexDirection: 'row',
    marginBottom:  spacing.sm,
  },
  kpiGap: {
    width: spacing.sm,
  },

  // Empty state
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius:    radius.lg,
    padding:         spacing.xl,
    alignItems:      'center',
    ...CARD_SHADOW,
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

  // Reservation list
  reservationCard: {
    backgroundColor: colors.surface,
    borderRadius:    radius.md,
    padding:         spacing.lg,
    flexDirection:   'row',
    alignItems:      'flex-start',
    marginBottom:    spacing.sm,
    ...CARD_SHADOW,
  },
  timeChip: {
    backgroundColor:   colors.goldLight,
    borderRadius:      radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs,
    marginRight:       spacing.md,
    minWidth:          52,
    alignItems:        'center',
    justifyContent:    'center',
  },
  timeText: {
    fontFamily: typography.stat.fontFamily,
    fontSize:   typography.small.fontSize,
    color:      colors.gold,
  },
  reservationInfo: { flex: 1 },
  nameRow: {
    flexDirection: 'row',
    alignItems:    'center',
    marginBottom:  spacing.xs,
  },
  guestName: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    flex:  1,
  },
  vipBadge: {
    backgroundColor:   colors.goldLight,
    borderRadius:      radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   2,
    marginLeft:        spacing.xs,
  },
  vipText: {
    ...typography.label,
    color: colors.gold,
  },
  reservationMeta: {
    ...typography.small,
    color:        colors.textMuted,
    marginBottom: spacing.sm,
  },

  // Actions rapides
  actionGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.sm,
  },
  actionButton: {
    backgroundColor: colors.surface,
    borderRadius:    radius.lg,
    padding:         spacing.lg,
    width:           '48%',
    alignItems:      'flex-start',
    gap:             spacing.sm,
    ...CARD_SHADOW,
  },
  actionLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
});

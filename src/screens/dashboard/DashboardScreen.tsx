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
import { colors, typography, spacing, radius, layout } from '../../theme';
import { useTodayDashboard, type DashboardReservation } from '../../hooks/useTodayDashboard';
import { formatReadableDate, formatTimeSlot } from '../../utils/date';
import { getReservationStatusColors, getReservationStatusLabel } from '../../utils/reservationStatus';
import { reservationNeedsPhoneConfirmation } from '../../utils/reservationConfirmation';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import type { ReservationStatus } from '../../types/database';

const STATUS_ORDER: ReservationStatus[] = [
  'confirmed', 'pending', 'seated',
  'completed', 'cancelled', 'noshow',
];

const MAX_RESERVATIONS = 8;

function getGuestName(r: DashboardReservation): string {
  if (!r.guests) return 'Client sans nom';
  const parts = [r.guests.first_name, r.guests.last_name]
    .filter((p): p is string => Boolean(p));
  return parts.length > 0 ? parts.join(' ') : 'Client sans nom';
}

function getTableLabel(r: DashboardReservation): string {
  return r.tables?.label ?? 'Table non assignée';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ReservationRow({ r }: { r: DashboardReservation }): React.JSX.Element {
  const isVip = r.guests?.vip === true;
  return (
    <View style={styles.reservationCard}>
      <View style={styles.timeChip}>
        <Text style={styles.timeText}>{formatTimeSlot(r.time_slot)}</Text>
      </View>
      <View style={styles.reservationInfo}>
        <View style={styles.nameRow}>
          <Text style={styles.guestName} numberOfLines={1}>
            {getGuestName(r)}
          </Text>
          {isVip && (
            <View style={styles.vipBadge}>
              <Text style={styles.vipText}>VIP</Text>
            </View>
          )}
        </View>
        <Text style={styles.reservationMeta}>
          {r.party_size} couvert{r.party_size > 1 ? 's' : ''} · {getTableLabel(r)}
        </Text>
        <StatusBadge status={r.status} />
      </View>
    </View>
  );
}

function StatusRow({ status, count }: { status: ReservationStatus; count: number }): React.JSX.Element {
  const { backgroundColor, color } = getReservationStatusColors(status);
  const label = getReservationStatusLabel(status);
  return (
    <View style={styles.statusRowItem}>
      <View style={[styles.statusPill, { backgroundColor }]}>
        <Text style={[styles.statusPillText, { color }]}>{label}</Text>
      </View>
      <Text style={styles.statusCount}>{count}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DashboardScreen(): React.JSX.Element {
  const { loading, error, reservations, stats, refresh } = useTodayDashboard();
  const readableDate  = formatReadableDate(new Date());
  const toCallCount   = reservations.filter(reservationNeedsPhoneConfirmation).length;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} size="large" />
          <Text style={styles.loadingText}>Chargement de la vue du jour…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Impossible de charger le dashboard</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={refresh}>
              <Text style={styles.retryButtonText}>Réessayer</Text>
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
          <Text style={styles.headerLabel}>Aujourd'hui</Text>
          <Text style={styles.headerTitle}>Vue du jour</Text>
          <Text style={styles.headerDate}>{readableDate}</Text>

          {/* ── KPIs ── */}
          <View style={styles.kpiRow}>
            <StatCard label="Réservations" value={stats.total} />
            <View style={styles.kpiGap} />
            <StatCard label="Couverts" value={stats.totalCovers} />
          </View>
          <View style={[styles.kpiRow, styles.kpiRowGap]}>
            <StatCard label="Confirmées" value={stats.confirmed} accent={colors.gold} />
            <View style={styles.kpiGap} />
            <StatCard label="À table" value={stats.seated} accent={colors.cta} />
          </View>
          <View style={[styles.kpiRow, styles.kpiRowGap]}>
            <StatCard
              label="Annulées / No-show"
              value={stats.cancelledAndNoshow}
              accent={stats.cancelledAndNoshow > 0 ? colors.cta : colors.textMuted}
            />
          </View>
          {toCallCount > 0 && (
            <View style={[styles.kpiRow, styles.kpiRowGap]}>
              <StatCard
                label="À appeler aujourd'hui"
                value={toCallCount}
                accent={colors.cta}
              />
            </View>
          )}

          {/* ── Prochaines arrivées ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Prochaines arrivées</Text>
            {visible.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Aucune réservation aujourd'hui</Text>
                <Text style={styles.emptySubtitle}>
                  Les réservations créées apparaîtront ici en temps réel.
                </Text>
              </View>
            ) : (
              visible.map((r) => <ReservationRow key={r.id} r={r} />)
            )}
          </View>

          {/* ── Répartition par statut ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Répartition</Text>
            <View style={styles.statusCard}>
              <View style={styles.statusColumns}>
                <View style={styles.statusColumn}>
                  {STATUS_ORDER.slice(0, 3).map((s) => (
                    <StatusRow key={s} status={s} count={stats.byStatus[s]} />
                  ))}
                </View>
                <View style={[styles.statusColumn, styles.statusColumnRight]}>
                  {STATUS_ORDER.slice(3).map((s) => (
                    <StatusRow key={s} status={s} count={stats.byStatus[s]} />
                  ))}
                </View>
              </View>
            </View>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  container: {
    padding: spacing.xl,
    maxWidth: layout.contentMaxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },

  // Loading
  loadingText: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.md,
    textAlign: 'center',
  },

  // Error
  errorCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  errorTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  errorMessage: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  retryButton: {
    backgroundColor: colors.cta,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  retryButtonText: {
    ...typography.bodyMedium,
    color: colors.textOnDark,
  },

  // Header
  headerLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  headerTitle: {
    ...typography.h1,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  headerDate: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.xl,
  },

  // KPI grid
  kpiRow: {
    flexDirection: 'row',
  },
  kpiRowGap: {
    marginTop: spacing.sm,
  },
  kpiGap: {
    width: spacing.sm,
  },

  // Sections
  section: {
    marginTop: spacing.xxl,
  },
  sectionTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },

  // Empty state
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  emptyTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
  },

  // Reservation card
  reservationCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  timeChip: {
    backgroundColor: colors.goldLight,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginRight: spacing.md,
    minWidth: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeText: {
    fontFamily: typography.stat.fontFamily,
    fontSize: typography.small.fontSize,
    color: colors.gold,
  },
  reservationInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  guestName: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    flex: 1,
  },
  vipBadge: {
    backgroundColor: colors.goldLight,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginLeft: spacing.xs,
  },
  vipText: {
    ...typography.label,
    color: colors.gold,
  },
  reservationMeta: {
    ...typography.small,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },

  // Status section
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  statusColumns: {
    flexDirection: 'row',
  },
  statusColumn: {
    flex: 1,
    gap: spacing.sm,
  },
  statusColumnRight: {
    marginLeft: spacing.lg,
  },
  statusRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusPill: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  statusPillText: {
    ...typography.label,
  },
  statusCount: {
    fontFamily: typography.stat.fontFamily,
    fontSize: typography.body.fontSize,
    color: colors.textPrimary,
  },
});

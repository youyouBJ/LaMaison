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
import { useTodayDashboard, type DashboardReservation } from '../../hooks/useTodayDashboard';
import { useDashboardExtended, type FeedbackStats, type PeriodStats, type ClientStats } from '../../hooks/useDashboardExtended';
import { formatReadableDate, formatTimeSlot } from '../../utils/date';
import { getReservationStatusColors, getReservationStatusLabel } from '../../utils/reservationStatus';
import { reservationNeedsPhoneConfirmation } from '../../utils/reservationConfirmation';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import type { ReservationStatus } from '../../types/database';
import type { MainTabsParamList } from '../../navigation/MainTabs';

type NavProp = BottomTabNavigationProp<MainTabsParamList>;
type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const STATUS_ORDER: ReservationStatus[] = [
  'confirmed', 'pending', 'seated',
  'completed', 'cancelled', 'noshow',
];

const MAX_RESERVATIONS = 8;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGuestName(r: DashboardReservation): string {
  if (!r.guests) return 'Client sans nom';
  const parts = [r.guests.first_name, r.guests.last_name]
    .filter((p): p is string => Boolean(p));
  return parts.length > 0 ? parts.join(' ') : 'Client sans nom';
}

function getTableLabel(r: DashboardReservation): string {
  return r.tables?.label ?? 'Table non assignée';
}

function fmtRating(v: number | null): string {
  if (v === null) return '—';
  return v.toFixed(1);
}

function fmtPct(v: number | null): string {
  if (v === null) return '—';
  return `${v}%`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }): React.JSX.Element {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

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

function KpiRow({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <View style={styles.kpiRow}>{children}</View>;
}

function KpiGap(): React.JSX.Element {
  return <View style={styles.kpiGap} />;
}

// ── Period section ─────────────────────────────────────────────────────────

function PeriodSection({ title, data }: { title: string; data: PeriodStats }): React.JSX.Element {
  return (
    <View style={styles.section}>
      <SectionHeader title={title} />
      <KpiRow>
        <StatCard label="Réservations" value={data.reservations} />
        <KpiGap />
        <StatCard label="Couverts" value={data.covers} />
      </KpiRow>
      <KpiRow>
        <StatCard label="Annulées" value={data.cancelled} accent={data.cancelled > 0 ? colors.cta : colors.textMuted} />
        <KpiGap />
        <StatCard label="No-show" value={data.noshow} accent={data.noshow > 0 ? colors.cta : colors.textMuted} />
      </KpiRow>
      <KpiRow>
        <StatCard label="Anniversaires" value={data.birthdays} accent={data.birthdays > 0 ? colors.gold : colors.textMuted} />
        <KpiGap />
        <StatCard label="Événements" value={data.events} accent={data.events > 0 ? colors.gold : colors.textMuted} />
      </KpiRow>
    </View>
  );
}

// ── Client section ─────────────────────────────────────────────────────────

function ClientSection({ data }: { data: ClientStats }): React.JSX.Element {
  return (
    <View style={styles.section}>
      <SectionHeader title="Clients" />
      <KpiRow>
        <StatCard label="Total clients" value={data.total} />
        <KpiGap />
        <StatCard label="VIP" value={data.vip} accent={colors.gold} />
      </KpiRow>
      <KpiRow>
        <StatCard label="Avec téléphone" value={data.withPhone} />
        <KpiGap />
        <StatCard label="Avec email" value={data.withEmail} />
      </KpiRow>
      <KpiRow>
        <StatCard label="Sans téléphone" value={data.withoutPhone} accent={data.withoutPhone > 0 ? colors.textSecondary : colors.textMuted} />
        <KpiGap />
        <StatCard label="Sans email" value={data.withoutEmail} accent={data.withoutEmail > 0 ? colors.textSecondary : colors.textMuted} />
      </KpiRow>
      {data.withRating > 0 && (
        <KpiRow>
          <StatCard label="Avec note importée" value={data.withRating} accent={colors.gold} />
        </KpiRow>
      )}
    </View>
  );
}

// ── Feedback section ───────────────────────────────────────────────────────

function FeedbackSection({ data }: { data: FeedbackStats | null }): React.JSX.Element {
  if (data === null) {
    return (
      <View style={styles.section}>
        <SectionHeader title="Satisfaction" />
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Module satisfaction non disponible</Text>
          <Text style={styles.emptySubtitle}>
            Vérifiez que la migration feedback_surveys est appliquée.
          </Text>
        </View>
      </View>
    );
  }

  if (data.total === 0) {
    return (
      <View style={styles.section}>
        <SectionHeader title="Satisfaction" />
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Aucun avis reçu pour le moment</Text>
          <Text style={styles.emptySubtitle}>
            Les avis apparaîtront ici dès réception du premier retour client.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <SectionHeader title="Satisfaction" />
      <KpiRow>
        <StatCard label="Avis reçus" value={data.total} accent={colors.gold} />
        <KpiGap />
        <StatCard label="Note globale" value={0} valueText={`${fmtRating(data.avgOverall)} / 5`} accent={colors.gold} />
      </KpiRow>
      <KpiRow>
        <StatCard label="Cuisine" value={0} valueText={fmtRating(data.avgFood)} />
        <KpiGap />
        <StatCard label="Boissons" value={0} valueText={fmtRating(data.avgDrinks)} />
      </KpiRow>
      <KpiRow>
        <StatCard label="Service" value={0} valueText={fmtRating(data.avgService)} />
        <KpiGap />
        <StatCard label="Ambiance" value={0} valueText={fmtRating(data.avgAmbience)} />
      </KpiRow>
      {data.recommendedRate !== null && (
        <KpiRow>
          <StatCard label="Recommande" value={0} valueText={fmtPct(data.recommendedRate)} accent={colors.statusFree} />
        </KpiRow>
      )}
    </View>
  );
}

// ── Action button ──────────────────────────────────────────────────────────

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
  const navigation = useNavigation<NavProp>();
  const { loading, error, reservations, stats, refresh, restaurantId } = useTodayDashboard();
  const { loading: extLoading, stats: ext, refresh: extRefresh } = useDashboardExtended(restaurantId);

  const readableDate = formatReadableDate(new Date());
  const toCallCount  = reservations.filter(reservationNeedsPhoneConfirmation).length;

  const handleRefresh = (): void => {
    refresh();
    extRefresh();
  };

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
            <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
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
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <Text style={styles.headerLabel}>Tableau de bord</Text>
              <Text style={styles.headerTitle}>Vue du jour</Text>
              <Text style={styles.headerDate}>{readableDate}</Text>
            </View>
            <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
              <Ionicons name="refresh-outline" size={16} color={colors.cta} />
              <Text style={styles.refreshText}>Actualiser</Text>
            </TouchableOpacity>
          </View>

          {/* ── Aujourd'hui : KPIs ── */}
          <View style={styles.section}>
            <SectionHeader title="Aujourd'hui" />
            <KpiRow>
              <StatCard label="Réservations" value={stats.total} />
              <KpiGap />
              <StatCard label="Couverts actifs" value={stats.totalCovers} />
            </KpiRow>
            <KpiRow>
              <StatCard label="Confirmées" value={stats.confirmed} accent={colors.gold} />
              <KpiGap />
              <StatCard label="À table" value={stats.seated} accent={colors.cta} />
            </KpiRow>
            <KpiRow>
              <StatCard label="En attente" value={stats.byStatus.pending} />
              <KpiGap />
              <StatCard label="Walk-ins" value={stats.walkInCount} />
            </KpiRow>
            <KpiRow>
              <StatCard
                label="Waitlist en attente"
                value={extLoading ? 0 : ext.waitlistPending}
                accent={ext.waitlistPending > 0 ? colors.gold : colors.textMuted}
              />
              <KpiGap />
              {toCallCount > 0 ? (
                <StatCard label="À appeler" value={toCallCount} accent={colors.cta} />
              ) : (
                <StatCard label="À appeler" value={toCallCount} />
              )}
            </KpiRow>
            <KpiRow>
              <StatCard
                label="Annulées"
                value={stats.byStatus.cancelled}
                accent={stats.byStatus.cancelled > 0 ? colors.cta : colors.textMuted}
              />
              <KpiGap />
              <StatCard
                label="No-show"
                value={stats.byStatus.noshow}
                accent={stats.byStatus.noshow > 0 ? colors.cta : colors.textMuted}
              />
            </KpiRow>
          </View>

          {/* ── Prochaines arrivées ── */}
          <View style={styles.section}>
            <SectionHeader title="Prochaines arrivées" />
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

          {/* ── Statuts du jour ── */}
          <View style={styles.section}>
            <SectionHeader title="Statuts du jour" />
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

          {/* ── Services du jour ── */}
          <View style={styles.section}>
            <SectionHeader title="Services du jour" />
            <KpiRow>
              <StatCard label="Déjeuner" value={stats.lunchCount} accent={colors.gold} />
              <KpiGap />
              <StatCard label="Couverts déj." value={stats.lunchCovers} />
            </KpiRow>
            <KpiRow>
              <StatCard label="Dîner" value={stats.dinnerCount} accent={colors.gold} />
              <KpiGap />
              <StatCard label="Couverts dîn." value={stats.dinnerCovers} />
            </KpiRow>
          </View>

          {/* ── Période 7 jours ── */}
          {extLoading ? (
            <View style={styles.section}>
              <SectionHeader title="7 derniers jours" />
              <View style={styles.extLoadingCard}>
                <ActivityIndicator color={colors.sand} size="small" />
              </View>
            </View>
          ) : (
            <PeriodSection title="7 derniers jours" data={ext.week} />
          )}

          {/* ── Période 30 jours ── */}
          {extLoading ? (
            <View style={styles.section}>
              <SectionHeader title="30 derniers jours" />
              <View style={styles.extLoadingCard}>
                <ActivityIndicator color={colors.sand} size="small" />
              </View>
            </View>
          ) : (
            <PeriodSection title="30 derniers jours" data={ext.month} />
          )}

          {/* ── Clients ── */}
          {extLoading ? (
            <View style={styles.section}>
              <SectionHeader title="Clients" />
              <View style={styles.extLoadingCard}>
                <ActivityIndicator color={colors.sand} size="small" />
              </View>
            </View>
          ) : (
            <ClientSection data={ext.clients} />
          )}

          {/* ── Satisfaction ── */}
          {extLoading ? (
            <View style={styles.section}>
              <SectionHeader title="Satisfaction" />
              <View style={styles.extLoadingCard}>
                <ActivityIndicator color={colors.sand} size="small" />
              </View>
            </View>
          ) : (
            <FeedbackSection data={ext.feedback} />
          )}

          {/* ── Actions rapides ── */}
          <View style={styles.section}>
            <SectionHeader title="Actions rapides" />
            <View style={styles.actionGrid}>
              <ActionButton
                icon="calendar-outline"
                label="Nouvelle réservation"
                onPress={() => { navigation.navigate('Reservations'); }}
              />
              <ActionButton
                icon="grid-outline"
                label="Voir le plan"
                onPress={() => { navigation.navigate('FloorPlan'); }}
              />
              <ActionButton
                icon="time-outline"
                label="Liste d'attente"
                onPress={() => { navigation.navigate('Reservations'); }}
              />
              <ActionButton
                icon="people-outline"
                label="Clients"
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  container: {
    padding:     spacing.xl,
    maxWidth:    layout.contentMaxWidth,
    width:       '100%',
    alignSelf:   'center',
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
    marginBottom:   spacing.xl,
  },
  headerText: {
    flex: 1,
  },
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

  // Extended stats loading state
  extLoadingCard: {
    backgroundColor: colors.surface,
    borderRadius:    radius.lg,
    padding:         spacing.xl,
    alignItems:      'center',
    ...CARD_SHADOW,
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

  // Reservation cards
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
    backgroundColor:  colors.goldLight,
    borderRadius:     radius.sm,
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
  reservationInfo: {
    flex: 1,
  },
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
    backgroundColor:  colors.goldLight,
    borderRadius:     radius.sm,
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

  // Status section
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius:    radius.lg,
    padding:         spacing.lg,
    ...CARD_SHADOW,
  },
  statusColumns: {
    flexDirection: 'row',
  },
  statusColumn: {
    flex: 1,
    gap:  spacing.sm,
  },
  statusColumnRight: {
    marginLeft: spacing.lg,
  },
  statusRowItem: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  statusPill: {
    borderRadius:      radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs,
  },
  statusPillText: {
    ...typography.label,
  },
  statusCount: {
    fontFamily: typography.stat.fontFamily,
    fontSize:   typography.body.fontSize,
    color:      colors.textPrimary,
  },

  // Actions rapides
  actionGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.sm,
  },
  actionButton: {
    backgroundColor:  colors.surface,
    borderRadius:     radius.lg,
    padding:          spacing.lg,
    width:            '48%',
    alignItems:       'flex-start',
    gap:              spacing.sm,
    ...CARD_SHADOW,
  },
  actionLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
});

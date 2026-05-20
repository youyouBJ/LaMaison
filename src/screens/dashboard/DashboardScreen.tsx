import React, { useState } from 'react';
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
import { useDashboardExtended, type ClientStats, type SevenRoomsStats } from '../../hooks/useDashboardExtended';
import {
  usePeriodStats,
  PERIOD_OPTIONS,
  type DashboardPeriod,
  type PeriodReservationStats,
  type PeriodFeedbackStats,
} from '../../hooks/usePeriodStats';
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
  return `${v} %`;
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

// ─── Period selector ──────────────────────────────────────────────────────────

function PeriodSelector({
  active,
  onChange,
}: {
  active: DashboardPeriod;
  onChange: (p: DashboardPeriod) => void;
}): React.JSX.Element {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.periodRow}
      style={styles.periodScroll}
    >
      {PERIOD_OPTIONS.map(opt => {
        const isActive = active === opt.key;
        return (
          <TouchableOpacity
            key={opt.key}
            style={[styles.periodChip, isActive && styles.periodChipActive]}
            onPress={() => { onChange(opt.key); }}
            activeOpacity={0.75}
          >
            <Text style={[styles.periodChipText, isActive && styles.periodChipTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ─── Reservation list item ────────────────────────────────────────────────────

function ReservationRow({ r }: { r: DashboardReservation }): React.JSX.Element {
  const isVip = r.guests?.vip === true;
  return (
    <View style={styles.reservationCard}>
      <View style={styles.timeChip}>
        <Text style={styles.timeText}>{formatTimeSlot(r.time_slot)}</Text>
      </View>
      <View style={styles.reservationInfo}>
        <View style={styles.nameRow}>
          <Text style={styles.guestName} numberOfLines={1}>{getGuestName(r)}</Text>
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

// ─── Status breakdown row ─────────────────────────────────────────────────────

function StatusBreakdownRow({
  status,
  count,
  rate,
}: {
  status: ReservationStatus;
  count: number;
  rate?: number;
}): React.JSX.Element {
  const { backgroundColor, color } = getReservationStatusColors(status);
  const label = getReservationStatusLabel(status);
  return (
    <View style={styles.statusRowItem}>
      <View style={[styles.statusPill, { backgroundColor }]}>
        <Text style={[styles.statusPillText, { color }]}>{label}</Text>
      </View>
      <Text style={styles.statusCount}>
        {count}{rate !== undefined && rate > 0 ? ` · ${rate} %` : ''}
      </Text>
    </View>
  );
}

// ─── Vue période KPIs ─────────────────────────────────────────────────────────

function PeriodKpiSection({
  data,
  loading,
  isToday,
  waitlistPending,
  toCallCount,
}: {
  data: PeriodReservationStats;
  loading: boolean;
  isToday: boolean;
  waitlistPending: number;
  toCallCount: number;
}): React.JSX.Element {
  if (loading) {
    return (
      <View style={styles.extLoadingCard}>
        <ActivityIndicator color={colors.sand} size="small" />
      </View>
    );
  }

  if (data.total === 0) {
    return <EmptyCard title="Aucune réservation sur cette période" />;
  }

  return (
    <>
      <KpiRow>
        <StatCard label="Réservations" value={data.total} />
        <KpiGap />
        <StatCard label="Couverts actifs" value={data.covers} />
      </KpiRow>
      <KpiRow>
        <StatCard label="Confirmées" value={data.confirmed} accent={colors.gold} />
        <KpiGap />
        <StatCard label="Terminées" value={data.completed} />
      </KpiRow>
      <KpiRow>
        <StatCard label="En attente" value={data.pending} />
        <KpiGap />
        <StatCard label="À table" value={data.seated} accent={colors.cta} />
      </KpiRow>
      <KpiRow>
        <StatCard
          label="Annulées"
          value={data.cancelled}
          valueText={data.cancellationRate > 0 ? `${data.cancelled} (${data.cancellationRate} %)` : `${data.cancelled}`}
          accent={data.cancelled > 0 ? colors.cta : colors.textMuted}
        />
        <KpiGap />
        <StatCard
          label="No-show"
          value={data.noshow}
          valueText={data.noshowRate > 0 ? `${data.noshow} (${data.noshowRate} %)` : `${data.noshow}`}
          accent={data.noshow > 0 ? colors.cta : colors.textMuted}
        />
      </KpiRow>
      {(data.walkIns > 0 || data.uniqueGuests > 0) && (
        <KpiRow>
          <StatCard label="Walk-ins" value={data.walkIns} />
          <KpiGap />
          <StatCard label="Clients uniques" value={data.uniqueGuests} />
        </KpiRow>
      )}
      {(data.birthdays > 0 || data.events > 0) && (
        <KpiRow>
          <StatCard label="Anniversaires" value={data.birthdays} accent={data.birthdays > 0 ? colors.gold : colors.textMuted} />
          <KpiGap />
          <StatCard label="Événements" value={data.events} accent={data.events > 0 ? colors.gold : colors.textMuted} />
        </KpiRow>
      )}
      {isToday && (
        <KpiRow>
          <StatCard
            label="Waitlist en attente"
            value={waitlistPending}
            accent={waitlistPending > 0 ? colors.gold : colors.textMuted}
          />
          <KpiGap />
          <StatCard
            label="À appeler"
            value={toCallCount}
            accent={toCallCount > 0 ? colors.cta : colors.textMuted}
          />
        </KpiRow>
      )}
    </>
  );
}

// ─── Statuts répartition ──────────────────────────────────────────────────────

function StatusSection({
  data,
  loading,
}: {
  data: PeriodReservationStats;
  loading: boolean;
}): React.JSX.Element {
  return (
    <View style={styles.section}>
      <SectionHeader title="Répartition statuts" />
      {loading ? (
        <View style={styles.extLoadingCard}>
          <ActivityIndicator color={colors.sand} size="small" />
        </View>
      ) : (
        <View style={styles.statusCard}>
          <View style={styles.statusColumns}>
            <View style={styles.statusColumn}>
              {STATUS_ORDER.slice(0, 3).map(s => {
                const count = data[s as keyof PeriodReservationStats] as number;
                const rate  = s === 'cancelled' ? data.cancellationRate : s === 'noshow' ? data.noshowRate : undefined;
                return <StatusBreakdownRow key={s} status={s} count={count} rate={rate} />;
              })}
            </View>
            <View style={[styles.statusColumn, styles.statusColumnRight]}>
              {STATUS_ORDER.slice(3).map(s => {
                const count = data[s as keyof PeriodReservationStats] as number;
                const rate  = s === 'cancelled' ? data.cancellationRate : s === 'noshow' ? data.noshowRate : undefined;
                return <StatusBreakdownRow key={s} status={s} count={count} rate={rate} />;
              })}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Services section ─────────────────────────────────────────────────────────

function ServicesSection({
  data,
  loading,
}: {
  data: PeriodReservationStats;
  loading: boolean;
}): React.JSX.Element {
  return (
    <View style={styles.section}>
      <SectionHeader title="Services" />
      {loading ? (
        <View style={styles.extLoadingCard}>
          <ActivityIndicator color={colors.sand} size="small" />
        </View>
      ) : (
        <>
          <KpiRow>
            <StatCard label="Déjeuner" value={data.lunchCount} accent={colors.gold} />
            <KpiGap />
            <StatCard label="Couverts déj." value={data.lunchCovers} />
          </KpiRow>
          <KpiRow>
            <StatCard label="Dîner" value={data.dinnerCount} accent={colors.gold} />
            <KpiGap />
            <StatCard label="Couverts dîn." value={data.dinnerCovers} />
          </KpiRow>
        </>
      )}
    </View>
  );
}

// ─── Satisfaction section ─────────────────────────────────────────────────────

function SatisfactionSection({
  data,
  sevenRooms,
  periodLoading,
  extLoading,
}: {
  data: PeriodFeedbackStats | null;
  sevenRooms: SevenRoomsStats;
  periodLoading: boolean;
  extLoading: boolean;
}): React.JSX.Element {
  return (
    <View style={styles.section}>
      <SectionHeader title="Satisfaction" />

      {/* ── Sous-section : Enquêtes reçues ── */}
      <Text style={styles.subSectionLabel}>Enquêtes reçues</Text>
      {periodLoading ? (
        <View style={styles.extLoadingCard}>
          <ActivityIndicator color={colors.sand} size="small" />
        </View>
      ) : data === null ? (
        <EmptyCard
          title="Module satisfaction non disponible"
          subtitle="Vérifiez que la migration feedback_surveys est appliquée."
        />
      ) : data.total === 0 ? (
        <EmptyCard
          title="Aucune nouvelle enquête reçue sur cette période"
          subtitle="Les avis issus du formulaire apparaîtront ici."
        />
      ) : (
        <>
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
          {data.lastComment ? (
            <View style={styles.commentCard}>
              <Text style={styles.commentLabel}>Dernier commentaire</Text>
              <Text style={styles.commentText} numberOfLines={4}>{data.lastComment}</Text>
            </View>
          ) : null}
        </>
      )}

      {/* ── Sous-section : Import SevenRooms ── */}
      <Text style={styles.subSectionLabel}>Import SevenRooms</Text>
      {extLoading ? (
        <View style={styles.extLoadingCard}>
          <ActivityIndicator color={colors.sand} size="small" />
        </View>
      ) : sevenRooms.count === 0 ? (
        <EmptyCard title="Aucune note importée disponible" />
      ) : (
        <View style={styles.srCard}>
          <KpiRow>
            <StatCard label="Clients notés" value={sevenRooms.count} accent={colors.gold} />
            <KpiGap />
            <StatCard
              label="Rating moyen"
              value={0}
              valueText={`${fmtRating(sevenRooms.avgRating)} / 5`}
              accent={colors.gold}
            />
          </KpiRow>
          <Text style={styles.srNote}>
            Données importées depuis SevenRooms. Non filtrées par période tant que l'historique détaillé n'est pas importé.
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Client section ───────────────────────────────────────────────────────────

function ClientSection({
  data,
  loading,
}: {
  data: ClientStats;
  loading: boolean;
}): React.JSX.Element {
  return (
    <View style={styles.section}>
      <SectionHeader title="Clients" />
      {loading ? (
        <View style={styles.extLoadingCard}>
          <ActivityIndicator color={colors.sand} size="small" />
        </View>
      ) : (
        <>
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
        </>
      )}
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
  const navigation = useNavigation<NavProp>();
  const [activePeriod, setActivePeriod] = useState<DashboardPeriod>('today');

  const { loading, error, reservations, restaurantId, refresh: todayRefresh } = useTodayDashboard();
  const { loading: extLoading, stats: ext, refresh: extRefresh } = useDashboardExtended(restaurantId);
  const { loading: periodLoading, stats: period, refresh: periodRefresh } = usePeriodStats(restaurantId, activePeriod);

  const readableDate = formatReadableDate(new Date());
  const toCallCount  = reservations.filter(reservationNeedsPhoneConfirmation).length;
  const isToday      = activePeriod === 'today';

  const handleRefresh = (): void => {
    todayRefresh();
    extRefresh();
    periodRefresh();
  };

  // ── Full-screen loading (initial auth + profile only) ──────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} size="large" />
          <Text style={styles.loadingText}>Chargement du tableau de bord…</Text>
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
              <Text style={styles.headerTitle}>Pilotage</Text>
              <Text style={styles.headerDate}>{readableDate}</Text>
            </View>
            <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
              <Ionicons name="refresh-outline" size={16} color={colors.cta} />
              <Text style={styles.refreshText}>Actualiser</Text>
            </TouchableOpacity>
          </View>

          {/* ── Sélecteur de période ── */}
          <PeriodSelector active={activePeriod} onChange={setActivePeriod} />

          {/* ── Vue période ── */}
          <View style={styles.section}>
            <SectionHeader title="Vue période" />
            <PeriodKpiSection
              data={period.reservations}
              loading={periodLoading}
              isToday={isToday}
              waitlistPending={ext.waitlistPending}
              toCallCount={toCallCount}
            />
          </View>

          {/* ── Prochaines arrivées (aujourd'hui uniquement) ── */}
          {isToday && (
            <View style={styles.section}>
              <SectionHeader title="Prochaines arrivées" />
              {visible.length === 0 ? (
                <EmptyCard
                  title="Aucune réservation aujourd'hui"
                  subtitle="Les réservations créées apparaîtront ici en temps réel."
                />
              ) : (
                visible.map(r => <ReservationRow key={r.id} r={r} />)
              )}
            </View>
          )}

          {/* ── Répartition statuts ── */}
          <StatusSection data={period.reservations} loading={periodLoading} />

          {/* ── Services ── */}
          <ServicesSection data={period.reservations} loading={periodLoading} />

          {/* ── Satisfaction ── */}
          <SatisfactionSection
            data={period.feedback}
            sevenRooms={ext.sevenRooms}
            periodLoading={periodLoading}
            extLoading={extLoading}
          />

          {/* ── Clients ── */}
          <ClientSection data={ext.clients} loading={extLoading} />

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

  // Period selector
  periodScroll: {
    marginBottom: spacing.xs,
  },
  periodRow: {
    flexDirection: 'row',
    gap:           spacing.sm,
    paddingBottom: spacing.xs,
  },
  periodChip: {
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius:      radius.xl,
    backgroundColor:   colors.surface,
    borderWidth:       1,
    borderColor:       colors.border,
  },
  periodChipActive: {
    backgroundColor: colors.cta,
    borderColor:     colors.cta,
  },
  periodChipText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  periodChipTextActive: {
    color: colors.textOnDark,
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

  // Loading placeholder for async sections
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

  // Satisfaction sub-sections
  subSectionLabel: {
    ...typography.label,
    color:        colors.textMuted,
    marginTop:    spacing.lg,
    marginBottom: spacing.sm,
  },
  srCard: {
    // No extra wrapper needed — KpiRow + srNote are sufficient
  },
  srNote: {
    ...typography.small,
    color:      colors.textMuted,
    marginTop:  spacing.sm,
    fontStyle:  'italic',
  },

  // Satisfaction comment
  commentCard: {
    backgroundColor: colors.surfaceWarm,
    borderRadius:    radius.lg,
    padding:         spacing.lg,
    marginTop:       spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
  },
  commentLabel: {
    ...typography.label,
    color:        colors.textMuted,
    marginBottom: spacing.sm,
  },
  commentText: {
    ...typography.body,
    color:      colors.textSecondary,
    fontStyle:  'italic',
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

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, typography, spacing, radius, layout } from '../../theme';
import { useSettingsOverview } from '../../hooks/useSettingsOverview';
import type { ZoneSummary } from '../../hooks/useSettingsOverview';
import { supabase } from '../../lib/supabase';
import { parseDateString } from '../../utils/date';
import {
  usePeriodStats,
  PERIOD_OPTIONS,
  type DashboardPeriod,
  type PeriodReservationStats,
  type PeriodFeedbackStats,
  type PeriodGuestStats,
} from '../../hooks/usePeriodStats';
import { useDashboardExtended, type SevenRoomsStats } from '../../hooks/useDashboardExtended';
import { getReservationStatusColors, getReservationStatusLabel } from '../../utils/reservationStatus';
import StatCard from '../../components/StatCard';
import type { AdminStackParamList } from '../../navigation/AdminNavigator';
import type { ReservationStatus, Database } from '../../types/database';

type ShiftRow = Database['public']['Tables']['shifts']['Row'];

type Props = {
  navigation: NativeStackNavigationProp<AdminStackParamList, 'AdminMain'>;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_ORDER: ReservationStatus[] = [
  'confirmed', 'pending', 'seated',
  'completed', 'cancelled', 'noshow',
];

const DAY_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtRating(v: number | null): string {
  if (v === null) return '—';
  return v.toFixed(1);
}

function fmtPct(v: number | null): string {
  if (v === null) return '—';
  return `${v} %`;
}

function formatDays(days: number[]): string {
  if (days.length === 0) return '–';
  if (days.length === 7) return 'Tous les jours';
  const sorted = [...days].sort((a, b) => a - b);
  const labels = sorted.map(d => DAY_SHORT[d] ?? `J${d}`);
  let consecutive = true;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) { consecutive = false; break; }
  }
  if (consecutive && sorted.length >= 3) {
    return `${labels[0]}–${labels[labels.length - 1]}`;
  }
  return labels.join(', ');
}

function formatTime(t: string): string {
  return t.length >= 5 ? t.substring(0, 5) : t;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <View style={styles.card}>{children}</View>;
}

function SectionHeader({ title }: { title: string }): React.JSX.Element {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function InfoRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function Divider(): React.JSX.Element {
  return <View style={styles.divider} />;
}

function ShiftCard({ shift }: { shift: ShiftRow }): React.JSX.Element {
  const days  = formatDays(shift.days_of_week);
  const start = formatTime(shift.start_time);
  const end   = formatTime(shift.end_time);
  return (
    <View style={styles.shiftCard}>
      <View style={styles.shiftHeader}>
        <Text style={styles.shiftName}>{shift.name}</Text>
        <View style={styles.shiftBadge}>
          <Text style={styles.shiftBadgeText}>{days}</Text>
        </View>
      </View>
      <Text style={styles.shiftHours}>{start}–{end}</Text>
      <View style={styles.shiftMeta}>
        <View style={styles.shiftMetaItem}>
          <Ionicons name="time-outline" size={12} color={colors.textMuted} />
          <Text style={styles.shiftMetaText}>Slot {shift.slot_duration} min</Text>
        </View>
        <View style={styles.shiftMetaDot} />
        <View style={styles.shiftMetaItem}>
          <Ionicons name="people-outline" size={12} color={colors.textMuted} />
          <Text style={styles.shiftMetaText}>{shift.max_covers_per_slot} couverts max</Text>
        </View>
      </View>
    </View>
  );
}

function ZoneRow({ zone }: { zone: ZoneSummary }): React.JSX.Element {
  return (
    <View style={styles.zoneRow}>
      <View style={styles.zoneIcon}>
        <Ionicons name="grid-outline" size={14} color={colors.gold} />
      </View>
      <Text style={styles.zoneName} numberOfLines={1}>{zone.name}</Text>
      <Text style={styles.zoneCount}>
        {zone.tableCount} table{zone.tableCount > 1 ? 's' : ''}
      </Text>
    </View>
  );
}

function PeriodSelectorAdmin({
  active,
  onChange,
}: {
  active: DashboardPeriod;
  onChange: (p: DashboardPeriod) => void;
}): React.JSX.Element {
  return (
    <View style={styles.periodRow}>
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
    </View>
  );
}

function PeriodKpiSection({
  data,
  loading,
}: {
  data: PeriodReservationStats;
  loading: boolean;
}): React.JSX.Element {
  if (loading) {
    return (
      <View style={styles.extLoadingCard}>
        <ActivityIndicator color={colors.sand} size="small" />
      </View>
    );
  }
  if (data.total === 0) {
    return (
      <Card>
        <Text style={styles.emptyText}>Aucune réservation sur cette période.</Text>
      </Card>
    );
  }
  return (
    <>
      <View style={styles.kpiRow}>
        <StatCard label="Réservations"   value={data.total} />
        <View style={styles.kpiGap} />
        <StatCard label="Couverts actifs" value={data.covers} />
      </View>
      <View style={styles.kpiRow}>
        <StatCard label="Confirmées" value={data.confirmed} accent={colors.gold} />
        <View style={styles.kpiGap} />
        <StatCard label="Terminées"  value={data.completed} />
      </View>
      <View style={styles.kpiRow}>
        <StatCard label="En attente" value={data.pending} />
        <View style={styles.kpiGap} />
        <StatCard label="À table"    value={data.seated} accent={colors.cta} />
      </View>
      <View style={styles.kpiRow}>
        <StatCard
          label="Annulées"
          value={data.cancelled}
          valueText={data.cancellationRate > 0 ? `${data.cancelled} (${data.cancellationRate} %)` : `${data.cancelled}`}
          accent={data.cancelled > 0 ? colors.cta : colors.textMuted}
        />
        <View style={styles.kpiGap} />
        <StatCard
          label="No-show"
          value={data.noshow}
          valueText={data.noshowRate > 0 ? `${data.noshow} (${data.noshowRate} %)` : `${data.noshow}`}
          accent={data.noshow > 0 ? colors.cta : colors.textMuted}
        />
      </View>
      {data.uniqueGuests > 0 && (
        <View style={styles.kpiRow}>
          <StatCard label="Walk-ins"        value={data.walkIns} />
          <View style={styles.kpiGap} />
          <StatCard label="Clients uniques" value={data.uniqueGuests} />
        </View>
      )}
      {(data.birthdays > 0 || data.events > 0) && (
        <View style={styles.kpiRow}>
          <StatCard
            label="Anniversaires"
            value={data.birthdays}
            accent={data.birthdays > 0 ? colors.gold : colors.textMuted}
          />
          <View style={styles.kpiGap} />
          <StatCard
            label="Événements"
            value={data.events}
            accent={data.events > 0 ? colors.gold : colors.textMuted}
          />
        </View>
      )}
    </>
  );
}

function PeriodServicesSection({
  data,
  loading,
}: {
  data: PeriodReservationStats;
  loading: boolean;
}): React.JSX.Element {
  if (loading) {
    return (
      <View style={styles.extLoadingCard}>
        <ActivityIndicator color={colors.sand} size="small" />
      </View>
    );
  }
  return (
    <>
      <View style={styles.kpiRow}>
        <StatCard label="Déjeuner"      value={data.lunchCount}  accent={colors.gold} />
        <View style={styles.kpiGap} />
        <StatCard label="Couverts déj." value={data.lunchCovers} />
      </View>
      <View style={styles.kpiRow}>
        <StatCard label="Dîner"         value={data.dinnerCount}  accent={colors.gold} />
        <View style={styles.kpiGap} />
        <StatCard label="Couverts dîn." value={data.dinnerCovers} />
      </View>
    </>
  );
}

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

function StatusSummarySection({
  data,
  loading,
}: {
  data: PeriodReservationStats;
  loading: boolean;
}): React.JSX.Element {
  if (loading) {
    return (
      <View style={styles.extLoadingCard}>
        <ActivityIndicator color={colors.sand} size="small" />
      </View>
    );
  }
  return (
    <View style={styles.statusCard}>
      {STATUS_ORDER.map(s => {
        const count = data[s as keyof PeriodReservationStats] as number;
        const rate  = s === 'cancelled' ? data.cancellationRate : s === 'noshow' ? data.noshowRate : undefined;
        return <StatusBreakdownRow key={s} status={s} count={count} rate={rate} />;
      })}
    </View>
  );
}

function SatisfactionSection({
  feedbackData,
  sevenRooms,
  periodLoading,
  extLoading,
}: {
  feedbackData: PeriodFeedbackStats | null;
  sevenRooms: SevenRoomsStats;
  periodLoading: boolean;
  extLoading: boolean;
}): React.JSX.Element {
  if (periodLoading || extLoading) {
    return (
      <View style={styles.extLoadingCard}>
        <ActivityIndicator color={colors.sand} size="small" />
      </View>
    );
  }

  const hasSR       = sevenRooms.count > 0;
  const hasFeedback = feedbackData !== null && feedbackData.total > 0;

  return (
    <>
      {hasFeedback && feedbackData !== null ? (
        <>
          <View style={styles.kpiRow}>
            <StatCard label="Avis reçus"    value={feedbackData.total}  accent={colors.gold} />
            <View style={styles.kpiGap} />
            <StatCard
              label="Note moyenne"
              value={0}
              valueText={`${fmtRating(feedbackData.avgOverall)} / 5`}
              accent={colors.gold}
            />
          </View>
          <View style={styles.kpiRow}>
            <StatCard label="Cuisine"  value={0} valueText={fmtRating(feedbackData.avgFood)} />
            <View style={styles.kpiGap} />
            <StatCard label="Boissons" value={0} valueText={fmtRating(feedbackData.avgDrinks)} />
          </View>
          <View style={styles.kpiRow}>
            <StatCard label="Service"  value={0} valueText={fmtRating(feedbackData.avgService)} />
            <View style={styles.kpiGap} />
            <StatCard label="Ambiance" value={0} valueText={fmtRating(feedbackData.avgAmbience)} />
          </View>
          {feedbackData.recommendedRate !== null && (
            <View style={styles.kpiRow}>
              <StatCard
                label="Recommandation"
                value={0}
                valueText={fmtPct(feedbackData.recommendedRate)}
                accent={colors.statusFree}
              />
            </View>
          )}
          {feedbackData.lastComment ? (
            <View style={styles.commentCard}>
              <Text style={styles.commentLabel}>Dernier commentaire</Text>
              <Text style={styles.commentText} numberOfLines={4}>{feedbackData.lastComment}</Text>
            </View>
          ) : null}
        </>
      ) : (
        <Card>
          <Text style={styles.emptyText}>
            {feedbackData === null
              ? 'Module satisfaction non configuré.'
              : 'Aucune enquête reçue sur cette période.'}
          </Text>
        </Card>
      )}

      {hasSR && (
        <View style={styles.srHistoryCard}>
          <Text style={styles.srHistoryTitle}>Historique satisfaction</Text>
          <View style={styles.srHistoryRow}>
            <Text style={styles.srHistoryLabel}>Note importée</Text>
            <Text style={styles.srHistoryValue}>{fmtRating(sevenRooms.avgRating)} / 5</Text>
          </View>
          <View style={styles.srHistoryRow}>
            <Text style={styles.srHistoryLabel}>Clients notés</Text>
            <Text style={styles.srHistoryValue}>{sevenRooms.count}</Text>
          </View>
        </View>
      )}
    </>
  );
}

function CustomDateInputs({
  startDate,
  endDate,
  onChangeStart,
  onChangeEnd,
  error,
}: {
  startDate: string;
  endDate: string;
  onChangeStart: (v: string) => void;
  onChangeEnd: (v: string) => void;
  error: string | null;
}): React.JSX.Element {
  return (
    <View style={styles.customDateBlock}>
      <View style={styles.customDateRow}>
        <View style={styles.customDateGroup}>
          <Text style={styles.customDateLabel}>Date début</Text>
          <TextInput
            style={styles.customDateInput}
            placeholder="AAAA-MM-JJ"
            placeholderTextColor={colors.textMuted}
            value={startDate}
            onChangeText={onChangeStart}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <View style={styles.customDateGroup}>
          <Text style={styles.customDateLabel}>Date fin</Text>
          <TextInput
            style={styles.customDateInput}
            placeholder="AAAA-MM-JJ"
            placeholderTextColor={colors.textMuted}
            value={endDate}
            onChangeText={onChangeEnd}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>
      {error !== null && (
        <Text style={styles.customDateError}>{error}</Text>
      )}
    </View>
  );
}

function PeriodGuestsSection({
  periodGuests,
  periodLoading,
}: {
  periodGuests: PeriodGuestStats;
  periodLoading: boolean;
}): React.JSX.Element {
  if (periodLoading) {
    return (
      <View style={styles.extLoadingCard}>
        <ActivityIndicator color={colors.sand} size="small" />
      </View>
    );
  }
  return (
    <>
      <View style={styles.kpiRow}>
        <StatCard label="Clients uniques" value={periodGuests.uniqueReserving} />
        <View style={styles.kpiGap} />
        <StatCard label="Walk-ins"        value={periodGuests.walkIns} />
      </View>
      <View style={styles.kpiRow}>
        <StatCard label="VIP période" value={periodGuests.vipReserving} accent={colors.gold} />
      </View>
    </>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SettingsScreen({ navigation }: Props): React.JSX.Element {
  const { loading, error, data, refresh } = useSettingsOverview();
  const [signingOut, setSigningOut]       = useState(false);
  const [activePeriod, setActivePeriod]   = useState<DashboardPeriod>('month');
  const [customStart, setCustomStart]     = useState('');
  const [customEnd, setCustomEnd]         = useState('');

  const restaurantId = data?.restaurant.id ?? null;

  const customStartParsed = parseDateString(customStart);
  const customEndParsed   = parseDateString(customEnd);
  const customDatesValid  = customStartParsed !== null && customEndParsed !== null && customStart <= customEnd;
  const hookCustomStart   = activePeriod === 'custom' && customDatesValid ? customStart : undefined;
  const hookCustomEnd     = activePeriod === 'custom' && customDatesValid ? customEnd   : undefined;

  const customError: string | null = activePeriod !== 'custom' ? null
    : customStart.length > 0 && customStartParsed === null ? 'Date de début invalide (format AAAA-MM-JJ).'
    : customEnd.length > 0   && customEndParsed   === null ? 'Date de fin invalide (format AAAA-MM-JJ).'
    : customStartParsed !== null && customEndParsed !== null && customStart > customEnd
      ? 'La date de fin doit être après la date de début.'
      : null;

  const { loading: periodLoading, stats: period, refresh: periodRefresh } = usePeriodStats(
    restaurantId,
    activePeriod,
    hookCustomStart,
    hookCustomEnd,
  );
  const { loading: extLoading, stats: ext, refresh: extRefresh } = useDashboardExtended(restaurantId);

  const handleSignOut = async (): Promise<void> => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
    } catch (e) {
      if (__DEV__) console.error('[Admin] signOut threw:', e);
    } finally {
      setSigningOut(false);
    }
  };

  const handleRefreshAll = (): void => {
    refresh();
    periodRefresh();
    extRefresh();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} size="large" />
          <Text style={styles.loadingText}>Chargement…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Impossible de charger</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleRefreshAll}>
              <Text style={styles.retryButtonText}>Réessayer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.signOutButtonSmall}
              onPress={() => { void handleSignOut(); }}
              disabled={signingOut}
            >
              {signingOut
                ? <ActivityIndicator color={colors.cta} size="small" />
                : <Text style={styles.signOutTextSmall}>Se déconnecter</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!data) return <SafeAreaView style={styles.safe} />;

  const { restaurant, shifts, floor, guests } = data;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>

          {/* ── Header ── */}
          <Text style={styles.headerLabel}>Admin</Text>
          <Text style={styles.headerTitle}>Administration</Text>
          <Text style={styles.headerSub}>Pilotage · {restaurant.name}</Text>

          {/* ── Entrée Paramètres ── */}
          <TouchableOpacity
            style={styles.settingsEntryCard}
            onPress={() => { navigation.navigate('AdminSettings'); }}
            activeOpacity={0.75}
          >
            <View style={styles.settingsEntryIcon}>
              <Ionicons name="settings-outline" size={20} color={colors.gold} />
            </View>
            <View style={styles.settingsEntryContent}>
              <Text style={styles.settingsEntryTitle}>Paramètres</Text>
              <Text style={styles.settingsEntrySub}>Restaurant, compte et configuration</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          {/* ── Pilotage avancé ── */}
          <SectionHeader title="Pilotage avancé" />
          <PeriodSelectorAdmin active={activePeriod} onChange={setActivePeriod} />
          {activePeriod === 'custom' && (
            <CustomDateInputs
              startDate={customStart}
              endDate={customEnd}
              onChangeStart={setCustomStart}
              onChangeEnd={setCustomEnd}
              error={customError}
            />
          )}

          <Text style={styles.subSectionLabel}>Réservations</Text>
          <PeriodKpiSection data={period.reservations} loading={periodLoading} />

          <Text style={styles.subSectionLabel}>Clients</Text>
          <PeriodGuestsSection
            periodGuests={period.guests}
            periodLoading={periodLoading}
          />

          <Text style={styles.subSectionLabel}>Répartition statuts</Text>
          <StatusSummarySection data={period.reservations} loading={periodLoading} />

          <Text style={styles.subSectionLabel}>Services de la période</Text>
          <PeriodServicesSection data={period.reservations} loading={periodLoading} />

          <Text style={styles.subSectionLabel}>Satisfaction client</Text>
          <SatisfactionSection
            feedbackData={period.feedback}
            sevenRooms={ext.sevenRooms}
            periodLoading={periodLoading}
            extLoading={extLoading}
          />

          {/* ── Services ── */}
          <SectionHeader title="Services" />
          {shifts.length === 0 ? (
            <Card>
              <Text style={styles.emptyText}>Aucun service configuré.</Text>
            </Card>
          ) : (
            shifts.map((shift, idx) => (
              <ShiftCard key={shift.id ?? idx} shift={shift} />
            ))
          )}

          {/* ── Plan de salle ── */}
          <SectionHeader title="Plan de salle" />
          <View style={styles.kpiRow}>
            <StatCard label="Tables" value={floor.totalTables} accent={colors.gold} />
            <View style={styles.kpiGap} />
            <StatCard label="Zones"  value={floor.zoneCount} />
          </View>
          {floor.zones.length > 0 && (
            <Card>
              {floor.zones.map((z, idx) => (
                <React.Fragment key={z.name}>
                  {idx > 0 && <Divider />}
                  <ZoneRow zone={z} />
                </React.Fragment>
              ))}
            </Card>
          )}

          {/* ── Données clients ── */}
          <SectionHeader title="Données clients" />
          <View style={styles.kpiRow}>
            <StatCard label="Clients"    value={guests.total} />
            <View style={styles.kpiGap} />
            <StatCard label="VIP"        value={guests.vip} accent={colors.gold} />
          </View>
          <View style={styles.kpiRow}>
            <StatCard label="Avec email" value={guests.withEmail} />
          </View>
          {extLoading ? (
            <View style={styles.extLoadingCard}>
              <ActivityIndicator color={colors.sand} size="small" />
            </View>
          ) : (
            <Card>
              <InfoRow label="Avec tél." value={String(guests.withPhone)} />
              {ext.sevenRooms.count > 0 && (
                <>
                  <Divider />
                  <InfoRow label="Clients notés" value={String(ext.sevenRooms.count)} />
                  <Divider />
                  <InfoRow
                    label="Note moyenne"
                    value={ext.sevenRooms.avgRating !== null
                      ? `${ext.sevenRooms.avgRating.toFixed(1)} / 5`
                      : '—'}
                  />
                </>
              )}
            </Card>
          )}

          {/* ── Actualiser ── */}
          <TouchableOpacity style={styles.refreshButton} onPress={handleRefreshAll}>
            <Ionicons name="refresh-outline" size={16} color={colors.cta} />
            <Text style={styles.refreshButtonText}>Actualiser</Text>
          </TouchableOpacity>

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
  headerSub: {
    ...typography.body,
    color:        colors.textMuted,
    marginBottom: spacing.lg,
  },

  // Paramètres entry card
  settingsEntryCard: {
    backgroundColor: colors.surface,
    borderRadius:    radius.lg,
    padding:         spacing.lg,
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.md,
    marginBottom:    spacing.xl,
    ...CARD_SHADOW,
  },
  settingsEntryIcon: {
    width:           40,
    height:          40,
    borderRadius:    radius.md,
    backgroundColor: colors.goldLight,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  settingsEntryContent: {
    flex: 1,
  },
  settingsEntryTitle: {
    ...typography.bodyMedium,
    color:        colors.textPrimary,
    marginBottom: 2,
  },
  settingsEntrySub: {
    ...typography.small,
    color: colors.textMuted,
  },

  // Section headers
  sectionTitle: {
    ...typography.h2,
    color:        colors.textPrimary,
    marginTop:    spacing.xxl,
    marginBottom: spacing.md,
  },

  // Generic card
  card: {
    backgroundColor: colors.surface,
    borderRadius:    radius.lg,
    padding:         spacing.lg,
    ...CARD_SHADOW,
  },

  // Info rows
  infoRow: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    paddingVertical: spacing.sm,
    gap:             spacing.sm,
  },
  infoLabel: {
    ...typography.label,
    color:      colors.textMuted,
    width:      96,
    marginTop:  2,
    flexShrink: 0,
  },
  infoValue: {
    ...typography.body,
    color: colors.textPrimary,
    flex:  1,
  },
  divider: {
    height:           1,
    backgroundColor:  colors.borderLight,
    marginHorizontal: -spacing.lg,
  },

  // KPI grid
  kpiRow: {
    flexDirection: 'row',
    marginBottom:  spacing.sm,
  },
  kpiGap: {
    width: spacing.sm,
  },

  // Loading placeholder
  extLoadingCard: {
    backgroundColor: colors.surface,
    borderRadius:    radius.lg,
    padding:         spacing.xl,
    alignItems:      'center',
    marginBottom:    spacing.sm,
    ...CARD_SHADOW,
  },

  // Empty state
  emptyText: {
    ...typography.body,
    color:     colors.textMuted,
    textAlign: 'center',
    padding:   spacing.sm,
  },

  // Period selector
  periodRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.sm,
    marginBottom:  spacing.sm,
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

  // Sub-section labels within Pilotage
  subSectionLabel: {
    ...typography.label,
    color:        colors.textMuted,
    marginTop:    spacing.lg,
    marginBottom: spacing.sm,
  },

  // Status breakdown
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius:    radius.lg,
    padding:         spacing.lg,
    gap:             spacing.sm,
    ...CARD_SHADOW,
  },
  statusRowItem: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingVertical: 2,
  },
  statusPill: {
    borderRadius:      radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs,
    flexShrink:        1,
  },
  statusPillText: {
    ...typography.label,
  },
  statusCount: {
    fontFamily: typography.stat.fontFamily,
    fontSize:   typography.body.fontSize,
    color:      colors.textPrimary,
    marginLeft: spacing.sm,
    flexShrink: 0,
  },

  // Satisfaction — historique importé
  srHistoryCard: {
    backgroundColor: colors.surfaceWarm,
    borderRadius:    radius.md,
    padding:         spacing.md,
    marginTop:       spacing.lg,
    borderLeftWidth: 2,
    borderLeftColor: colors.sand,
  },
  srHistoryTitle: {
    ...typography.label,
    color:        colors.textMuted,
    marginBottom: spacing.sm,
  },
  srHistoryRow: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    paddingVertical: 2,
  },
  srHistoryLabel: {
    ...typography.small,
    color: colors.textSecondary,
  },
  srHistoryValue: {
    fontFamily: typography.stat.fontFamily,
    fontSize:   typography.small.fontSize,
    color:      colors.textPrimary,
  },

  // Custom date inputs
  customDateBlock: {
    marginTop:    spacing.sm,
    marginBottom: spacing.xs,
  },
  customDateRow: {
    flexDirection: 'row',
    gap:           spacing.sm,
  },
  customDateGroup: {
    flex: 1,
  },
  customDateLabel: {
    ...typography.label,
    color:        colors.textMuted,
    marginBottom: spacing.xs,
  },
  customDateInput: {
    backgroundColor:   colors.surface,
    borderRadius:      radius.md,
    borderWidth:       1,
    borderColor:       colors.border,
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color:             colors.textPrimary,
  },
  customDateError: {
    ...typography.small,
    color:     colors.cta,
    marginTop: spacing.xs,
  },

  // Satisfaction — last comment
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
    color:     colors.textSecondary,
    fontStyle: 'italic',
  },

  // Shift cards
  shiftCard: {
    backgroundColor: colors.surface,
    borderRadius:    radius.lg,
    padding:         spacing.lg,
    marginBottom:    spacing.sm,
    ...CARD_SHADOW,
  },
  shiftHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   spacing.xs,
  },
  shiftName: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  shiftBadge: {
    backgroundColor:   colors.goldLight,
    borderRadius:      radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   2,
  },
  shiftBadgeText: {
    ...typography.label,
    color: colors.gold,
  },
  shiftHours: {
    ...typography.h2,
    color:        colors.textPrimary,
    marginBottom: spacing.sm,
  },
  shiftMeta: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  shiftMetaItem: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
  },
  shiftMetaText: {
    ...typography.small,
    color: colors.textMuted,
  },
  shiftMetaDot: {
    width:           3,
    height:          3,
    borderRadius:    2,
    backgroundColor: colors.sandLight,
  },

  // Zone rows
  zoneRow: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingVertical: spacing.sm,
    gap:             spacing.sm,
  },
  zoneIcon: {
    width:           28,
    height:          28,
    borderRadius:    radius.sm,
    backgroundColor: colors.goldLight,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  zoneName: {
    ...typography.body,
    color: colors.textPrimary,
    flex:  1,
  },
  zoneCount: {
    ...typography.small,
    color: colors.textMuted,
  },

  // Refresh button
  refreshButton: {
    flexDirection:     'row',
    alignItems:        'center',
    alignSelf:         'flex-start',
    gap:               spacing.xs,
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor:   colors.ctaLight,
    borderRadius:      radius.md,
    marginTop:         spacing.xl,
  },
  refreshButtonText: {
    ...typography.bodyMedium,
    color: colors.cta,
  },

  // Sign-out (error state)
  signOutButtonSmall: {
    marginTop:       spacing.md,
    alignItems:      'center',
    paddingVertical: spacing.sm,
    minHeight:       36,
  },
  signOutTextSmall: {
    ...typography.small,
    color:              colors.textMuted,
    textDecorationLine: 'underline',
  },
});

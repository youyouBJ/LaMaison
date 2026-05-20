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
import { colors, typography, spacing, radius, layout } from '../../theme';
import { useSettingsOverview } from '../../hooks/useSettingsOverview';
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
import type { ZoneSummary, GuestCounts } from '../../hooks/useSettingsOverview';
import type { Database, ReservationStatus } from '../../types/database';

type ShiftRow = Database['public']['Tables']['shifts']['Row'];
type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  admin:   'Admin',
  manager: 'Manager',
  host:    'Hôte',
  waiter:  'Serveur',
};

const DAY_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

const STATUS_ORDER: ReservationStatus[] = [
  'confirmed', 'pending', 'seated',
  'completed', 'cancelled', 'noshow',
];

type Feature = { icon: IoniconsName; label: string };
const FEATURES: Feature[] = [
  { icon: 'logo-whatsapp',      label: 'WhatsApp Business' },
  { icon: 'mail-outline',       label: 'Email Resend' },
  { icon: 'chatbubble-outline', label: 'SMS secours' },
  { icon: 'card-outline',       label: 'Stripe abonnements' },
  { icon: 'business-outline',   label: 'Multi-restaurants' },
  { icon: 'map-outline',        label: 'Éditeur plan avancé' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function getRoleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

function fmtRating(v: number | null): string {
  if (v === null) return '—';
  return v.toFixed(1);
}

function fmtPct(v: number | null): string {
  if (v === null) return '—';
  return `${v} %`;
}

// ─── Base sub-components ──────────────────────────────────────────────────────

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

function SectionHeader({ title }: { title: string }): React.JSX.Element {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function Card({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <View style={styles.card}>{children}</View>;
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

function FeatureCard({ icon, label }: Feature): React.JSX.Element {
  return (
    <View style={styles.featureCard}>
      <Ionicons name={icon} size={20} color={colors.sand} />
      <Text style={styles.featureLabel} numberOfLines={2}>{label}</Text>
      <View style={styles.featureBadge}>
        <Text style={styles.featureBadgeText}>Bientôt</Text>
      </View>
    </View>
  );
}

// ─── Pilotage sub-components ──────────────────────────────────────────────────

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
        <StatCard label="Réservations" value={data.total} />
        <View style={styles.kpiGap} />
        <StatCard label="Couverts actifs" value={data.covers} />
      </View>
      <View style={styles.kpiRow}>
        <StatCard label="Confirmées" value={data.confirmed} accent={colors.gold} />
        <View style={styles.kpiGap} />
        <StatCard label="Terminées" value={data.completed} />
      </View>
      <View style={styles.kpiRow}>
        <StatCard label="En attente" value={data.pending} />
        <View style={styles.kpiGap} />
        <StatCard label="À table" value={data.seated} accent={colors.cta} />
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
          <StatCard label="Walk-ins" value={data.walkIns} />
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

function ServicesSection({
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
        <StatCard label="Déjeuner" value={data.lunchCount} accent={colors.gold} />
        <View style={styles.kpiGap} />
        <StatCard label="Couverts déj." value={data.lunchCovers} />
      </View>
      <View style={styles.kpiRow}>
        <StatCard label="Dîner" value={data.dinnerCount} accent={colors.gold} />
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
      {/* ── Enquêtes de la période ── */}
      {hasFeedback && feedbackData !== null ? (
        <>
          <View style={styles.kpiRow}>
            <StatCard label="Avis reçus"    value={feedbackData.total} accent={colors.gold} />
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

      {/* ── Historique importé — affiché séparément si disponible ── */}
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

function GuestsDataSection({
  periodGuests,
  globalGuests,
  periodLoading,
}: {
  periodGuests: PeriodGuestStats;
  globalGuests: GuestCounts;
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
      {/* ── Sur la période ── */}
      <Text style={styles.guestGroupLabel}>Sur la période</Text>
      <View style={styles.kpiRow}>
        <StatCard label="Clients uniques" value={periodGuests.uniqueReserving} />
        <View style={styles.kpiGap} />
        <StatCard label="Walk-ins"        value={periodGuests.walkIns} />
      </View>
      <View style={styles.kpiRow}>
        <StatCard label="VIP période" value={periodGuests.vipReserving} accent={colors.gold} />
      </View>

      {/* ── Base globale ── */}
      <Text style={styles.guestGroupLabel}>Base globale</Text>
      <View style={styles.kpiRow}>
        <StatCard label="Clients"   value={globalGuests.total} />
        <View style={styles.kpiGap} />
        <StatCard label="VIP total" value={globalGuests.vip} accent={colors.gold} />
      </View>
      <View style={styles.kpiRow}>
        <StatCard label="Avec email" value={globalGuests.withEmail} />
      </View>
    </>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SettingsScreen(): React.JSX.Element {
  const { loading, error, data, refresh } = useSettingsOverview();
  const [signingOut, setSigningOut]       = useState(false);
  const [signOutError, setSignOutError]   = useState<string | null>(null);
  const [activePeriod, setActivePeriod]   = useState<DashboardPeriod>('month');
  const [customStart, setCustomStart]     = useState('');
  const [customEnd, setCustomEnd]         = useState('');

  // restaurantId is null while settings load — hooks handle null gracefully
  const restaurantId = data?.restaurant.id ?? null;

  // Validate custom dates — only pass valid range to the hook
  const customStartParsed  = parseDateString(customStart);
  const customEndParsed    = parseDateString(customEnd);
  const customDatesValid   = customStartParsed !== null && customEndParsed !== null && customStart <= customEnd;
  const hookCustomStart    = activePeriod === 'custom' && customDatesValid ? customStart : undefined;
  const hookCustomEnd      = activePeriod === 'custom' && customDatesValid ? customEnd   : undefined;

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
    setSignOutError(null);
    try {
      const { error: signOutErr } = await supabase.auth.signOut();
      if (signOutErr) {
        setSignOutError(signOutErr.message);
        setSigningOut(false);
      }
      // On success the RootNavigator's onAuthStateChange fires and unmounts this screen.
    } catch (e) {
      console.error('[Settings] signOut threw:', e);
      setSignOutError('Erreur lors de la déconnexion.');
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
          <Text style={styles.loadingText}>Chargement des paramètres…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Impossible de charger les paramètres</Text>
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

  const { restaurant, userProfile, shifts, floor, guests } = data;

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
          <Text style={styles.headerSub}>Configuration & pilotage · {restaurant.name}</Text>

          {/* ── Refresh button ── */}
          <TouchableOpacity style={styles.refreshButton} onPress={handleRefreshAll}>
            <Ionicons name="refresh-outline" size={16} color={colors.cta} />
            <Text style={styles.refreshButtonText}>Actualiser</Text>
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
          <GuestsDataSection
            periodGuests={period.guests}
            globalGuests={guests}
            periodLoading={periodLoading}
          />

          <Text style={styles.subSectionLabel}>Répartition statuts</Text>
          <StatusSummarySection data={period.reservations} loading={periodLoading} />

          <Text style={styles.subSectionLabel}>Services</Text>
          <ServicesSection data={period.reservations} loading={periodLoading} />

          <Text style={styles.subSectionLabel}>Satisfaction client</Text>
          <SatisfactionSection
            feedbackData={period.feedback}
            sevenRooms={ext.sevenRooms}
            periodLoading={periodLoading}
            extLoading={extLoading}
          />

          {/* ── Restaurant ── */}
          <SectionHeader title="Restaurant" />
          <Card>
            <InfoRow label="Nom"       value={restaurant.name} />
            {restaurant.address ? (
              <>
                <Divider />
                <InfoRow label="Adresse"   value={restaurant.address} />
              </>
            ) : null}
            {restaurant.phone ? (
              <>
                <Divider />
                <InfoRow label="Téléphone" value={restaurant.phone} />
              </>
            ) : null}
            {restaurant.email ? (
              <>
                <Divider />
                <InfoRow label="Email"     value={restaurant.email} />
              </>
            ) : null}
            <Divider />
            <InfoRow label="Fuseau"       value={restaurant.timezone} />
            <Divider />
            <InfoRow label="Réservations" value="Téléphone uniquement" />
          </Card>

          {/* ── Compte staff ── */}
          <SectionHeader title="Compte" />
          <Card>
            <InfoRow label="Nom"        value={userProfile.fullName} />
            <Divider />
            <InfoRow label="Rôle"       value={getRoleLabel(userProfile.role)} />
            <Divider />
            <InfoRow label="Restaurant" value={userProfile.restaurantName} />
          </Card>

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
            <StatCard label="Zones" value={floor.zoneCount} />
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

          {/* ── Fonctionnalités à venir ── */}
          <SectionHeader title="Fonctionnalités à venir" />
          <View style={styles.featureGrid}>
            {FEATURES.map((f) => (
              <FeatureCard key={f.label} icon={f.icon} label={f.label} />
            ))}
          </View>

          {/* ── Session ── */}
          <SectionHeader title="Session" />
          <Card>
            {userProfile.email ? (
              <>
                <InfoRow label="Email" value={userProfile.email} />
                <Divider />
              </>
            ) : null}
            <TouchableOpacity
              style={styles.signOutButton}
              onPress={() => { void handleSignOut(); }}
              disabled={signingOut}
            >
              {signingOut ? (
                <ActivityIndicator color={colors.cta} size="small" />
              ) : (
                <>
                  <Ionicons name="log-out-outline" size={16} color={colors.cta} />
                  <Text style={styles.signOutText}>Se déconnecter</Text>
                </>
              )}
            </TouchableOpacity>
            {signOutError ? (
              <Text style={styles.signOutError}>{signOutError}</Text>
            ) : null}
          </Card>

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
    marginBottom:      spacing.xl,
  },
  refreshButtonText: {
    ...typography.bodyMedium,
    color: colors.cta,
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
  kpiRowGap: {
    marginTop: 0,
  },
  kpiGap: {
    width: spacing.sm,
  },

  // Loading placeholder for pilotage sections
  extLoadingCard: {
    backgroundColor: colors.surface,
    borderRadius:    radius.lg,
    padding:         spacing.xl,
    alignItems:      'center',
    marginBottom:    spacing.sm,
    ...CARD_SHADOW,
  },

  // Empty state (inside Card)
  emptyText: {
    ...typography.body,
    color:     colors.textMuted,
    textAlign: 'center',
    padding:   spacing.sm,
  },

  // Period selector — wrapping layout so all chips stay visible
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

  // Lighter labels inside GuestsDataSection to distinguish period vs global
  guestGroupLabel: {
    ...typography.small,
    color:        colors.textMuted,
    marginTop:    spacing.md,
    marginBottom: spacing.xs,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },

  // Status breakdown — single column list, badge + count per row
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

  // Satisfaction — historique importé (compact, non-technique)
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

  // Période personnalisée — champs date
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
    backgroundColor:  colors.surfaceWarm,
    borderRadius:     radius.lg,
    padding:          spacing.lg,
    marginTop:        spacing.sm,
    borderLeftWidth:  3,
    borderLeftColor:  colors.gold,
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

  // Feature grid
  featureGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.sm,
    marginBottom:  spacing.sm,
  },
  featureCard: {
    backgroundColor: colors.surface,
    borderRadius:    radius.lg,
    padding:         spacing.lg,
    width:           '48%',
    gap:             spacing.sm,
    alignItems:      'flex-start',
    ...CARD_SHADOW,
  },
  featureLabel: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    flex:  1,
  },
  featureBadge: {
    backgroundColor:   colors.borderLight,
    borderRadius:      radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   2,
  },
  featureBadgeText: {
    ...typography.label,
    color: colors.textMuted,
  },

  // Sign-out
  signOutButton: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               spacing.sm,
    paddingVertical:   spacing.md,
    marginTop:         spacing.xs,
    borderRadius:      radius.md,
    borderWidth:       1,
    borderColor:       colors.cta,
    backgroundColor:   colors.ctaLight,
    minHeight:         44,
  },
  signOutText: {
    ...typography.bodyMedium,
    color: colors.cta,
  },
  signOutError: {
    ...typography.small,
    color:     colors.cta,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  signOutButtonSmall: {
    marginTop:       spacing.md,
    alignItems:      'center',
    paddingVertical: spacing.sm,
    minHeight:       36,
  },
  signOutTextSmall: {
    ...typography.small,
    color:               colors.textMuted,
    textDecorationLine:  'underline',
  },
});

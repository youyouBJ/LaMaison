import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radius, layout } from '../../theme';
import { useReservations } from '../../hooks/useReservations';
import { useWaitlistCount } from '../../hooks/useWaitlistCount';
import ReservationCard from '../../components/ReservationCard';
import DateSelector from '../../components/DateSelector';
import { FilterChip } from '../../components/FilterChip';
import type { ReservationsStackParamList } from '../../navigation/ReservationsNavigator';
import type { ReservationWithJoins } from '../../types/reservations';
import type { ReservationStatus } from '../../types/database';
import { getReservationStatusLabel } from '../../utils/reservationStatus';

type Props = NativeStackScreenProps<ReservationsStackParamList, 'ReservationList'>;
type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];
type ReservationServiceFilter = 'all' | 'lunch' | 'dinner';

const SERVICE_OPTIONS: { key: ReservationServiceFilter; label: string }[] = [
  { key: 'all',    label: 'Tous' },
  { key: 'lunch',  label: 'Déjeuner' },
  { key: 'dinner', label: 'Dîner' },
];

const STATUS_FILTER_OPTIONS: ReservationStatus[] = [
  'pending', 'confirmed', 'seated', 'completed', 'cancelled', 'noshow',
];

// Normalise pour une recherche insensible aux diacritiques.
function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function buildSearchableString(r: ReservationWithJoins): string {
  return normalizeSearchText(
    [
      r.guests?.first_name ?? '',
      r.guests?.last_name  ?? '',
      r.guests?.phone      ?? '',
      r.guests?.email      ?? '',
      r.tables?.label      ?? '',
      r.shifts?.name       ?? '',
      getReservationStatusLabel(r.status),
      r.time_slot.substring(0, 5),
      String(r.party_size),
    ].join(' '),
  );
}

function timeSlotToMinutes(timeSlot: string): number {
  const [h, m] = timeSlot.substring(0, 5).split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function matchesService(r: ReservationWithJoins, service: ReservationServiceFilter): boolean {
  if (service === 'all') return true;

  // Priorité : nom du shift
  if (r.shifts?.name) {
    const name = r.shifts.name.toLowerCase();
    if (service === 'lunch') {
      return name.includes('déjeuner') || name.includes('dejeuner') || name.includes('lunch') || name.includes('midi');
    }
    return name.includes('dîner') || name.includes('diner') || name.includes('dinner') || name.includes('soir');
  }

  // Fallback : créneau horaire
  const minutes = timeSlotToMinutes(r.time_slot);
  if (service === 'lunch') return minutes >= 12 * 60 && minutes <= 16 * 60 + 45;
  return minutes >= 17 * 60 && minutes <= 23 * 60 + 45;
}

export default function ReservationListScreen({ navigation }: Props): React.JSX.Element {
  const { loading, error, reservations, selectedDate, setSelectedDate, refresh } = useReservations();
  const [searchQuery, setSearchQuery]       = useState('');
  const [isFocused, setIsFocused]           = useState(false);
  const [serviceFilter, setServiceFilter]   = useState<ReservationServiceFilter>('all');
  const [statusFilter, setStatusFilter]     = useState<ReservationStatus | null>(null);

  useFocusEffect(
    useCallback(() => { refresh(); }, [refresh]),
  );

  const { count: waitlistWaitingCount } = useWaitlistCount(selectedDate, serviceFilter);

  // Étape 1 : filtrage par service
  const reservationsForService = useMemo(() => {
    if (serviceFilter === 'all') return reservations;
    return reservations.filter(r => matchesService(r, serviceFilter));
  }, [reservations, serviceFilter]);

  // Étape 2 : filtrage par statut
  const reservationsForStatus = useMemo(() => {
    if (statusFilter === null) return reservationsForService;
    return reservationsForService.filter(r => r.status === statusFilter);
  }, [reservationsForService, statusFilter]);

  // Étape 3 : filtrage par recherche (sur le résultat du statut)
  const filteredReservations = useMemo(() => {
    const q = normalizeSearchText(searchQuery.trim());
    if (!q) return reservationsForStatus;
    return reservationsForStatus.filter(r => buildSearchableString(r).includes(q));
  }, [reservationsForStatus, searchQuery]);

  const handleClear = () => setSearchQuery('');

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} size="large" />
          <Text style={styles.loadingText}>Chargement des réservations…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Impossible de charger les réservations</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={refresh}>
              <Text style={styles.retryText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const isSearching        = searchQuery.trim().length > 0;
  const hasReservations    = reservations.length > 0;
  const hasServiceResults  = reservationsForService.length > 0;
  const hasStatusResults   = reservationsForStatus.length > 0;
  const hasResults         = filteredReservations.length > 0;

  const countLabel = (() => {
    if (isSearching) {
      const n = filteredReservations.length;
      return `${n} résultat${n !== 1 ? 's' : ''}`;
    }
    const n = filteredReservations.length;
    if (n === 0) return 'Aucune réservation';
    const s = n > 1 ? 's' : '';
    if (serviceFilter === 'lunch')  return `${n} réservation${s} déjeuner`;
    if (serviceFilter === 'dinner') return `${n} réservation${s} dîner`;
    return `${n} réservation${s}`;
  })();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.gold} />
        }
      >
        <View style={styles.container}>

          {/* ── Header ── */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerLabel}>Réservations</Text>
              <Text style={styles.headerTitle}>Planning</Text>
            </View>
            <View style={styles.headerButtons}>
              <View style={styles.waitlistBtnWrapper}>
                <TouchableOpacity
                  style={styles.waitlistButton}
                  onPress={() => navigation.navigate('Waitlist')}
                  activeOpacity={0.8}
                >
                  <Ionicons name={'time-outline' as IoniconsName} size={16} color={colors.gold} />
                  <Text style={styles.waitlistButtonText}>Attente</Text>
                </TouchableOpacity>
                {waitlistWaitingCount > 0 ? (
                  <View style={styles.waitlistBadge}>
                    <Text style={styles.waitlistBadgeText}>
                      {waitlistWaitingCount > 99 ? '99+' : waitlistWaitingCount}
                    </Text>
                  </View>
                ) : null}
              </View>
              <TouchableOpacity
                style={styles.newButton}
                onPress={() => navigation.navigate('NewReservation')}
                activeOpacity={0.8}
              >
                <Ionicons name={'add' as IoniconsName} size={18} color={colors.textOnDark} />
                <Text style={styles.newButtonText}>Nouvelle</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Sélecteur de date ── */}
          <DateSelector value={selectedDate} onChange={setSelectedDate} showQuickActions />

          {/* ── Filtre service ── */}
          <View style={styles.serviceSection}>
            <Text style={styles.serviceSectionLabel}>Service</Text>
            <View style={styles.serviceChips}>
              {SERVICE_OPTIONS.map(({ key, label }) => (
                <FilterChip
                  key={key}
                  label={label}
                  active={serviceFilter === key}
                  onPress={() => setServiceFilter(key)}
                />
              ))}
            </View>
          </View>

          {/* ── Filtre statut ── */}
          <View style={styles.statusSection}>
            <View style={styles.statusSectionHeader}>
              <Text style={styles.statusSectionLabel}>Statut</Text>
              {statusFilter !== null && (
                <TouchableOpacity
                  style={styles.statusResetBtn}
                  onPress={() => { setStatusFilter(null); }}
                  activeOpacity={0.75}
                >
                  <Text style={styles.statusResetBtnText}>Tout afficher</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.statusChips}
            >
              {STATUS_FILTER_OPTIONS.map(s => (
                <FilterChip
                  key={s}
                  label={getReservationStatusLabel(s)}
                  active={statusFilter === s}
                  onPress={() => { setStatusFilter(statusFilter === s ? null : s); }}
                />
              ))}
            </ScrollView>
          </View>

          {/* ── Barre de recherche ── */}
          <View style={[styles.searchBar, isFocused && styles.searchBarFocused]}>
            <Ionicons
              name={'search-outline' as IoniconsName}
              size={16}
              color={isFocused ? colors.gold : colors.textMuted}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher nom, téléphone, table, heure..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {isSearching ? (
              <TouchableOpacity onPress={handleClear} style={styles.clearBtn} activeOpacity={0.7}>
                <Text style={styles.clearBtnText}>Effacer</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* ── Compteur ── */}
          <Text style={styles.listCount}>{countLabel}</Text>

          {/* ── Aucune réservation sur cette date ── */}
          {!hasReservations ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Aucune réservation</Text>
              <Text style={styles.emptySubtitle}>
                Aucune réservation n'est prévue pour cette date.
              </Text>
            </View>

          /* ── Aucune réservation pour ce service ── */
          ) : !hasServiceResults ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Aucune réservation pour ce service</Text>
              <Text style={styles.emptySubtitle}>
                {serviceFilter === 'lunch'
                  ? 'Aucune réservation déjeuner pour cette date.'
                  : 'Aucune réservation dîner pour cette date.'}
              </Text>
            </View>

          /* ── Aucune réservation pour ce statut ── */
          ) : !hasStatusResults ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Aucune réservation avec ce statut</Text>
              <Text style={styles.emptySubtitle}>
                {statusFilter !== null
                  ? `Aucune réservation "${getReservationStatusLabel(statusFilter)}" pour cette date.`
                  : 'Aucune réservation pour cette date.'}
              </Text>
            </View>

          /* ── Recherche sans résultat ── */
          ) : isSearching && !hasResults ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Aucune réservation trouvée</Text>
              <Text style={styles.emptySubtitle}>
                Essayez un autre nom, téléphone, horaire ou service.
              </Text>
            </View>

          /* ── Liste filtrée ── */
          ) : (
            filteredReservations.map((r) => (
              <ReservationCard
                key={r.id}
                reservation={r}
                onPress={() => navigation.navigate('ReservationDetail', { reservationId: r.id })}
              />
            ))
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xxl },
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
  errorTitle:   { ...typography.h2,        color: colors.textPrimary,   marginBottom: spacing.sm },
  errorMessage: { ...typography.body,      color: colors.textSecondary, marginBottom: spacing.xl },
  retryButton: {
    backgroundColor: colors.cta,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  retryText: { ...typography.bodyMedium, color: colors.textOnDark },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing.xl,
  },
  headerLabel: { ...typography.label, color: colors.textMuted, marginBottom: spacing.xs },
  headerTitle: { ...typography.h1, color: colors.textPrimary },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  waitlistBtnWrapper: {
    position: 'relative',
  },
  waitlistButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.goldLight,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  waitlistButtonText: { ...typography.bodyMedium, color: colors.gold },
  waitlistBadge: {
    position: 'absolute',
    top: -7,
    right: -7,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.cta,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: colors.background,
  },
  waitlistBadgeText: {
    ...typography.label,
    color: colors.textOnDark,
    fontSize: 10,
    lineHeight: 13,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cta,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  newButtonText: { ...typography.bodyMedium, color: colors.textOnDark },

  // Service filter
  serviceSection: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  serviceSectionLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  serviceChips: {
    flexDirection: 'row',
    gap: spacing.sm,
  },

  // Status filter
  statusSection: {
    marginBottom: spacing.md,
  },
  statusSectionHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   spacing.sm,
  },
  statusSectionLabel: {
    ...typography.label,
    color: colors.textMuted,
  },
  statusResetBtn: {
    backgroundColor:   colors.ctaLight,
    borderRadius:      radius.md,
    paddingVertical:   3,
    paddingHorizontal: spacing.sm,
    borderWidth:       1,
    borderColor:       colors.cta,
  },
  statusResetBtnText: {
    ...typography.label,
    color: colors.cta,
  },
  statusChips: {
    flexDirection: 'row',
    gap:           spacing.sm,
  },

  // Search bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  searchBarFocused: {
    borderColor: colors.gold,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    paddingVertical: spacing.md,
  },
  clearBtn: {
    marginLeft: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  clearBtnText: {
    ...typography.small,
    color: colors.textMuted,
  },

  // List
  listCount: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
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
});

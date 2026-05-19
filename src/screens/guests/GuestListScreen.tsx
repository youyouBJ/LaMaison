import React, { useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, typography, spacing, radius, layout } from '../../theme';
import { useGuests } from '../../hooks/useGuests';
import { FilterChip } from '../../components/FilterChip';
import {
  formatGuestName,
  formatPhone,
  formatDateShort,
  formatRating,
  getDisplayableGuestTags,
} from '../../utils/format';
import type { GuestsStackParamList } from '../../navigation/GuestsNavigator';
import type { Database } from '../../types/database';
import type { GuestSortOption, GuestFilterState } from '../../types/guests';
import VipBadge from '../../components/VipBadge';

type GuestRow = Database['public']['Tables']['guests']['Row'];
type Props = NativeStackScreenProps<GuestsStackParamList, 'GuestList'>;

const SORT_OPTIONS: { key: GuestSortOption; label: string }[] = [
  { key: 'last_visit_desc', label: 'Dernière visite' },
  { key: 'visit_count_desc', label: 'Nb visites' },
  { key: 'avg_rating_desc', label: 'Note' },
  { key: 'name_asc', label: 'A → Z' },
  { key: 'created_at_desc', label: 'Récents' },
];

const FILTER_OPTIONS: { key: keyof GuestFilterState; label: string }[] = [
  { key: 'upcomingReservationOnly', label: 'Réservation à venir' },
  { key: 'vipOnly', label: 'VIP' },
  { key: 'withPhoneOnly', label: 'Avec tél.' },
  { key: 'withEmailOnly', label: 'Avec email' },
  { key: 'withRatingOnly', label: 'Avec note' },
  { key: 'reengagementOnly', label: 'Ré-engagement' },
  { key: 'positiveFeedbackOnly', label: 'Feedback +' },
  { key: 'negativeFeedbackOnly', label: 'Feedback −' },
];

export default function GuestListScreen({ navigation }: Props): React.JSX.Element {
  const {
    loading,
    error,
    guests,
    query,
    setQuery,
    sort,
    setSort,
    filters,
    toggleFilter,
    resetFilters,
    activeFilterCount,
    search,
    clearSearch,
    refresh,
  } = useGuests();

  const handleSearch = (): void => { void search(); };
  const handleClear = (): void => { void clearSearch(); };
  const handleRefresh = useCallback((): void => { void refresh(); }, [refresh]);

  const renderItem = useCallback(
    ({ item }: { item: GuestRow }) => {
      const displayTags = getDisplayableGuestTags(item.tags).slice(0, 2);
      return (
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.75}
          onPress={() => navigation.navigate('GuestDetail', { guestId: item.id })}
          accessibilityRole="button"
          accessibilityLabel={formatGuestName(item.first_name, item.last_name)}
        >
          <View style={styles.cardTop}>
            <View style={styles.cardLeft}>
              <Text style={styles.guestName} numberOfLines={1}>
                {formatGuestName(item.first_name, item.last_name)}
              </Text>
              <Text style={styles.guestPhone}>{formatPhone(item.phone)}</Text>
              {item.email ? (
                <Text style={styles.guestEmail} numberOfLines={1}>{item.email}</Text>
              ) : null}
            </View>
            <View style={styles.cardRight}>
              {item.vip ? <VipBadge /> : null}
            </View>
          </View>

          <View style={styles.cardStats}>
            {item.visit_count > 0 ? (
              <Text style={styles.statChip}>{item.visit_count} visite{item.visit_count > 1 ? 's' : ''}</Text>
            ) : null}
            {item.avg_rating !== null ? (
              <Text style={styles.statChip}>{formatRating(item.avg_rating)} / 5</Text>
            ) : null}
            {item.last_visit ? (
              <Text style={styles.statChip}>{formatDateShort(item.last_visit)}</Text>
            ) : null}
          </View>

          {displayTags.length > 0 ? (
            <View style={styles.cardTags}>
              {displayTags.map((tag, idx) => (
                <View key={idx} style={styles.tagChip}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </TouchableOpacity>
      );
    },
    [navigation],
  );

  const keyExtractor = useCallback((item: GuestRow) => item.id, []);

  if (loading && guests.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} size="large" />
          <Text style={styles.loadingText}>Chargement des clients…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && guests.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={handleRefresh}>
              <Text style={styles.retryBtnText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const hasActiveState = query.length > 0 || activeFilterCount > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── En-tête ── */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerLabel}>CRM</Text>
          <Text style={styles.headerTitle}>Clients</Text>
          <Text style={styles.headerSubtitle}>Recherche par téléphone, nom ou email</Text>
        </View>
      </View>

      {/* ── Barre de recherche ── */}
      <View style={styles.searchBar}>
        <View style={styles.searchBarContent}>
          <TextInput
            style={styles.searchInput}
            placeholder="Téléphone, nom ou email"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 ? (
            <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
              <Text style={styles.clearBtnText}>Effacer</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
            {loading
              ? <ActivityIndicator color={colors.textOnDark} size="small" />
              : <Text style={styles.searchBtnText}>Rechercher</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Filtres ── */}
      <View style={styles.filterSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Filtres</Text>
          {activeFilterCount > 0 ? (
            <TouchableOpacity
              onPress={resetFilters}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Text style={styles.resetBtnText}>Tout effacer</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContent}
        >
          {FILTER_OPTIONS.map(({ key, label }) => (
            <FilterChip
              key={key}
              label={label}
              active={filters[key]}
              onPress={() => toggleFilter(key)}
            />
          ))}
        </ScrollView>
      </View>

      {/* ── Tri ── */}
      <View style={styles.sortSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Trier par</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContent}
        >
          {SORT_OPTIONS.map(({ key, label }) => (
            <FilterChip
              key={key}
              label={label}
              active={sort === key}
              onPress={() => setSort(key)}
            />
          ))}
        </ScrollView>
      </View>

      {/* ── Compteur ── */}
      <View style={styles.resultsBar}>
        <Text style={styles.resultsText}>
          {loading ? '…' : `${guests.length} client${guests.length !== 1 ? 's' : ''}`}
        </Text>
      </View>

      {/* ── Liste ── */}
      <FlatList
        data={guests}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.list,
          guests.length === 0 && styles.listEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={loading && guests.length > 0}
            onRefresh={handleRefresh}
            tintColor={colors.gold}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>
              {!hasActiveState
                ? 'Aucun client pour le moment'
                : filters.upcomingReservationOnly
                  ? 'Aucun client avec réservation à venir'
                  : 'Aucun client trouvé'}
            </Text>
            {hasActiveState ? (
              <Text style={styles.emptySubtitle}>
                {filters.upcomingReservationOnly && query.length === 0 && activeFilterCount === 1
                  ? 'Les clients avec une réservation confirmée ou en attente apparaîtront ici.'
                  : 'Essayez une autre recherche ou réinitialisez les filtres.'}
              </Text>
            ) : null}
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.md,
    textAlign: 'center',
  },

  // Header
  header: {
    backgroundColor: colors.background,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerContent: {
    paddingHorizontal: spacing.xl,
    maxWidth: layout.contentMaxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  headerLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  headerTitle: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },

  // Search
  searchBar: {
    backgroundColor: colors.background,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  searchBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    maxWidth: layout.contentMaxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  clearBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  clearBtnText: {
    ...typography.small,
    color: colors.textMuted,
  },
  searchBtn: {
    backgroundColor: colors.cta,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 96,
    minHeight: 36,
  },
  searchBtnText: {
    ...typography.small,
    color: colors.textOnDark,
    fontFamily: typography.bodyMedium.fontFamily,
  },

  // Filter section
  filterSection: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingBottom: spacing.sm,
  },
  sortSection: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingBottom: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textMuted,
  },
  resetBtnText: {
    ...typography.small,
    color: colors.cta,
    fontFamily: typography.bodyMedium.fontFamily,
  },
  chipsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xs,
  },

  // Results bar
  resultsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  resultsText: {
    ...typography.small,
    color: colors.textMuted,
  },

  // List
  list: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.xl,
    maxWidth: layout.contentMaxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  listEmpty: {
    flex: 1,
  },

  // Guest card
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  cardLeft: {
    flex: 1,
    gap: spacing.xs,
  },
  cardRight: {
    alignItems: 'flex-end',
  },
  guestName: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  guestPhone: {
    ...typography.small,
    color: colors.textSecondary,
  },
  guestEmail: {
    ...typography.small,
    color: colors.textMuted,
  },
  cardStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  statChip: {
    ...typography.small,
    color: colors.textMuted,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  cardTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  tagChip: {
    backgroundColor: colors.ctaLight,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  tagText: {
    ...typography.small,
    color: colors.cta,
    textTransform: 'none' as const,
    letterSpacing: 0,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xxl * 2,
  },
  emptyTitle: {
    ...typography.bodyMedium,
    color: colors.textMuted,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  // Error state
  errorCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  errorText: {
    ...typography.body,
    color: colors.cta,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: colors.cta,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  retryBtnText: {
    ...typography.bodyMedium,
    color: colors.textOnDark,
  },
});

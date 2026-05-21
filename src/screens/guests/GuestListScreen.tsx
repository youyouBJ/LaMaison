import React, { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
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
import { useI18n } from '../../i18n';

type GuestRow = Database['public']['Tables']['guests']['Row'];
type Props = NativeStackScreenProps<GuestsStackParamList, 'GuestList'>;

export default function GuestListScreen({ navigation }: Props): React.JSX.Element {
  const { t } = useI18n();

  const SORT_OPTIONS: { key: GuestSortOption; label: string }[] = [
    { key: 'last_visit_desc',  label: t('guests_sort_last_visit') },
    { key: 'visit_count_desc', label: t('guests_sort_visits') },
    { key: 'avg_rating_desc',  label: t('guests_sort_rating') },
    { key: 'name_asc',         label: t('guests_sort_name') },
    { key: 'created_at_desc',  label: t('guests_sort_recent') },
  ];

  const FILTER_OPTIONS: { key: keyof GuestFilterState; label: string }[] = [
    { key: 'upcomingReservationOnly', label: t('guests_filter_upcoming') },
    { key: 'vipOnly',                 label: t('guests_filter_vip') },
    { key: 'withPhoneOnly',           label: t('guests_filter_phone') },
    { key: 'withEmailOnly',           label: t('guests_filter_email_only') },
    { key: 'withRatingOnly',          label: t('guests_filter_rating') },
    { key: 'reengagementOnly',        label: t('guests_filter_reengagement') },
    { key: 'positiveFeedbackOnly',    label: t('guests_filter_positive') },
    { key: 'negativeFeedbackOnly',    label: t('guests_filter_negative') },
  ];

  const {
    loading,
    loadingMore,
    error,
    guests,
    hasMore,
    loadMore,
    query,
    setQuery,
    sort,
    setSort,
    filters,
    toggleFilter,
    resetFilters,
    activeFilterCount,
    refresh,
  } = useGuests();

  const handleClear = (): void => { setQuery(''); };
  const handleRefresh = useCallback((): void => { void refresh(); }, [refresh]);
  const handleEndReached = useCallback((): void => {
    if (!loadingMore && hasMore) void loadMore();
  }, [loadingMore, hasMore, loadMore]);

  useFocusEffect(
    useCallback(() => { void refresh(); }, [refresh]),
  );

  const renderFooter = useCallback((): React.JSX.Element | null => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator color={colors.gold} size="small" />
        <Text style={styles.footerText}>{t('guests_loading_more')}</Text>
      </View>
    );
  }, [loadingMore, t]);

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
              <View style={styles.guestNameRow}>
                <Text style={styles.guestName} numberOfLines={1}>
                  {formatGuestName(item.first_name, item.last_name)}
                </Text>
                {item.vip ? <VipBadge small /> : null}
              </View>
              <Text style={styles.guestPhone}>{formatPhone(item.phone)}</Text>
              {item.email ? (
                <Text style={styles.guestEmail} numberOfLines={1}>{item.email}</Text>
              ) : null}
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
          <Text style={styles.loadingText}>{t('guests_loading')}</Text>
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
              <Text style={styles.retryBtnText}>{t('guests_retry')}</Text>
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
          <Text style={styles.headerLabel}>{t('guests_label')}</Text>
          <Text style={styles.headerTitle}>{t('guests_title')}</Text>
          <Text style={styles.headerSubtitle}>{t('guests_subtitle')}</Text>
        </View>
      </View>

      {/* ── Barre de recherche ── */}
      <View style={styles.searchBar}>
        <View style={styles.searchBarContent}>
          <TextInput
            style={styles.searchInput}
            placeholder={t('guests_search_placeholder')}
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {loading ? (
            <ActivityIndicator color={colors.gold} size="small" />
          ) : null}
          {query.length > 0 ? (
            <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
              <Text style={styles.clearBtnText}>{t('common_clear')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* ── Filtres ── */}
      <View style={styles.filterSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>{t('guests_filter_label')}</Text>
          {activeFilterCount > 0 ? (
            <TouchableOpacity
              onPress={resetFilters}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Text style={styles.resetBtnText}>{t('guests_clear_filters')}</Text>
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
          <Text style={styles.sectionLabel}>{t('guests_sort_label')}</Text>
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
          {loading
            ? '…'
            : hasMore
              ? `${guests.length}+ clients chargés`
              : `${guests.length} client${guests.length !== 1 ? 's' : ''}`}
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
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        ListFooterComponent={renderFooter}
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
                ? t('guests_no_guests')
                : filters.upcomingReservationOnly
                  ? t('guests_no_upcoming')
                  : t('guests_no_results')}
            </Text>
            {hasActiveState ? (
              <Text style={styles.emptySubtitle}>
                {filters.upcomingReservationOnly && query.length === 0 && activeFilterCount === 1
                  ? t('guests_no_upcoming_sub')
                  : t('guests_no_results_sub')}
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
  },
  cardLeft: {
    flex: 1,
    gap: spacing.xs,
  },
  guestNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
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

  // Footer loader
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  footerText: {
    ...typography.small,
    color: colors.textMuted,
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

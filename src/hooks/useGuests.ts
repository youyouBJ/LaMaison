// Search via Supabase ilike. Tag-based filters are applied client-side after
// fetching a larger batch (TAG_FILTER_LIMIT) to avoid building complex SQL.
// Never loads the full 22 682-row dataset — always capped at STANDARD_LIMIT or TAG_FILTER_LIMIT.

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Database, ReservationStatus } from '../types/database';
import { getTodayDateString } from '../utils/date';
import type { GuestSortOption, GuestFilterState } from '../types/guests';
import { DEFAULT_SORT, DEFAULT_FILTERS } from '../types/guests';

type GuestRow = Database['public']['Tables']['guests']['Row'];

const STANDARD_LIMIT = 150;
const TAG_FILTER_LIMIT = 300;
// Fetch at most 300 upcoming reservations — after dedup the actual .in() list is smaller.
// At ~50 reservations/day this covers ~6 days ahead, sufficient for CRM use.
const UPCOMING_RESERVATIONS_LIMIT = 300;
const UPCOMING_STATUSES: ReservationStatus[] = ['confirmed', 'pending', 'seated'];

function hasTagFilter(filters: GuestFilterState): boolean {
  return filters.reengagementOnly || filters.positiveFeedbackOnly || filters.negativeFeedbackOnly;
}

function applyTagFilters(rows: GuestRow[], filters: GuestFilterState): GuestRow[] {
  return rows.filter(guest => {
    const tags = (guest.tags ?? []).map(t => t.toLowerCase());
    if (filters.reengagementOnly) {
      if (!tags.some(t => t.includes('re-engagement') || t.includes('re engagement'))) return false;
    }
    if (filters.positiveFeedbackOnly) {
      if (!tags.some(t => t.includes('positive'))) return false;
    }
    if (filters.negativeFeedbackOnly) {
      if (!tags.some(t => t.includes('negative'))) return false;
    }
    return true;
  });
}

export function useGuests() {
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [guests, setGuests]       = useState<GuestRow[]>([]);
  const [query, setQuery]         = useState('');
  const [sort, setSort]           = useState<GuestSortOption>(DEFAULT_SORT);
  const [filters, setFilters]     = useState<GuestFilterState>(DEFAULT_FILTERS);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);

  const restaurantIdRef   = useRef<string | null>(null);
  const queryRef          = useRef<string>('');
  const initialLoadedRef  = useRef(false);

  const fetchGuests = useCallback(
    async (
      resId: string,
      searchQuery: string,
      currentSort: GuestSortOption,
      currentFilters: GuestFilterState,
    ): Promise<void> => {
      const q = searchQuery.trim();
      const useTagLimit = hasTagFilter(currentFilters);
      const limit = useTagLimit ? TAG_FILTER_LIMIT : STANDARD_LIMIT;

      // Upcoming reservation filter: resolve the set of guest_ids first, then filter guests.
      // Two queries total — never loads the full guest table.
      let upcomingGuestIds: string[] | null = null;
      if (currentFilters.upcomingReservationOnly) {
        const today = getTodayDateString();
        const { data: resRows, error: resError } = await supabase
          .from('reservations')
          .select('guest_id')
          .eq('restaurant_id', resId)
          .gte('date', today)
          .in('status', UPCOMING_STATUSES)
          .not('guest_id', 'is', null)
          .limit(UPCOMING_RESERVATIONS_LIMIT);

        if (resError) { setError(resError.message); return; }

        const ids = [
          ...new Set(
            (resRows ?? [])
              .map(r => r.guest_id)
              .filter((id): id is string => id !== null),
          ),
        ];

        if (ids.length === 0) {
          setGuests([]);
          setError(null);
          return;
        }

        upcomingGuestIds = ids;
      }

      let dbQuery = supabase
        .from('guests')
        .select('*')
        .eq('restaurant_id', resId);

      if (upcomingGuestIds !== null) {
        dbQuery = dbQuery.in('id', upcomingGuestIds);
      }

      if (q.length >= 2) {
        dbQuery = dbQuery.or(
          `phone.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`,
        );
      }

      if (currentFilters.vipOnly) dbQuery = dbQuery.eq('vip', true);
      if (currentFilters.withPhoneOnly) dbQuery = dbQuery.not('phone', 'is', null);
      if (currentFilters.withEmailOnly) dbQuery = dbQuery.not('email', 'is', null);
      if (currentFilters.withRatingOnly) dbQuery = dbQuery.not('avg_rating', 'is', null);

      switch (currentSort) {
        case 'last_visit_desc':
          dbQuery = dbQuery.order('last_visit', { ascending: false });
          break;
        case 'created_at_desc':
          dbQuery = dbQuery.order('created_at', { ascending: false });
          break;
        case 'visit_count_desc':
          dbQuery = dbQuery.order('visit_count', { ascending: false });
          break;
        case 'avg_rating_desc':
          dbQuery = dbQuery.order('avg_rating', { ascending: false });
          break;
        case 'name_asc':
          dbQuery = dbQuery
            .order('last_name', { ascending: true })
            .order('first_name', { ascending: true });
          break;
      }

      dbQuery = dbQuery.limit(limit);

      const { data, error: fetchError } = await dbQuery;

      if (fetchError) {
        setError(fetchError.message);
        return;
      }

      let results = data ?? [];
      if (useTagLimit) results = applyTagFilters(results, currentFilters);

      setGuests(results);
      setError(null);
    },
    [],
  );

  const loadInitial = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { setError('Non connecté.'); return; }

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('restaurant_id')
        .eq('id', userData.user.id)
        .single();
      if (profileError || !profile) { setError('Profil introuvable.'); return; }

      restaurantIdRef.current = profile.restaurant_id;
      setRestaurantId(profile.restaurant_id);
      initialLoadedRef.current = true;
      await fetchGuests(profile.restaurant_id, '', DEFAULT_SORT, DEFAULT_FILTERS);
    } finally {
      setLoading(false);
    }
  }, [fetchGuests]);

  useEffect(() => { void loadInitial(); }, [loadInitial]);

  // Auto-refetch when sort or filters change — only after the initial load
  useEffect(() => {
    if (!initialLoadedRef.current) return;
    const resId = restaurantIdRef.current;
    if (!resId) return;
    setLoading(true);
    void fetchGuests(resId, queryRef.current, sort, filters).finally(() => setLoading(false));
  }, [sort, filters, fetchGuests]);

  const search = useCallback(async (): Promise<void> => {
    const resId = restaurantIdRef.current;
    if (!resId) return;
    queryRef.current = query;
    setLoading(true);
    try { await fetchGuests(resId, query, sort, filters); }
    finally { setLoading(false); }
  }, [query, sort, filters, fetchGuests]);

  const clearSearch = useCallback(async (): Promise<void> => {
    const resId = restaurantIdRef.current;
    setQuery('');
    queryRef.current = '';
    if (!resId) return;
    setLoading(true);
    try { await fetchGuests(resId, '', sort, filters); }
    finally { setLoading(false); }
  }, [sort, filters, fetchGuests]);

  const refresh = useCallback(async (): Promise<void> => {
    const resId = restaurantIdRef.current;
    if (!resId) return;
    setLoading(true);
    try { await fetchGuests(resId, queryRef.current, sort, filters); }
    finally { setLoading(false); }
  }, [sort, filters, fetchGuests]);

  const toggleFilter = useCallback((key: keyof GuestFilterState): void => {
    setFilters(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const resetFilters = useCallback((): void => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return {
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
    restaurantId,
  };
}

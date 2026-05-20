// Search via Supabase ilike. Tag-based filters are applied client-side after
// fetching a larger batch (TAG_FETCH_SIZE) to avoid building complex SQL.
// Pagination via .range() — never loads the full 22 682-row dataset at once.

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Database, ReservationStatus } from '../types/database';
import { getTodayDateString } from '../utils/date';
import type { GuestSortOption, GuestFilterState } from '../types/guests';
import { DEFAULT_SORT, DEFAULT_FILTERS } from '../types/guests';

function minSearchLength(q: string): number {
  return /^\d+$/.test(q) ? 3 : 2;
}

type GuestRow = Database['public']['Tables']['guests']['Row'];

type PageResult =
  | { ok: true; rows: GuestRow[]; hasMore: boolean }
  | { ok: false; error: string };

const PAGE_SIZE = 100;
// Larger batch for client-side tag filtering to reduce round-trips while still paginating.
const TAG_FETCH_SIZE = 300;
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

async function queryGuestPage(
  resId: string,
  searchQuery: string,
  currentSort: GuestSortOption,
  currentFilters: GuestFilterState,
  page: number,
): Promise<PageResult> {
  const q = searchQuery.trim();
  const useTagFilter = hasTagFilter(currentFilters);
  const fetchSize = useTagFilter ? TAG_FETCH_SIZE : PAGE_SIZE;
  const from = page * fetchSize;
  const to = from + fetchSize - 1;

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

    if (resError) return { ok: false, error: resError.message };

    const ids = [
      ...new Set(
        (resRows ?? [])
          .map(r => r.guest_id)
          .filter((id): id is string => id !== null),
      ),
    ];

    if (ids.length === 0) return { ok: true, rows: [], hasMore: false };
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

  // VIP clients always surface first within any sort order so they are
  // never pushed beyond the first page by the secondary sort criterion.
  dbQuery = dbQuery.order('vip', { ascending: false });

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

  dbQuery = dbQuery.range(from, to);

  const { data, error: fetchError } = await dbQuery;
  if (fetchError) return { ok: false, error: fetchError.message };

  const rawRows = data ?? [];
  const rows = useTagFilter ? applyTagFilters(rawRows, currentFilters) : rawRows;

  return { ok: true, rows, hasMore: rawRows.length === fetchSize };
}

export function useGuests() {
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [guests, setGuests]           = useState<GuestRow[]>([]);
  const [hasMore, setHasMore]         = useState(true);
  const [query, setQuery]             = useState('');
  const [sort, setSort]               = useState<GuestSortOption>(DEFAULT_SORT);
  const [filters, setFilters]         = useState<GuestFilterState>(DEFAULT_FILTERS);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);

  const restaurantIdRef    = useRef<string | null>(null);
  const queryRef           = useRef<string>('');
  const initialLoadedRef   = useRef(false);
  const currentPageRef     = useRef(0);
  const loadingMoreRef     = useRef(false);
  const hasMoreRef         = useRef(true);
  // Incremented on every reset so stale loadMore appends are discarded.
  const fetchGenerationRef = useRef(0);
  // Refs kept in sync with state so debounce callbacks always see latest values.
  const sortRef            = useRef<GuestSortOption>(DEFAULT_SORT);
  const filtersRef         = useRef<GuestFilterState>(DEFAULT_FILTERS);
  const debounceTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep mirror refs current on every render.
  sortRef.current    = sort;
  filtersRef.current = filters;

  const fetchPage = useCallback(async (
    resId: string,
    searchQuery: string,
    currentSort: GuestSortOption,
    currentFilters: GuestFilterState,
    page: number,
    append: boolean,
  ): Promise<void> => {
    // append=false means a fresh reset; increment generation to invalidate concurrent loadMore.
    const generation = append
      ? fetchGenerationRef.current
      : ++fetchGenerationRef.current;

    const result = await queryGuestPage(resId, searchQuery, currentSort, currentFilters, page);

    // Discard if a newer reset started while this request was in flight.
    if (fetchGenerationRef.current !== generation) return;

    if (!result.ok) {
      setError(result.error);
      return;
    }

    const { rows, hasMore: pageHasMore } = result;
    hasMoreRef.current = pageHasMore;
    setHasMore(pageHasMore);
    currentPageRef.current = page;

    if (append) {
      setGuests(prev => {
        const existingIds = new Set(prev.map(g => g.id));
        const newRows = rows.filter(g => !existingIds.has(g.id));
        return [...prev, ...newRows];
      });
    } else {
      setGuests(rows);
    }
    setError(null);
  }, []);

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
      await fetchPage(profile.restaurant_id, '', DEFAULT_SORT, DEFAULT_FILTERS, 0, false);
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  useEffect(() => { void loadInitial(); }, [loadInitial]);

  // Auto-search: fires on every query change, debounced 300 ms.
  // Empty query resets immediately to the full paginated list.
  useEffect(() => {
    if (!initialLoadedRef.current) return;
    const resId = restaurantIdRef.current;
    if (!resId) return;

    const q = query.trim();

    if (q.length === 0) {
      queryRef.current = '';
      setLoading(true);
      void fetchPage(resId, '', sortRef.current, filtersRef.current, 0, false).finally(() => setLoading(false));
      return;
    }

    if (q.length < minSearchLength(q)) return;

    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      queryRef.current = q;
      setLoading(true);
      void fetchPage(resId, q, sortRef.current, filtersRef.current, 0, false).finally(() => setLoading(false));
    }, 300);

    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [query, fetchPage]);

  // Auto-refetch (reset to page 0) when sort or filters change — only after initial load.
  useEffect(() => {
    if (!initialLoadedRef.current) return;
    const resId = restaurantIdRef.current;
    if (!resId) return;
    setLoading(true);
    void fetchPage(resId, queryRef.current, sort, filters, 0, false).finally(() => setLoading(false));
  }, [sort, filters, fetchPage]);

  const search = useCallback(async (): Promise<void> => {
    const resId = restaurantIdRef.current;
    if (!resId) return;
    queryRef.current = query;
    setLoading(true);
    try { await fetchPage(resId, query, sort, filters, 0, false); }
    finally { setLoading(false); }
  }, [query, sort, filters, fetchPage]);

  const clearSearch = useCallback((): void => {
    queryRef.current = '';
    setQuery('');
    // The auto-search effect detects query === '' and resets the list immediately.
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    const resId = restaurantIdRef.current;
    if (!resId) return;
    setLoading(true);
    try { await fetchPage(resId, queryRef.current, sort, filters, 0, false); }
    finally { setLoading(false); }
  }, [sort, filters, fetchPage]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (loadingMoreRef.current || !hasMoreRef.current) return;
    const resId = restaurantIdRef.current;
    if (!resId) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      await fetchPage(resId, queryRef.current, sort, filters, currentPageRef.current + 1, true);
    } finally {
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }
  }, [sort, filters, fetchPage]);

  const toggleFilter = useCallback((key: keyof GuestFilterState): void => {
    setFilters(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const resetFilters = useCallback((): void => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return {
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
    search,
    clearSearch,
    refresh,
    restaurantId,
  };
}

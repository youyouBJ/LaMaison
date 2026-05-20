import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getTodayDateString, addDaysToDateString } from '../utils/date';

// ─── Period definition ────────────────────────────────────────────────────────

export type DashboardPeriod = 'today' | 'week' | 'month' | 'current_month' | 'year';

export type PeriodOption = { key: DashboardPeriod; label: string };

export const PERIOD_OPTIONS: PeriodOption[] = [
  { key: 'today',         label: "Aujourd'hui" },
  { key: 'week',          label: '7 jours' },
  { key: 'month',         label: '30 jours' },
  { key: 'current_month', label: 'Mois' },
  { key: 'year',          label: 'Année' },
];

export function getPeriodLabel(period: DashboardPeriod): string {
  return PERIOD_OPTIONS.find(o => o.key === period)?.label ?? period;
}

export function getPeriodDateRange(period: DashboardPeriod): { start: string; end: string } {
  const today = getTodayDateString();
  switch (period) {
    case 'today':
      return { start: today, end: today };
    case 'week':
      return { start: addDaysToDateString(today, -6), end: today };
    case 'month':
      return { start: addDaysToDateString(today, -29), end: today };
    case 'current_month': {
      const parts = today.split('-');
      return { start: `${parts[0]}-${parts[1]}-01`, end: today };
    }
    case 'year': {
      const year = today.split('-')[0];
      return { start: `${year}-01-01`, end: today };
    }
  }
}

// ─── Stats types ──────────────────────────────────────────────────────────────

export type PeriodReservationStats = {
  total: number;
  covers: number;
  confirmed: number;
  pending: number;
  seated: number;
  completed: number;
  cancelled: number;
  noshow: number;
  cancellationRate: number;
  noshowRate: number;
  walkIns: number;
  uniqueGuests: number;
  lunchCount: number;
  lunchCovers: number;
  dinnerCount: number;
  dinnerCovers: number;
  birthdays: number;
  events: number;
};

export type PeriodFeedbackStats = {
  total: number;
  avgOverall: number | null;
  avgFood: number | null;
  avgDrinks: number | null;
  avgService: number | null;
  avgAmbience: number | null;
  recommendedRate: number | null;
  lastComment: string | null;
};

export type PeriodGuestStats = {
  uniqueReserving: number;
  walkIns: number;
  newGuests: number;
  vipReserving: number;
};

export type PeriodStatsResult = {
  reservations: PeriodReservationStats;
  feedback: PeriodFeedbackStats | null;
  guests: PeriodGuestStats;
};

// ─── Internal row types ───────────────────────────────────────────────────────

type ResRow = {
  status: string;
  party_size: number;
  notes: string | null;
  guest_id: string | null;
  source: string;
  time_slot: string;
};

type FbRow = {
  rating_overall: number;
  rating_food: number | null;
  rating_drinks: number | null;
  rating_service: number | null;
  rating_ambience: number | null;
  recommended: boolean | null;
  comment: string | null;
  created_at: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const BIRTHDAY_TAG = '[Occasion] Anniversaire';
const EVENT_TAG    = '[Occasion] Événement';

const EMPTY_RES: PeriodReservationStats = {
  total: 0, covers: 0, confirmed: 0, pending: 0, seated: 0, completed: 0,
  cancelled: 0, noshow: 0, cancellationRate: 0, noshowRate: 0,
  walkIns: 0, uniqueGuests: 0,
  lunchCount: 0, lunchCovers: 0, dinnerCount: 0, dinnerCovers: 0,
  birthdays: 0, events: 0,
};

const INITIAL_STATS: PeriodStatsResult = {
  reservations: { ...EMPTY_RES },
  feedback: null,
  guests: { uniqueReserving: 0, walkIns: 0, newGuests: 0, vipReserving: 0 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeReservationStats(rows: ResRow[]): PeriodReservationStats {
  let covers = 0, confirmed = 0, pending = 0, seated = 0, completed = 0;
  let cancelled = 0, noshow = 0, walkIns = 0;
  let lunchCount = 0, lunchCovers = 0, dinnerCount = 0, dinnerCovers = 0;
  let birthdays = 0, events = 0;
  const guestIds = new Set<string>();

  for (const r of rows) {
    switch (r.status) {
      case 'confirmed': confirmed++; break;
      case 'pending':   pending++;   break;
      case 'seated':    seated++;    break;
      case 'completed': completed++; break;
      case 'cancelled': cancelled++; break;
      case 'noshow':    noshow++;    break;
    }

    if (r.guest_id) guestIds.add(r.guest_id);

    if (r.notes) {
      if (r.notes.includes(BIRTHDAY_TAG)) birthdays++;
      if (r.notes.includes(EVENT_TAG))    events++;
    }

    const isActive = r.status !== 'cancelled' && r.status !== 'noshow';
    if (isActive) {
      covers += r.party_size;
      if (r.source === 'walkin') walkIns++;

      // Service classification via time_slot fallback
      const slot      = r.time_slot.substring(0, 5);
      const isLunch   = slot >= '12:00' && slot <= '16:45';
      const isDinner  = slot >= '17:00' && slot <= '23:45';

      if (isLunch)       { lunchCount++;  lunchCovers  += r.party_size; }
      else if (isDinner) { dinnerCount++; dinnerCovers += r.party_size; }
    }
  }

  const total = rows.length;
  return {
    total, covers,
    confirmed, pending, seated, completed, cancelled, noshow,
    cancellationRate: total > 0 ? Math.round((cancelled / total) * 100) : 0,
    noshowRate:       total > 0 ? Math.round((noshow   / total) * 100) : 0,
    walkIns,
    uniqueGuests: guestIds.size,
    lunchCount, lunchCovers, dinnerCount, dinnerCovers,
    birthdays, events,
  };
}

function roundedAvg(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length === 0) return null;
  return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10;
}

function computeFeedbackStats(rows: FbRow[]): PeriodFeedbackStats {
  if (rows.length === 0) {
    return {
      total: 0,
      avgOverall: null, avgFood: null, avgDrinks: null,
      avgService: null, avgAmbience: null,
      recommendedRate: null, lastComment: null,
    };
  }

  const withRec = rows.filter(r => r.recommended !== null).length;
  const recYes  = rows.filter(r => r.recommended === true).length;

  const sorted         = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const lastWithComment = sorted.find(r => Boolean(r.comment?.trim()));

  return {
    total:          rows.length,
    avgOverall:     roundedAvg(rows.map(r => r.rating_overall)),
    avgFood:        roundedAvg(rows.map(r => r.rating_food)),
    avgDrinks:      roundedAvg(rows.map(r => r.rating_drinks)),
    avgService:     roundedAvg(rows.map(r => r.rating_service)),
    avgAmbience:    roundedAvg(rows.map(r => r.rating_ambience)),
    recommendedRate: withRec > 0 ? Math.round((recYes / withRec) * 100) : null,
    lastComment:     lastWithComment?.comment ?? null,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePeriodStats(restaurantId: string | null, period: DashboardPeriod) {
  const [loading, setLoading] = useState(false);
  const [stats, setStats]     = useState<PeriodStatsResult>(INITIAL_STATS);
  const fetchIdRef            = useRef(0);

  const fetchAll = useCallback(async (resId: string, p: DashboardPeriod): Promise<void> => {
    const myId           = ++fetchIdRef.current;
    const { start, end } = getPeriodDateRange(p);

    const [resResult, fbResult, newGuestsResult] = await Promise.all([
      supabase
        .from('reservations')
        .select('status, party_size, notes, guest_id, source, time_slot')
        .eq('restaurant_id', resId)
        .gte('date', start)
        .lte('date', end),

      // Load all feedback for the restaurant then filter by period in memory.
      // Volume expected << 5 000 rows — safe to aggregate client-side.
      supabase
        .from('feedback_surveys')
        .select('rating_overall, rating_food, rating_drinks, rating_service, rating_ambience, recommended, comment, created_at')
        .eq('restaurant_id', resId)
        .order('created_at', { ascending: false }),

      // Count guests created in the period (no row data loaded)
      supabase
        .from('guests')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', resId)
        .gte('created_at', start)
        .lt('created_at', addDaysToDateString(end, 1)),
    ]);

    // Discard stale responses when the period changed mid-flight
    if (fetchIdRef.current !== myId) return;

    const resRows = (resResult.data as ResRow[] | null) ?? [];

    // Collect unique guest IDs that reserved in this period
    const guestIdSet = new Set<string>();
    for (const r of resRows) {
      if (r.guest_id !== null) guestIdSet.add(r.guest_id);
    }
    const guestIdBatch = [...guestIdSet].slice(0, 400);

    // Count VIP among reserving guests (sequential, depends on guestIdBatch)
    let vipReserving = 0;
    if (guestIdBatch.length > 0) {
      const vipResult = await supabase
        .from('guests')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', resId)
        .eq('vip', true)
        .in('id', guestIdBatch);
      if (!vipResult.error) {
        vipReserving = vipResult.count ?? 0;
      }
    }

    if (fetchIdRef.current !== myId) return;

    const resStats = computeReservationStats(resRows);

    let feedback: PeriodFeedbackStats | null = null;
    if (!fbResult.error) {
      const allFb = (fbResult.data as FbRow[] | null) ?? [];
      // Filter by period using the date portion of created_at (UTC — ±1h precision near midnight Tunis time)
      const periodFb = allFb.filter(r => {
        const d = r.created_at.substring(0, 10);
        return d >= start && d <= end;
      });
      feedback = computeFeedbackStats(periodFb);
    }

    setStats({
      reservations: resStats,
      feedback,
      guests: {
        uniqueReserving: resStats.uniqueGuests,
        walkIns:         resStats.walkIns,
        newGuests:       newGuestsResult.count ?? 0,
        vipReserving,
      },
    });
  }, []);

  const refresh = useCallback((): void => {
    if (!restaurantId) return;
    setLoading(true);
    void fetchAll(restaurantId, period).finally(() => { setLoading(false); });
  }, [restaurantId, period, fetchAll]);

  useEffect(() => {
    if (!restaurantId) return;
    setLoading(true);
    void fetchAll(restaurantId, period).finally(() => { setLoading(false); });
  }, [restaurantId, period, fetchAll]);

  return { loading, stats, refresh };
}

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getTodayDateString, addDaysToDateString } from '../utils/date';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PeriodStats = {
  reservations: number;
  covers: number;
  cancelled: number;
  noshow: number;
  birthdays: number;
  events: number;
};

export type ClientStats = {
  total: number;
  vip: number;
  withPhone: number;
  withEmail: number;
  withoutPhone: number;
  withoutEmail: number;
  withRating: number;
};

export type FeedbackStats = {
  total: number;
  avgOverall: number | null;
  avgFood: number | null;
  avgDrinks: number | null;
  avgService: number | null;
  avgAmbience: number | null;
  recommendedRate: number | null;
  lastAt: string | null;
};

export type ExtendedStats = {
  waitlistPending: number;
  week: PeriodStats;
  month: PeriodStats;
  clients: ClientStats;
  feedback: FeedbackStats | null;
};

// ─── Internal row types ───────────────────────────────────────────────────────

type PeriodRow = {
  status: string;
  party_size: number;
  notes: string | null;
};

type FeedbackRow = {
  rating_overall: number;
  rating_food: number | null;
  rating_drinks: number | null;
  rating_service: number | null;
  rating_ambience: number | null;
  recommended: boolean | null;
  created_at: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const BIRTHDAY_TAG = '[Occasion] Anniversaire';
const EVENT_TAG    = '[Occasion] Événement';

const EMPTY_PERIOD: PeriodStats = {
  reservations: 0, covers: 0, cancelled: 0,
  noshow: 0, birthdays: 0, events: 0,
};

const INITIAL_STATS: ExtendedStats = {
  waitlistPending: 0,
  week:    { ...EMPTY_PERIOD },
  month:   { ...EMPTY_PERIOD },
  clients: { total: 0, vip: 0, withPhone: 0, withEmail: 0, withoutPhone: 0, withoutEmail: 0, withRating: 0 },
  feedback: null,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computePeriodStats(rows: PeriodRow[]): PeriodStats {
  let covers = 0, cancelled = 0, noshow = 0, birthdays = 0, events = 0;

  for (const r of rows) {
    const isActive = r.status !== 'cancelled' && r.status !== 'noshow';
    if (isActive) covers += r.party_size;
    if (r.status === 'cancelled') cancelled++;
    if (r.status === 'noshow')    noshow++;
    if (r.notes) {
      if (r.notes.includes(BIRTHDAY_TAG)) birthdays++;
      if (r.notes.includes(EVENT_TAG))    events++;
    }
  }

  return { reservations: rows.length, covers, cancelled, noshow, birthdays, events };
}

function roundedAvg(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length === 0) return null;
  return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10;
}

function computeFeedbackStats(rows: FeedbackRow[]): FeedbackStats {
  if (rows.length === 0) {
    return {
      total: 0,
      avgOverall: null, avgFood: null, avgDrinks: null,
      avgService: null, avgAmbience: null,
      recommendedRate: null, lastAt: null,
    };
  }

  const withRecommended = rows.filter(r => r.recommended !== null).length;
  const recommendedYes  = rows.filter(r => r.recommended === true).length;

  const sorted = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return {
    total:          rows.length,
    avgOverall:     roundedAvg(rows.map(r => r.rating_overall)),
    avgFood:        roundedAvg(rows.map(r => r.rating_food)),
    avgDrinks:      roundedAvg(rows.map(r => r.rating_drinks)),
    avgService:     roundedAvg(rows.map(r => r.rating_service)),
    avgAmbience:    roundedAvg(rows.map(r => r.rating_ambience)),
    recommendedRate: withRecommended > 0 ? Math.round((recommendedYes / withRecommended) * 100) : null,
    lastAt:         sorted[0]?.created_at ?? null,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDashboardExtended(restaurantId: string | null) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats]     = useState<ExtendedStats>(INITIAL_STATS);

  const fetchAll = useCallback(async (resId: string): Promise<void> => {
    const today      = getTodayDateString();
    const weekStart  = addDaysToDateString(today, -6);
    const monthStart = addDaysToDateString(today, -29);

    const [
      waitlistRes,
      weekRes,
      monthRes,
      totalRes,
      vipRes,
      withPhoneRes,
      withEmailRes,
      withoutPhoneRes,
      withoutEmailRes,
      withRatingRes,
      feedbackRes,
    ] = await Promise.all([
      // Waitlist en attente aujourd'hui
      supabase
        .from('waitlist')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', resId)
        .eq('date', today)
        .eq('status', 'waiting'),

      // Réservations 7 jours
      supabase
        .from('reservations')
        .select('status, party_size, notes')
        .eq('restaurant_id', resId)
        .gte('date', weekStart)
        .lte('date', today),

      // Réservations 30 jours
      supabase
        .from('reservations')
        .select('status, party_size, notes')
        .eq('restaurant_id', resId)
        .gte('date', monthStart)
        .lte('date', today),

      // Clients total
      supabase
        .from('guests')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', resId),

      // Clients VIP
      supabase
        .from('guests')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', resId)
        .eq('vip', true),

      // Clients avec téléphone
      supabase
        .from('guests')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', resId)
        .not('phone', 'is', null),

      // Clients avec email
      supabase
        .from('guests')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', resId)
        .not('email', 'is', null),

      // Clients sans téléphone
      supabase
        .from('guests')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', resId)
        .is('phone', null),

      // Clients sans email
      supabase
        .from('guests')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', resId)
        .is('email', null),

      // Clients avec note
      supabase
        .from('guests')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', resId)
        .not('avg_rating', 'is', null),

      // Avis satisfaction — petit volume, agrégé en mémoire
      supabase
        .from('feedback_surveys')
        .select('rating_overall, rating_food, rating_drinks, rating_service, rating_ambience, recommended, created_at')
        .eq('restaurant_id', resId)
        .order('created_at', { ascending: false }),
    ]);

    const weekRows  = (weekRes.data  as PeriodRow[] | null) ?? [];
    const monthRows = (monthRes.data as PeriodRow[] | null) ?? [];

    // Feedback — fallback gracieux si table inaccessible ou inexistante
    let feedback: FeedbackStats | null = null;
    if (!feedbackRes.error) {
      feedback = computeFeedbackStats((feedbackRes.data as FeedbackRow[] | null) ?? []);
    }

    setStats({
      waitlistPending: waitlistRes.count ?? 0,
      week:    computePeriodStats(weekRows),
      month:   computePeriodStats(monthRows),
      clients: {
        total:        totalRes.count        ?? 0,
        vip:          vipRes.count          ?? 0,
        withPhone:    withPhoneRes.count    ?? 0,
        withEmail:    withEmailRes.count    ?? 0,
        withoutPhone: withoutPhoneRes.count ?? 0,
        withoutEmail: withoutEmailRes.count ?? 0,
        withRating:   withRatingRes.count   ?? 0,
      },
      feedback,
    });
  }, []);

  const refresh = useCallback((): void => {
    if (!restaurantId) return;
    setLoading(true);
    void fetchAll(restaurantId).finally(() => { setLoading(false); });
  }, [restaurantId, fetchAll]);

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void fetchAll(restaurantId).finally(() => { setLoading(false); });
  }, [restaurantId, fetchAll]);

  return { loading, stats, refresh };
}

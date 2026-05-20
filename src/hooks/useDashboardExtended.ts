import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getTodayDateString } from '../utils/date';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ClientStats = {
  total: number;
  vip: number;
  withPhone: number;
  withEmail: number;
  withoutPhone: number;
  withoutEmail: number;
  withRating: number;
};

export type ExtendedStats = {
  waitlistPending: number;
  clients: ClientStats;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const INITIAL_STATS: ExtendedStats = {
  waitlistPending: 0,
  clients: { total: 0, vip: 0, withPhone: 0, withEmail: 0, withoutPhone: 0, withoutEmail: 0, withRating: 0 },
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDashboardExtended(restaurantId: string | null) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats]     = useState<ExtendedStats>(INITIAL_STATS);

  const fetchAll = useCallback(async (resId: string): Promise<void> => {
    const today = getTodayDateString();

    const [
      waitlistRes,
      totalRes,
      vipRes,
      withPhoneRes,
      withEmailRes,
      withoutPhoneRes,
      withoutEmailRes,
      withRatingRes,
    ] = await Promise.all([
      // Waitlist en attente aujourd'hui
      supabase
        .from('waitlist')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', resId)
        .eq('date', today)
        .eq('status', 'waiting'),

      // Clients total
      supabase.from('guests').select('*', { count: 'exact', head: true }).eq('restaurant_id', resId),

      // Clients VIP
      supabase.from('guests').select('*', { count: 'exact', head: true }).eq('restaurant_id', resId).eq('vip', true),

      // Clients avec téléphone
      supabase.from('guests').select('*', { count: 'exact', head: true }).eq('restaurant_id', resId).not('phone', 'is', null),

      // Clients avec email
      supabase.from('guests').select('*', { count: 'exact', head: true }).eq('restaurant_id', resId).not('email', 'is', null),

      // Clients sans téléphone
      supabase.from('guests').select('*', { count: 'exact', head: true }).eq('restaurant_id', resId).is('phone', null),

      // Clients sans email
      supabase.from('guests').select('*', { count: 'exact', head: true }).eq('restaurant_id', resId).is('email', null),

      // Clients avec note importée
      supabase.from('guests').select('*', { count: 'exact', head: true }).eq('restaurant_id', resId).not('avg_rating', 'is', null),
    ]);

    setStats({
      waitlistPending: waitlistRes.count ?? 0,
      clients: {
        total:        totalRes.count        ?? 0,
        vip:          vipRes.count          ?? 0,
        withPhone:    withPhoneRes.count    ?? 0,
        withEmail:    withEmailRes.count    ?? 0,
        withoutPhone: withoutPhoneRes.count ?? 0,
        withoutEmail: withoutEmailRes.count ?? 0,
        withRating:   withRatingRes.count   ?? 0,
      },
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

import { useState, useEffect, useCallback, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { getTodayDateString } from '../utils/date';
import type { ReservationWithJoins, ReservationTableEntry } from '../types/reservations';
import type { Database } from '../types/database';

type TableRow = Database['public']['Tables']['tables']['Row'];

type RtQueryRow = {
  id:             string;
  reservation_id: string;
  table_id:       string;
  tables:         TableRow | null;
};

export type { ReservationWithJoins };

export function useReservations() {
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [reservations, setReservations] = useState<ReservationWithJoins[]>([]);
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const channelRef       = useRef<RealtimeChannel | null>(null);
  const restaurantIdRef  = useRef<string | null>(null);
  const selectedDateRef  = useRef(selectedDate);

  useEffect(() => { selectedDateRef.current = selectedDate; }, [selectedDate]);

  const fetchReservations = useCallback(async (resId: string, date: string): Promise<void> => {
    const { data, error: fetchError } = await supabase
      .from('reservations')
      .select('*, guests(*), tables(*), shifts(*)')
      .eq('restaurant_id', resId)
      .eq('date', date)
      .order('time_slot', { ascending: true });

    if (fetchError) { setError(fetchError.message); return; }
    let rows = (data as unknown as ReservationWithJoins[] | null) ?? [];

    // Second query for reservation_tables: PostgREST can't join through a N:N junction
    // table with full column selection in one pass, so we enrich client-side.
    // Silently ignore pre-migration (table may not exist yet).
    const ids = rows.map((r) => r.id);
    if (ids.length > 0) {
      const { data: rtData } = await supabase
        .from('reservation_tables')
        .select('id, reservation_id, table_id, tables(*)')
        .in('reservation_id', ids);

      if (rtData && rtData.length > 0) {
        const rtRows = rtData as unknown as RtQueryRow[];
        const rtByResId = new Map<string, ReservationTableEntry[]>();
        for (const rt of rtRows) {
          if (!rt.tables) continue;
          const entry: ReservationTableEntry = { id: rt.id, table_id: rt.table_id, tables: rt.tables };
          const existing = rtByResId.get(rt.reservation_id) ?? [];
          existing.push(entry);
          rtByResId.set(rt.reservation_id, existing);
        }
        rows = rows.map((r) => ({ ...r, reservation_tables: rtByResId.get(r.id) }));
      }
    }

    setReservations(rows);
    setError(null);
  }, []);

  // Chargement initial : profil + premières réservations
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) { setError('Session expirée. Reconnectez-vous.'); return; }

        const { data: profile, error: profileError } = await supabase
          .from('users').select('restaurant_id').eq('id', userData.user.id).single();
        if (profileError || !profile) { setError('Profil introuvable.'); return; }

        restaurantIdRef.current = profile.restaurant_id;
        setRestaurantId(profile.restaurant_id);
        await fetchReservations(profile.restaurant_id, selectedDateRef.current);
      } finally {
        setLoading(false);
      }
    };
    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // once on mount

  // Rechargement lors du changement de date
  useEffect(() => {
    if (restaurantIdRef.current) {
      void fetchReservations(restaurantIdRef.current, selectedDate);
    }
  }, [selectedDate, fetchReservations]);

  // Realtime : restaurantIdRef et selectedDateRef sont utilisés dans le callback
  // à la place des valeurs d'état directes pour éviter les stale closures —
  // le callback capture une snapshot au moment de sa définition.
  useEffect(() => {
    if (!restaurantId) return;
    if (channelRef.current) { void supabase.removeChannel(channelRef.current); }

    channelRef.current = supabase
      .channel('reservations-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservations', filter: `restaurant_id=eq.${restaurantId}` },
        () => {
          if (restaurantIdRef.current) {
            void fetchReservations(restaurantIdRef.current, selectedDateRef.current);
          }
        },
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [restaurantId, fetchReservations]);

  const refresh = useCallback(() => {
    if (restaurantIdRef.current) {
      void fetchReservations(restaurantIdRef.current, selectedDateRef.current);
    }
  }, [fetchReservations]);

  return { loading, error, reservations, selectedDate, setSelectedDate, refresh, restaurantId };
}

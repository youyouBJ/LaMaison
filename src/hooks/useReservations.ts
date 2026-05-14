import { useState, useEffect, useCallback, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { getTodayDateString } from '../utils/date';
import type { ReservationWithJoins } from '../types/reservations';

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
    setReservations((data as unknown as ReservationWithJoins[] | null) ?? []);
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

  // Realtime sur reservations du restaurant
  // Les tables et floor_plans seront traités dans le module Plan de salle.
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

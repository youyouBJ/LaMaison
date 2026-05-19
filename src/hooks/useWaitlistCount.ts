import { useState, useEffect, useCallback, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type ServiceFilter = 'all' | 'lunch' | 'dinner';

// Même logique que useWaitlist — vérifie si une entrée correspond au service.
type CountRow = {
  time_slot: string | null;
  shifts:    { name: string } | null;
};

function matchesService(row: CountRow, filter: ServiceFilter): boolean {
  if (filter === 'all') return true;

  if (row.shifts?.name) {
    const name = row.shifts.name.toLowerCase();
    if (filter === 'lunch') {
      return (
        name.includes('déjeuner') || name.includes('dejeuner') ||
        name.includes('lunch')    || name.includes('midi')
      );
    }
    return (
      name.includes('dîner') || name.includes('diner') ||
      name.includes('dinner') || name.includes('soir')
    );
  }

  if (row.time_slot) {
    const h = parseInt(row.time_slot.substring(0, 2), 10);
    if (filter === 'lunch') return h >= 12 && h <= 16;
    return h >= 17;
  }

  // Pas d'info service → visible uniquement dans "Tous"
  return false;
}

export function useWaitlistCount(date: string, serviceFilter: ServiceFilter) {
  const [count, setCount]     = useState(0);
  const [loading, setLoading] = useState(true);

  const restaurantIdRef = useRef<string | null>(null);
  const channelRef      = useRef<RealtimeChannel | null>(null);

  // Garde les params courants accessibles depuis le callback realtime.
  const dateRef          = useRef(date);
  const serviceFilterRef = useRef(serviceFilter);
  useEffect(() => { dateRef.current = date; },          [date]);
  useEffect(() => { serviceFilterRef.current = serviceFilter; }, [serviceFilter]);

  const fetchCount = useCallback(async (resId: string, d: string, sf: ServiceFilter): Promise<void> => {
    const { data } = await supabase
      .from('waitlist')
      .select('time_slot, shifts(name)')
      .eq('restaurant_id', resId)
      .eq('date', d)
      .eq('status', 'waiting');

    const rows = (data as unknown as CountRow[] | null) ?? [];
    const filtered = sf === 'all' ? rows : rows.filter((r) => matchesService(r, sf));
    setCount(filtered.length);
  }, []);

  // Chargement initial : auth + profile
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) return;

        const { data: profile, error: profileError } = await supabase
          .from('users').select('restaurant_id').eq('id', userData.user.id).single();
        if (profileError || !profile) return;

        restaurantIdRef.current = profile.restaurant_id;
        await fetchCount(profile.restaurant_id, dateRef.current, serviceFilterRef.current);
      } finally {
        setLoading(false);
      }
    };
    void init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // once on mount

  // Re-fetch quand date ou serviceFilter changent
  useEffect(() => {
    const resId = restaurantIdRef.current;
    if (!resId) return;
    void fetchCount(resId, date, serviceFilter);
  }, [date, serviceFilter, fetchCount]);

  // Realtime — se met en place une fois restaurant_id connu
  useEffect(() => {
    const setupChannel = () => {
      const resId = restaurantIdRef.current;
      if (!resId) return;

      if (channelRef.current) { void supabase.removeChannel(channelRef.current); }

      channelRef.current = supabase
        .channel('waitlist-count')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'waitlist', filter: `restaurant_id=eq.${resId}` },
          () => {
            if (restaurantIdRef.current) {
              void fetchCount(restaurantIdRef.current, dateRef.current, serviceFilterRef.current);
            }
          },
        )
        .subscribe();
    };

    // On attend que restaurantIdRef soit renseigné (petit délai max 2s)
    const trySetup = () => {
      if (restaurantIdRef.current) { setupChannel(); return; }
      const timer = setTimeout(trySetup, 200);
      return timer;
    };
    const t = trySetup();

    return () => {
      clearTimeout(t as ReturnType<typeof setTimeout>);
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // once on mount — realtime persiste pendant toute la vie du composant

  return { count, loading };
}

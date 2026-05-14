// Recherche côté Supabase via ilike — suffisant pour le MVP.
// Lors de l'import SevenRooms (22 682 clients), envisager :
//   - index pg_trgm (trigram) sur phone, first_name, last_name, email
//   - full-text search via tsvector
//   - pagination avec curseur

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type GuestRow = Database['public']['Tables']['guests']['Row'];

const PAGE_SIZE = 50;

export function useGuests() {
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [guests, setGuests]           = useState<GuestRow[]>([]);
  const [query, setQuery]             = useState('');
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const restaurantIdRef               = useRef<string | null>(null);

  const fetchGuests = useCallback(async (resId: string, searchQuery: string): Promise<void> => {
    const q = searchQuery.trim();

    const { data, error: fetchError } = q.length >= 2
      ? await supabase
          .from('guests')
          .select('*')
          .eq('restaurant_id', resId)
          .or(`phone.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)
          .order('last_visit', { ascending: false })
          .limit(PAGE_SIZE)
      : await supabase
          .from('guests')
          .select('*')
          .eq('restaurant_id', resId)
          .order('created_at', { ascending: false })
          .limit(PAGE_SIZE);

    if (fetchError) { setError(fetchError.message); return; }
    setGuests(data ?? []);
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
      await fetchGuests(profile.restaurant_id, '');
    } finally {
      setLoading(false);
    }
  }, [fetchGuests]);

  const search = useCallback(async (): Promise<void> => {
    const resId = restaurantIdRef.current;
    if (!resId) return;
    setLoading(true);
    try { await fetchGuests(resId, query); }
    finally { setLoading(false); }
  }, [query, fetchGuests]);

  const refresh = useCallback(async (): Promise<void> => {
    const resId = restaurantIdRef.current;
    if (!resId) return;
    setLoading(true);
    try { await fetchGuests(resId, query); }
    finally { setLoading(false); }
  }, [query, fetchGuests]);

  useEffect(() => { void loadInitial(); }, [loadInitial]);

  return { loading, error, guests, query, setQuery, search, refresh, restaurantId };
}

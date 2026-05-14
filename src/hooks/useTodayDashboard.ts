import { useState, useEffect, useCallback, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Database, ReservationStatus } from '../types/database';
import { getTodayDateString, getCurrentTimeInTunis, formatTimeSlot } from '../utils/date';

type ReservationRow = Database['public']['Tables']['reservations']['Row'];
type GuestRow      = Database['public']['Tables']['guests']['Row'];
type TableRow      = Database['public']['Tables']['tables']['Row'];
type ShiftRow      = Database['public']['Tables']['shifts']['Row'];

export type DashboardReservation = ReservationRow & {
  guests: GuestRow | null;
  tables: TableRow | null;
  shifts: ShiftRow | null;
};

export type DashboardStats = {
  total: number;
  totalCovers: number;
  confirmed: number;
  seated: number;
  cancelledAndNoshow: number;
  byStatus: Record<ReservationStatus, number>;
  nextReservation: DashboardReservation | null;
};

const EMPTY_BY_STATUS: Record<ReservationStatus, number> = {
  confirmed: 0,
  pending:   0,
  cancelled: 0,
  noshow:    0,
  seated:    0,
  completed: 0,
};

const INITIAL_STATS: DashboardStats = {
  total: 0,
  totalCovers: 0,
  confirmed: 0,
  seated: 0,
  cancelledAndNoshow: 0,
  byStatus: { ...EMPTY_BY_STATUS },
  nextReservation: null,
};

function computeStats(rows: DashboardReservation[]): DashboardStats {
  const currentTime = getCurrentTimeInTunis();
  const byStatus: Record<ReservationStatus, number> = { ...EMPTY_BY_STATUS };
  let totalCovers = 0;
  let nextReservation: DashboardReservation | null = null;

  for (const r of rows) {
    byStatus[r.status]++;
    totalCovers += r.party_size;

    const isUpcoming =
      (r.status === 'confirmed' || r.status === 'pending') &&
      formatTimeSlot(r.time_slot) >= currentTime;

    if (isUpcoming && (nextReservation === null || r.time_slot < nextReservation.time_slot)) {
      nextReservation = r;
    }
  }

  return {
    total: rows.length,
    totalCovers,
    confirmed: byStatus.confirmed,
    seated: byStatus.seated,
    cancelledAndNoshow: byStatus.cancelled + byStatus.noshow,
    byStatus,
    nextReservation,
  };
}

export function useTodayDashboard() {
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [reservations, setReservations] = useState<DashboardReservation[]>([]);
  const [stats, setStats]               = useState<DashboardStats>(INITIAL_STATS);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchReservations = useCallback(async (resId: string): Promise<void> => {
    const today = getTodayDateString();

    const { data, error: fetchError } = await supabase
      .from('reservations')
      .select('*, guests(*), tables(*), shifts(*)')
      .eq('restaurant_id', resId)
      .eq('date', today)
      .order('time_slot', { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      return;
    }

    // Join types not declared in Relationships[] — explicit cast required.
    // Resolved once the CLI generates database.ts with proper FK relationships.
    const rows = (data as unknown as DashboardReservation[] | null) ?? [];
    setReservations(rows);
    setStats(computeStats(rows));
    setError(null);
  }, []);

  const loadAll = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        setError('Session expirée. Reconnectez-vous.');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('restaurant_id, role, full_name')
        .eq('id', userData.user.id)
        .single();

      if (profileError || !profile) {
        setError('Profil introuvable. Contactez un administrateur.');
        return;
      }

      setRestaurantId(profile.restaurant_id);
      await fetchReservations(profile.restaurant_id);
    } finally {
      setLoading(false);
    }
  }, [fetchReservations]);

  const refresh = useCallback((): void => {
    void loadAll();
  }, [loadAll]);

  // Realtime sur reservations uniquement.
  // Les changements sur tables et floor_plans seront traités dans le module Plan de salle.
  useEffect(() => {
    if (!restaurantId) return;

    if (channelRef.current) {
      void supabase.removeChannel(channelRef.current);
    }

    channelRef.current = supabase
      .channel('dashboard-reservations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => { void fetchReservations(restaurantId); },
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [restaurantId, fetchReservations]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  return { loading, error, reservations, stats, refresh, restaurantId };
}

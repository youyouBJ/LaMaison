import { useState, useEffect, useCallback, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { getTodayDateString } from '../utils/date';
import { LA_MAISON_FLOOR_TABLES, LA_MAISON_FLOOR_LABELS } from '../utils/floorPlanLayout';
import type {
  FloorTableWithState,
  FloorLabelLayout,
  FloorServiceFilter,
  FloorPlanReservation,
  FloorTableStatus,
} from '../types/floor';
import type { Database } from '../types/database';

type TableRow       = Database['public']['Tables']['tables']['Row'];
type ReservationRow = Database['public']['Tables']['reservations']['Row'];
type GuestRow       = Database['public']['Tables']['guests']['Row'];
type ShiftRow       = Database['public']['Tables']['shifts']['Row'];

type ReservationWithJoins = ReservationRow & {
  guests: GuestRow | null;
  shifts: ShiftRow | null;
};

// ─── Service time ranges ──────────────────────────────────────────────────────

const LUNCH_START  = '12:00';
const LUNCH_END    = '16:45';
const DINNER_START = '17:00';
const DINNER_END   = '23:45';

function timeInRange(time: string, start: string, end: string): boolean {
  return time >= start && time <= end;
}

function matchesService(
  res: ReservationWithJoins,
  filter: FloorServiceFilter,
): boolean {
  if (filter === 'all') return true;
  const shiftName = res.shifts?.name?.toLowerCase() ?? '';
  if (filter === 'lunch') {
    if (shiftName.includes('déjeuner') || shiftName.includes('lunch') || shiftName.includes('midi')) return true;
    return timeInRange(res.time_slot, LUNCH_START, LUNCH_END);
  }
  if (shiftName.includes('dîner') || shiftName.includes('dinner') || shiftName.includes('soir')) return true;
  return timeInRange(res.time_slot, DINNER_START, DINNER_END);
}

// ─── Status computation ───────────────────────────────────────────────────────

function computeStatus(
  tableRow: TableRow | undefined,
  reservation: ReservationWithJoins | undefined,
): FloorTableStatus {
  if (!tableRow || tableRow.status === 'unavailable') return 'unavailable';
  if (!reservation) return 'free';
  if (reservation.status === 'seated') return 'occupied';
  if (reservation.status === 'confirmed' || reservation.status === 'pending') return 'reserved';
  return 'free';
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseFloorPlanResult {
  loading: boolean;
  error: string | null;
  tables: FloorTableWithState[];
  labels: FloorLabelLayout[];
  reservations: ReservationWithJoins[];
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  serviceFilter: FloorServiceFilter;
  setServiceFilter: (f: FloorServiceFilter) => void;
  selectedTable: FloorTableWithState | null;
  setSelectedTable: (t: FloorTableWithState | null) => void;
  refresh: () => void;
  assignReservationToTable: (reservationId: string, tableId: string) => Promise<void>;
}

export function useFloorPlan(): UseFloorPlanResult {
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [dbTables, setDbTables]             = useState<TableRow[]>([]);
  const [reservations, setReservations]     = useState<ReservationWithJoins[]>([]);
  const [selectedDate, setSelectedDate]     = useState(getTodayDateString());
  const [serviceFilter, setServiceFilter]   = useState<FloorServiceFilter>('all');
  const [selectedTable, setSelectedTable]   = useState<FloorTableWithState | null>(null);
  const [restaurantId, setRestaurantId]     = useState<string | null>(null);

  const restaurantIdRef  = useRef<string | null>(null);
  const selectedDateRef  = useRef(selectedDate);
  const channelResRef    = useRef<RealtimeChannel | null>(null);
  const channelTabRef    = useRef<RealtimeChannel | null>(null);

  useEffect(() => { selectedDateRef.current = selectedDate; }, [selectedDate]);

  // ── Fetch tables from DB ─────────────────────────────────────────────────

  const fetchTables = useCallback(async (resId: string): Promise<void> => {
    const { data, error: e } = await supabase
      .from('tables')
      .select('*')
      .eq('restaurant_id', resId);
    if (e) { setError(e.message); return; }
    setDbTables(data ?? []);
  }, []);

  // ── Fetch reservations for date ──────────────────────────────────────────

  const fetchReservations = useCallback(async (resId: string, date: string): Promise<void> => {
    const { data, error: e } = await supabase
      .from('reservations')
      .select('*, guests(*), shifts(*)')
      .eq('restaurant_id', resId)
      .eq('date', date)
      .not('status', 'in', '("cancelled","noshow","completed")')
      .order('time_slot', { ascending: true });
    if (e) { setError(e.message); return; }
    setReservations((data as unknown as ReservationWithJoins[] | null) ?? []);
    setError(null);
  }, []);

  const refresh = useCallback((): void => {
    if (!restaurantIdRef.current) return;
    void fetchTables(restaurantIdRef.current);
    void fetchReservations(restaurantIdRef.current, selectedDateRef.current);
  }, [fetchTables, fetchReservations]);

  // ── Initial load ─────────────────────────────────────────────────────────

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
        await Promise.all([
          fetchTables(profile.restaurant_id),
          fetchReservations(profile.restaurant_id, selectedDateRef.current),
        ]);
      } finally {
        setLoading(false);
      }
    };
    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Reload reservations when date changes ────────────────────────────────

  useEffect(() => {
    if (restaurantIdRef.current) {
      void fetchReservations(restaurantIdRef.current, selectedDate);
    }
  }, [selectedDate, fetchReservations]);

  // ── Realtime ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!restaurantId) return;

    const cleanup = () => {
      if (channelResRef.current) { void supabase.removeChannel(channelResRef.current); channelResRef.current = null; }
      if (channelTabRef.current) { void supabase.removeChannel(channelTabRef.current); channelTabRef.current = null; }
    };
    cleanup();

    channelResRef.current = supabase
      .channel('floor-reservations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations', filter: `restaurant_id=eq.${restaurantId}` }, () => {
        if (restaurantIdRef.current) void fetchReservations(restaurantIdRef.current, selectedDateRef.current);
      })
      .subscribe();

    channelTabRef.current = supabase
      .channel('floor-tables')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables', filter: `restaurant_id=eq.${restaurantId}` }, () => {
        if (restaurantIdRef.current) void fetchTables(restaurantIdRef.current);
      })
      .subscribe();

    return cleanup;
  }, [restaurantId, fetchReservations, fetchTables]);

  // ── Assign reservation to table ──────────────────────────────────────────

  const assignReservationToTable = useCallback(async (reservationId: string, tableId: string): Promise<void> => {
    const { error: e } = await supabase
      .from('reservations')
      .update({ table_id: tableId })
      .eq('id', reservationId);
    if (e) { setError(e.message); return; }
    refresh();
  }, [refresh]);

  // ── Join layout + DB state + reservations ────────────────────────────────

  const filteredReservations = reservations.filter((r) => matchesService(r, serviceFilter));

  const dbByLabel = new Map<string, TableRow>(dbTables.map((t) => [t.label, t]));
  const resByTableId = new Map<string, ReservationWithJoins>();
  for (const res of filteredReservations) {
    if (res.table_id) resByTableId.set(res.table_id, res);
  }

  const tables: FloorTableWithState[] = LA_MAISON_FLOOR_TABLES.map((layout) => {
    const dbRow   = dbByLabel.get(String(layout.id));
    const res     = dbRow ? resByTableId.get(dbRow.id) : undefined;
    const status  = computeStatus(dbRow, res);

    let reservation: FloorPlanReservation | null = null;
    if (res) {
      const guest = res.guests;
      const guestName = guest
        ? [guest.first_name, guest.last_name].filter(Boolean).join(' ') || null
        : null;
      reservation = {
        id:        res.id,
        timeSlot:  res.time_slot,
        partySize: res.party_size,
        status:    res.status,
        guestName,
        shiftName: res.shifts?.name ?? null,
      };
    }

    return {
      ...layout,
      dbId:           dbRow?.id ?? null,
      dbStatus:       dbRow?.status ?? 'free',
      computedStatus: status,
      reservation,
    };
  });

  return {
    loading,
    error,
    tables,
    labels: LA_MAISON_FLOOR_LABELS,
    reservations: filteredReservations,
    selectedDate,
    setSelectedDate,
    serviceFilter,
    setServiceFilter,
    selectedTable,
    setSelectedTable,
    refresh,
    assignReservationToTable,
  };
}

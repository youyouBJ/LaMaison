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
import type { Database, ReservationStatus } from '../types/database';

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

function matchesService(res: ReservationWithJoins, filter: FloorServiceFilter): boolean {
  if (filter === 'all') return true;
  const shiftName = res.shifts?.name?.toLowerCase() ?? '';
  if (filter === 'lunch') {
    if (shiftName.includes('déjeuner') || shiftName.includes('lunch') || shiftName.includes('midi')) return true;
    return timeInRange(res.time_slot, LUNCH_START, LUNCH_END);
  }
  if (shiftName.includes('dîner') || shiftName.includes('dinner') || shiftName.includes('soir')) return true;
  return timeInRange(res.time_slot, DINNER_START, DINNER_END);
}

// ─── Status helpers ───────────────────────────────────────────────────────────

// Priority for picking the "best" reservation to determine visual table status.
// seated > confirmed > pending (higher = wins).
const STATUS_PRIORITY: Record<string, number> = { seated: 3, confirmed: 2, pending: 1 };

function computeTableStatus(
  tableRow: TableRow | undefined,
  reservationStatus: string | undefined,
): FloorTableStatus {
  if (!tableRow || tableRow.status === 'unavailable') return 'unavailable';
  if (!reservationStatus) return 'free';
  if (reservationStatus === 'seated') return 'occupied';
  if (reservationStatus === 'confirmed' || reservationStatus === 'pending') return 'reserved';
  return 'free';
}

// ─── Hook interface ───────────────────────────────────────────────────────────

export interface UseFloorPlanResult {
  loading: boolean;
  error: string | null;
  actionError: string | null;
  updatingReservationId: string | null;
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
  updateReservationStatus: (reservationId: string, status: ReservationStatus) => Promise<boolean>;
  seatReservation: (reservationId: string) => Promise<boolean>;
  completeReservation: (reservationId: string) => Promise<boolean>;
  markNoShow: (reservationId: string) => Promise<boolean>;
  cancelReservation: (reservationId: string) => Promise<boolean>;
  clearActionError: () => void;
}

type RtEntry = { reservation_id: string; table_id: string };

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useFloorPlan(): UseFloorPlanResult {
  const [loading, setLoading]                           = useState(true);
  const [error, setError]                               = useState<string | null>(null);
  const [actionError, setActionError]                   = useState<string | null>(null);
  const [updatingReservationId, setUpdatingReservationId] = useState<string | null>(null);
  const [dbTables, setDbTables]                         = useState<TableRow[]>([]);
  const [reservations, setReservations]                 = useState<ReservationWithJoins[]>([]);
  const [rtEntries, setRtEntries]                       = useState<RtEntry[]>([]);
  const [selectedDate, setSelectedDate]                 = useState(getTodayDateString());
  const [serviceFilter, setServiceFilter]               = useState<FloorServiceFilter>('all');
  // Store layout id (number) instead of full object — selectedTable derived freshly each render.
  const [selectedTableLayoutId, setSelectedTableLayoutId] = useState<number | null>(null);
  const [restaurantId, setRestaurantId]                 = useState<string | null>(null);

  const restaurantIdRef = useRef<string | null>(null);
  const selectedDateRef = useRef(selectedDate);
  const channelResRef   = useRef<RealtimeChannel | null>(null);
  const channelTabRef   = useRef<RealtimeChannel | null>(null);

  useEffect(() => { selectedDateRef.current = selectedDate; }, [selectedDate]);

  // ── Fetch tables ──────────────────────────────────────────────────────────

  const fetchTables = useCallback(async (resId: string): Promise<void> => {
    const { data, error: e } = await supabase
      .from('tables')
      .select('*')
      .eq('restaurant_id', resId);
    if (e) { setError(e.message); return; }
    setDbTables(data ?? []);
  }, []);

  // ── Fetch reservations + reservation_tables ───────────────────────────────

  const fetchReservations = useCallback(async (resId: string, date: string): Promise<void> => {
    const { data, error: e } = await supabase
      .from('reservations')
      .select('*, guests(*), shifts(*)')
      .eq('restaurant_id', resId)
      .eq('date', date)
      .not('status', 'in', '("cancelled","noshow","completed")')
      .order('time_slot', { ascending: true });
    if (e) { setError(e.message); return; }
    const rows = (data as unknown as ReservationWithJoins[] | null) ?? [];
    setReservations(rows);
    setError(null);

    // Enrich with secondary tables (silently ignore pre-migration)
    const ids = rows.map((r) => r.id);
    if (ids.length > 0) {
      const { data: rtData } = await supabase
        .from('reservation_tables')
        .select('reservation_id, table_id')
        .in('reservation_id', ids);
      setRtEntries((rtData as RtEntry[] | null) ?? []);
    } else {
      setRtEntries([]);
    }
  }, []);

  const refresh = useCallback((): void => {
    if (!restaurantIdRef.current) return;
    void fetchTables(restaurantIdRef.current);
    void fetchReservations(restaurantIdRef.current, selectedDateRef.current);
  }, [fetchTables, fetchReservations]);

  // ── Initial load ──────────────────────────────────────────────────────────

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

  // ── Reload on date change ─────────────────────────────────────────────────

  useEffect(() => {
    if (restaurantIdRef.current) {
      void fetchReservations(restaurantIdRef.current, selectedDate);
    }
  }, [selectedDate, fetchReservations]);

  // ── Realtime ──────────────────────────────────────────────────────────────

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

  // ── Assign reservation to table ───────────────────────────────────────────

  const assignReservationToTable = useCallback(async (reservationId: string, tableId: string): Promise<void> => {
    const { error: e } = await supabase
      .from('reservations')
      .update({ table_id: tableId })
      .eq('id', reservationId);
    if (e) { setError(e.message); return; }
    refresh();
  }, [refresh]);

  // ── Status update actions ─────────────────────────────────────────────────

  const updateReservationStatus = useCallback(async (
    reservationId: string,
    status: ReservationStatus,
  ): Promise<boolean> => {
    setUpdatingReservationId(reservationId);
    setActionError(null);
    try {
      const { error: e } = await supabase
        .from('reservations')
        .update({ status })
        .eq('id', reservationId);
      if (e) { setActionError(e.message); return false; }
      refresh();
      return true;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erreur inconnue.');
      return false;
    } finally {
      setUpdatingReservationId(null);
    }
  }, [refresh]);

  const seatReservation     = useCallback((id: string) => updateReservationStatus(id, 'seated'),    [updateReservationStatus]);
  const completeReservation = useCallback((id: string) => updateReservationStatus(id, 'completed'), [updateReservationStatus]);
  const markNoShow          = useCallback((id: string) => updateReservationStatus(id, 'noshow'),    [updateReservationStatus]);
  const cancelReservation   = useCallback((id: string) => updateReservationStatus(id, 'cancelled'), [updateReservationStatus]);

  const clearActionError = useCallback(() => setActionError(null), []);

  // ── Join layout + DB state + reservations ─────────────────────────────────

  const filteredReservations = reservations.filter((r) => matchesService(r, serviceFilter));
  const filteredResIds       = new Set(filteredReservations.map((r) => r.id));
  const resById              = new Map(filteredReservations.map((r) => [r.id, r]));
  const dbById               = new Map<string, TableRow>(dbTables.map((t) => [t.id, t]));
  const dbByLabel            = new Map<string, TableRow>(dbTables.map((t) => [t.label, t]));

  // Compute display table-labels per reservation (for multi-table display in panel)
  const tableLabelsForRes = new Map<string, string[]>();
  for (const res of filteredReservations) {
    if (res.table_id) {
      const t = dbById.get(res.table_id);
      if (t) {
        const labels = tableLabelsForRes.get(res.id) ?? [];
        if (!labels.includes(t.label)) labels.push(t.label);
        tableLabelsForRes.set(res.id, labels);
      }
    }
  }
  for (const rt of rtEntries) {
    if (filteredResIds.has(rt.reservation_id)) {
      const t = dbById.get(rt.table_id);
      if (t) {
        const labels = tableLabelsForRes.get(rt.reservation_id) ?? [];
        if (!labels.includes(t.label)) labels.push(t.label);
        tableLabelsForRes.set(rt.reservation_id, labels);
      }
    }
  }

  // Build reservationsByTableId — multiple reservations possible per table in a day
  const reservationsByTableId = new Map<string, ReservationWithJoins[]>();
  for (const res of filteredReservations) {
    if (res.table_id) {
      const existing = reservationsByTableId.get(res.table_id) ?? [];
      existing.push(res);
      reservationsByTableId.set(res.table_id, existing);
    }
  }
  for (const rt of rtEntries) {
    if (filteredResIds.has(rt.reservation_id)) {
      const res = resById.get(rt.reservation_id);
      if (res) {
        const existing = reservationsByTableId.get(rt.table_id) ?? [];
        if (!existing.some((r) => r.id === res.id)) {
          existing.push(res);
          reservationsByTableId.set(rt.table_id, existing);
        }
      }
    }
  }

  // Convert DB row to FloorPlanReservation summary
  function toFloorPlanReservation(res: ReservationWithJoins): FloorPlanReservation {
    const guest     = res.guests;
    const guestName = guest
      ? [guest.first_name, guest.last_name].filter(Boolean).join(' ') || null
      : null;
    return {
      id:          res.id,
      timeSlot:    res.time_slot,
      partySize:   res.party_size,
      status:      res.status,
      source:      res.source,
      guestName,
      guestPhone:  res.guests?.phone ?? null,
      shiftName:   res.shifts?.name ?? null,
      notes:       res.notes,
      tableLabels: tableLabelsForRes.get(res.id) ?? [],
    };
  }

  // Build FloorTableWithState array
  const tables: FloorTableWithState[] = LA_MAISON_FLOOR_TABLES.map((layout) => {
    const dbRow       = dbByLabel.get(String(layout.id));
    const resForTable = dbRow ? (reservationsByTableId.get(dbRow.id) ?? []) : [];

    // Pick highest-priority reservation for visual status
    const bestRes = resForTable.reduce<ReservationWithJoins | null>((best, r) => {
      if (!best) return r;
      return (STATUS_PRIORITY[r.status] ?? 0) > (STATUS_PRIORITY[best.status] ?? 0) ? r : best;
    }, null);

    const computedStatus = computeTableStatus(dbRow, bestRes?.status);

    const floorReservations = resForTable
      .slice()
      .sort((a, b) => a.time_slot.localeCompare(b.time_slot))
      .map(toFloorPlanReservation);

    return {
      ...layout,
      dbId:           dbRow?.id ?? null,
      dbStatus:       dbRow?.status ?? 'free',
      computedStatus,
      reservation:    floorReservations[0] ?? null,
      reservations:   floorReservations,
    };
  });

  // selectedTable is derived from the fresh tables array — never stale after refresh
  const selectedTable = selectedTableLayoutId !== null
    ? (tables.find((t) => t.id === selectedTableLayoutId) ?? null)
    : null;

  const setSelectedTable = useCallback((t: FloorTableWithState | null) => {
    setSelectedTableLayoutId(t?.id ?? null);
  }, []);

  return {
    loading,
    error,
    actionError,
    updatingReservationId,
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
    updateReservationStatus,
    seatReservation,
    completeReservation,
    markNoShow,
    cancelReservation,
    clearActionError,
  };
}

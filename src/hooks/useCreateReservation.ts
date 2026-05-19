import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';
import { isTimeSlotInShift } from '../utils/reservationSlots';

type ShiftRow = Database['public']['Tables']['shifts']['Row'];
type TableRow = Database['public']['Tables']['tables']['Row'];
type GuestRow = Database['public']['Tables']['guests']['Row'];

export type { ShiftRow, TableRow, GuestRow };

export type CreateReservationInput = {
  date:      string;
  timeSlot:  string;            // HH:MM
  partySize: number;
  shiftId:   string;
  notes?:    string;
  status:    'confirmed' | 'pending' | 'seated';
  // Table(s) — tableIds prend le dessus sur tableId si fourni.
  // tableId est conservé pour compatibilité ascendante.
  tableId?:  string;
  tableIds?: string[];
  // Walk-in : guest_id = null, source = 'walkin'
  isWalkIn?: boolean;
  // Soit guestId (existant), soit guest (nouveau) — ignorés si isWalkIn = true.
  guestId?:  string;
  guest?: {
    firstName?: string;
    lastName?:  string;
    phone?:     string;
    email?:     string;
    notes?:     string;
    vip?:       boolean;
  };
};

export function useCreateReservation() {
  const [loading, setLoading]                       = useState(true);
  const [submitting, setSubmitting]                 = useState(false);
  const [searchLoading, setSearchLoading]           = useState(false);
  const [error, setError]                           = useState<string | null>(null);
  const [shifts, setShifts]                         = useState<ShiftRow[]>([]);
  const [tables, setTables]                         = useState<TableRow[]>([]);
  const [guestSearchResults, setGuestSearchResults] = useState<GuestRow[]>([]);

  const restaurantIdRef = useRef<string | null>(null);
  const userIdRef       = useRef<string | null>(null);
  const shiftsRef       = useRef<ShiftRow[]>([]);

  const loadInitialData = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) { setError('Session expirée. Reconnectez-vous.'); return; }
      userIdRef.current = userData.user.id;

      const { data: profile, error: profileError } = await supabase
        .from('users').select('restaurant_id').eq('id', userData.user.id).single();
      if (profileError || !profile) { setError('Profil introuvable.'); return; }
      restaurantIdRef.current = profile.restaurant_id;

      const [{ data: shiftsData }, { data: tablesData }] = await Promise.all([
        supabase.from('shifts').select('*').eq('restaurant_id', profile.restaurant_id).order('start_time'),
        supabase.from('tables').select('*').eq('restaurant_id', profile.restaurant_id).order('label'),
      ]);
      shiftsRef.current = shiftsData ?? [];
      setShifts(shiftsData ?? []);
      setTables(tablesData ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  const searchGuests = useCallback(async (query: string): Promise<void> => {
    const resId = restaurantIdRef.current;
    if (!resId || query.trim().length < 2) { setGuestSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const q = query.trim();
      const { data } = await supabase
        .from('guests')
        .select('*')
        .eq('restaurant_id', resId)
        .or(`phone.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(10);
      setGuestSearchResults(data ?? []);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const createReservation = useCallback(async (input: CreateReservationInput): Promise<string> => {
    const resId = restaurantIdRef.current;
    const uid   = userIdRef.current;
    if (!resId || !uid) throw new Error('Non connecté.');

    setSubmitting(true);
    setError(null);
    try {
      // ── Validation ──────────────────────────────────────────────────────
      if (!input.date || !input.shiftId || !input.timeSlot) {
        throw new Error('Date, service et créneau sont obligatoires.');
      }
      if (input.partySize <= 0) throw new Error('Nombre de couverts invalide.');

      const validStatuses: string[] = ['confirmed', 'pending', 'seated'];
      if (!validStatuses.includes(input.status)) {
        throw new Error('Statut invalide.');
      }

      const shift = shiftsRef.current.find((s) => s.id === input.shiftId);
      if (!shift) throw new Error('Service introuvable.');
      if (!isTimeSlotInShift(input.timeSlot, shift)) {
        throw new Error('Créneau non disponible pour ce service.');
      }

      // ── Vérification capacité par créneau ────────────────────────────────
      const normalizedSlot = `${input.timeSlot.substring(0, 5)}:00`;
      const { data: slotData } = await supabase
        .from('reservations')
        .select('party_size')
        .eq('restaurant_id', resId)
        .eq('date', input.date)
        .eq('time_slot', normalizedSlot)
        .neq('status', 'cancelled')
        .neq('status', 'noshow');

      const existingCovers = (slotData ?? []).reduce((s, r) => s + r.party_size, 0);
      if (existingCovers + input.partySize > shift.max_covers_per_slot) {
        throw new Error(
          `Créneau complet : ${existingCovers}/${shift.max_covers_per_slot} couverts déjà réservés.`,
        );
      }

      // ── Déterminer les tables ─────────────────────────────────────────────
      // tableIds prend le dessus sur tableId.
      const tableIdsToInsert: string[] =
        input.tableIds && input.tableIds.length > 0
          ? input.tableIds
          : input.tableId
            ? [input.tableId]
            : [];
      const primaryTableId = tableIdsToInsert[0] ?? null;

      // ── Guest ─────────────────────────────────────────────────────────────
      // Walk-in : pas de guest, source = 'walkin'.
      let guestId: string | null = null;
      const source = input.isWalkIn ? 'walkin' : 'phone';

      if (!input.isWalkIn) {
        guestId = input.guestId ?? null;
        if (!guestId && input.guest) {
          const { data: newGuest, error: guestError } = await supabase
            .from('guests')
            .insert({
              restaurant_id: resId,
              first_name:    input.guest.firstName ?? null,
              last_name:     input.guest.lastName  ?? null,
              phone:         input.guest.phone     ?? null,
              email:         input.guest.email     ?? null,
              notes:         input.guest.notes     ?? null,
              vip:           input.guest.vip       ?? false,
              source:        'manual',
            })
            .select('id')
            .single();
          if (guestError) throw new Error(`Erreur création client : ${guestError.message}`);
          guestId = newGuest.id;
        }
      }

      // ── Créer la réservation ──────────────────────────────────────────────
      if (__DEV__) {
        console.log('[createReservation] status envoyé à Supabase :', input.status);
      }
      const { data: newRes, error: resError } = await supabase
        .from('reservations')
        .insert({
          restaurant_id: resId,
          guest_id:      guestId,
          table_id:      primaryTableId,
          shift_id:      input.shiftId,
          date:          input.date,
          time_slot:     normalizedSlot,
          party_size:    input.partySize,
          status:        input.status,
          notes:         input.notes ?? null,
          source,
          created_by:    uid,
        })
        .select('id')
        .single();
      if (resError) throw new Error(`Erreur création réservation : ${resError.message}`);

      // ── Insérer dans reservation_tables ───────────────────────────────────
      // Silencieusement ignoré en pré-migration (table inexistante).
      if (tableIdsToInsert.length > 0) {
        await supabase
          .from('reservation_tables')
          .insert(
            tableIdsToInsert.map((tid) => ({
              reservation_id: newRes.id,
              table_id:       tid,
              restaurant_id:  resId,
            })),
          );
        // L'erreur éventuelle (table non encore créée) n'est pas levée :
        // la réservation est déjà créée et son ID est valide.
      }

      return newRes.id;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => { void loadInitialData(); }, [loadInitialData]);

  return {
    loading,
    submitting,
    searchLoading,
    error,
    shifts,
    tables,
    guestSearchResults,
    searchGuests,
    createReservation,
    clearError,
    setError,
  };
}

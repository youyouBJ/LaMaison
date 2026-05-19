import { useState, useEffect, useCallback, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { getTodayDateString } from '../utils/date';
import type {
  WaitlistEntryWithGuest,
  WaitlistServiceFilter,
  CreateWaitlistInput,
} from '../types/waitlist';
import type { Database } from '../types/database';

type ShiftRow = Database['public']['Tables']['shifts']['Row'];
type GuestRow = Database['public']['Tables']['guests']['Row'];

// ── Service filter helpers ────────────────────────────────────────────────────

function matchesWaitlistService(
  entry: WaitlistEntryWithGuest,
  filter: WaitlistServiceFilter,
): boolean {
  if (filter === 'all') return true;

  if (entry.shifts?.name) {
    const name = entry.shifts.name.toLowerCase();
    if (filter === 'lunch') {
      return (
        name.includes('déjeuner') ||
        name.includes('dejeuner') ||
        name.includes('lunch') ||
        name.includes('midi')
      );
    }
    return (
      name.includes('dîner') ||
      name.includes('diner') ||
      name.includes('dinner') ||
      name.includes('soir')
    );
  }

  if (entry.time_slot) {
    const h = parseInt(entry.time_slot.substring(0, 2), 10);
    if (filter === 'lunch') return h >= 12 && h <= 16;
    return h >= 17;
  }

  return false;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useWaitlist() {
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [entries, setEntries]               = useState<WaitlistEntryWithGuest[]>([]);
  const [selectedDate, setSelectedDate]     = useState(getTodayDateString());
  const [serviceFilter, setServiceFilter]   = useState<WaitlistServiceFilter>('all');
  const [shifts, setShifts]                 = useState<ShiftRow[]>([]);
  const [guestSearchResults, setGuestSearchResults] = useState<GuestRow[]>([]);
  const [searchLoading, setSearchLoading]   = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionError, setActionError]       = useState<string | null>(null);

  const restaurantIdRef  = useRef<string | null>(null);
  const userIdRef        = useRef<string | null>(null);
  const selectedDateRef  = useRef(selectedDate);
  const channelRef       = useRef<RealtimeChannel | null>(null);

  useEffect(() => { selectedDateRef.current = selectedDate; }, [selectedDate]);

  // ── Fetch waitlist for a given date ────────────────────────────────────────

  const fetchEntries = useCallback(async (resId: string, date: string): Promise<void> => {
    const { data, error: fetchError } = await supabase
      .from('waitlist')
      .select('*, guests(*), shifts(*)')
      .eq('restaurant_id', resId)
      .eq('date', date)
      .order('created_at', { ascending: true });

    if (fetchError) { setError(fetchError.message); return; }
    setEntries((data as unknown as WaitlistEntryWithGuest[]) ?? []);
    setError(null);
  }, []);

  // ── Init: auth + profile + shifts ──────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) { setError('Session expirée. Reconnectez-vous.'); return; }
        userIdRef.current = userData.user.id;

        const { data: profile, error: profileError } = await supabase
          .from('users').select('restaurant_id').eq('id', userData.user.id).single();
        if (profileError || !profile) { setError('Profil introuvable.'); return; }
        restaurantIdRef.current = profile.restaurant_id;

        const { data: shiftsData } = await supabase
          .from('shifts')
          .select('*')
          .eq('restaurant_id', profile.restaurant_id)
          .order('start_time');
        setShifts(shiftsData ?? []);

        await fetchEntries(profile.restaurant_id, selectedDateRef.current);
      } finally {
        setLoading(false);
      }
    };
    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // once on mount

  // ── Reload on date change ───────────────────────────────────────────────────

  useEffect(() => {
    if (restaurantIdRef.current) {
      void fetchEntries(restaurantIdRef.current, selectedDate);
    }
  }, [selectedDate, fetchEntries]);

  // ── Realtime ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const resId = restaurantIdRef.current;
    if (!resId) return;
    if (channelRef.current) { void supabase.removeChannel(channelRef.current); }

    channelRef.current = supabase
      .channel('waitlist-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'waitlist', filter: `restaurant_id=eq.${resId}` },
        () => {
          if (restaurantIdRef.current) {
            void fetchEntries(restaurantIdRef.current, selectedDateRef.current);
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
  }, [fetchEntries]);

  // ── Filtered entries (client-side service filter) ──────────────────────────

  const filteredEntries = entries.filter((e) => matchesWaitlistService(e, serviceFilter));

  // ── Refresh ─────────────────────────────────────────────────────────────────

  const refresh = useCallback(() => {
    if (restaurantIdRef.current) {
      void fetchEntries(restaurantIdRef.current, selectedDateRef.current);
    }
  }, [fetchEntries]);

  // ── Search guests ───────────────────────────────────────────────────────────

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

  // ── Create entry ────────────────────────────────────────────────────────────

  const createWaitlistEntry = useCallback(async (input: CreateWaitlistInput): Promise<void> => {
    const resId = restaurantIdRef.current;
    const uid   = userIdRef.current;
    if (!resId || !uid) throw new Error('Non connecté.');

    if (!input.date) throw new Error('Date obligatoire.');
    if (input.partySize <= 0) throw new Error('Nombre de couverts invalide.');

    let guestId: string | null = null;

    if (!input.isWalkIn) {
      if (input.guestId) {
        guestId = input.guestId;
      } else if (input.guest && (input.guest.firstName || input.guest.lastName || input.guest.phone)) {
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

    const normalizedTimeSlot = input.timeSlot
      ? `${input.timeSlot.substring(0, 5)}:00`
      : null;

    const { error: insertError } = await supabase
      .from('waitlist')
      .insert({
        restaurant_id: resId,
        guest_id:      guestId,
        shift_id:      input.shiftId ?? null,
        date:          input.date,
        time_slot:     normalizedTimeSlot,
        party_size:    input.partySize,
        status:        'waiting',
        notes:         input.notes ?? null,
      });

    if (insertError) throw new Error(`Erreur ajout waitlist : ${insertError.message}`);
    await fetchEntries(resId, selectedDateRef.current);
  }, [fetchEntries]);

  // ── Update status ───────────────────────────────────────────────────────────

  const updateWaitlistStatus = useCallback(async (
    id: string,
    status: 'waiting' | 'notified' | 'seated' | 'left',
  ): Promise<void> => {
    const resId = restaurantIdRef.current;
    if (!resId) return;
    setActionLoadingId(id);
    setActionError(null);
    try {
      const { error: updateError } = await supabase
        .from('waitlist')
        .update({ status })
        .eq('id', id)
        .eq('restaurant_id', resId);
      if (updateError) throw new Error(updateError.message);
      await fetchEntries(resId, selectedDateRef.current);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setActionLoadingId(null);
    }
  }, [fetchEntries]);

  const markWaiting  = useCallback((id: string) => updateWaitlistStatus(id, 'waiting'),  [updateWaitlistStatus]);
  const markNotified = useCallback((id: string) => updateWaitlistStatus(id, 'notified'), [updateWaitlistStatus]);
  const markSeated   = useCallback((id: string) => updateWaitlistStatus(id, 'seated'),   [updateWaitlistStatus]);
  const markLeft     = useCallback((id: string) => updateWaitlistStatus(id, 'left'),     [updateWaitlistStatus]);

  // ── Convert to reservation ─────────────────────────────────────────────────
  // targetStatus : 'confirmed' → waitlist passe en 'notified'
  //                'seated'    → waitlist passe en 'seated'

  const convertToReservation = useCallback(async (
    entryId:      string,
    targetStatus: 'confirmed' | 'seated',
  ): Promise<string> => {
    const resId = restaurantIdRef.current;
    const uid   = userIdRef.current;
    if (!resId || !uid) throw new Error('Non connecté.');

    // Chercher d'abord dans les entrées filtrées, sinon dans toutes
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) throw new Error('Entrée introuvable.');

    setActionLoadingId(entryId);
    setActionError(null);
    try {
      // Déterminer le créneau horaire pour la réservation
      let timeSlot: string;
      if (entry.time_slot) {
        timeSlot = `${entry.time_slot.substring(0, 5)}:00`;
      } else if (entry.shifts) {
        timeSlot = `${entry.shifts.start_time.substring(0, 5)}:00`;
      } else {
        timeSlot = '19:00:00';
      }

      const source: 'walkin' | 'phone' | 'manual' =
        entry.guest_id === null ? 'walkin' : 'phone';

      const { data: newRes, error: resError } = await supabase
        .from('reservations')
        .insert({
          restaurant_id: resId,
          guest_id:      entry.guest_id,
          shift_id:      entry.shift_id,
          date:          entry.date,
          time_slot:     timeSlot,
          party_size:    entry.party_size,
          status:        targetStatus,
          notes:         entry.notes,
          source,
          created_by:    uid,
        })
        .select('id')
        .single();

      if (resError) throw new Error(`Erreur création réservation : ${resError.message}`);

      // Waitlist status reflète la suite :
      // seated → installé (convertion directe)
      // confirmed → notifié (il a une réservation confirmée, pas encore installé)
      const waitlistStatus: 'seated' | 'notified' =
        targetStatus === 'seated' ? 'seated' : 'notified';

      await supabase
        .from('waitlist')
        .update({ status: waitlistStatus })
        .eq('id', entryId)
        .eq('restaurant_id', resId);

      await fetchEntries(resId, selectedDateRef.current);
      return newRes.id;
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erreur inconnue');
      throw e;
    } finally {
      setActionLoadingId(null);
    }
  }, [entries, fetchEntries]);

  return {
    loading,
    error,
    entries: filteredEntries,
    allEntries: entries,
    selectedDate,
    setSelectedDate,
    serviceFilter,
    setServiceFilter,
    shifts,
    refresh,
    createWaitlistEntry,
    updateWaitlistStatus,
    markWaiting,
    markNotified,
    markSeated,
    markLeft,
    convertToReservation,
    searchGuests,
    guestSearchResults,
    searchLoading,
    actionLoadingId,
    actionError,
    restaurantId: restaurantIdRef.current,
  };
}

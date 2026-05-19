import { useState, useEffect, useCallback, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type GuestRow       = Database['public']['Tables']['guests']['Row'];
type ReservationRow = Database['public']['Tables']['reservations']['Row'];
type TableRow       = Database['public']['Tables']['tables']['Row'];
type ShiftRow       = Database['public']['Tables']['shifts']['Row'];

export type ReservationWithDetail = ReservationRow & {
  tables: TableRow | null;
  shifts: ShiftRow | null;
};

export type UpdateGuestInput = {
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  tags?: string[];
  marketing_opt_in?: boolean;
};

const RESERVATION_LIMIT = 10;

type LinkedCounts = { reservationCount: number; waitlistCount: number };
type DeleteResult = { ok: true } | { ok: false; errorMessage: string };

export function useGuestDetail(guestId: string) {
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [guest, setGuest]       = useState<GuestRow | null>(null);
  const [reservations, setReservations] = useState<ReservationWithDetail[]>([]);
  const channelRef              = useRef<RealtimeChannel | null>(null);

  const fetchGuest = useCallback(async (): Promise<void> => {
    const [{ data: guestData, error: guestError }, { data: resData, error: resError }] =
      await Promise.all([
        supabase.from('guests').select('*').eq('id', guestId).single(),
        supabase
          .from('reservations')
          .select('*, tables(*), shifts(*)')
          .eq('guest_id', guestId)
          .order('date', { ascending: false })
          .order('time_slot', { ascending: false })
          .limit(RESERVATION_LIMIT),
      ]);

    if (guestError) { setError(guestError.message); return; }
    if (resError)   { setError(resError.message);   return; }
    setGuest(guestData);
    setReservations((resData ?? []) as unknown as ReservationWithDetail[]);
    setError(null);
  }, [guestId]);

  // Retourne true si la mise à jour a réussi.
  const updateGuest = useCallback(async (input: UpdateGuestInput): Promise<boolean> => {
    setSaving(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('guests')
        .update(input)
        .eq('id', guestId);
      if (updateError) { setError(updateError.message); return false; }
      await fetchGuest();
      return true;
    } finally {
      setSaving(false);
    }
  }, [guestId, fetchGuest]);

  const toggleVip = useCallback(async (): Promise<void> => {
    if (!guest) return;
    setSaving(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('guests')
        .update({ vip: !guest.vip })
        .eq('id', guestId);
      if (updateError) { setError(updateError.message); return; }
      await fetchGuest();
    } finally {
      setSaving(false);
    }
  }, [guestId, guest, fetchGuest]);

  const refresh = useCallback(() => { void fetchGuest(); }, [fetchGuest]);

  const fetchLinkedCounts = useCallback(async (): Promise<LinkedCounts | null> => {
    const [{ count: resCount, error: resError }, { count: wlCount, error: wlError }] =
      await Promise.all([
        supabase.from('reservations').select('id', { count: 'exact', head: true }).eq('guest_id', guestId),
        supabase.from('waitlist').select('id', { count: 'exact', head: true }).eq('guest_id', guestId),
      ]);
    if (resError || wlError) return null;
    return { reservationCount: resCount ?? 0, waitlistCount: wlCount ?? 0 };
  }, [guestId]);

  const deleteGuest = useCallback(async (): Promise<DeleteResult> => {
    setDeleting(true);
    setError(null);
    try {
      const { error: deleteError } = await supabase.from('guests').delete().eq('id', guestId);
      if (deleteError) {
        setError(deleteError.message);
        return { ok: false, errorMessage: deleteError.message };
      }
      return { ok: true };
    } finally {
      setDeleting(false);
    }
  }, [guestId]);

  // Realtime sur le client courant
  useEffect(() => {
    channelRef.current = supabase
      .channel(`guest-detail-${guestId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'guests', filter: `id=eq.${guestId}` },
        () => { void fetchGuest(); },
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [guestId, fetchGuest]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try { await fetchGuest(); }
      finally { setLoading(false); }
    })();
  }, [fetchGuest]);

  return { loading, saving, deleting, error, guest, reservations, refresh, updateGuest, toggleVip, fetchLinkedCounts, deleteGuest };
}

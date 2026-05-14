import { useState, useEffect, useCallback, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { ReservationStatus } from '../types/database';
import type { ReservationWithJoins } from '../types/reservations';

export function useReservationDetail(reservationId: string) {
  const [loading, setLoading]       = useState(true);
  const [updating, setUpdating]     = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [reservation, setReservation] = useState<ReservationWithJoins | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchDetail = useCallback(async (): Promise<void> => {
    const { data, error: fetchError } = await supabase
      .from('reservations')
      .select('*, guests(*), tables(*), shifts(*)')
      .eq('id', reservationId)
      .single();

    if (fetchError) { setError(fetchError.message); return; }
    setReservation(data as unknown as ReservationWithJoins);
    setError(null);
  }, [reservationId]);

  const updateStatus = useCallback(async (status: ReservationStatus): Promise<void> => {
    setUpdating(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('reservations')
        .update({ status })
        .eq('id', reservationId);
      if (updateError) { setError(updateError.message); return; }
      await fetchDetail();
    } finally {
      setUpdating(false);
    }
  }, [reservationId, fetchDetail]);

  const cancelReservation = useCallback(async (): Promise<void> => {
    await updateStatus('cancelled');
  }, [updateStatus]);

  const refresh = useCallback(() => { void fetchDetail(); }, [fetchDetail]);

  // Realtime sur la réservation courante
  useEffect(() => {
    channelRef.current = supabase
      .channel(`reservation-detail-${reservationId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservations', filter: `id=eq.${reservationId}` },
        () => { void fetchDetail(); },
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [reservationId, fetchDetail]);

  // Chargement initial
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try { await fetchDetail(); }
      finally { setLoading(false); }
    };
    void init();
  }, [fetchDetail]);

  return { loading, updating, error, reservation, refresh, updateStatus, cancelReservation };
}

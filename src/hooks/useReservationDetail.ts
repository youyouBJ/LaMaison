import { useState, useEffect, useCallback, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { ReservationStatus, Database } from '../types/database';
import type { ReservationWithJoins, ReservationTableEntry } from '../types/reservations';

type TableRow = Database['public']['Tables']['tables']['Row'];
type RtQueryRow = { id: string; reservation_id: string; table_id: string; tables: TableRow | null };

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
    let row = data as unknown as ReservationWithJoins;

    // Enrich with reservation_tables (silently ignore pre-migration)
    const { data: rtData } = await supabase
      .from('reservation_tables')
      .select('id, reservation_id, table_id, tables(*)')
      .eq('reservation_id', reservationId);

    if (rtData && rtData.length > 0) {
      const rtRows = rtData as unknown as RtQueryRow[];
      const entries: ReservationTableEntry[] = rtRows
        .filter((rt) => rt.tables !== null)
        .map((rt) => ({ id: rt.id, table_id: rt.table_id, tables: rt.tables as TableRow }));
      row = { ...row, reservation_tables: entries };
    }

    setReservation(row);
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

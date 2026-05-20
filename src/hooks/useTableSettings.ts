import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type TableRow = Database['public']['Tables']['tables']['Row'];

export type TableEditFields = {
  label:    string;
  zone:     string;
  capacity: number;
};

export function useTableSettings(restaurantId: string | null) {
  const [savingId, setSavingId]   = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedId, setSavedId]     = useState<string | null>(null);

  const updateTable = useCallback(async (
    tableId:   string,
    fields:    TableEditFields,
    onSuccess: (updated: TableRow) => void,
  ): Promise<void> => {
    if (!restaurantId) {
      setSaveError('Aucun restaurant associé.');
      return;
    }

    setSavingId(tableId);
    setSaveError(null);

    try {
      const { data, error } = await supabase
        .from('tables')
        .update({
          label:    fields.label.trim(),
          zone:     fields.zone.trim(),
          capacity: fields.capacity,
        })
        .eq('id', tableId)
        .eq('restaurant_id', restaurantId)
        .select()
        .single();

      if (error) {
        setSaveError(error.message);
        return;
      }
      if (data) {
        onSuccess(data);
        setSavedId(tableId);
        setTimeout(() => {
          setSavedId(prev => (prev === tableId ? null : prev));
        }, 3000);
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erreur inconnue.');
    } finally {
      setSavingId(null);
    }
  }, [restaurantId]);

  const clearTableError = useCallback((): void => { setSaveError(null); }, []);

  return { savingId, saveError, savedId, updateTable, clearTableError };
}

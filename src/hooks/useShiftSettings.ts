import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type ShiftRow = Database['public']['Tables']['shifts']['Row'];

export type ShiftEditFields = {
  name:                string;
  days_of_week:        number[];
  start_time:          string;
  end_time:            string;
  slot_duration:       number;
  max_covers_per_slot: number;
};

export function useShiftSettings(restaurantId: string | null) {
  const [savingId, setSavingId]   = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedId, setSavedId]     = useState<string | null>(null);

  const updateShift = useCallback(async (
    shiftId:   string,
    fields:    ShiftEditFields,
    onSuccess: (updated: ShiftRow) => void,
  ): Promise<void> => {
    if (!restaurantId) {
      setSaveError('Aucun restaurant associé.');
      return;
    }

    setSavingId(shiftId);
    setSaveError(null);

    try {
      const { data, error } = await supabase
        .from('shifts')
        .update({
          name:                fields.name.trim(),
          days_of_week:        fields.days_of_week,
          start_time:          fields.start_time,
          end_time:            fields.end_time,
          slot_duration:       fields.slot_duration,
          max_covers_per_slot: fields.max_covers_per_slot,
        })
        .eq('id', shiftId)
        .eq('restaurant_id', restaurantId)
        .select()
        .single();

      if (error) {
        setSaveError(error.message);
        return;
      }
      if (data) {
        onSuccess(data);
        setSavedId(shiftId);
        setTimeout(() => {
          setSavedId(prev => (prev === shiftId ? null : prev));
        }, 3000);
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erreur inconnue.');
    } finally {
      setSavingId(null);
    }
  }, [restaurantId]);

  const clearShiftError = useCallback((): void => { setSaveError(null); }, []);

  return { savingId, saveError, savedId, updateShift, clearShiftError };
}

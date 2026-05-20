import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type RestaurantRow = Database['public']['Tables']['restaurants']['Row'];

export type RestaurantEditFields = {
  name:     string;
  address:  string;
  phone:    string;
  email:    string;
  timezone: string;
};

export function useRestaurantSettings(restaurantId: string | null) {
  const [saving, setSaving]           = useState(false);
  const [saveError, setSaveError]     = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const updateRestaurant = useCallback(async (
    fields:    RestaurantEditFields,
    onSuccess: (updated: RestaurantRow) => void,
  ): Promise<void> => {
    if (!restaurantId) {
      setSaveError('Aucun restaurant associé à ce compte.');
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const { data, error } = await supabase
        .from('restaurants')
        .update({
          name:     fields.name.trim(),
          address:  fields.address.trim() || null,
          phone:    fields.phone.trim()   || null,
          email:    fields.email.trim()   || null,
          timezone: fields.timezone.trim() || 'Africa/Tunis',
        })
        .eq('id', restaurantId)
        .select()
        .single();

      if (error) {
        setSaveError(error.message);
        return;
      }
      if (data) {
        onSuccess(data);
        setSaveSuccess(true);
        setTimeout(() => { setSaveSuccess(false); }, 3000);
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erreur inconnue.');
    } finally {
      setSaving(false);
    }
  }, [restaurantId]);

  const clearSaveStatus = useCallback((): void => {
    setSaveError(null);
    setSaveSuccess(false);
  }, []);

  return { saving, saveError, saveSuccess, updateRestaurant, clearSaveStatus };
}

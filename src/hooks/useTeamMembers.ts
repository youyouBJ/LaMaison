import { useState, useEffect, useCallback } from 'react';
import { supabase }                          from '../lib/supabase';
import type { UserRole }                     from '../types/database';

export type TeamMember = {
  id:       string;
  fullName: string;
  role:     UserRole;
};

type UsersRow = {
  id:        string;
  full_name: string;
  role:      UserRole;
};

export function useTeamMembers(restaurantId: string | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);

  const load = useCallback(async (): Promise<void> => {
    if (!restaurantId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await supabase
        .from('users')
        .select('id, full_name, role')
        .eq('restaurant_id', restaurantId)
        .order('full_name')
        .returns<UsersRow[]>();

      if (queryError) {
        setError("Impossible de charger les membres de l'équipe.");
        return;
      }
      setMembers(
        (data ?? []).map(u => ({ id: u.id, fullName: u.full_name, role: u.role }))
      );
    } catch {
      setError('Erreur inconnue.');
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => { void load(); }, [load]);

  return { loading, error, members, refresh: load };
}

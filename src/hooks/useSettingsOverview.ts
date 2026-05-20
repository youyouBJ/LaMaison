import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type RestaurantRow = Database['public']['Tables']['restaurants']['Row'];
type ShiftRow      = Database['public']['Tables']['shifts']['Row'];
type TableRow      = Database['public']['Tables']['tables']['Row'];

export type ZoneSummary = {
  name: string;
  tableCount: number;
};

export type FloorSummary = {
  totalTables: number;
  zoneCount: number;
  zones: ZoneSummary[];
};

export type GuestCounts = {
  total: number;
  vip: number;
  withPhone: number;
  withEmail: number;
};

export type UserProfile = {
  fullName: string;
  role: string;
  restaurantName: string;
  email: string | null;
};

export type SettingsData = {
  restaurant: RestaurantRow;
  userProfile: UserProfile;
  shifts: ShiftRow[];
  floor: FloorSummary;
  guests: GuestCounts;
  tableRows: TableRow[];
};

export function useSettingsOverview() {
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [data, setData]       = useState<SettingsData | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        setError('Session expirée. Reconnectez-vous.');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('full_name, role, restaurant_id')
        .eq('id', authData.user.id)
        .single();

      if (profileError || !profile) {
        setError('Profil introuvable.');
        return;
      }

      const restaurantId = profile.restaurant_id;

      const [
        restaurantResult,
        shiftsResult,
        tablesResult,
        totalResult,
        vipResult,
        phoneResult,
        emailResult,
      ] = await Promise.all([
        supabase.from('restaurants').select('*').eq('id', restaurantId).single(),
        supabase.from('shifts').select('*').eq('restaurant_id', restaurantId).order('name'),
        supabase.from('tables').select('*').eq('restaurant_id', restaurantId),
        supabase.from('guests').select('*', { count: 'exact', head: true }).eq('restaurant_id', restaurantId),
        supabase.from('guests').select('*', { count: 'exact', head: true }).eq('restaurant_id', restaurantId).eq('vip', true),
        supabase.from('guests').select('*', { count: 'exact', head: true }).eq('restaurant_id', restaurantId).not('phone', 'is', null),
        supabase.from('guests').select('*', { count: 'exact', head: true }).eq('restaurant_id', restaurantId).not('email', 'is', null),
      ]);

      if (restaurantResult.error || !restaurantResult.data) {
        setError('Restaurant introuvable.');
        return;
      }

      const tableRows = tablesResult.data ?? [];
      const zoneMap   = new Map<string, number>();
      for (const t of tableRows) {
        zoneMap.set(t.zone, (zoneMap.get(t.zone) ?? 0) + 1);
      }
      const zones: ZoneSummary[] = Array.from(zoneMap.entries())
        .map(([name, tableCount]) => ({ name, tableCount }))
        .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

      setData({
        restaurant: restaurantResult.data,
        userProfile: {
          fullName:       profile.full_name,
          role:           profile.role,
          restaurantName: restaurantResult.data.name,
          email:          authData.user.email ?? null,
        },
        shifts: shiftsResult.data ?? [],
        floor: {
          totalTables: tableRows.length,
          zoneCount:   zones.length,
          zones,
        },
        guests: {
          total:     totalResult.count  ?? 0,
          vip:       vipResult.count    ?? 0,
          withPhone: phoneResult.count  ?? 0,
          withEmail: emailResult.count  ?? 0,
        },
        tableRows,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue.');
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback((): void => { void load(); }, [load]);

  useEffect(() => { void load(); }, [load]);

  return { loading, error, data, refresh };
}

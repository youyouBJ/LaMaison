import type { Database } from './database';

type ReservationRow = Database['public']['Tables']['reservations']['Row'];
type GuestRow       = Database['public']['Tables']['guests']['Row'];
type TableRow       = Database['public']['Tables']['tables']['Row'];
type ShiftRow       = Database['public']['Tables']['shifts']['Row'];

// Entry dans reservation_tables avec la table jointe.
export type ReservationTableEntry = {
  id:       string;
  table_id: string;
  tables:   TableRow;
};

export type ReservationWithJoins = ReservationRow & {
  guests:              GuestRow | null;
  tables:              TableRow | null;
  shifts:              ShiftRow | null;
  // Disponible après la migration 002 et régénération des types.
  reservation_tables?: ReservationTableEntry[];
};

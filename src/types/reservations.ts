import type { Database } from './database';

type ReservationRow = Database['public']['Tables']['reservations']['Row'];
type GuestRow       = Database['public']['Tables']['guests']['Row'];
type TableRow       = Database['public']['Tables']['tables']['Row'];
type ShiftRow       = Database['public']['Tables']['shifts']['Row'];

export type ReservationWithJoins = ReservationRow & {
  guests: GuestRow | null;
  tables: TableRow | null;
  shifts: ShiftRow | null;
};

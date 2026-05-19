import type { Database } from '../types/database';

type TableRow = Database['public']['Tables']['tables']['Row'];

export type ReservationTableEntry = {
  id:       string;
  table_id: string;
  tables:   TableRow;
};

/**
 * Construit le libellé des tables d'une réservation.
 * Utilise reservation_tables si disponible (post-migration 002), sinon table principale.
 */
export function formatReservationTables(
  primaryTable:       TableRow | null,
  reservationTables?: ReservationTableEntry[],
): string {
  if (reservationTables && reservationTables.length > 0) {
    const labels = reservationTables.map((rt) => rt.tables.label);
    return labels.length > 1
      ? `Tables ${labels.join(', ')}`
      : `Table ${labels[0]}`;
  }
  if (primaryTable?.label) {
    return `Table ${primaryTable.label}`;
  }
  return 'Table non assignée';
}

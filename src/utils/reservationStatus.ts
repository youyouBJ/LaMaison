import { colors } from '../theme';
import type { ReservationStatus } from '../types/database';

export function getReservationStatusLabel(status: ReservationStatus): string {
  const labels: Record<ReservationStatus, string> = {
    confirmed: 'Confirmée',
    pending:   'En attente',
    cancelled: 'Annulée',
    noshow:    'No-show',
    seated:    'À table',
    completed: 'Terminée',
  };
  return labels[status];
}

export function getReservationStatusColors(
  status: ReservationStatus,
): { backgroundColor: string; color: string } {
  const map: Record<ReservationStatus, { backgroundColor: string; color: string }> = {
    confirmed: { backgroundColor: colors.goldLight,               color: colors.gold },
    pending:   { backgroundColor: colors.sandLight,               color: colors.textSecondary },
    seated:    { backgroundColor: colors.statusOccupiedLight,     color: colors.statusOccupied },
    completed: { backgroundColor: colors.statusFreeLight,         color: colors.statusFree },
    cancelled: { backgroundColor: colors.statusUnavailableLight,  color: colors.statusUnavailable },
    noshow:    { backgroundColor: colors.statusUnavailableLight,  color: colors.statusUnavailable },
  };
  return map[status];
}

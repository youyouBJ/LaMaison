import { colors } from '../theme';
import type { WaitlistStatus } from '../types/waitlist';

export function getWaitlistStatusLabel(status: WaitlistStatus): string {
  const labels: Record<WaitlistStatus, string> = {
    waiting:  'En attente',
    notified: 'Prévenu',
    seated:   'Installé',
    left:     'Parti',
  };
  return labels[status];
}

export function getWaitlistStatusColors(
  status: WaitlistStatus,
): { backgroundColor: string; color: string } {
  const map: Record<WaitlistStatus, { backgroundColor: string; color: string }> = {
    waiting:  { backgroundColor: colors.goldLight,              color: colors.gold },
    notified: { backgroundColor: colors.ctaLight,               color: colors.cta },
    seated:   { backgroundColor: colors.statusFreeLight,        color: colors.statusFree },
    left:     { backgroundColor: colors.statusUnavailableLight, color: colors.statusUnavailable },
  };
  return map[status];
}

export function getWaitlistStatusDescription(status: WaitlistStatus): string {
  const descriptions: Record<WaitlistStatus, string> = {
    waiting:  "Client en attente d'une table",
    notified: 'Client prévenu qu\'une table est disponible',
    seated:   'Client installé à table',
    left:     'Client parti sans être installé',
  };
  return descriptions[status];
}

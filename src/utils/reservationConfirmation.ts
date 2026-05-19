import { getTodayDateString, getCurrentTimeInTunis } from './date';
import type { ReservationStatus } from '../types/database';

type PhoneCheckable = {
  date:   string;
  status: ReservationStatus;
  guests: { phone?: string | null } | null;
  notes?: string | null;
};

// Détermine si une réservation nécessite encore une confirmation téléphonique.
// La présence du tag '[Appel confirmation]' dans les notes signale qu'un appel
// a déjà eu lieu — ce tag est inséré par buildConfirmationNote() et constitue
// la seule trace d'historique d'appel (pas de table dédiée en V1).
export function reservationNeedsPhoneConfirmation(r: PhoneCheckable): boolean {
  if (r.date !== getTodayDateString()) return false;
  if (r.status !== 'pending' && r.status !== 'confirmed') return false;
  if (!r.guests?.phone) return false;
  if (r.notes?.includes('[Appel confirmation]')) return false;
  return true;
}

export function buildConfirmationNote(): string {
  const today = getTodayDateString();
  const parts  = today.split('-');
  const dayStr   = parts[2] ?? '';
  const monthStr = parts[1] ?? '';
  const time = getCurrentTimeInTunis();
  return `[Appel confirmation] Client confirmé par téléphone le ${dayStr}/${monthStr} à ${time}.`;
}

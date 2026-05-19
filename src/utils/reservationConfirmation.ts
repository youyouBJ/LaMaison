import { getTodayDateString, getCurrentTimeInTunis } from './date';
import type { ReservationStatus } from '../types/database';

type PhoneCheckable = {
  date:   string;
  status: ReservationStatus;
  guests: { phone?: string | null } | null;
  notes?: string | null;
};

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

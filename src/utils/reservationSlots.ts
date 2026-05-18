import type { Database } from '../types/database';

type ShiftRow       = Database['public']['Tables']['shifts']['Row'];
type ReservationRow = Database['public']['Tables']['reservations']['Row'];

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.substring(0, 5).split(':').map(Number);
  return h * 60 + m;
}

function formatMinutes(totalMin: number): string {
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Génère les créneaux HH:MM de start à end inclus.
// end_time = "00:00" signifie minuit : dernier slot = 23:45 (24*60 - slotDuration).
export function generateTimeSlots(
  startTime: string,
  endTime: string,
  slotDuration: number,
): string[] {
  const start = toMinutes(startTime);
  const isMidnight = endTime.substring(0, 5) === '00:00';
  const end = isMidnight ? 24 * 60 - slotDuration : toMinutes(endTime);

  const slots: string[] = [];
  for (let cur = start; cur <= end; cur += slotDuration) {
    slots.push(formatMinutes(cur));
  }
  return slots;
}

// Durée de table selon taille du groupe (duration_rules dans la BDD).
export function getDurationForPartySize(partySize: number): number {
  if (partySize <= 1) return 90;
  if (partySize <= 5) return 120;
  if (partySize <= 9) return 150;
  return 180;
}

// Vérifie si une date YYYY-MM-DD est autorisée pour un shift (daysOfWeek : 0=dim, 1=lun…).
export function isDateAllowedForShift(date: string, daysOfWeek: number[]): boolean {
  if (daysOfWeek.length === 0) return false;
  const [year, month, day] = date.split('-').map(Number);
  const dow = new Date(year, month - 1, day).getDay();
  return daysOfWeek.includes(dow);
}

// Vérifie si un créneau HH:MM appartient aux slots générés pour un shift.
export function isTimeSlotInShift(timeSlot: string, shift: ShiftRow): boolean {
  const slots = generateTimeSlots(shift.start_time, shift.end_time, shift.slot_duration);
  return slots.includes(timeSlot.substring(0, 5));
}

// Retourne le premier shift valide pour une date et un créneau donnés.
export function getShiftForDateAndTime(
  date: string,
  timeSlot: string,
  shifts: ShiftRow[],
): ShiftRow | null {
  return (
    shifts.find(
      (s) => isDateAllowedForShift(date, s.days_of_week) && isTimeSlotInShift(timeSlot, s),
    ) ?? null
  );
}

// "HH:MM:SS" ou "HH:MM" → "HH:MM" (affichage).
export function normalizeTimeSlotForDisplay(time: string): string {
  return time.substring(0, 5);
}

// "HH:MM" → "HH:MM:SS" (format attendu par PostgreSQL).
export function normalizeTimeSlotForDatabase(time: string): string {
  return `${time.substring(0, 5)}:00`;
}

// Calcule le total de couverts actifs sur un créneau (exclut cancelled et noshow).
export function calculateCoversForSlot(
  reservations: Pick<ReservationRow, 'time_slot' | 'party_size' | 'status'>[],
  timeSlot: string,
): number {
  const normalized = timeSlot.substring(0, 5);
  return reservations
    .filter(
      (r) =>
        r.time_slot.substring(0, 5) === normalized &&
        r.status !== 'cancelled' &&
        r.status !== 'noshow',
    )
    .reduce((sum, r) => sum + r.party_size, 0);
}

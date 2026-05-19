// Les occasions (Anniversaire, Événement) sont stockées dans le champ `notes` de la
// réservation plutôt que dans une colonne dédiée, pour éviter une migration de schéma
// prématurée. Les tags sont filtrés à l'affichage des notes libres via displayNotes().
const BIRTHDAY_TAG = '[Occasion] Anniversaire';
const EVENT_TAG    = '[Occasion] Événement';

export function isBirthdayReservation(notes?: string | null): boolean {
  if (!notes) return false;
  return notes.includes(BIRTHDAY_TAG);
}

export function isEventReservation(notes?: string | null): boolean {
  if (!notes) return false;
  return notes.includes(EVENT_TAG);
}

export function withBirthdayOccasion(notes: string | null | undefined, enabled: boolean): string | null {
  const existing = notes?.trim() ?? '';
  if (!enabled) return existing || null;
  if (existing.includes(BIRTHDAY_TAG)) return existing;
  return existing ? `${BIRTHDAY_TAG}\n${existing}` : BIRTHDAY_TAG;
}

export function withEventOccasion(notes: string | null | undefined, enabled: boolean): string | null {
  const existing = notes?.trim() ?? '';
  if (!enabled) return existing || null;
  if (existing.includes(EVENT_TAG)) return existing;
  return existing ? `${EVENT_TAG}\n${existing}` : EVENT_TAG;
}

export function displayNotes(notes?: string | null): string | null {
  if (!notes) return null;
  const cleaned = notes
    .replace(BIRTHDAY_TAG, '')
    .replace(EVENT_TAG, '')
    .replace(/\n+/g, '\n')
    .trim();
  return cleaned || null;
}

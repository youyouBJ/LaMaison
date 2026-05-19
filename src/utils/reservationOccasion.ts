const BIRTHDAY_TAG = '[Occasion] Anniversaire';

export function isBirthdayReservation(notes?: string | null): boolean {
  if (!notes) return false;
  return notes.includes(BIRTHDAY_TAG);
}

export function withBirthdayOccasion(notes: string | null | undefined, enabled: boolean): string | null {
  const existing = notes?.trim() ?? '';
  if (!enabled) return existing || null;
  if (existing.includes(BIRTHDAY_TAG)) return existing;
  return existing ? `${BIRTHDAY_TAG}\n${existing}` : BIRTHDAY_TAG;
}

export function displayNotes(notes?: string | null): string | null {
  if (!notes) return null;
  const cleaned = notes.replace(BIRTHDAY_TAG, '').replace(/^\n+/, '').trim();
  return cleaned || null;
}

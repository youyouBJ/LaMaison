export function formatGuestName(
  firstName?: string | null,
  lastName?: string | null,
): string {
  const parts = [firstName, lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : 'Client sans nom';
}

export function formatPhone(phone?: string | null): string {
  return phone ?? '—';
}

export function formatRating(rating?: number | null): string {
  if (rating === null || rating === undefined) return '—';
  return rating.toFixed(1);
}

export function formatCurrencyTND(amount?: number | null): string {
  if (amount === null || amount === undefined) return '—';
  return `${amount.toFixed(3)} TND`;
}

// date est au format YYYY-MM-DD
export function formatDateShort(date?: string | null): string {
  if (!date) return '—';
  const [y, m, d] = date.split('-');
  if (!y || !m || !d) return date;
  return `${d}/${m}/${y}`;
}

// Tags SevenRooms — valeurs à ne jamais afficher
const BLOCKED_TAG_VALUES = new Set([
  'group all guests',
]);

// Mots à conserver en majuscules même après mise en sentence case
const UPPERCASE_TAG_WORDS = new Set([
  'vip',
]);

// Convertit un tag brut SevenRooms en libellé lisible.
// Retourne '' si le tag doit être masqué (sans valeur métier).
export function formatGuestTag(tag: string): string {
  const trimmed = tag.trim();
  if (!trimmed) return '';

  // Prendre la partie après ':' si présente (ex: "CUSTOM LOCAL:VISIT" → "VISIT")
  const colonIdx = trimmed.indexOf(':');
  const value = colonIdx >= 0 ? trimmed.slice(colonIdx + 1).trim() : trimmed;
  if (!value) return '';

  const lower = value.toLowerCase();

  if (BLOCKED_TAG_VALUES.has(lower)) return '';

  // Mots entièrement en majuscules (VIP, etc.)
  if (UPPERCASE_TAG_WORDS.has(lower)) return lower.toUpperCase();

  // Sentence case : première lettre en majuscule, reste en minuscule
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

// Retourne la liste des tags affichables pour une fiche client.
// Filtre les tags vides/bloqués, déduplique, limite à 8.
export function getDisplayableGuestTags(tags?: string[] | null): string[] {
  if (!tags || tags.length === 0) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const formatted = formatGuestTag(tag);
    if (!formatted) continue;
    const key = formatted.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(formatted);
    if (result.length >= 8) break;
  }
  return result;
}

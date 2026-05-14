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

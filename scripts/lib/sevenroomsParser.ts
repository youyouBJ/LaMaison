import { parse } from 'csv-parse/sync';

// Raw row as parsed from the SevenRooms CSV export (all values are strings)
export interface SevenRoomsRawRow {
  Salutation: string;
  'Client Last Name': string;
  'Client First Name': string;
  Title: string;
  Company: string;
  Gender: string;
  VIP: string;
  Visits: string;
  Cancels: string;
  'No Shows': string;
  Orders: string;
  'Spend/Cover': string;
  'Total Spend': string;
  'Spend/Visit': string;
  'Avg. Rating': string;
  Birthday: string;
  Anniversary: string;
  Phone: string;
  'Work Phone': string;
  Email: string;
  'Alt Email': string;
  Address: string;
  City: string;
  State: string;
  'Postal Code': string;
  Country: string;
  Notes: string;
  Tags: string;
  'Loyalty ID': string;
  'Loyalty Tier': string;
  'Loyalty Rank': string;
  Created: string;
  'Last Location': string;
  'Last Visit': string;
  'Venue Group Marketing Opt-In': string;
  'La Maison Marketing Opt-In': string;
}

// Mapped guest ready for Supabase insert/update (without id and restaurant_id)
export interface MappedGuest {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  birthday: string | null;
  notes: string | null;
  tags: string[];
  visit_count: number;
  cancels: number;
  no_shows: number;
  // avg_spend uses Spend/Visit — best proxy for per-visit revenue (vs Spend/Cover which is per head)
  avg_spend: number | null;
  avg_rating: number | null;
  vip: boolean;
  marketing_opt_in: boolean;
  source: 'import';
  last_visit: string | null;
}

export function parseSevenRoomsCsv(content: string): SevenRoomsRawRow[] {
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
  }) as SevenRoomsRawRow[];
}

export function normalizePhone(value?: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  if (['n/a', 'none', 'null', '-', 'na'].includes(lower)) return null;

  // Remove spaces, dots, hyphens, parentheses — keep + for international prefix
  const cleaned = trimmed.replace(/[\s.\-()]/g, '');

  // Must contain at least 6 digits to be a valid phone
  if (!/\d{6}/.test(cleaned)) return null;

  return cleaned;
}

export function normalizeEmail(value?: string): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  // Basic validation: must contain @ and at least one dot after @
  if (!normalized.includes('@') || !/\.[a-z]{2,}$/.test(normalized)) return null;
  return normalized;
}

export function parseNumber(value?: string): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Remove currency symbols and non-numeric chars (keep digits, comma, dot, minus)
  const cleaned = trimmed.replace(/[^\d.,\-]/g, '');
  if (!cleaned) return null;

  const commaIdx = cleaned.lastIndexOf(',');
  const dotIdx = cleaned.lastIndexOf('.');

  let normalized = cleaned;
  if (commaIdx > -1 && dotIdx > -1) {
    if (commaIdx > dotIdx) {
      // European format: 1.234,56 → remove dots, replace comma with dot
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // US format: 1,234.56 → remove commas
      normalized = cleaned.replace(/,/g, '');
    }
  } else if (commaIdx > -1) {
    // Only comma → treat as decimal separator
    normalized = cleaned.replace(',', '.');
  }

  const num = parseFloat(normalized);
  return isNaN(num) ? null : num;
}

export function parseDate(value?: string): string | null {
  if (!value || value.trim() === '') return null;
  const trimmed = value.trim();

  // Already ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(`${trimmed}T00:00:00`);
    return isNaN(d.getTime()) ? null : trimmed;
  }

  // MM/DD/YYYY
  const mdy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy !== null) {
    const month = mdy[1].padStart(2, '0');
    const day = mdy[2].padStart(2, '0');
    const year = mdy[3];
    const d = new Date(`${year}-${month}-${day}T00:00:00`);
    if (!isNaN(d.getTime())) return `${year}-${month}-${day}`;
  }

  // DD/MM/YYYY fallback
  const dmy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy !== null) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    const year = dmy[3];
    const d = new Date(`${year}-${month}-${day}T00:00:00`);
    if (!isNaN(d.getTime())) return `${year}-${month}-${day}`;
  }

  // Generic fallback
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];

  return null;
}

export function parseBoolean(value?: string): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return ['yes', 'true', '1', 'vip', 'y', 'oui', 'opted in', 'opt in', 'opted-in'].includes(normalized);
}

export function parseTags(value?: string): string[] {
  if (!value || value.trim() === '') return [];
  const tags = value
    .split(',')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0);
  return [...new Set(tags)];
}

export function buildNotes(row: SevenRoomsRawRow): string | null {
  const parts: string[] = [];

  if (row.Notes?.trim()) {
    parts.push(row.Notes.trim());
  }

  if (row['Loyalty ID']?.trim()) {
    parts.push(`Loyalty ID: ${row['Loyalty ID'].trim()}`);
  }
  if (row['Loyalty Tier']?.trim()) {
    parts.push(`Loyalty Tier: ${row['Loyalty Tier'].trim()}`);
  }
  if (row['Loyalty Rank']?.trim()) {
    parts.push(`Loyalty Rank: ${row['Loyalty Rank'].trim()}`);
  }

  return parts.length > 0 ? parts.join('\n') : null;
}

export function mapSevenRoomsRowToGuest(row: SevenRoomsRawRow): MappedGuest {
  const phone = normalizePhone(row.Phone) ?? normalizePhone(row['Work Phone']);
  const email = normalizeEmail(row.Email) ?? normalizeEmail(row['Alt Email']);

  const rawRating = parseNumber(row['Avg. Rating']);
  const avgRating =
    rawRating !== null && rawRating >= 0 && rawRating <= 5 ? rawRating : null;

  // Prefer La Maison-specific opt-in; fall back to venue group
  const marketingRaw =
    row['La Maison Marketing Opt-In']?.trim() ||
    row['Venue Group Marketing Opt-In']?.trim();

  return {
    first_name: row['Client First Name']?.trim() || null,
    last_name: row['Client Last Name']?.trim() || null,
    email,
    phone,
    birthday: parseDate(row.Birthday),
    notes: buildNotes(row),
    tags: parseTags(row.Tags),
    visit_count: Math.round(parseNumber(row.Visits) ?? 0),
    cancels: Math.round(parseNumber(row.Cancels) ?? 0),
    no_shows: Math.round(parseNumber(row['No Shows']) ?? 0),
    avg_spend: parseNumber(row['Spend/Visit']),
    avg_rating: avgRating,
    vip: parseBoolean(row.VIP),
    marketing_opt_in: parseBoolean(marketingRaw),
    source: 'import',
    last_visit: parseDate(row['Last Visit']),
  };
}

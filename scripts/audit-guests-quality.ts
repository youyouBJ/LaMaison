/**
 * CRM Data Quality Audit — READ ONLY
 *
 * Analyse les doublons et données sales dans la table guests.
 * N'effectue aucune écriture dans Supabase.
 *
 * Usage :
 *   npm run crm:audit
 *
 * Prérequis : .env.import renseigné (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESTAURANT_ID)
 */

import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';

dotenvConfig({ path: resolve(process.cwd(), '.env.import') });

import { writeFileSync, mkdirSync } from 'fs';
import { createSupabaseAdmin } from './lib/supabaseAdmin';
import { normalizePhone, normalizeEmail } from './lib/sevenroomsParser';

// ─── Safety banner ────────────────────────────────────────────────────────────

console.log('\n╔══════════════════════════════════════════════════════╗');
console.log('║  READ ONLY — aucune donnée Supabase ne sera modifiée ║');
console.log('╚══════════════════════════════════════════════════════╝\n');

// ─── Types ────────────────────────────────────────────────────────────────────

type IssueType =
  | 'duplicate_phone_high_confidence'
  | 'duplicate_email_high_confidence'
  | 'possible_name_duplicate'
  | 'reversed_name_possible_duplicate'
  | 'missing_phone'
  | 'invalid_phone'
  | 'invalid_email'
  | 'dirty_name'
  | 'empty_name';

interface AuditIssue {
  issue_type: IssueType;
  confidence_score: number;
  guest_ids: string[];
  first_names: (string | null)[];
  last_names: (string | null)[];
  phones: (string | null)[];
  emails: (string | null)[];
  reason: string;
  recommended_action: string;
  automatic_action: false;
}

interface GuestRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  tags: string[] | null;
}

interface AuditStats {
  total: number;
  withPhone: number;
  withEmail: number;
  duplicatePhoneGroups: number;
  duplicateEmailGroups: number;
  probableDuplicates: number;
  suspiciousRecords: number;
}

// ─── Env guard ────────────────────────────────────────────────────────────────

function requireEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    console.error(`\n✗ Variable manquante dans .env.import : ${key}`);
    console.error('→ Copiez .env.import.example vers .env.import et renseignez les valeurs.\n');
    process.exit(1);
  }
  return value;
}

requireEnv('SUPABASE_URL');
requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const RESTAURANT_ID = requireEnv('RESTAURANT_ID');

// ─── Name normalization ───────────────────────────────────────────────────────

const CIVILITIES = [
  'monsieur',
  'madame',
  'mademoiselle',
  'monsieur.',
  'madame.',
  'mademoiselle.',
  'mlle',
  'mme',
  'mr',
  'm.',
  'miss',
  'ms',
  'ms.',
  'dr',
  'dr.',
  'prof',
  'prof.',
];

function removeDiacritics(str: string): string {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function normalizeName(value: string | null): string {
  if (!value) return '';
  return removeDiacritics(value.trim().toLowerCase())
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripCivilities(normalized: string): string {
  const words = normalized.split(' ');
  const filtered = words.filter(w => !CIVILITIES.includes(w));
  return filtered.join(' ').trim();
}

function hasCivility(normalized: string): boolean {
  const words = normalized.split(' ');
  return words.some(w => CIVILITIES.includes(w));
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[b.length][a.length];
}

function isSimilarName(a: string, b: string, maxDist = 2): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const minLen = Math.min(a.length, b.length);
  if (minLen < 4) return a === b;
  return levenshtein(a, b) <= maxDist;
}

// ─── Phone validation ─────────────────────────────────────────────────────────

function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s.\-()]/g, '');
  return /^\+?[0-9]{6,15}$/.test(cleaned);
}

// ─── Email validation ─────────────────────────────────────────────────────────

function isValidEmail(email: string): boolean {
  const lower = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(lower);
}

// ─── Supabase load ────────────────────────────────────────────────────────────

async function loadAllGuests(): Promise<GuestRow[]> {
  const supabase = createSupabaseAdmin();

  console.log('Chargement des clients...');
  const pageSize = 1000;
  let page = 0;
  let hasMore = true;
  const all: GuestRow[] = [];

  while (hasMore) {
    const { data, error } = await supabase
      .from('guests')
      .select('id, first_name, last_name, phone, email, tags')
      .eq('restaurant_id', RESTAURANT_ID)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      throw new Error(`Erreur Supabase : ${error.message}`);
    }

    const rows = (data ?? []) as GuestRow[];
    all.push(...rows);
    hasMore = rows.length === pageSize;
    page++;
  }

  console.log(`  → ${all.length} clients chargés.\n`);
  return all;
}

// ─── Audit ────────────────────────────────────────────────────────────────────

function buildIssue(
  issueType: IssueType,
  confidenceScore: number,
  guests: GuestRow[],
  reason: string,
  recommendedAction: string
): AuditIssue {
  return {
    issue_type: issueType,
    confidence_score: confidenceScore,
    guest_ids: guests.map(g => g.id),
    first_names: guests.map(g => g.first_name),
    last_names: guests.map(g => g.last_name),
    phones: guests.map(g => g.phone),
    emails: guests.map(g => g.email),
    reason,
    recommended_action: recommendedAction,
    automatic_action: false,
  };
}

function runAudit(guests: GuestRow[]): { issues: AuditIssue[]; stats: AuditStats } {
  const issues: AuditIssue[] = [];

  const stats: AuditStats = {
    total: guests.length,
    withPhone: 0,
    withEmail: 0,
    duplicatePhoneGroups: 0,
    duplicateEmailGroups: 0,
    probableDuplicates: 0,
    suspiciousRecords: 0,
  };

  // ── Phone & email maps ────────────────────────────────────────────────────
  const phoneGroups = new Map<string, GuestRow[]>();
  const emailGroups = new Map<string, GuestRow[]>();

  for (const guest of guests) {
    if (guest.phone) {
      stats.withPhone++;
      const norm = normalizePhone(guest.phone);
      if (norm) {
        const group = phoneGroups.get(norm) ?? [];
        group.push(guest);
        phoneGroups.set(norm, group);
      }
    }
    if (guest.email) {
      stats.withEmail++;
      const norm = normalizeEmail(guest.email);
      if (norm) {
        const group = emailGroups.get(norm) ?? [];
        group.push(guest);
        emailGroups.set(norm, group);
      }
    }
  }

  // ── Duplicate phone (high confidence) ────────────────────────────────────
  for (const [phone, group] of phoneGroups) {
    if (group.length < 2) continue;
    stats.duplicatePhoneGroups++;
    issues.push(
      buildIssue(
        'duplicate_phone_high_confidence',
        0.95,
        group,
        `Téléphone normalisé identique : ${phone}`,
        'Vérifier manuellement et fusionner si même personne. Conserver la fiche la plus complète.'
      )
    );
  }

  // ── Duplicate email (high confidence) ────────────────────────────────────
  for (const [email, group] of emailGroups) {
    if (group.length < 2) continue;
    stats.duplicateEmailGroups++;
    issues.push(
      buildIssue(
        'duplicate_email_high_confidence',
        0.9,
        group,
        `Email normalisé identique : ${email}`,
        'Vérifier manuellement et fusionner si même personne. Conserver la fiche la plus complète.'
      )
    );
  }

  // ── Name-based duplicate detection ───────────────────────────────────────
  // Build a map keyed by normalized full name (first + last, stripped of civilities)
  const nameGroups = new Map<string, GuestRow[]>();
  const processedNamePairs = new Set<string>();

  for (const guest of guests) {
    const fn = stripCivilities(normalizeName(guest.first_name));
    const ln = stripCivilities(normalizeName(guest.last_name));
    if (!fn && !ln) continue;
    const key = `${fn}|${ln}`;
    const group = nameGroups.get(key) ?? [];
    group.push(guest);
    nameGroups.set(key, group);
  }

  // Exact normalized full name duplicates
  for (const [nameKey, group] of nameGroups) {
    if (group.length < 2) continue;
    const [fn, ln] = nameKey.split('|');
    if (!fn && !ln) continue;

    stats.probableDuplicates++;
    issues.push(
      buildIssue(
        'possible_name_duplicate',
        0.75,
        group,
        `Nom complet normalisé identique : "${fn} ${ln}".`,
        'Vérifier les fiches : peuvent être des homonymes ou de vrais doublons. Comparer téléphone/email.'
      )
    );
    processedNamePairs.add(nameKey);
  }

  // Reversed name detection (first↔last swap)
  for (const guest of guests) {
    const fn = stripCivilities(normalizeName(guest.first_name));
    const ln = stripCivilities(normalizeName(guest.last_name));
    if (!fn || !ln) continue;

    const reversedKey = `${ln}|${fn}`;
    if (!nameGroups.has(reversedKey)) continue;

    const reversedGroup = nameGroups.get(reversedKey)!;
    const pairKey = [nameKey(fn, ln), nameKey(ln, fn)].sort().join('↔');
    if (processedNamePairs.has(pairKey)) continue;
    processedNamePairs.add(pairKey);

    const candidates = reversedGroup.filter(g => {
      const gFn = stripCivilities(normalizeName(g.first_name));
      const gLn = stripCivilities(normalizeName(g.last_name));
      return gFn === ln && gLn === fn;
    });

    if (candidates.length === 0) continue;

    stats.probableDuplicates++;
    issues.push(
      buildIssue(
        'reversed_name_possible_duplicate',
        0.7,
        [guest, ...candidates],
        `Prénom/nom possiblement inversés : "${fn} ${ln}" ↔ "${ln} ${fn}".`,
        'Vérifier si même personne avec saisie inversée. Corriger le sens prénom/nom si confirmé.'
      )
    );
  }

  // Fuzzy name matching (Levenshtein ≤ 2 sur prénom ET nom)
  const guestArray = guests.filter(g => {
    const fn = stripCivilities(normalizeName(g.first_name));
    const ln = stripCivilities(normalizeName(g.last_name));
    return (fn.length >= 3 || ln.length >= 3);
  });

  const fuzzyProcessed = new Set<string>();

  for (let i = 0; i < guestArray.length; i++) {
    const a = guestArray[i];
    const aFn = stripCivilities(normalizeName(a.first_name));
    const aLn = stripCivilities(normalizeName(a.last_name));

    for (let j = i + 1; j < guestArray.length; j++) {
      const b = guestArray[j];
      const bFn = stripCivilities(normalizeName(b.first_name));
      const bLn = stripCivilities(normalizeName(b.last_name));

      // Already captured as exact duplicate
      if (aFn === bFn && aLn === bLn) continue;

      // Must be similar on both first and last name
      const fnSimilar = isSimilarName(aFn, bFn);
      const lnSimilar = isSimilarName(aLn, bLn);
      if (!fnSimilar || !lnSimilar) continue;

      const pairKey = [a.id, b.id].sort().join(':');
      if (fuzzyProcessed.has(pairKey)) continue;
      fuzzyProcessed.add(pairKey);

      stats.probableDuplicates++;
      issues.push(
        buildIssue(
          'possible_name_duplicate',
          0.6,
          [a, b],
          `Noms proches (Levenshtein ≤ 2) : "${aFn} ${aLn}" ≈ "${bFn} ${bLn}".`,
          'Vérifier manuellement. Peut être une faute de saisie ou un homonyme.'
        )
      );
    }
  }

  // ── Per-record suspicious checks ─────────────────────────────────────────
  for (const guest of guests) {
    const fn = guest.first_name?.trim() ?? '';
    const ln = guest.last_name?.trim() ?? '';
    const normFn = normalizeName(guest.first_name);
    const normLn = normalizeName(guest.last_name);

    // Empty name
    if (!fn && !ln) {
      stats.suspiciousRecords++;
      issues.push(
        buildIssue(
          'empty_name',
          0.99,
          [guest],
          'Prénom ET nom vides.',
          'Identifier le client via téléphone/email et renseigner le nom manuellement.'
        )
      );
      continue;
    }

    // Civility in first_name or last_name
    if (hasCivility(normFn) || hasCivility(normLn)) {
      stats.suspiciousRecords++;
      issues.push(
        buildIssue(
          'dirty_name',
          0.85,
          [guest],
          `Civilité détectée dans le nom : "${fn}" / "${ln}".`,
          'Retirer la civilité du champ nom/prénom.'
        )
      );
    }

    // Full name in first_name (e.g. "Jean Dupont" in first_name, nothing in last_name)
    if (fn && !ln && fn.trim().split(/\s+/).length >= 2) {
      stats.suspiciousRecords++;
      issues.push(
        buildIssue(
          'dirty_name',
          0.8,
          [guest],
          `Nom complet dans le champ prénom : "${fn}" (champ nom vide).`,
          'Séparer prénom et nom dans les champs appropriés.'
        )
      );
    }

    // Missing phone
    if (!guest.phone) {
      stats.suspiciousRecords++;
      issues.push(
        buildIssue(
          'missing_phone',
          0.99,
          [guest],
          'Téléphone manquant.',
          'Rechercher le contact dans SevenRooms ou auprès du restaurant pour compléter.'
        )
      );
    } else if (!isValidPhone(guest.phone)) {
      // Invalid phone
      stats.suspiciousRecords++;
      issues.push(
        buildIssue(
          'invalid_phone',
          0.9,
          [guest],
          `Format de téléphone invalide : "${guest.phone}".`,
          'Vérifier et corriger le numéro de téléphone.'
        )
      );
    }

    // Invalid email
    if (guest.email && !isValidEmail(guest.email)) {
      stats.suspiciousRecords++;
      issues.push(
        buildIssue(
          'invalid_email',
          0.9,
          [guest],
          `Format d'email invalide : "${guest.email}".`,
          'Vérifier et corriger l\'adresse email.'
        )
      );
    }

    // Duplicate tags
    if (guest.tags && guest.tags.length > 0) {
      const seen = new Set<string>();
      const dupes: string[] = [];
      for (const tag of guest.tags) {
        const lower = tag.toLowerCase().trim();
        if (seen.has(lower)) dupes.push(tag);
        else seen.add(lower);
      }
      if (dupes.length > 0) {
        stats.suspiciousRecords++;
        issues.push(
          buildIssue(
            'dirty_name',
            0.7,
            [guest],
            `Tags en doublon : ${dupes.map(t => `"${t}"`).join(', ')}.`,
            'Dédupliquer les tags de ce client.'
          )
        );
      }
    }
  }

  return { issues, stats };
}

// Helper to build a consistent name key
function nameKey(fn: string, ln: string): string {
  return `${fn}|${ln}`;
}

// ─── Report generation ────────────────────────────────────────────────────────

function toCSVValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = Array.isArray(value) ? value.join(' | ') : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function generateCSV(issues: AuditIssue[]): string {
  const headers = [
    'issue_type',
    'confidence_score',
    'guest_ids',
    'first_names',
    'last_names',
    'phones',
    'emails',
    'reason',
    'recommended_action',
    'automatic_action',
  ];

  const rows = issues.map(issue =>
    [
      issue.issue_type,
      issue.confidence_score,
      issue.guest_ids.join(' | '),
      issue.first_names.join(' | '),
      issue.last_names.join(' | '),
      issue.phones.join(' | '),
      issue.emails.join(' | '),
      issue.reason,
      issue.recommended_action,
      issue.automatic_action,
    ]
      .map(toCSVValue)
      .join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const guests = await loadAllGuests();
  console.log('Analyse en cours...\n');

  const { issues, stats } = runAudit(guests);

  // Write reports
  const reportsDir = resolve(process.cwd(), 'reports');
  mkdirSync(reportsDir, { recursive: true });

  const jsonPath = resolve(reportsDir, 'crm-quality-audit.json');
  const csvPath = resolve(reportsDir, 'crm-quality-audit.csv');

  writeFileSync(jsonPath, JSON.stringify({ generated_at: new Date().toISOString(), stats, issues }, null, 2), 'utf-8');
  writeFileSync(csvPath, generateCSV(issues), 'utf-8');

  // Terminal summary
  console.log('─── Résultats de l\'audit ──────────────────────────────');
  console.log(`Total clients analysés         : ${stats.total}`);
  console.log(`Clients avec téléphone         : ${stats.withPhone}`);
  console.log(`Clients avec email             : ${stats.withEmail}`);
  console.log(`Groupes doublons téléphone     : ${stats.duplicatePhoneGroups}`);
  console.log(`Groupes doublons email         : ${stats.duplicateEmailGroups}`);
  console.log(`Doublons probables (nom)       : ${stats.probableDuplicates}`);
  console.log(`Fiches suspectes               : ${stats.suspiciousRecords}`);
  console.log(`Total issues détectées         : ${issues.length}`);
  console.log('──────────────────────────────────────────────────────');
  console.log(`\nRapports générés :`);
  console.log(`  JSON → ${jsonPath}`);
  console.log(`  CSV  → ${csvPath}`);
  console.log('\n✅ Audit terminé — aucune donnée modifiée.\n');
}

main().catch(err => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\n✗ Erreur fatale : ${msg}\n`);
  process.exit(1);
});

/**
 * CRM Merge Preview — READ ONLY
 *
 * Lit reports/crm-quality-audit.json et génère une prévisualisation des fusions
 * pour les groupes haute confiance (téléphone/email exact, noms similaires, ≤ 5 fiches).
 *
 * N'effectue aucune écriture dans Supabase. Si SUPABASE_URL et
 * SUPABASE_SERVICE_ROLE_KEY sont disponibles dans .env.import, enrichit chaque
 * groupe avec VIP, avg_rating, visit_count, notes et tags (lecture seule).
 *
 * Enrichissement robuste : batches de 100, 2 retries par batch, délai entre retries.
 * Si un batch échoue définitivement, les IDs concernés sont marqués et les groupes
 * sans enrichissement sont reclassés en validation humaine.
 *
 * Usage :
 *   npm run crm:merge:preview
 */

import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';

dotenvConfig({ path: resolve(process.cwd(), '.env.import') });

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdmin } from './lib/supabaseAdmin';
import { normalizeEmail } from './lib/sevenroomsParser';

// ─── Banner ───────────────────────────────────────────────────────────────────

console.log('\n╔══════════════════════════════════════════════════════╗');
console.log('║  READ ONLY — aucune donnée Supabase ne sera modifiée ║');
console.log('╚══════════════════════════════════════════════════════╝\n');

// ─── Constants ────────────────────────────────────────────────────────────────

const BATCH_SIZE = 100;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 200;
const LOG_EVERY_N_BATCHES = 10;

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

type MatchType = 'phone_exact' | 'email_exact' | 'phone_and_email_exact';
type RiskLevel = 'low' | 'medium' | 'high';
type ActionRecommendation = 'ready_for_review' | 'human_validation_required' | 'ignore_for_now';

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

interface AuditReport {
  generated_at: string;
  stats: {
    total: number;
    withPhone: number;
    withEmail: number;
    duplicatePhoneGroups: number;
    duplicateEmailGroups: number;
    probableDuplicates: number;
    suspiciousRecords: number;
  };
  issues: AuditIssue[];
}

interface GuestEnrichment {
  id: string;
  vip: boolean;
  avg_rating: number | null;
  visit_count: number;
  notes: string | null;
  tags: string[];
  created_at: string;
  updated_at: string | null;
}

interface MergedDataPreview {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  vip: boolean;
  avg_rating: number | null;
  notes_merge_required: boolean;
  tags_merge_required: boolean;
}

interface MergeGroup {
  group_id: string;
  risk_level: RiskLevel;
  match_type: MatchType;
  confidence_score: number;
  master_guest_id: string;
  duplicate_guest_ids: string[];
  master_name: string;
  duplicate_names: string[];
  phones: (string | null)[];
  emails: (string | null)[];
  vip_flags: boolean[];
  ratings: (number | null)[];
  reason: string;
  master_selection_reason: string;
  enrichment_partial: boolean;
  merged_data_preview: MergedDataPreview;
  recommended_action: ActionRecommendation;
  automatic_action: false;
}

interface EnrichmentStats {
  attempted: boolean;
  total_ids: number;
  enriched_count: number;
  failed_count: number;
  failed_batch_count: number;
  failed_ids: string[];
  complete: boolean;
}

interface PreviewReport {
  generated_at: string;
  source_audit_date: string;
  enrichment: EnrichmentStats;
  total_groups_analyzed: number;
  counts: {
    ready_for_review: number;
    human_validation_required: number;
    ignore_for_now: number;
    risk_low: number;
    risk_medium: number;
    risk_high: number;
    downgraded_due_to_partial_enrichment: number;
    match_phone_exact: number;
    match_email_exact: number;
    match_phone_and_email_exact: number;
  };
  groups: MergeGroup[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

function namesAreSimilar(
  firstNames: (string | null)[],
  lastNames: (string | null)[]
): boolean {
  const nonNullFirst = firstNames.filter((n): n is string => !!n?.trim());
  const nonNullLast = lastNames.filter((n): n is string => !!n?.trim());
  if (nonNullFirst.length > 0 && new Set(nonNullFirst.map(n => n.toLowerCase().trim())).size === 1) return true;
  if (nonNullLast.length > 0 && new Set(nonNullLast.map(n => n.toLowerCase().trim())).size === 1) return true;
  return false;
}

function namesFullyIdentical(
  firstNames: (string | null)[],
  lastNames: (string | null)[]
): boolean {
  const nonNullFirst = firstNames.filter((n): n is string => !!n?.trim());
  const nonNullLast = lastNames.filter((n): n is string => !!n?.trim());
  const firstOk = nonNullFirst.length > 0 && new Set(nonNullFirst.map(n => n.toLowerCase().trim())).size === 1;
  const lastOk = nonNullLast.length > 0 && new Set(nonNullLast.map(n => n.toLowerCase().trim())).size === 1;
  return firstOk && lastOk;
}

function computeMatchType(issue: AuditIssue): MatchType {
  if (issue.issue_type === 'duplicate_email_high_confidence') return 'email_exact';
  const nonNullEmails = issue.emails.filter((e): e is string => !!e);
  if (nonNullEmails.length >= 2) {
    const normed = nonNullEmails.map(e => normalizeEmail(e)).filter(Boolean);
    if (normed.length >= 2 && new Set(normed).size === 1) return 'phone_and_email_exact';
  }
  return 'phone_exact';
}

function computeRisk(issue: AuditIssue, masterIsDefinitive: boolean): RiskLevel {
  const size = issue.guest_ids.length;
  if (size >= 5) return 'high';
  if (size >= 3) return 'medium';
  // size == 2
  if (!masterIsDefinitive) return 'medium';
  return namesFullyIdentical(issue.first_names, issue.last_names) ? 'low' : 'medium';
}

function computeAction(risk: RiskLevel): ActionRecommendation {
  if (risk === 'low') return 'ready_for_review';
  return 'human_validation_required';
}

function formatGuestName(firstName: string | null, lastName: string | null): string {
  return [firstName, lastName].filter(Boolean).join(' ') || '(sans nom)';
}

// ─── Master selection ─────────────────────────────────────────────────────────

interface GuestCandidate {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  enrichment?: GuestEnrichment;
}

interface MasterSelection {
  masterId: string;
  reason: string;
  isDefinitive: boolean;
}

function fieldCompletenessScore(g: GuestCandidate): number {
  let score = 0;
  if (g.first_name) score++;
  if (g.last_name) score++;
  if (g.phone) score++;
  if (g.email) score++;
  if (g.enrichment?.notes) score++;
  if (g.enrichment && g.enrichment.tags.length > 0) score++;
  if (g.enrichment?.avg_rating !== null && g.enrichment?.avg_rating !== undefined) score++;
  return score;
}

function selectMaster(candidates: GuestCandidate[], enrichmentAttempted: boolean): MasterSelection {
  const anyEnriched = candidates.some(c => c.enrichment !== undefined);
  // Enrichment was attempted but none of this group's guests were enriched → fallback
  const enrichmentMissing = enrichmentAttempted && !anyEnriched;

  const scored = candidates.map(g => {
    let score = 0;
    const parts: string[] = [];

    if (g.enrichment?.vip) { score += 100; parts.push('VIP'); }

    const rating = g.enrichment?.avg_rating ?? null;
    if (rating !== null && rating > 0) { score += rating * 10; parts.push(`rating ${rating}`); }

    if (g.email) { score += 5; parts.push('email'); }

    const visits = g.enrichment?.visit_count ?? 0;
    score += visits * 0.1;

    score += fieldCompletenessScore(g);

    return { g, score, parts };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aDate = a.g.enrichment?.created_at ?? '';
    const bDate = b.g.enrichment?.created_at ?? '';
    return aDate < bDate ? -1 : 1;
  });

  const winner = scored[0];

  if (enrichmentMissing) {
    return {
      masterId: winner.g.id,
      reason: 'données enrichies partielles — validation humaine recommandée',
      isDefinitive: false,
    };
  }

  if (winner.parts.length === 0) {
    const completenessA = fieldCompletenessScore(winner.g);
    const completenessB = fieldCompletenessScore(scored[1]?.g ?? winner.g);
    const reason = completenessA > completenessB
      ? 'données les plus complètes'
      : 'premier de la liste (par défaut)';
    return { masterId: winner.g.id, reason, isDefinitive: true };
  }

  return {
    masterId: winner.g.id,
    reason: winner.parts.join(' | '),
    isDefinitive: true,
  };
}

// ─── Merged data preview ──────────────────────────────────────────────────────

function buildMergedDataPreview(candidates: GuestCandidate[], masterId: string): MergedDataPreview {
  const master = candidates.find(c => c.id === masterId)!;

  const bestEmail = candidates.find(c => c.email)?.email ?? null;
  const bestPhone = candidates.find(c => c.phone)?.phone ?? null;
  const isVip = candidates.some(c => c.enrichment?.vip === true);

  const ratings = candidates
    .map(c => c.enrichment?.avg_rating ?? null)
    .filter((r): r is number => r !== null && r > 0);
  const bestRating = ratings.length > 0 ? Math.max(...ratings) : null;

  const nonEmptyNotes = candidates
    .map(c => c.enrichment?.notes ?? null)
    .filter((n): n is string => !!n?.trim());
  const distinctNotes = new Set(nonEmptyNotes);

  const tagSets = candidates
    .map(c => c.enrichment?.tags ?? [])
    .filter(t => t.length > 0);

  return {
    first_name: master.first_name,
    last_name: master.last_name,
    phone: bestPhone,
    email: bestEmail,
    vip: isVip,
    avg_rating: bestRating,
    notes_merge_required: distinctNotes.size > 1,
    tags_merge_required: tagSets.length > 1,
  };
}

// ─── Supabase enrichment ──────────────────────────────────────────────────────

interface RawGuestRow {
  id: string;
  vip: boolean | null;
  avg_rating: number | null;
  visit_count: number | null;
  notes: string | null;
  tags: string[] | null;
  created_at: string | null;
  updated_at: string | null;
}

interface EnrichmentResult {
  map: Map<string, GuestEnrichment>;
  failedIds: string[];
  failedBatchCount: number;
}

async function enrichGuestsFromSupabase(
  supabase: SupabaseClient,
  guestIds: string[]
): Promise<EnrichmentResult> {
  const enrichmentMap = new Map<string, GuestEnrichment>();
  const failedIds: string[] = [];
  let failedBatchCount = 0;

  const batches = chunk(guestIds, BATCH_SIZE);
  const totalBatches = batches.length;

  console.log(`  Taille des batches : ${BATCH_SIZE} | Total batches : ${totalBatches} | Retries max : ${MAX_RETRIES}`);

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    let success = false;
    let lastErrorMsg = '';

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        await sleep(RETRY_DELAY_MS * attempt);
      }

      const { data, error } = await supabase
        .from('guests')
        .select('id, vip, avg_rating, visit_count, notes, tags, created_at, updated_at')
        .in('id', batch);

      if (error) {
        lastErrorMsg = error.message;
        // Schema errors are not retryable
        const isSchemaError =
          error.message.includes('column') ||
          error.message.includes('does not exist') ||
          (error as { code?: string }).code === '42703';
        if (isSchemaError) break;
        continue;
      }

      for (const row of (data ?? []) as RawGuestRow[]) {
        enrichmentMap.set(row.id, {
          id: row.id,
          vip: row.vip ?? false,
          avg_rating: row.avg_rating ?? null,
          visit_count: row.visit_count ?? 0,
          notes: row.notes ?? null,
          tags: Array.isArray(row.tags) ? row.tags : [],
          created_at: row.created_at ?? '',
          updated_at: row.updated_at ?? null,
        });
      }

      success = true;
      break;
    }

    if (!success) {
      failedBatchCount++;
      failedIds.push(...batch);
      console.warn(`  ⚠ Batch ${batchIdx + 1}/${totalBatches} échoué après ${MAX_RETRIES + 1} tentatives : ${lastErrorMsg}`);
    }

    const shouldLog =
      (batchIdx + 1) % LOG_EVERY_N_BATCHES === 0 ||
      batchIdx === totalBatches - 1;

    if (shouldLog) {
      const pct = Math.round(((batchIdx + 1) / totalBatches) * 100);
      console.log(
        `  Batch ${batchIdx + 1}/${totalBatches} (${pct}%) — enrichis : ${enrichmentMap.size}${failedBatchCount > 0 ? ` | batches échoués : ${failedBatchCount}` : ''}`
      );
    }
  }

  return { map: enrichmentMap, failedIds, failedBatchCount };
}

// ─── CSV ──────────────────────────────────────────────────────────────────────

function toCSVValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = Array.isArray(value) ? value.join(' | ') : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function generateCSV(groups: MergeGroup[]): string {
  const headers = [
    'group_id',
    'risk_level',
    'match_type',
    'confidence_score',
    'master_guest_id',
    'duplicate_guest_ids',
    'master_name',
    'duplicate_names',
    'phones',
    'emails',
    'vip_flags',
    'ratings',
    'reason',
    'master_selection_reason',
    'enrichment_partial',
    'merged_vip',
    'merged_rating',
    'notes_merge_required',
    'tags_merge_required',
    'recommended_action',
    'automatic_action',
  ];

  const rows = groups.map(g =>
    [
      g.group_id,
      g.risk_level,
      g.match_type,
      g.confidence_score,
      g.master_guest_id,
      g.duplicate_guest_ids.join(' | '),
      g.master_name,
      g.duplicate_names.join(' | '),
      g.phones.join(' | '),
      g.emails.join(' | '),
      g.vip_flags.join(' | '),
      g.ratings.join(' | '),
      g.reason,
      g.master_selection_reason,
      g.enrichment_partial,
      g.merged_data_preview.vip,
      g.merged_data_preview.avg_rating ?? '',
      g.merged_data_preview.notes_merge_required,
      g.merged_data_preview.tags_merge_required,
      g.recommended_action,
      g.automatic_action,
    ]
      .map(toCSVValue)
      .join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const auditPath = resolve(process.cwd(), 'reports/crm-quality-audit.json');
  console.log(`Lecture : ${auditPath}`);

  let auditData: unknown;
  try {
    auditData = JSON.parse(readFileSync(auditPath, 'utf-8'));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Rapport d'audit introuvable.\n→ Lancez d'abord : npm run crm:audit\n→ ${msg}`);
  }

  const audit = auditData as AuditReport;
  console.log(`  → ${audit.issues.length} issues chargées (audit du ${audit.generated_at})\n`);

  // ── Filter eligible groups ─────────────────────────────────────────────────
  const eligible = audit.issues.filter(issue => {
    if (
      issue.issue_type !== 'duplicate_phone_high_confidence' &&
      issue.issue_type !== 'duplicate_email_high_confidence'
    ) return false;
    if (issue.guest_ids.length > 5) return false;
    if (!namesAreSimilar(issue.first_names, issue.last_names)) return false;
    return true;
  });

  console.log(`Groupes éligibles pour la prévisualisation : ${eligible.length}`);
  console.log('  (phone/email exact, noms similaires, ≤ 5 fiches)\n');

  // ── Optional Supabase enrichment ──────────────────────────────────────────
  let enrichmentAttempted = false;
  let enrichmentMap = new Map<string, GuestEnrichment>();
  let failedIds: string[] = [];
  let failedBatchCount = 0;

  let supabase: SupabaseClient | null = null;
  try {
    supabase = createSupabaseAdmin();
  } catch {
    console.log('Supabase non disponible — enrichissement VIP/rating/notes désactivé.');
    console.log('→ Renseignez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans .env.import pour l\'activer.\n');
  }

  if (supabase !== null) {
    const allGuestIds = [...new Set(eligible.flatMap(i => i.guest_ids))];
    console.log(`Enrichissement Supabase — ${allGuestIds.length} clients à enrichir :`);
    enrichmentAttempted = true;

    const result = await enrichGuestsFromSupabase(supabase, allGuestIds);
    enrichmentMap = result.map;
    failedIds = result.failedIds;
    failedBatchCount = result.failedBatchCount;

    console.log(`\n  ✓ Enrichissement terminé : ${enrichmentMap.size}/${allGuestIds.length} clients`);
    if (failedBatchCount > 0) {
      console.log(`  ⚠ ${failedBatchCount} batch(es) échoué(s) — ${failedIds.length} clients non enrichis`);
    }
    console.log();
  }

  const failedIdSet = new Set(failedIds);

  // ── Build merge groups ────────────────────────────────────────────────────
  const mergeGroups: MergeGroup[] = [];
  let downgradedCount = 0;

  for (let idx = 0; idx < eligible.length; idx++) {
    const issue = eligible[idx];
    const groupId = `merge-${String(idx + 1).padStart(4, '0')}`;

    const candidates: GuestCandidate[] = issue.guest_ids.map((id, i) => ({
      id,
      first_name: issue.first_names[i] ?? null,
      last_name: issue.last_names[i] ?? null,
      phone: issue.phones[i] ?? null,
      email: issue.emails[i] ?? null,
      enrichment: enrichmentMap.get(id),
    }));

    const enrichmentPartial =
      enrichmentAttempted &&
      candidates.some(c => c.enrichment === undefined && failedIdSet.has(c.id));

    const { masterId, reason: masterReason, isDefinitive } = selectMaster(
      candidates,
      enrichmentAttempted
    );
    const duplicateIds = candidates.filter(c => c.id !== masterId).map(c => c.id);

    const masterCandidate = candidates.find(c => c.id === masterId)!;
    const duplicateCandidates = candidates.filter(c => c.id !== masterId);

    const risk = computeRisk(issue, isDefinitive);
    const action = computeAction(risk);
    const matchType = computeMatchType(issue);
    const mergedPreview = buildMergedDataPreview(candidates, masterId);

    const vipFlags = candidates.map(c => c.enrichment?.vip ?? false);
    const ratings = candidates.map(c => c.enrichment?.avg_rating ?? null);

    if (!isDefinitive) downgradedCount++;

    mergeGroups.push({
      group_id: groupId,
      risk_level: risk,
      match_type: matchType,
      confidence_score: issue.confidence_score,
      master_guest_id: masterId,
      duplicate_guest_ids: duplicateIds,
      master_name: formatGuestName(masterCandidate.first_name, masterCandidate.last_name),
      duplicate_names: duplicateCandidates.map(c =>
        formatGuestName(c.first_name, c.last_name)
      ),
      phones: issue.phones,
      emails: issue.emails,
      vip_flags: vipFlags,
      ratings,
      reason: issue.reason,
      master_selection_reason: masterReason,
      enrichment_partial: enrichmentPartial,
      merged_data_preview: mergedPreview,
      recommended_action: action,
      automatic_action: false,
    });
  }

  // ── Counts ────────────────────────────────────────────────────────────────
  const readyCount = mergeGroups.filter(g => g.recommended_action === 'ready_for_review').length;
  const humanCount = mergeGroups.filter(g => g.recommended_action === 'human_validation_required').length;
  const ignoreCount = mergeGroups.filter(g => g.recommended_action === 'ignore_for_now').length;

  const enrichmentStats: EnrichmentStats = {
    attempted: enrichmentAttempted,
    total_ids: enrichmentAttempted ? [...new Set(eligible.flatMap(i => i.guest_ids))].length : 0,
    enriched_count: enrichmentMap.size,
    failed_count: failedIds.length,
    failed_batch_count: failedBatchCount,
    failed_ids: failedIds.length <= 200 ? failedIds : failedIds.slice(0, 200),
    complete: enrichmentAttempted && failedIds.length === 0,
  };

  const counts = {
    ready_for_review: readyCount,
    human_validation_required: humanCount,
    ignore_for_now: ignoreCount,
    risk_low: mergeGroups.filter(g => g.risk_level === 'low').length,
    risk_medium: mergeGroups.filter(g => g.risk_level === 'medium').length,
    risk_high: mergeGroups.filter(g => g.risk_level === 'high').length,
    downgraded_due_to_partial_enrichment: downgradedCount,
    match_phone_exact: mergeGroups.filter(g => g.match_type === 'phone_exact').length,
    match_email_exact: mergeGroups.filter(g => g.match_type === 'email_exact').length,
    match_phone_and_email_exact: mergeGroups.filter(g => g.match_type === 'phone_and_email_exact').length,
  };

  // ── Write reports ─────────────────────────────────────────────────────────
  const reportsDir = resolve(process.cwd(), 'reports');
  mkdirSync(reportsDir, { recursive: true });

  const jsonPath = resolve(reportsDir, 'crm-merge-plan-preview.json');
  const csvPath = resolve(reportsDir, 'crm-merge-plan-preview.csv');

  const previewReport: PreviewReport = {
    generated_at: new Date().toISOString(),
    source_audit_date: audit.generated_at,
    enrichment: enrichmentStats,
    total_groups_analyzed: mergeGroups.length,
    counts,
    groups: mergeGroups,
  };

  writeFileSync(jsonPath, JSON.stringify(previewReport, null, 2), 'utf-8');
  writeFileSync(csvPath, generateCSV(mergeGroups), 'utf-8');

  // ── Terminal output ───────────────────────────────────────────────────────
  console.log('─── Résultats de la prévisualisation ─────────────────────────');
  console.log(`Groupes analysés                          : ${mergeGroups.length}`);
  console.log(`  ready_for_review                        : ${readyCount}`);
  console.log(`  human_validation_required               : ${humanCount}`);
  console.log(`  ignore_for_now                          : ${ignoreCount}`);
  console.log(`Risque faible (low)                       : ${counts.risk_low}`);
  console.log(`Risque moyen (medium)                     : ${counts.risk_medium}`);
  console.log(`Risque élevé (high)                       : ${counts.risk_high}`);
  console.log(`Groupes déclassés (enrichissement partiel): ${downgradedCount}`);
  console.log(`Match téléphone exact                     : ${counts.match_phone_exact}`);
  console.log(`Match email exact                         : ${counts.match_email_exact}`);
  console.log(`Match téléphone + email exact             : ${counts.match_phone_and_email_exact}`);
  if (enrichmentAttempted) {
    console.log(`Enrichissement Supabase                   : ${enrichmentMap.size}/${enrichmentStats.total_ids} clients`);
    console.log(`Batches échoués                           : ${failedBatchCount}`);
    console.log(`Enrichissement complet                    : ${enrichmentStats.complete ? 'oui' : 'non'}`);
  } else {
    console.log(`Enrichissement Supabase                   : désactivé`);
  }
  console.log('──────────────────────────────────────────────────────────────');

  const top20 = mergeGroups
    .filter(g => g.recommended_action === 'ready_for_review')
    .slice(0, 20);

  if (top20.length > 0) {
    console.log('\n── Top 20 groupes prêts pour review ──────────────────────────');
    for (const g of top20) {
      const contact =
        g.match_type === 'email_exact'
          ? (g.emails.find(e => e !== null) ?? '—')
          : (g.phones.find(p => p !== null) ?? '—');
      const names = [g.master_name, ...g.duplicate_names].join(' / ');
      const vipNote = g.merged_data_preview.vip ? ' [VIP]' : '';
      const ratingNote =
        g.merged_data_preview.avg_rating !== null
          ? ` [★ ${g.merged_data_preview.avg_rating}]`
          : '';
      const partialNote = g.enrichment_partial ? ' ⚠ enrichissement partiel' : '';
      console.log(`  [${g.group_id}] ${contact}${vipNote}${ratingNote}${partialNote}`);
      console.log(`    Noms    : ${names}`);
      console.log(`    Master  : ${g.master_guest_id} (${g.master_selection_reason})`);
      console.log(`    Match   : ${g.match_type} | Risque : ${g.risk_level}`);
    }
  } else {
    console.log('\n⚠ Aucun groupe ready_for_review — enrichissement peut-être incomplet.');
    console.log('→ Relancez avec Supabase disponible pour affiner le scoring.');
  }

  console.log('\nRapports générés :');
  console.log(`  JSON → ${jsonPath}`);
  console.log(`  CSV  → ${csvPath}`);
  console.log('\n✅ Prévisualisation terminée — aucune donnée modifiée.\n');
}

main().catch(err => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\n✗ Erreur fatale : ${msg}\n`);
  process.exit(1);
});

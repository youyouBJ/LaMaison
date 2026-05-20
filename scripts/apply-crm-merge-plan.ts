/**
 * CRM Merge Apply — DRY RUN par défaut, APPLY avec confirmation explicite
 *
 * Lit reports/crm-merge-plan-preview.json et applique les fusions pour les
 * groupes low risk / ready_for_review dont le master a été choisi sur des données
 * réelles (pas "premier de la liste par défaut").
 *
 * Strategy V1 :
 *   - Rattacher les réservations, waitlist et feedbacks au master_guest_id.
 *   - Mettre à jour le master avec les meilleures données disponibles.
 *   - NE PAS supprimer les fiches dupliquées (pas de colonne archived/merged_into).
 *     Les doublons restent dans la base mais n'ont plus de réservations associées.
 *     Ils seront archivés ou supprimés dans une V2 après validation.
 *
 * Usage :
 *   npm run crm:merge:dry-run               # simule 20 groupes, aucune écriture
 *   npm run crm:merge:dry-run:related       # simule 20 groupes avec impact FK réel
 *   npm run crm:merge:apply                 # applique 20 groupes AVEC confirmation CLI
 *
 *   Options :
 *     --dry-run                    mode simulation (défaut)
 *     --apply                      mode application réelle
 *     --confirm=MERGE_LOW_RISK_CRM requis avec --apply
 *     --limit=N                    nombre de groupes à traiter (défaut : 20)
 *     --only-with-related          ne traiter que les groupes dont le doublon
 *                                  a au moins 1 réservation/waitlist/feedback lié
 */

import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';

dotenvConfig({ path: resolve(process.cwd(), '.env.import') });

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdmin } from './lib/supabaseAdmin';

// ─── Banner ───────────────────────────────────────────────────────────────────

const CONFIRM_TOKEN = 'MERGE_LOW_RISK_CRM';

// ─── Types ────────────────────────────────────────────────────────────────────

type MergeMode = 'dry-run' | 'apply';
type MergeStatus = 'simulated' | 'applied' | 'skipped' | 'failed';
type DuplicateAction = 'kept_as_is_v1';

interface CliOptions {
  mode: MergeMode;
  limit: number;
  confirmed: boolean;
  onlyWithRelated: boolean;
}

interface MergeGroupPreview {
  group_id: string;
  risk_level: string;
  match_type: string;
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
  merged_data_preview: {
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    email: string | null;
    vip: boolean;
    avg_rating: number | null;
    notes_merge_required: boolean;
    tags_merge_required: boolean;
  };
  recommended_action: string;
  automatic_action: false;
}

interface PreviewReport {
  generated_at: string;
  source_audit_date: string;
  total_groups_analyzed: number;
  groups: MergeGroupPreview[];
}

interface GuestRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  vip: boolean;
  avg_rating: number | null;
  notes: string | null;
  tags: string[];
  birthday: string | null;
  last_visit: string | null;
  visit_count: number;
  no_shows: number;
  cancels: number;
  avg_spend: number | null;
  marketing_opt_in: boolean;
}

interface GuestUpdate {
  phone?: string | null;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  vip?: boolean;
  avg_rating?: number | null;
  notes?: string | null;
  tags?: string[];
  birthday?: string | null;
  last_visit?: string | null;
}

interface RelatedCounts {
  reservations: number | null;
  waitlist: number | null;
  feedback_survey_links: number | null;
  feedback_surveys: number | null;
  counts_available: boolean;
}

interface MergeResult {
  group_id: string;
  mode: MergeMode;
  master_guest_id: string;
  duplicate_guest_ids: string[];
  reservations_to_reassign_count: number | null;
  waitlist_to_reassign_count: number | null;
  feedback_to_reassign_count: number | null;
  counts_available: boolean;
  master_updates_preview: GuestUpdate;
  duplicate_action: DuplicateAction;
  status: MergeStatus;
  error: string | null;
  skip_reason: string | null;
  applied_at: string | null;
}

// ─── CLI args ─────────────────────────────────────────────────────────────────

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);

  const hasApply = args.includes('--apply');
  const hasDryRun = args.includes('--dry-run') || !hasApply;
  const mode: MergeMode = hasApply && !hasDryRun ? 'apply' : 'dry-run';

  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 20;
  if (isNaN(limit) || limit < 1) {
    throw new Error(`--limit invalide. Utilisez --limit=20`);
  }

  const confirmArg = args.find(a => a.startsWith('--confirm='));
  const confirmed = confirmArg?.split('=')[1] === CONFIRM_TOKEN;

  const onlyWithRelated = args.includes('--only-with-related');

  return { mode, limit, confirmed, onlyWithRelated };
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

// ─── Group eligibility filter ─────────────────────────────────────────────────

function isEligible(group: MergeGroupPreview): { ok: boolean; reason: string } {
  if (group.recommended_action !== 'ready_for_review') {
    return { ok: false, reason: `recommended_action = ${group.recommended_action}` };
  }
  if (group.risk_level !== 'low') {
    return { ok: false, reason: `risk_level = ${group.risk_level}` };
  }
  if (group.duplicate_guest_ids.length !== 1) {
    return { ok: false, reason: `group_size = ${group.duplicate_guest_ids.length + 1} (V1 : taille 2 uniquement)` };
  }
  if (group.enrichment_partial) {
    return { ok: false, reason: 'enrichissement partiel — données insuffisantes' };
  }
  if (
    group.master_selection_reason.includes('défaut') ||
    group.master_selection_reason.includes('default') ||
    group.master_selection_reason.includes('partiel')
  ) {
    return { ok: false, reason: `master choisi par défaut : "${group.master_selection_reason}"` };
  }
  return { ok: true, reason: '' };
}

// ─── Guest data ───────────────────────────────────────────────────────────────

async function loadGuests(
  supabase: SupabaseClient,
  ids: string[]
): Promise<Map<string, GuestRow>> {
  const { data, error } = await supabase
    .from('guests')
    .select(
      'id, first_name, last_name, phone, email, vip, avg_rating, notes, tags, ' +
      'birthday, last_visit, visit_count, no_shows, cancels, avg_spend, marketing_opt_in'
    )
    .in('id', ids);

  if (error) throw new Error(`Erreur chargement guests : ${error.message}`);

  const map = new Map<string, GuestRow>();
  for (const row of (data ?? []) as unknown as GuestRow[]) {
    map.set(row.id, {
      ...row,
      vip: row.vip ?? false,
      tags: Array.isArray(row.tags) ? row.tags : [],
      visit_count: row.visit_count ?? 0,
      no_shows: row.no_shows ?? 0,
      cancels: row.cancels ?? 0,
    });
  }
  return map;
}

// ─── Master update computation ────────────────────────────────────────────────

function computeGuestUpdate(master: GuestRow, duplicates: GuestRow[]): GuestUpdate {
  const update: GuestUpdate = {};

  if (!master.phone) {
    const best = duplicates.find(d => d.phone)?.phone ?? null;
    if (best) update.phone = best;
  }

  if (!master.email) {
    const best = duplicates.find(d => d.email)?.email ?? null;
    if (best) update.email = best;
  }

  if (!master.first_name) {
    const best = duplicates.find(d => d.first_name)?.first_name ?? null;
    if (best) update.first_name = best;
  }

  if (!master.last_name) {
    const best = duplicates.find(d => d.last_name)?.last_name ?? null;
    if (best) update.last_name = best;
  }

  if (!master.vip && duplicates.some(d => d.vip)) {
    update.vip = true;
  }

  const allRatings = [master, ...duplicates]
    .map(g => g.avg_rating)
    .filter((r): r is number => r !== null && r > 0);
  if (allRatings.length > 0) {
    const best = Math.max(...allRatings);
    if (best !== master.avg_rating) update.avg_rating = best;
  }

  if (!master.birthday) {
    const best = duplicates.find(d => d.birthday)?.birthday ?? null;
    if (best) update.birthday = best;
  }

  const allLastVisits = [master, ...duplicates]
    .map(g => g.last_visit)
    .filter((v): v is string => !!v)
    .sort()
    .reverse();
  if (allLastVisits.length > 0 && allLastVisits[0] !== master.last_visit) {
    update.last_visit = allLastVisits[0];
  }

  // Notes: concat distinct notes with separator
  const allNotes = [master, ...duplicates]
    .map(g => g.notes?.trim() ?? null)
    .filter((n): n is string => !!n);
  const uniqueNotes = [...new Set(allNotes)];
  if (uniqueNotes.length > 1) {
    update.notes = uniqueNotes.join('\n---\n');
  }

  // Tags: union, lowercase, deduped, sorted
  const allTags = [master, ...duplicates].flatMap(g => g.tags);
  const uniqueTags = [...new Set(allTags.map(t => t.toLowerCase().trim()))].sort();
  const currentTags = master.tags.map(t => t.toLowerCase().trim()).sort();
  if (JSON.stringify(uniqueTags) !== JSON.stringify(currentTags)) {
    update.tags = uniqueTags;
  }

  return update;
}

// ─── Related rows count ───────────────────────────────────────────────────────

async function countRelatedRows(
  supabase: SupabaseClient,
  table: string,
  duplicateId: string
): Promise<number | null> {
  const { data, error } = await supabase
    .from(table)
    .select('id')
    .eq('guest_id', duplicateId);

  if (error) {
    return null;
  }
  return (data ?? []).length;
}

async function countAllRelated(
  supabase: SupabaseClient,
  duplicateId: string
): Promise<RelatedCounts> {
  const [reservations, waitlist, feedbackLinks, feedbackSurveys] = await Promise.all([
    countRelatedRows(supabase, 'reservations', duplicateId),
    countRelatedRows(supabase, 'waitlist', duplicateId),
    countRelatedRows(supabase, 'feedback_survey_links', duplicateId),
    countRelatedRows(supabase, 'feedback_surveys', duplicateId),
  ]);
  const counts_available =
    reservations !== null &&
    waitlist !== null &&
    feedbackLinks !== null &&
    feedbackSurveys !== null;
  return {
    reservations,
    waitlist,
    feedback_survey_links: feedbackLinks,
    feedback_surveys: feedbackSurveys,
    counts_available,
  };
}

// ─── Related rows reassignment ────────────────────────────────────────────────

async function reassignRelatedRows(
  supabase: SupabaseClient,
  table: string,
  masterId: string,
  duplicateId: string
): Promise<{ count: number; error: string | null }> {
  const { data, error } = await supabase
    .from(table)
    .update({ guest_id: masterId })
    .eq('guest_id', duplicateId)
    .select('id');

  if (error) return { count: 0, error: error.message };
  return { count: data?.length ?? 0, error: null };
}

// ─── Process one group ────────────────────────────────────────────────────────

async function processGroup(
  supabase: SupabaseClient,
  group: MergeGroupPreview,
  mode: MergeMode,
  knownCounts?: RelatedCounts
): Promise<MergeResult> {
  const base: Pick<MergeResult, 'group_id' | 'mode' | 'master_guest_id' | 'duplicate_guest_ids' | 'duplicate_action'> = {
    group_id: group.group_id,
    mode,
    master_guest_id: group.master_guest_id,
    duplicate_guest_ids: group.duplicate_guest_ids,
    duplicate_action: 'kept_as_is_v1',
  };

  const duplicateId = group.duplicate_guest_ids[0];

  // Load fresh guest data from Supabase
  let guestMap: Map<string, GuestRow>;
  const nullCounts = { reservations_to_reassign_count: null, waitlist_to_reassign_count: null, feedback_to_reassign_count: null, counts_available: false };

  try {
    guestMap = await loadGuests(supabase, [group.master_guest_id, duplicateId]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ...base, ...nullCounts, master_updates_preview: {}, status: 'failed', error: msg, skip_reason: null, applied_at: null };
  }

  const masterGuest = guestMap.get(group.master_guest_id);
  const duplicateGuest = guestMap.get(duplicateId);

  if (!masterGuest) {
    return { ...base, ...nullCounts, master_updates_preview: {}, status: 'skipped', error: null, skip_reason: `master introuvable en base (id: ${group.master_guest_id})`, applied_at: null };
  }
  if (!duplicateGuest) {
    return { ...base, ...nullCounts, master_updates_preview: {}, status: 'skipped', error: null, skip_reason: `doublon introuvable en base (id: ${duplicateId})`, applied_at: null };
  }

  const masterUpdate = computeGuestUpdate(masterGuest, [duplicateGuest]);
  const relatedCounts = knownCounts ?? await countAllRelated(supabase, duplicateId);

  const fbl = relatedCounts.feedback_survey_links;
  const fbs = relatedCounts.feedback_surveys;
  const feedbackTotal = fbl !== null && fbs !== null ? fbl + fbs : null;

  const countsBase = {
    reservations_to_reassign_count: relatedCounts.reservations,
    waitlist_to_reassign_count: relatedCounts.waitlist,
    feedback_to_reassign_count: feedbackTotal,
    counts_available: relatedCounts.counts_available,
  };

  if (mode === 'dry-run') {
    return {
      ...base,
      ...countsBase,
      master_updates_preview: masterUpdate,
      status: 'simulated',
      error: null,
      skip_reason: null,
      applied_at: null,
    };
  }

  // ── APPLY mode ──────────────────────────────────────────────────────────────
  const errors: string[] = [];

  // 1. Reassign FK tables
  for (const table of ['reservations', 'waitlist', 'feedback_survey_links', 'feedback_surveys'] as const) {
    const { error } = await reassignRelatedRows(supabase, table, group.master_guest_id, duplicateId);
    if (error) errors.push(`${table}: ${error}`);
  }

  // 2. Update master guest
  if (Object.keys(masterUpdate).length > 0) {
    const { error } = await supabase
      .from('guests')
      .update(masterUpdate)
      .eq('id', group.master_guest_id);
    if (error) errors.push(`guest update: ${error.message}`);
  }

  if (errors.length > 0) {
    return {
      ...base,
      ...countsBase,
      master_updates_preview: masterUpdate,
      status: 'failed',
      error: errors.join(' | '),
      skip_reason: null,
      applied_at: new Date().toISOString(),
    };
  }

  return {
    ...base,
    ...countsBase,
    master_updates_preview: masterUpdate,
    status: 'applied',
    error: null,
    skip_reason: null,
    applied_at: new Date().toISOString(),
  };
}

// ─── CSV ──────────────────────────────────────────────────────────────────────

function toCSVValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str =
    typeof value === 'object' && !Array.isArray(value)
      ? JSON.stringify(value)
      : Array.isArray(value)
        ? (value as unknown[]).join(' | ')
        : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function generateCSV(results: MergeResult[]): string {
  const headers = [
    'group_id', 'mode', 'master_guest_id', 'duplicate_guest_ids',
    'reservations_to_reassign_count', 'waitlist_to_reassign_count', 'feedback_to_reassign_count',
    'counts_available', 'master_updates_preview', 'duplicate_action', 'status', 'error', 'skip_reason', 'applied_at',
  ];
  const rows = results.map(r =>
    [
      r.group_id, r.mode, r.master_guest_id, r.duplicate_guest_ids.join(' | '),
      r.reservations_to_reassign_count, r.waitlist_to_reassign_count, r.feedback_to_reassign_count,
      r.counts_available, r.master_updates_preview, r.duplicate_action, r.status, r.error, r.skip_reason, r.applied_at,
    ].map(toCSVValue).join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const opts = parseArgs();

  const modeLabel = opts.mode === 'apply'
    ? '✅ APPLY — écriture réelle dans Supabase'
    : '🔍 DRY RUN — aucune écriture';

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  if (opts.mode === 'dry-run') {
    console.log('║  READ ONLY — aucune donnée Supabase ne sera modifiée         ║');
  } else {
    console.log('║  APPLY MODE — les données Supabase seront modifiées          ║');
  }
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`\nMode    : ${modeLabel}`);
  console.log(`Limite  : ${opts.limit} groupes`);
  if (opts.onlyWithRelated) {
    console.log(`Filtre  : --only-with-related (impact FK réel uniquement)`);
  }
  console.log('');

  // Confirmation required in apply mode
  if (opts.mode === 'apply' && !opts.confirmed) {
    console.error('✗ Confirmation manquante.');
    console.error(`→ Ajoutez --confirm=${CONFIRM_TOKEN} à la commande pour confirmer l'application.\n`);
    process.exit(1);
  }

  // Load env (required in both modes — needed for Supabase read + write)
  requireEnv('SUPABASE_URL');
  requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const restaurantId = requireEnv('RESTAURANT_ID');
  console.log(`Restaurant ID : ${restaurantId}\n`);

  // Load preview report
  const previewPath = resolve(process.cwd(), 'reports/crm-merge-plan-preview.json');
  console.log(`Lecture : ${previewPath}`);

  let rawPreview: unknown;
  try {
    rawPreview = JSON.parse(readFileSync(previewPath, 'utf-8'));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Rapport preview introuvable.\n→ Lancez d'abord : npm run crm:merge:preview\n→ ${msg}`);
  }

  const preview = rawPreview as PreviewReport;
  console.log(`  → ${preview.groups.length} groupes dans le rapport (généré le ${preview.generated_at})\n`);

  // Filter eligible groups
  const eligible: MergeGroupPreview[] = [];
  const skippedAtFilter: Array<{ group_id: string; reason: string }> = [];

  for (const group of preview.groups) {
    const { ok, reason } = isEligible(group);
    if (ok) {
      eligible.push(group);
    } else {
      skippedAtFilter.push({ group_id: group.group_id, reason });
    }
  }

  console.log(`Groupes éligibles (low risk, master data-driven, taille 2) : ${eligible.length}`);
  console.log(`Groupes exclus : ${skippedAtFilter.length}`);

  // Init Supabase
  const supabase = createSupabaseAdmin();

  // Optional pre-scan: filter eligible groups to those with at least one related FK row
  const countsCache = new Map<string, RelatedCounts>();
  let candidateGroups: MergeGroupPreview[] = eligible;

  if (opts.onlyWithRelated) {
    if (eligible.length === 0) {
      console.log('Aucun groupe éligible — filtre --only-with-related sans effet.\n');
    } else {
      // Probe first group to detect permission issues early
      const probeId = eligible[0].duplicate_guest_ids[0];
      const probeCount = await countRelatedRows(supabase, 'reservations', probeId);
      if (probeCount === null) {
        console.error(
          '\n✗ --only-with-related requiert un accès SELECT sur les tables FK.\n' +
          '  Les requêtes COUNT ont retourné une erreur (permission denied).\n' +
          '  Ajoutez ces GRANTs dans Supabase avant de relancer :\n\n' +
          '    GRANT SELECT, UPDATE ON reservations TO service_role;\n' +
          '    GRANT SELECT, UPDATE ON waitlist TO service_role;\n' +
          '    GRANT SELECT, UPDATE ON feedback_survey_links TO service_role;\n' +
          '    GRANT SELECT, UPDATE ON feedback_surveys TO service_role;\n'
        );
        process.exit(1);
      }

      console.log(`\nScan des ${eligible.length} groupes éligibles pour impact lié…`);
      const withRelated: MergeGroupPreview[] = [];

      for (let i = 0; i < eligible.length; i++) {
        const group = eligible[i];
        const duplicateId = group.duplicate_guest_ids[0];
        const counts = await countAllRelated(supabase, duplicateId);
        countsCache.set(duplicateId, counts);

        const total =
          (counts.reservations ?? 0) +
          (counts.waitlist ?? 0) +
          (counts.feedback_survey_links ?? 0) +
          (counts.feedback_surveys ?? 0);

        if (total > 0) {
          withRelated.push(group);
        }

        if ((i + 1) % 10 === 0 || i === eligible.length - 1) {
          process.stdout.write(`  ${i + 1}/${eligible.length} scannés, ${withRelated.length} avec impact…\r`);
        }
      }
      process.stdout.write('\n');

      candidateGroups = withRelated;
      console.log(`Groupes avec impact lié (reservations/waitlist/feedback) : ${candidateGroups.length}`);
    }
  }

  const toProcess = candidateGroups.slice(0, opts.limit);
  console.log(`Groupes à traiter (limite ${opts.limit}) : ${toProcess.length}\n`);

  // Process groups
  const results: MergeResult[] = [];
  let processedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  let totalReservations = 0;
  let totalWaitlist = 0;
  let totalFeedback = 0;

  for (const group of toProcess) {
    const duplicateId = group.duplicate_guest_ids[0];
    const knownCounts = countsCache.get(duplicateId);
    process.stdout.write(`  [${group.group_id}] ${group.master_name} … `);
    const result = await processGroup(supabase, group, opts.mode, knownCounts);
    results.push(result);

    totalReservations += result.reservations_to_reassign_count ?? 0;
    totalWaitlist += result.waitlist_to_reassign_count ?? 0;
    totalFeedback += result.feedback_to_reassign_count ?? 0;

    if (result.status === 'failed') {
      failedCount++;
      console.log(`✗ FAILED — ${result.error}`);
    } else if (result.status === 'skipped') {
      skippedCount++;
      console.log(`⊘ skipped — ${result.skip_reason}`);
    } else {
      processedCount++;
      const updateKeys = Object.keys(result.master_updates_preview);
      const updateSummary = updateKeys.length > 0 ? `maj: [${updateKeys.join(', ')}]` : 'aucune mise à jour master';
      const fmt = (n: number | null) => n !== null ? String(n) : '?';
      const fkSummary = `res:${fmt(result.reservations_to_reassign_count)} wait:${fmt(result.waitlist_to_reassign_count)} fb:${fmt(result.feedback_to_reassign_count)}`;
      console.log(`✓ ${result.status} — ${fkSummary} | ${updateSummary}`);
    }
  }

  // Warn once if counts were unavailable (permission denied on FK tables)
  const countsUnavailable = results.some(r => !r.counts_available);
  if (countsUnavailable) {
    console.log(
      '\n⚠  Les requêtes COUNT sur reservations/waitlist/feedback ont échoué (permission denied).' +
      '\n   Les colonnes res/wait/fb affichent "?" — la fiche guest est correctement lue et les' +
      '\n   champs seront mis à jour.' +
      '\n   En mode APPLY, les UPDATE sur ces tables peuvent également échouer.' +
      '\n   → Vérifiez les GRANTs Supabase : GRANT SELECT, UPDATE ON reservations, waitlist,' +
      '\n     feedback_survey_links, feedback_surveys TO service_role;\n'
    );
  }

  // Write reports
  const reportsDir = resolve(process.cwd(), 'reports');
  mkdirSync(reportsDir, { recursive: true });

  const reportSuffix = opts.mode === 'apply' ? 'apply-result' : 'dry-run';
  const jsonPath = resolve(reportsDir, `crm-merge-${reportSuffix}.json`);
  const csvPath = resolve(reportsDir, `crm-merge-${reportSuffix}.csv`);

  const fullReport = {
    generated_at: new Date().toISOString(),
    mode: opts.mode,
    source_preview: previewPath,
    source_preview_date: preview.generated_at,
    restaurant_id: restaurantId,
    limit: opts.limit,
    summary: {
      eligible_in_preview: eligible.length,
      only_with_related: opts.onlyWithRelated,
      related_total_count: opts.onlyWithRelated ? candidateGroups.length : null,
      processed: processedCount,
      failed: failedCount,
      skipped_in_processing: skippedCount,
      skipped_at_filter: skippedAtFilter.length,
      total_reservations_reassigned: totalReservations,
      total_waitlist_reassigned: totalWaitlist,
      total_feedback_reassigned: totalFeedback,
    },
    results,
    skipped_at_filter: skippedAtFilter,
  };

  writeFileSync(jsonPath, JSON.stringify(fullReport, null, 2), 'utf-8');
  writeFileSync(csvPath, generateCSV(results), 'utf-8');

  // Terminal summary
  console.log('\n─── Résumé ───────────────────────────────────────────────────────');
  console.log(`Mode                         : ${opts.mode}`);
  console.log(`Groupes éligibles            : ${eligible.length}`);
  if (opts.onlyWithRelated) {
    console.log(`Groupes avec impact lié      : ${candidateGroups.length}`);
  }
  console.log(`Traités (limite ${String(opts.limit).padStart(3)})         : ${toProcess.length}`);
  console.log(`  ✓ ${opts.mode === 'apply' ? 'Appliqués' : 'Simulés'}               : ${processedCount}`);
  console.log(`  ⊘ Ignorés (données)        : ${skippedCount}`);
  console.log(`  ✗ Échecs                   : ${failedCount}`);
  console.log(`Réservations rattachées      : ${totalReservations}`);
  console.log(`Waitlist rattachées          : ${totalWaitlist}`);
  console.log(`Feedbacks rattachés          : ${totalFeedback}`);
  console.log(`Doublons supprimés           : 0 (V1 — conservation)`);
  console.log('─────────────────────────────────────────────────────────────────');
  console.log('\nRapports générés :');
  console.log(`  JSON → ${jsonPath}`);
  console.log(`  CSV  → ${csvPath}`);

  if (opts.mode === 'dry-run') {
    console.log('\n→ Pour appliquer réellement, lancez :');
    console.log(`  npm run crm:merge:apply -- --confirm=${CONFIRM_TOKEN}\n`);
  } else {
    console.log('\n✅ Application terminée.\n');
  }
}

main().catch(err => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\n✗ Erreur fatale : ${msg}\n`);
  process.exit(1);
});

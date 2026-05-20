/**
 * CRM Audit Summary — READ ONLY
 *
 * Lit reports/crm-quality-audit.json et génère une synthèse priorisée :
 * - high_confidence_cleanup   : doublons téléphone/email
 * - medium_confidence_review  : noms inversés, doublons nom+téléphone
 * - low_confidence_ignore_for_now : fuzzy nom seul, dirty_name, missing_phone
 *
 * Usage :
 *   npm run crm:audit:summary
 *
 * Prérequis : npm run crm:audit doit avoir été exécuté au préalable.
 * Aucune connexion Supabase — lecture fichier uniquement.
 *
 * Note : les champs VIP, rating, notes et tags ne sont pas inclus dans le
 * rapport d'audit V1. Un enrichissement Supabase en lecture seule pourra être
 * ajouté dans une future version du script de fusion contrôlée.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

// ─── Banner ───────────────────────────────────────────────────────────────────

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

type ConfidenceTier =
  | 'high_confidence_cleanup'
  | 'medium_confidence_review'
  | 'low_confidence_ignore_for_now';

type Recommendation =
  | 'fusion contrôlée recommandée'
  | 'validation humaine nécessaire'
  | "ignorer pour l'instant";

interface AuditStats {
  total: number;
  withPhone: number;
  withEmail: number;
  duplicatePhoneGroups: number;
  duplicateEmailGroups: number;
  probableDuplicates: number;
  suspiciousRecords: number;
}

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
  stats: AuditStats;
  issues: AuditIssue[];
}

interface SummaryGroup {
  tier: ConfidenceTier;
  issue_type: IssueType;
  confidence_score: number;
  action_score: number;
  group_size: number;
  guest_ids: string[];
  first_names: (string | null)[];
  last_names: (string | null)[];
  phones: (string | null)[];
  emails: (string | null)[];
  names_similar: boolean;
  reason: string;
  recommendation: Recommendation;
  automatic_action: false;
}

interface SummaryCounts {
  high_confidence_cleanup: number;
  medium_confidence_review: number;
  low_confidence_ignore_for_now: number;
  phone_duplicate_groups: number;
  email_duplicate_groups: number;
  reversed_name_groups: number;
  name_duplicate_medium: number;
  name_duplicate_low: number;
  total_guests_impacted_high: number;
  groups_fusion_recommended: number;
  groups_human_validation: number;
}

interface SummaryReport {
  generated_at: string;
  source_file: string;
  source_audit_date: string;
  original_stats: AuditStats;
  counts: SummaryCounts;
  top_100_actionable: SummaryGroup[];
  medium_confidence_groups: SummaryGroup[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function namesAreSimilar(
  firstNames: (string | null)[],
  lastNames: (string | null)[]
): boolean {
  const nonNullFirst = firstNames.filter((n): n is string => !!n?.trim());
  const nonNullLast = lastNames.filter((n): n is string => !!n?.trim());

  if (nonNullFirst.length > 0) {
    const unique = new Set(nonNullFirst.map(n => n.toLowerCase().trim()));
    if (unique.size === 1) return true;
  }

  if (nonNullLast.length > 0) {
    const unique = new Set(nonNullLast.map(n => n.toLowerCase().trim()));
    if (unique.size === 1) return true;
  }

  return false;
}

/**
 * Action score = confidence × name_similarity_bonus × (1 / group_size).
 *
 * Petits groupes avec noms identiques remontent en tête.
 * Groupes hôtel/entreprise partagés (69 fiches, noms différents) tombent en bas.
 */
function computeActionScore(issue: AuditIssue): number {
  const similarBonus = namesAreSimilar(issue.first_names, issue.last_names) ? 2 : 1;
  const raw = issue.confidence_score * similarBonus * (1 / issue.guest_ids.length);
  return Math.round(raw * 1000) / 1000;
}

function classifyIssue(issue: AuditIssue): ConfidenceTier {
  if (
    issue.issue_type === 'duplicate_phone_high_confidence' ||
    issue.issue_type === 'duplicate_email_high_confidence'
  ) {
    return 'high_confidence_cleanup';
  }

  if (issue.issue_type === 'reversed_name_possible_duplicate') {
    return 'medium_confidence_review';
  }

  if (
    issue.issue_type === 'possible_name_duplicate' &&
    issue.confidence_score === 0.75
  ) {
    const hasContactInfo = issue.phones.some(p => p !== null) || issue.emails.some(e => e !== null);
    if (hasContactInfo) return 'medium_confidence_review';
  }

  return 'low_confidence_ignore_for_now';
}

function computeRecommendation(
  issue: AuditIssue,
  tier: ConfidenceTier
): Recommendation {
  if (tier === 'low_confidence_ignore_for_now') return "ignorer pour l'instant";

  if (tier === 'high_confidence_cleanup') {
    return namesAreSimilar(issue.first_names, issue.last_names)
      ? 'fusion contrôlée recommandée'
      : 'validation humaine nécessaire';
  }

  return 'validation humaine nécessaire';
}

function toSummaryGroup(issue: AuditIssue): SummaryGroup {
  const tier = classifyIssue(issue);
  return {
    tier,
    issue_type: issue.issue_type,
    confidence_score: issue.confidence_score,
    action_score: computeActionScore(issue),
    group_size: issue.guest_ids.length,
    guest_ids: issue.guest_ids,
    first_names: issue.first_names,
    last_names: issue.last_names,
    phones: issue.phones,
    emails: issue.emails,
    names_similar: namesAreSimilar(issue.first_names, issue.last_names),
    reason: issue.reason,
    recommendation: computeRecommendation(issue, tier),
    automatic_action: false,
  };
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

function toCSVValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = Array.isArray(value) ? value.join(' | ') : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function generateCSV(groups: SummaryGroup[]): string {
  const headers = [
    'tier',
    'issue_type',
    'confidence_score',
    'action_score',
    'group_size',
    'names_similar',
    'recommendation',
    'guest_ids',
    'first_names',
    'last_names',
    'phones',
    'emails',
    'reason',
    'automatic_action',
  ];

  const rows = groups.map(g =>
    [
      g.tier,
      g.issue_type,
      g.confidence_score,
      g.action_score,
      g.group_size,
      g.names_similar,
      g.recommendation,
      g.guest_ids.join(' | '),
      g.first_names.join(' | '),
      g.last_names.join(' | '),
      g.phones.join(' | '),
      g.emails.join(' | '),
      g.reason,
      g.automatic_action,
    ]
      .map(toCSVValue)
      .join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

// ─── Terminal helpers ─────────────────────────────────────────────────────────

function formatGroupLine(g: SummaryGroup): string {
  const contact =
    g.issue_type === 'duplicate_email_high_confidence'
      ? (g.emails.find(e => e !== null) ?? '—')
      : (g.phones.find(p => p !== null) ?? g.emails.find(e => e !== null) ?? '—');
  const names = g.first_names
    .map((fn, i) => `${fn ?? ''} ${g.last_names[i] ?? ''}`.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join(' / ');
  const overflow = g.group_size > 4 ? ` (+${g.group_size - 4} autres)` : '';
  return `  [${g.group_size} fiches] ${contact}\n    Noms  : ${names}${overflow}\n    Reco  : ${g.recommendation}  (score ${g.action_score})`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  const auditPath = resolve(process.cwd(), 'reports/crm-quality-audit.json');

  console.log(`Lecture : ${auditPath}`);

  let rawData: unknown;
  try {
    rawData = JSON.parse(readFileSync(auditPath, 'utf-8'));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Impossible de lire le rapport d'audit.\n→ Lancez d'abord : npm run crm:audit\n→ Erreur : ${msg}`
    );
  }

  const report = rawData as AuditReport;
  const { stats, issues } = report;

  console.log(`  → ${issues.length} issues chargées depuis l'audit du ${report.generated_at}\n`);
  console.log('Priorisation en cours...\n');

  // ── Classify ────────────────────────────────────────────────────────────────
  const highGroups: SummaryGroup[] = [];
  const mediumGroups: SummaryGroup[] = [];
  let lowCount = 0;
  let lowNameCount = 0;

  for (const issue of issues) {
    const tier = classifyIssue(issue);
    if (tier === 'high_confidence_cleanup') {
      highGroups.push(toSummaryGroup(issue));
    } else if (tier === 'medium_confidence_review') {
      mediumGroups.push(toSummaryGroup(issue));
    } else {
      lowCount++;
      if (issue.issue_type === 'possible_name_duplicate') lowNameCount++;
    }
  }

  // Sort by action_score descending
  highGroups.sort((a, b) => b.action_score - a.action_score);
  mediumGroups.sort((a, b) => b.action_score - a.action_score);

  // ── Sub-lists ───────────────────────────────────────────────────────────────
  const phoneGroups = highGroups.filter(
    g => g.issue_type === 'duplicate_phone_high_confidence'
  );
  const emailGroups = highGroups.filter(
    g => g.issue_type === 'duplicate_email_high_confidence'
  );
  const reversedGroups = mediumGroups.filter(
    g => g.issue_type === 'reversed_name_possible_duplicate'
  );
  const nameMediumGroups = mediumGroups.filter(
    g => g.issue_type === 'possible_name_duplicate'
  );

  const fusionGroups = highGroups.filter(
    g => g.recommendation === 'fusion contrôlée recommandée'
  );
  const humanGroups = highGroups.filter(
    g => g.recommendation === 'validation humaine nécessaire'
  );

  // Top 100 : high confidence, group_size > 1, sorted by action_score
  const top100 = highGroups.filter(g => g.group_size > 1).slice(0, 100);

  // ── Counts ──────────────────────────────────────────────────────────────────
  const totalImpactedHigh = new Set(highGroups.flatMap(g => g.guest_ids)).size;

  const counts: SummaryCounts = {
    high_confidence_cleanup: highGroups.length,
    medium_confidence_review: mediumGroups.length,
    low_confidence_ignore_for_now: lowCount,
    phone_duplicate_groups: phoneGroups.length,
    email_duplicate_groups: emailGroups.length,
    reversed_name_groups: reversedGroups.length,
    name_duplicate_medium: nameMediumGroups.length,
    name_duplicate_low: lowNameCount,
    total_guests_impacted_high: totalImpactedHigh,
    groups_fusion_recommended: fusionGroups.length,
    groups_human_validation: humanGroups.length,
  };

  // ── Write reports ───────────────────────────────────────────────────────────
  const reportsDir = resolve(process.cwd(), 'reports');
  mkdirSync(reportsDir, { recursive: true });

  const jsonOutPath = resolve(reportsDir, 'crm-quality-summary.json');
  const csvOutPath = resolve(reportsDir, 'crm-quality-summary.csv');

  const summaryReport: SummaryReport = {
    generated_at: new Date().toISOString(),
    source_file: auditPath,
    source_audit_date: report.generated_at,
    original_stats: stats,
    counts,
    top_100_actionable: top100,
    medium_confidence_groups: mediumGroups,
  };

  writeFileSync(jsonOutPath, JSON.stringify(summaryReport, null, 2), 'utf-8');
  writeFileSync(csvOutPath, generateCSV([...highGroups, ...mediumGroups]), 'utf-8');

  // ── Terminal output ─────────────────────────────────────────────────────────
  console.log('─── Résumé de priorisation ───────────────────────────────────');
  console.log(`Haute confiance (à traiter)   : ${counts.high_confidence_cleanup} groupes`);
  console.log(`  doublons téléphone          : ${counts.phone_duplicate_groups}`);
  console.log(`  doublons email              : ${counts.email_duplicate_groups}`);
  console.log(`  fusion recommandée          : ${fusionGroups.length} groupes`);
  console.log(`  validation humaine requise  : ${humanGroups.length} groupes`);
  console.log(`Confiance moyenne (à revoir)  : ${counts.medium_confidence_review} groupes`);
  console.log(`  noms inversés               : ${counts.reversed_name_groups}`);
  console.log(`  doublons nom + contact      : ${counts.name_duplicate_medium}`);
  console.log(`Faible confiance (ignorer)    : ${counts.low_confidence_ignore_for_now}`);
  console.log(`  doublons fuzzy nom seul     : ${counts.name_duplicate_low}`);
  console.log(`Clients impactés (haute conf.): ${counts.total_guests_impacted_high}`);
  console.log('─────────────────────────────────────────────────────────────');

  console.log('\n── Top 10 groupes téléphone (par score d\'action) ─────────');
  for (const g of phoneGroups.slice(0, 10)) {
    console.log(formatGroupLine(g));
  }

  console.log('\n── Top 10 groupes email (par score d\'action) ─────────────');
  for (const g of emailGroups.slice(0, 10)) {
    console.log(formatGroupLine(g));
  }

  console.log(`\nTop 100 groupes les plus sûrs → ${top100.length} inclus dans crm-quality-summary.json`);
  console.log('\nRapports générés :');
  console.log(`  JSON → ${jsonOutPath}`);
  console.log(`  CSV  → ${csvOutPath}`);
  console.log('\n✅ Synthèse terminée — aucune donnée modifiée.\n');
}

try {
  main();
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\n✗ Erreur fatale : ${msg}\n`);
  process.exit(1);
}

/**
 * cleanup-rich-test-tables.ts
 *
 * Supprime les tables T6–T20 créées par le premier rich seed dans "La Maison Test".
 *
 * Ce script ne touche jamais :
 *   - T1–T5 (tables originales du restaurant test)
 *   - Le restaurant réel
 *   - Les réservations elles-mêmes (seuls les liens reservation_tables sont supprimés)
 *
 * Étapes :
 *   1. Vérifie que restaurant_id = 57020ad8-… correspond à "La Maison Test"
 *   2. Identifie les tables T6–T20 dans ce restaurant
 *   3. En dry-run : affiche ce qui serait supprimé sans rien modifier
 *   4. En apply  : supprime les liens reservation_tables puis les tables
 *
 * Usage :
 *   npm run test:cleanup:rich-tables:dry-run
 *   npm run test:cleanup:rich-tables:apply -- --confirm=CLEANUP_RICH_TEST_TABLES
 */

import { config as dotenvConfig } from 'dotenv';
import { resolve }                 from 'path';
import { existsSync }              from 'fs';
import { createClient }            from '@supabase/supabase-js';
import type { SupabaseClient }     from '@supabase/supabase-js';

// ─── Env ──────────────────────────────────────────────────────────────────────

const envPath = resolve(process.cwd(), '.env.import');
if (!existsSync(envPath)) {
  console.error('❌  Fichier .env.import introuvable.');
  process.exit(1);
}
dotenvConfig({ path: envPath });

const supabaseUrl    = process.env['SUPABASE_URL'];
const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl)    { console.error('❌  SUPABASE_URL manquant');           process.exit(1); }
if (!serviceRoleKey) { console.error('❌  SUPABASE_SERVICE_ROLE_KEY manquante'); process.exit(1); }

const SUPABASE_URL:     string = supabaseUrl;
const SERVICE_ROLE_KEY: string = serviceRoleKey;

// ─── Args ─────────────────────────────────────────────────────────────────────

const CONFIRM_TOKEN = 'CLEANUP_RICH_TEST_TABLES';
const args          = process.argv.slice(2);
const hasApply      = args.includes('--apply');
const hasConfirm    = args.includes(`--confirm=${CONFIRM_TOKEN}`);

if (hasApply && !hasConfirm) {
  console.error(`❌  Mode apply sans token de confirmation.`);
  console.error(`    Relancez avec : --apply --confirm=${CONFIRM_TOKEN}`);
  process.exit(1);
}

const isApply  = hasApply && hasConfirm;
const isDryRun = !isApply;

// ─── Client ───────────────────────────────────────────────────────────────────

const supabase: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

// ─── Constantes ───────────────────────────────────────────────────────────────

const TEST_RESTAURANT_NAME = 'La Maison Test';
const TEST_RESTAURANT_ID   = '57020ad8-482b-4016-a8f4-24d308ce58d3';

const LABELS_TO_CLEAN: readonly string[] = [
  'T6','T7','T8','T9','T10','T11','T12','T13','T14','T15','T16','T17','T18','T19','T20',
];
const LABELS_TO_KEEP: readonly string[] = ['T1','T2','T3','T4','T5'];

const PERM_HINT = [
  '   💡  Permissions manquantes pour service_role.',
  '       Exécutez supabase/manual/grant_service_role.sql dans Supabase → SQL Editor.',
].join('\n');

function isPermissionError(msg: string): boolean {
  return msg.toLowerCase().includes('permission denied');
}

// ─── Types internes ───────────────────────────────────────────────────────────

type TableFound = {
  id:    string;
  label: string;
};

type ResTableLink = {
  id:             string;
  table_id:       string;
  reservation_id: string;
};

// ─── Vérification restaurant ──────────────────────────────────────────────────

async function verifyTestRestaurant(): Promise<void> {
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name')
    .eq('id', TEST_RESTAURANT_ID)
    .maybeSingle()
    .returns<{ id: string; name: string } | null>();

  if (error) {
    console.error(`❌  Impossible de vérifier le restaurant : ${error.message}`);
    if (isPermissionError(error.message)) console.error(PERM_HINT);
    process.exit(1);
  }
  if (!data) {
    console.error(`❌  Restaurant introuvable pour l'ID : ${TEST_RESTAURANT_ID}`);
    process.exit(1);
  }
  if (data.name !== TEST_RESTAURANT_NAME) {
    console.error(`❌  SÉCURITÉ : le restaurant trouvé s'appelle "${data.name}"`);
    console.error(`    Attendu exactement : "${TEST_RESTAURANT_NAME}"`);
    console.error('    Arrêt immédiat — aucune donnée supprimée.');
    process.exit(1);
  }

  console.log(`  ✅  Restaurant confirmé : "${data.name}" (${data.id})`);
}

// ─── Recherche des tables T6-T20 ─────────────────────────────────────────────

async function findRichSeedTables(): Promise<TableFound[]> {
  const { data, error } = await supabase
    .from('tables')
    .select('id, label')
    .eq('restaurant_id', TEST_RESTAURANT_ID)
    .in('label', [...LABELS_TO_CLEAN])
    .returns<TableFound[]>();

  if (error) {
    console.error(`❌  Impossible de récupérer les tables : ${error.message}`);
    if (isPermissionError(error.message)) console.error(PERM_HINT);
    process.exit(1);
  }

  return data ?? [];
}

// ─── Recherche des liens reservation_tables ───────────────────────────────────

async function findReservationTableLinks(tableIds: string[]): Promise<ResTableLink[]> {
  if (tableIds.length === 0) return [];

  const { data, error } = await supabase
    .from('reservation_tables')
    .select('id, table_id, reservation_id')
    .in('table_id', tableIds)
    .returns<ResTableLink[]>();

  if (error) {
    console.error(`❌  Impossible de récupérer reservation_tables : ${error.message}`);
    if (isPermissionError(error.message)) console.error(PERM_HINT);
    process.exit(1);
  }

  return data ?? [];
}

// ─── Dry-run ──────────────────────────────────────────────────────────────────

async function runDryRun(): Promise<void> {
  console.log('\n' + '═'.repeat(66));
  console.log('  DRY-RUN — cleanup-rich-test-tables');
  console.log('═'.repeat(66));
  console.log(`  Cible  : "${TEST_RESTAURANT_NAME}" (${TEST_RESTAURANT_ID})`);
  console.log('─'.repeat(66) + '\n');

  await verifyTestRestaurant();

  // Vérifier que T1-T5 restent intacts
  const { data: keptTables } = await supabase
    .from('tables')
    .select('id, label')
    .eq('restaurant_id', TEST_RESTAURANT_ID)
    .in('label', [...LABELS_TO_KEEP])
    .returns<TableFound[]>();

  console.log(`\n  Tables à conserver (jamais touchées) :`);
  for (const t of (keptTables ?? [])) {
    console.log(`    ✅  ${t.label} (${t.id.slice(0, 8)}…)`);
  }
  if ((keptTables ?? []).length === 0) {
    console.log('    ⚠️   Aucune table T1-T5 trouvée dans ce restaurant');
  }

  // Tables à supprimer
  const toDelete = await findRichSeedTables();
  const tableIds = toDelete.map(t => t.id);

  console.log(`\n  Tables créées par le rich seed (à supprimer) :`);
  if (toDelete.length === 0) {
    console.log('    ℹ️   Aucune table T6-T20 trouvée — déjà nettoyé ou jamais créé');
  } else {
    for (const t of toDelete) {
      console.log(`    🗑️   ${t.label} (${t.id.slice(0, 8)}…)`);
    }
  }

  // Liens reservation_tables
  const links = await findReservationTableLinks(tableIds);
  console.log(`\n  Liens reservation_tables liés à T6-T20 : ${links.length}`);
  if (links.length > 0) {
    const unique = new Set(links.map(l => l.reservation_id));
    console.log(`    → ${unique.size} réservations concernées`);
    console.log('    → Les réservations elles-mêmes ne seront PAS supprimées');
    console.log('    → Seuls les liens reservation_tables seront supprimés');
  }

  console.log('\n  Résumé de ce qui serait supprimé en mode apply :');
  console.log(`    · ${links.length} lien(s) dans reservation_tables`);
  console.log(`    · ${toDelete.length} table(s) : ${toDelete.map(t => t.label).join(', ') || 'aucune'}`);
  console.log('\n  Ce qui ne sera jamais modifié :');
  console.log('    · T1, T2, T3, T4, T5');
  console.log('    · Les réservations (reservation_tables uniquement)');
  console.log('    · Les clients');
  console.log('    · Le restaurant réel');

  if (toDelete.length === 0) {
    console.log('\n  ✅  Rien à nettoyer — restaurant déjà propre');
  } else {
    console.log(`\n  Pour appliquer le nettoyage :`);
    console.log(`    npm run test:cleanup:rich-tables:apply -- --confirm=${CONFIRM_TOKEN}`);
  }
  console.log('═'.repeat(66) + '\n');
}

// ─── Apply ────────────────────────────────────────────────────────────────────

async function runApply(): Promise<void> {
  console.log('\n' + '═'.repeat(66));
  console.log('  APPLY — cleanup-rich-test-tables');
  console.log('═'.repeat(66));
  console.log(`  Cible  : "${TEST_RESTAURANT_NAME}" (${TEST_RESTAURANT_ID})`);
  console.log('─'.repeat(66) + '\n');

  // ── 1. Vérification critique ──────────────────────────────────────────────
  await verifyTestRestaurant();

  // ── 2. Trouver T6-T20 ────────────────────────────────────────────────────
  const toDelete = await findRichSeedTables();

  if (toDelete.length === 0) {
    console.log('\n  ℹ️   Aucune table T6-T20 trouvée — déjà nettoyé ou jamais créé');
    console.log('  ✅  Aucune action nécessaire.');
    console.log('═'.repeat(66) + '\n');
    return;
  }

  const tableIds = toDelete.map(t => t.id);

  console.log(`\n  Tables trouvées à supprimer : ${toDelete.length}`);
  for (const t of toDelete) {
    console.log(`    · ${t.label} (${t.id.slice(0, 8)}…)`);
  }

  // ── 3. Supprimer les liens reservation_tables ─────────────────────────────
  const links = await findReservationTableLinks(tableIds);
  console.log(`\n  Liens reservation_tables à supprimer : ${links.length}`);

  if (links.length > 0) {
    const linkIds = links.map(l => l.id);

    // Supprimer par batch de 100
    for (let i = 0; i < linkIds.length; i += 100) {
      const batch = linkIds.slice(i, i + 100);
      const { error } = await supabase
        .from('reservation_tables')
        .delete()
        .in('id', batch);

      if (error) {
        console.error(`  ❌  Erreur suppression reservation_tables batch ${i} : ${error.message}`);
        if (isPermissionError(error.message)) console.error(PERM_HINT);
      } else {
        console.log(`  ✅  ${batch.length} lien(s) reservation_tables supprimé(s)`);
      }
    }
  }

  // ── 4. Supprimer les tables T6-T20 ───────────────────────────────────────

  // Sécurité finale : jamais supprimer T1-T5
  const safeToDelete = toDelete.filter(t => !LABELS_TO_KEEP.includes(t.label));
  const skipped = toDelete.length - safeToDelete.length;

  if (skipped > 0) {
    console.warn(`  ⚠️   ${skipped} table(s) ignorée(s) car dans la liste protégée (T1-T5)`);
  }

  if (safeToDelete.length === 0) {
    console.log('  ℹ️   Aucune table à supprimer après vérification de sécurité');
    console.log('═'.repeat(66) + '\n');
    return;
  }

  const safeIds = safeToDelete.map(t => t.id);

  const { error: delErr } = await supabase
    .from('tables')
    .delete()
    .in('id', safeIds)
    .eq('restaurant_id', TEST_RESTAURANT_ID); // double garde sur restaurant_id

  if (delErr) {
    console.error(`  ❌  Erreur suppression tables : ${delErr.message}`);
    if (isPermissionError(delErr.message)) console.error(PERM_HINT);
  } else {
    console.log(`  ✅  ${safeToDelete.length} table(s) supprimée(s) : ${safeToDelete.map(t => t.label).join(', ')}`);
  }

  // ── 5. Vérifier que T1-T5 sont intacts ───────────────────────────────────
  const { data: kept } = await supabase
    .from('tables')
    .select('id, label')
    .eq('restaurant_id', TEST_RESTAURANT_ID)
    .in('label', [...LABELS_TO_KEEP])
    .returns<TableFound[]>();

  const keptLabels = (kept ?? []).map(t => t.label).join(', ');
  console.log(`\n  Tables conservées (T1-T5) : ${keptLabels || 'aucune — vérifiez!'}`);

  // ── Résumé ────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(66));
  console.log('  ✅  Nettoyage terminé');
  console.log(`  · ${links.length} lien(s) reservation_tables supprimé(s)`);
  console.log(`  · ${safeToDelete.length} table(s) supprimée(s) : ${safeToDelete.map(t => t.label).join(', ')}`);
  console.log('  · T1-T5 intactes');
  console.log('  · Restaurant réel non touché');
  console.log('\n  Relancez seed-rich-test-restaurant pour recréer les réservations');
  console.log('  sur les tables existantes (T1-T5) :');
  console.log('    npm run test:seed:rich:dry-run');
  console.log('    npm run test:seed:rich:apply -- --confirm=SEED_RICH_TEST_DATA');
  console.log('═'.repeat(66) + '\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (isDryRun) {
    console.log('  (Mode dry-run — aucune modification.)');
    await runDryRun();
  } else {
    await runApply();
  }
}

main().catch((err: unknown) => {
  console.error('Erreur fatale :', err instanceof Error ? err.message : String(err));
  process.exit(1);
});

/**
 * update-table-capacities.ts
 *
 * Met à jour la capacité des tables existantes selon une liste fournie.
 * Ne crée pas de table. Ne supprime pas de table. Ne modifie pas x/y/shape/zone/floor_plan.
 *
 * Usage :
 *   npm run tables:update-capacities
 *
 * Variables attendues dans .env.import :
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   RESTAURANT_ID
 *
 * Matching : le label de la table est normalisé (trim, lowercase, suppression
 * des préfixes "table ", "la ", "t") avant comparaison.
 * Exemples : "15", "Table 15", "La 15", "T15" → "15"
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// ─── Env ──────────────────────────────────────────────────────────────────────

const envPath = path.resolve(process.cwd(), '.env.import');
if (!fs.existsSync(envPath)) {
  console.error('Fichier .env.import introuvable. Créez-le avec SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESTAURANT_ID.');
  process.exit(1);
}
dotenv.config({ path: envPath });

const supabaseUrl    = process.env['SUPABASE_URL'];
const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const restaurantId   = process.env['RESTAURANT_ID'];

if (!supabaseUrl) {
  console.error('SUPABASE_URL manquant dans .env.import');
  process.exit(1);
}
if (!serviceRoleKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY manquant dans .env.import');
  process.exit(1);
}
if (!restaurantId) {
  console.error('RESTAURANT_ID manquant dans .env.import');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

// ─── Capacités cibles ─────────────────────────────────────────────────────────
//
// Clé = label normalisé (chiffres uniquement après normalisation).
// Valeur = capacité cible.

const TARGET_CAPACITIES: Record<string, number> = {
  // Salle
  '15': 2,
  '31': 6,
  '32': 6,
  '34': 4,
  '41': 4,
  '42': 4,
  '43': 2,
  '44': 6,
  '45': 4,
  '46': 4,
  '21': 3,
  '22': 2,
  '23': 2,
  '24': 2,
  '12': 2,
  // Balcon
  '51': 4,
  '52': 4,
  '53': 2,
  '54': 2,
  '67': 4,
  '68': 4,
  '63': 2,
  '64': 2,
  '65': 2,
  '66': 2,
  // Terrasse
  '71': 5,
  '72': 4,
  '73': 4,
  '74': 4,
  '75': 8,
  '76': 4,
  '81': 8,
  '82': 4,
  '83': 2,
  '84': 8,
  '85': 4,
  // Lounge
  '111': 4,
  '112': 4,
  '114': 6,
  '115': 6,
  '116': 4,
};

// ─── Normalisation label ──────────────────────────────────────────────────────

function normalizeLabel(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^(table\s+|la\s+|t(?=\d))/i, '')
    .trim();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type TableRow = {
  id:       string;
  label:    string;
  capacity: number;
  zone:     string;
};

async function main(): Promise<void> {
  console.log('');
  console.log('Mise à jour des capacités tables');
  console.log(`RESTAURANT_ID = ${restaurantId}`);
  console.log('');

  // 1. Charger toutes les tables du restaurant
  const { data: rows, error } = await supabase
    .from('tables')
    .select('id, label, capacity, zone')
    .eq('restaurant_id', restaurantId);

  if (error) {
    console.error('Erreur lors de la lecture des tables :', error.message);
    process.exit(1);
  }

  const tables: TableRow[] = rows ?? [];
  console.log(`Tables chargées : ${tables.length}`);
  console.log('');

  // 2. Construire un index normalisé des tables en base
  const tableIndex = new Map<string, TableRow>();
  for (const t of tables) {
    const key = normalizeLabel(t.label);
    tableIndex.set(key, t);
  }

  // 3. Préparer les mises à jour
  const toUpdate: Array<{ id: string; label: string; zone: string; oldCapacity: number; newCapacity: number }> = [];
  const notFound: string[] = [];

  for (const [normalizedKey, targetCapacity] of Object.entries(TARGET_CAPACITIES)) {
    const row = tableIndex.get(normalizedKey);
    if (!row) {
      notFound.push(normalizedKey);
    } else if (row.capacity !== targetCapacity) {
      toUpdate.push({
        id:          row.id,
        label:       row.label,
        zone:        row.zone,
        oldCapacity: row.capacity,
        newCapacity: targetCapacity,
      });
    }
  }

  // Tables présentes en base mais non concernées par la liste
  const concernedKeys = new Set(Object.keys(TARGET_CAPACITIES));
  const notConcerned = tables.filter(t => !concernedKeys.has(normalizeLabel(t.label)));

  // 4. Afficher le plan
  console.log(`Tables à mettre à jour    : ${toUpdate.length}`);
  console.log(`Tables non trouvées       : ${notFound.length}`);
  console.log(`Tables non concernées     : ${notConcerned.length}`);
  console.log('');

  if (toUpdate.length === 0) {
    console.log('Aucune mise à jour nécessaire. Toutes les capacités sont déjà correctes.');
    if (notFound.length > 0) {
      console.log('');
      console.log('Labels non trouvés en base :');
      notFound.forEach(k => { console.log(`  - "${k}"`); });
    }
    return;
  }

  // 5. Appliquer les mises à jour
  console.log('Mises à jour à appliquer :');
  toUpdate.forEach(u => {
    console.log(`  [${u.zone}] ${u.label.padEnd(8)} : ${u.oldCapacity} -> ${u.newCapacity}`);
  });
  console.log('');

  let updated = 0;
  let failed  = 0;

  for (const u of toUpdate) {
    const { error: updateErr } = await supabase
      .from('tables')
      .update({ capacity: u.newCapacity })
      .eq('id', u.id)
      .eq('restaurant_id', restaurantId);

    if (updateErr) {
      console.error(`  ERREUR [${u.label}] : ${updateErr.message}`);
      failed++;
    } else {
      console.log(`  OK [${u.label}] -> ${u.newCapacity} pax`);
      updated++;
    }
  }

  // 6. Résumé final
  console.log('');
  console.log('─────────────────────────────────────────');
  console.log(`Tables mises à jour    : ${updated}`);
  if (failed > 0) {
    console.log(`Tables en erreur       : ${failed}`);
  }
  console.log(`Labels non trouvés     : ${notFound.length}`);
  if (notFound.length > 0) {
    notFound.forEach(k => { console.log(`  - "${k}"`); });
  }
  console.log(`Tables non concernées  : ${notConcerned.length}`);
  console.log('─────────────────────────────────────────');
  console.log('');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error('Erreur inattendue :', err);
  process.exit(1);
});

/**
 * Import SevenRooms guests → Supabase guests table
 *
 * Usage:
 *   npm run import:sevenrooms              # dry-run (lecture seule)
 *   npm run import:sevenrooms -- --limit 100  # dry-run sur 100 lignes
 *   npm run import:sevenrooms -- --apply   # écriture réelle
 *
 * Prérequis : .env.import renseigné depuis .env.import.example
 */

import { config as dotenvConfig } from 'dotenv';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Charger .env.import AVANT d'initialiser le client Supabase
dotenvConfig({ path: resolve(process.cwd(), '.env.import') });

import { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdmin } from './lib/supabaseAdmin';
import {
  MappedGuest,
  detectCsvDelimiter,
  mapSevenRoomsRowToGuest,
  normalizeEmail,
  normalizePhone,
  parseSevenRoomsCsv,
} from './lib/sevenroomsParser';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ImportOptions {
  apply: boolean;
  limit: number | null;
}

export interface ImportStats {
  total: number;
  valid: number;
  withPhone: number;
  withEmail: number;
  vip: number;
  withRating: number;
  toInsert: number;
  toUpdate: number;
  skipped: number;
  parseErrors: number;
}

interface GuestRow {
  id: string;
  phone: string | null;
  email: string | null;
}

interface RestaurantRow {
  id: string;
  name: string;
}

interface GuestMaps {
  phoneMap: Map<string, string>;
  emailMap: Map<string, string>;
}

type GuestToInsert = MappedGuest & { restaurant_id: string };
type GuestToUpdate = MappedGuest & { id: string; restaurant_id: string };

// ─── CLI args ────────────────────────────────────────────────────────────────

function parseArgs(): ImportOptions {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const limitIndex = args.indexOf('--limit');
  if (limitIndex !== -1) {
    const limitStr = args[limitIndex + 1];
    if (!limitStr) throw new Error('--limit nécessite une valeur (ex: --limit 100)');
    const limit = parseInt(limitStr, 10);
    if (isNaN(limit) || limit < 1)
      throw new Error(`--limit doit être un entier positif (reçu: "${limitStr}")`);
    return { apply, limit };
  }
  return { apply, limit: null };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────

async function findRestaurant(
  supabase: SupabaseClient,
  name: string
): Promise<string> {
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name')
    .ilike('name', name)
    .limit(1)
    .single();

  if (error || !data) {
    throw new Error(
      `Restaurant "${name}" introuvable dans Supabase.\n→ Vérifiez RESTAURANT_NAME dans .env.import`
    );
  }
  const row = data as RestaurantRow;
  console.log(`Restaurant trouvé : ${row.name} (${row.id})`);
  return row.id;
}

async function loadExistingGuests(
  supabase: SupabaseClient,
  restaurantId: string
): Promise<GuestMaps> {
  console.log('Chargement des clients existants...');
  const phoneMap = new Map<string, string>();
  const emailMap = new Map<string, string>();

  let page = 0;
  const pageSize = 1000;
  let hasMore = true;
  let totalLoaded = 0;

  while (hasMore) {
    const { data, error } = await supabase
      .from('guests')
      .select('id, phone, email')
      .eq('restaurant_id', restaurantId)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) throw new Error(`Erreur chargement guests existants : ${error.message}`);

    const rows = (data ?? []) as GuestRow[];
    for (const guest of rows) {
      if (guest.phone) {
        const norm = normalizePhone(guest.phone);
        if (norm) phoneMap.set(norm, guest.id);
      }
      if (guest.email) {
        const norm = normalizeEmail(guest.email);
        if (norm) emailMap.set(norm, guest.id);
      }
    }

    totalLoaded += rows.length;
    hasMore = rows.length === pageSize;
    page++;
  }

  console.log(
    `  → ${totalLoaded} clients existants (${phoneMap.size} téléphones, ${emailMap.size} emails)`
  );
  return { phoneMap, emailMap };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function runImport(options: ImportOptions): Promise<void> {
  const csvPath = process.env.SEVENROOMS_CSV_PATH;
  const restaurantName = process.env.RESTAURANT_NAME;

  if (!csvPath)
    throw new Error('SEVENROOMS_CSV_PATH non défini dans .env.import');
  if (!restaurantName)
    throw new Error('RESTAURANT_NAME non défini dans .env.import');

  const resolvedPath = resolve(process.cwd(), csvPath);

  console.log('\n=== Import SevenRooms → La Maison ===');
  console.log(
    `Mode    : ${options.apply ? '✅ APPLY (écriture réelle)' : '🔍 DRY-RUN (aucune écriture)'}`
  );
  if (options.limit !== null) console.log(`Limite  : ${options.limit} lignes`);
  console.log(`Fichier : ${resolvedPath}\n`);

  // Read CSV
  let content: string;
  try {
    content = readFileSync(resolvedPath, 'utf-8');
  } catch {
    throw new Error(
      `Fichier CSV introuvable : ${resolvedPath}\n` +
        `→ Exportez SevenRooms en CSV UTF-8 et placez-le dans data/sevenrooms-guests.csv\n` +
        `→ Voir docs/import-sevenrooms.md pour les instructions complètes`
    );
  }

  // Detect delimiter and parse CSV
  const delimiter = detectCsvDelimiter(content);
  console.log(`Séparateur CSV : "${delimiter}"`);
  const allRows = parseSevenRoomsCsv(content);
  const rows = options.limit !== null ? allRows.slice(0, options.limit) : allRows;
  console.log(`${allRows.length} lignes dans le fichier${options.limit !== null ? `, traitement limité à ${rows.length}` : ''}`);

  const stats: ImportStats = {
    total: rows.length,
    valid: 0,
    withPhone: 0,
    withEmail: 0,
    vip: 0,
    withRating: 0,
    toInsert: 0,
    toUpdate: 0,
    skipped: 0,
    parseErrors: 0,
  };

  // Init Supabase (après dotenvConfig)
  const supabase = createSupabaseAdmin();

  // Find restaurant
  const restaurantId = await findRestaurant(supabase, restaurantName);

  // Load existing guests for deduplication
  const { phoneMap, emailMap } = await loadExistingGuests(supabase, restaurantId);

  // Categorize rows
  const toInsert: GuestToInsert[] = [];
  const toUpdate: GuestToUpdate[] = [];

  console.log('\nAnalyse des lignes CSV...');

  for (const row of rows) {
    try {
      const guest = mapSevenRoomsRowToGuest(row);

      // Skip rows with no usable identifier at all
      if (!guest.phone && !guest.email && !guest.first_name && !guest.last_name) {
        stats.skipped++;
        continue;
      }

      stats.valid++;
      if (guest.phone) stats.withPhone++;
      if (guest.email) stats.withEmail++;
      if (guest.vip) stats.vip++;
      if (guest.avg_rating !== null) stats.withRating++;

      // Deduplication: phone first, then email
      let existingId: string | undefined;
      if (guest.phone) existingId = phoneMap.get(guest.phone);
      if (!existingId && guest.email) existingId = emailMap.get(guest.email);

      if (existingId !== undefined) {
        stats.toUpdate++;
        toUpdate.push({ ...guest, id: existingId, restaurant_id: restaurantId });
      } else {
        stats.toInsert++;
        toInsert.push({ ...guest, restaurant_id: restaurantId });
      }
    } catch (err) {
      stats.parseErrors++;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  ⚠ Erreur parsing ligne : ${msg}`);
    }
  }

  // ─── Résumé ───────────────────────────────────────────────────────────────
  console.log('\n─── Résumé ───────────────────────────────────────');
  console.log(`Lignes lues          : ${stats.total}`);
  console.log(`Clients valides      : ${stats.valid}`);
  console.log(`Avec téléphone       : ${stats.withPhone}`);
  console.log(`Avec email           : ${stats.withEmail}`);
  console.log(`VIP                  : ${stats.vip}`);
  console.log(`Avec rating          : ${stats.withRating}`);
  console.log(`À insérer            : ${stats.toInsert}`);
  console.log(`À mettre à jour      : ${stats.toUpdate}`);
  console.log(`Ignorés (vides)      : ${stats.skipped}`);
  console.log(`Erreurs de parsing   : ${stats.parseErrors}`);
  console.log('──────────────────────────────────────────────────');

  if (!options.apply) {
    console.log('\n🔍 DRY-RUN terminé — aucune donnée écrite.');
    console.log('→ Relancez avec --apply pour importer réellement.\n');
    return;
  }

  // ─── Inserts ─────────────────────────────────────────────────────────────
  if (toInsert.length > 0) {
    console.log(`\nInsertion de ${toInsert.length} clients...`);
    const batches = chunk(toInsert, 500);
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const { error } = await supabase.from('guests').insert(batch);
      if (error) {
        console.error(`  ✗ Batch insert ${i + 1}/${batches.length} : ${error.message}`);
      } else {
        console.log(`  ✓ Batch ${i + 1}/${batches.length} inséré (${batch.length} clients)`);
      }
    }
  }

  // ─── Updates ─────────────────────────────────────────────────────────────
  if (toUpdate.length > 0) {
    console.log(`\nMise à jour de ${toUpdate.length} clients existants...`);
    const batches = chunk(toUpdate, 500);
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const { error } = await supabase
        .from('guests')
        .upsert(batch, { onConflict: 'id' });
      if (error) {
        console.error(`  ✗ Batch update ${i + 1}/${batches.length} : ${error.message}`);
      } else {
        console.log(`  ✓ Batch ${i + 1}/${batches.length} mis à jour (${batch.length} clients)`);
      }
    }
  }

  console.log('\n✅ Import terminé.\n');
}

runImport(parseArgs()).catch(err => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\n✗ Erreur fatale : ${msg}\n`);
  process.exit(1);
});

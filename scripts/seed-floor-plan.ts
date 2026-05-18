/**
 * seed-floor-plan.ts
 *
 * Insère le plan "Plan principal" et toutes les tables La Maison dans Supabase.
 * Idempotent : crée ou met à jour selon restaurant_id + label.
 *
 * Usage :
 *   npm run seed:floor
 *
 * Variables attendues dans .env.import :
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   RESTAURANT_ID
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { LA_MAISON_FLOOR_TABLES, ZONE_LABELS } from '../src/utils/floorPlanLayout';
import { visualShapeToDbShape } from '../src/types/floor';

// ─── Env ──────────────────────────────────────────────────────────────────────

const envPath = path.resolve(process.cwd(), '.env.import');
if (!fs.existsSync(envPath)) {
  console.error('❌  Fichier .env.import introuvable. Créez-le avec SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESTAURANT_ID.');
  process.exit(1);
}
dotenv.config({ path: envPath });

const supabaseUrl      = process.env.SUPABASE_URL;
const serviceRoleKey   = process.env.SUPABASE_SERVICE_ROLE_KEY;
const restaurantId     = process.env.RESTAURANT_ID;

if (!supabaseUrl || !serviceRoleKey || !restaurantId) {
  console.error('❌  Variables manquantes dans .env.import : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESTAURANT_ID');
  process.exit(1);
}

// Ne pas logger la clé secrète
console.log(`🔗  Supabase URL : ${supabaseUrl}`);
console.log(`🏠  Restaurant ID : ${restaurantId}`);

const supabase = createClient(supabaseUrl, serviceRoleKey);

// ─── Shape DB mapping ─────────────────────────────────────────────────────────

type DbShape = 'round' | 'square' | 'rectangle';

function toDbShape(shape: string): DbShape {
  return visualShapeToDbShape(shape as Parameters<typeof visualShapeToDbShape>[0]);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  let created = 0;
  let updated = 0;
  let ignored = 0;
  const errors: string[] = [];

  // ── 1. Floor plan ─────────────────────────────────────────────────────────

  console.log('\n📐  Recherche du floor plan "Plan principal"…');

  const { data: existingPlan, error: planFetchError } = await supabase
    .from('floor_plans')
    .select('id, name')
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .maybeSingle();

  if (planFetchError) {
    console.error('❌  Erreur lors de la récupération du floor plan :', planFetchError.message);
    process.exit(1);
  }

  let floorPlanId: string;

  if (existingPlan) {
    floorPlanId = existingPlan.id;
    console.log(`✅  Floor plan existant trouvé : "${existingPlan.name}" (${floorPlanId})`);
  } else {
    console.log('➕  Création du floor plan "Plan principal"…');
    const { data: newPlan, error: createError } = await supabase
      .from('floor_plans')
      .insert({
        restaurant_id: restaurantId,
        name: 'Plan principal',
        is_active: true,
        layout: {},
      })
      .select('id')
      .single();

    if (createError || !newPlan) {
      console.error('❌  Impossible de créer le floor plan :', createError?.message);
      process.exit(1);
    }
    floorPlanId = newPlan.id;
    console.log(`✅  Floor plan créé : ${floorPlanId}`);
  }

  // ── 2. Tables existantes ──────────────────────────────────────────────────

  console.log('\n🪑  Chargement des tables existantes…');
  const { data: existingTables, error: tablesFetchError } = await supabase
    .from('tables')
    .select('id, label')
    .eq('restaurant_id', restaurantId);

  if (tablesFetchError) {
    console.error('❌  Erreur lors du chargement des tables :', tablesFetchError.message);
    process.exit(1);
  }

  const existingByLabel = new Map<string, string>(
    (existingTables ?? []).map((t) => [t.label, t.id]),
  );

  // ── 3. Upsert tables ──────────────────────────────────────────────────────

  console.log(`\n🔄  Traitement de ${LA_MAISON_FLOOR_TABLES.length} tables…`);

  for (const table of LA_MAISON_FLOOR_TABLES) {
    const label = String(table.id);
    const zone  = ZONE_LABELS[table.zone];
    const shape = toDbShape(table.shape);

    const payload = {
      restaurant_id: restaurantId,
      floor_plan_id: floorPlanId,
      label,
      zone,
      shape,
      capacity: table.capacity,
      position_x: table.x,
      position_y: table.y,
      status: 'free' as const,
    };

    const existingId = existingByLabel.get(label);

    if (existingId) {
      const { error: updateError } = await supabase
        .from('tables')
        .update({
          floor_plan_id: floorPlanId,
          zone,
          shape,
          capacity: table.capacity,
          position_x: table.x,
          position_y: table.y,
        })
        .eq('id', existingId);

      if (updateError) {
        errors.push(`Table ${label} : ${updateError.message}`);
      } else {
        updated++;
      }
    } else {
      const { error: insertError } = await supabase
        .from('tables')
        .insert(payload);

      if (insertError) {
        errors.push(`Table ${label} : ${insertError.message}`);
      } else {
        created++;
      }
    }
  }

  // ── 4. Résumé ─────────────────────────────────────────────────────────────

  console.log('\n─────────────────────────────────────────');
  console.log('📊  Résumé du seed');
  console.log('─────────────────────────────────────────');
  console.log(`  Floor plan : ${existingPlan ? 'existant' : 'créé'} — ${floorPlanId}`);
  console.log(`  Tables créées  : ${created}`);
  console.log(`  Tables mises à jour : ${updated}`);
  console.log(`  Tables ignorées     : ${ignored}`);

  if (errors.length > 0) {
    console.log(`\n⚠️  Erreurs (${errors.length}) :`);
    errors.forEach((e) => console.log(`  • ${e}`));
  } else {
    console.log('\n✅  Seed terminé sans erreur.');
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('❌  Erreur fatale :', msg);
  process.exit(1);
});

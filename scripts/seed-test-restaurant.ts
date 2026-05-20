/**
 * seed-test-restaurant.ts
 *
 * Crée un restaurant de test isolé "La Maison Test" avec des données minimales.
 * Le compte testeur est lié uniquement à ce restaurant — il ne voit pas les
 * données réelles grâce aux RLS filtrées par restaurant_id.
 *
 * Crée :
 *   - 1 restaurant  "La Maison Test"
 *   - 2 services    (Déjeuner Test, Dîner Test)
 *   - 1 plan de salle et 5 tables
 *   - 3 clients fictifs
 *   - 3 réservations fictives (passée, aujourd'hui, future)
 *   - 1 compte testeur (auth + profil) si TESTEUR_ACCOUNT.email est renseigné
 *
 * Usage :
 *   npm run test:seed:dry-run
 *   npm run test:seed:apply -- --confirm=CREATE_TEST_RESTAURANT
 *
 * Variables requises dans .env.import :
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * ⚠️  RESTAURANT_ID n'est PAS utilisé ici — le script cible uniquement
 *     "La Maison Test", jamais le restaurant réel.
 */

import { config as dotenvConfig } from 'dotenv';
import { resolve }                 from 'path';
import { existsSync }              from 'fs';
import { createClient }            from '@supabase/supabase-js';
import type { SupabaseClient }     from '@supabase/supabase-js';
import { TESTEUR_ACCOUNT }         from './staff-accounts.config';
import type { ReservationStatus, ReservationSource } from '../src/types/database';

// ─── Env ──────────────────────────────────────────────────────────────────────

const envPath = resolve(process.cwd(), '.env.import');
if (!existsSync(envPath)) {
  console.error('❌  Fichier .env.import introuvable.');
  process.exit(1);
}
dotenvConfig({ path: envPath });

const supabaseUrl    = process.env['SUPABASE_URL'];
const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl) {
  console.error('❌  SUPABASE_URL manquant dans .env.import');
  process.exit(1);
}
if (!serviceRoleKey) {
  console.error('❌  SUPABASE_SERVICE_ROLE_KEY manquante dans .env.import');
  process.exit(1);
}

const SUPABASE_URL    : string = supabaseUrl;
const SERVICE_ROLE_KEY: string = serviceRoleKey;

// ─── Args ─────────────────────────────────────────────────────────────────────

const CONFIRM_TOKEN = 'CREATE_TEST_RESTAURANT';
const args          = process.argv.slice(2);
const isApply       = args.includes('--apply') && args.includes(`--confirm=${CONFIRM_TOKEN}`);
const isDryRun      = !isApply;

// ─── Client ───────────────────────────────────────────────────────────────────

const supabase: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

// ─── Constantes ───────────────────────────────────────────────────────────────

const TEST_RESTAURANT_NAME = 'La Maison Test';

const DURATION_RULES = {
  '1': 90, '2': 120, '3': 120, '4': 120,
  '5': 120, '6': 150, '10': 180,
} as const;

const TEST_TABLES = [
  { label: 'T1', zone: 'Salle',    capacity: 2, position_x: 10, position_y: 10, shape: 'round'     as const },
  { label: 'T2', zone: 'Salle',    capacity: 4, position_x: 30, position_y: 10, shape: 'square'    as const },
  { label: 'T3', zone: 'Terrasse', capacity: 4, position_x: 10, position_y: 55, shape: 'round'     as const },
  { label: 'T4', zone: 'Terrasse', capacity: 6, position_x: 30, position_y: 55, shape: 'rectangle' as const },
  { label: 'T5', zone: 'Bar',      capacity: 2, position_x: 65, position_y: 10, shape: 'round'     as const },
] as const;

const TEST_GUESTS = [
  { first_name: 'Alice',  last_name: 'Dupont',  phone: '+21600000001', email: 'alice.test@example.com' },
  { first_name: 'Bob',    last_name: 'Martin',  phone: '+21600000002', email: null },
  { first_name: 'Cécile', last_name: 'Moreau',  phone: '+21600000003', email: 'cecile.test@example.com' },
] as const;

// ─── Types internes ───────────────────────────────────────────────────────────

type RestaurantRow       = { id: string; name: string };
type ShiftRow            = { id: string; name: string };
type TableRow            = { id: string; label: string };
type GuestRow            = { id: string; first_name: string | null; last_name: string | null };
type ProfileRow          = { id: string };
type ReservationInsertData = {
  restaurant_id: string;
  guest_id:      string | null;
  table_id:      string | null;
  shift_id:      string | null;
  date:          string;
  time_slot:     string;
  party_size:    number;
  status:        ReservationStatus;
  source:        ReservationSource;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0] as string;
}

function pad(label: string, width: number): string {
  return label.padEnd(width);
}

// ─── Dry-run ──────────────────────────────────────────────────────────────────

async function runDryRun(): Promise<void> {
  console.log('\n' + '═'.repeat(62));
  console.log('  DRY-RUN — seed-test-restaurant');
  console.log('═'.repeat(62));
  console.log(`  Supabase : ${SUPABASE_URL}`);
  console.log(`  Cible    : "${TEST_RESTAURANT_NAME}" (jamais le restaurant réel)`);
  console.log('─'.repeat(62) + '\n');

  // Vérifier si le restaurant test existe déjà
  const { data: existing } = await supabase
    .from('restaurants')
    .select('id, name')
    .eq('name', TEST_RESTAURANT_NAME)
    .maybeSingle()
    .returns<RestaurantRow | null>();

  if (existing) {
    console.log(`ℹ️   Restaurant existant : "${existing.name}" (${existing.id})`);
    console.log('    En mode apply : le script réutilisera ce restaurant.\n');
  } else {
    console.log(`✅  Restaurant "${TEST_RESTAURANT_NAME}" n'existe pas encore → sera créé\n`);
  }

  console.log('  Dataset prévu :');
  console.log(`    📅  Services    : Déjeuner Test (mar-dim 12h-16h45), Dîner Test (tous jours 17h-00h)`);
  console.log(`    🗺️   Tables      : ${TEST_TABLES.length} tables (Salle ×2, Terrasse ×2, Bar ×1)`);
  console.log(`    👥  Clients     : ${TEST_GUESTS.length} clients fictifs (Alice, Bob, Cécile)`);
  console.log(`    📋  Réservations: 3 (hier-terminée, aujourd'hui-confirmée, demain-en-attente)`);

  if (TESTEUR_ACCOUNT.email) {
    console.log(`    👤  Testeur     : ${TESTEUR_ACCOUNT.fullName} <${TESTEUR_ACCOUNT.email}> [${TESTEUR_ACCOUNT.role}]`);
  } else {
    console.log(`    👤  Testeur     : ⚠️  Email non configuré (TESTEUR_ACCOUNT dans staff-accounts.config.ts)`);
  }

  console.log('\n  ⚠️   Aucune donnée du restaurant réel ne sera touchée.');
  console.log('  Les RLS (restaurant_id) garantissent l\'isolation complète.\n');

  if (!existing) {
    console.log(`  Pour créer le restaurant de test :`);
    console.log(`    npm run test:seed:apply -- --confirm=${CONFIRM_TOKEN}`);
  } else {
    console.log(`  Le restaurant de test existe. Pour forcer la recréation des données :`);
    console.log(`    npm run test:seed:apply -- --confirm=${CONFIRM_TOKEN}`);
    console.log(`    (Idempotent — les données existantes sont ignorées)`);
  }
  console.log('═'.repeat(62) + '\n');
}

// ─── Apply ────────────────────────────────────────────────────────────────────

async function runApply(): Promise<void> {
  console.log('\n' + '═'.repeat(62));
  console.log('  APPLY — seed-test-restaurant');
  console.log('═'.repeat(62));
  console.log(`  Cible : "${TEST_RESTAURANT_NAME}"`);
  console.log(`  ⚠️   Le restaurant réel n'est pas touché.`);
  console.log('─'.repeat(62) + '\n');

  // ── 1. Restaurant ──────────────────────────────────────────────────────────

  console.log('🏠  Restaurant…');
  let testRestaurantId: string;

  const { data: existingRestaurant } = await supabase
    .from('restaurants')
    .select('id, name')
    .eq('name', TEST_RESTAURANT_NAME)
    .maybeSingle()
    .returns<RestaurantRow | null>();

  if (existingRestaurant) {
    testRestaurantId = existingRestaurant.id;
    console.log(`  ℹ️   Existant : "${existingRestaurant.name}" (${testRestaurantId})`);
  } else {
    const { data: newRestaurant, error: restError } = await supabase
      .from('restaurants')
      .insert({
        name:     TEST_RESTAURANT_NAME,
        timezone: 'Africa/Tunis',
        settings: {
          reservation_mode:    'phone_only',
          currency:            'TND',
          country:             'Tunisia',
          max_covers_per_slot: 20,
          slot_duration:       15,
        },
      })
      .select('id, name')
      .single()
      .returns<RestaurantRow>();

    if (restError || !newRestaurant) {
      console.error(`  ❌  Impossible de créer le restaurant : ${restError?.message ?? 'réponse vide'}`);
      process.exit(1);
    }
    testRestaurantId = newRestaurant.id;
    console.log(`  ✅  Créé : "${newRestaurant.name}" (${testRestaurantId})`);
  }

  console.log(`\n  ✅  restaurant_id test = ${testRestaurantId}`);
  console.log(`      Conservez cet ID — utilisez-le dans .env.import pour les tests.\n`);

  // ── 2. Services ────────────────────────────────────────────────────────────

  console.log('📅  Services…');

  const shiftsToCreate = [
    {
      name:                'Déjeuner Test',
      days_of_week:        [2, 3, 4, 5, 6, 0],
      start_time:          '12:00',
      end_time:            '16:45',
      slot_duration:       15,
      max_covers_per_slot: 20,
      duration_rules:      DURATION_RULES,
    },
    {
      name:                'Dîner Test',
      days_of_week:        [0, 1, 2, 3, 4, 5, 6],
      start_time:          '17:00',
      end_time:            '00:00',
      slot_duration:       15,
      max_covers_per_slot: 20,
      duration_rules:      DURATION_RULES,
    },
  ];

  const shiftIds: Record<string, string> = {};

  for (const shift of shiftsToCreate) {
    const { data: existing } = await supabase
      .from('shifts')
      .select('id, name')
      .eq('restaurant_id', testRestaurantId)
      .eq('name', shift.name)
      .maybeSingle()
      .returns<ShiftRow | null>();

    if (existing) {
      console.log(`  ℹ️   ${pad(shift.name, 16)} existant — ignoré`);
      shiftIds[shift.name] = existing.id;
    } else {
      const { data: newShift, error: shiftError } = await supabase
        .from('shifts')
        .insert({ restaurant_id: testRestaurantId, ...shift })
        .select('id, name')
        .single()
        .returns<ShiftRow>();

      if (shiftError || !newShift) {
        console.error(`  ❌  Échec création service "${shift.name}" : ${shiftError?.message ?? 'réponse vide'}`);
      } else {
        shiftIds[shift.name] = newShift.id;
        console.log(`  ✅  ${pad(shift.name, 16)} créé`);
      }
    }
  }

  // ── 3. Plan de salle + tables ──────────────────────────────────────────────

  console.log('\n🗺️   Plan de salle…');

  let floorPlanId: string | null = null;

  const { data: existingPlan } = await supabase
    .from('floor_plans')
    .select('id, name')
    .eq('restaurant_id', testRestaurantId)
    .eq('is_active', true)
    .maybeSingle()
    .returns<{ id: string; name: string } | null>();

  if (existingPlan) {
    floorPlanId = existingPlan.id;
    console.log(`  ℹ️   Plan existant : "${existingPlan.name}" — ignoré`);
  } else {
    const { data: newPlan, error: planError } = await supabase
      .from('floor_plans')
      .insert({ restaurant_id: testRestaurantId, name: 'Plan Test', is_active: true, layout: {} })
      .select('id')
      .single()
      .returns<{ id: string }>();

    if (planError || !newPlan) {
      console.error(`  ❌  Impossible de créer le plan de salle : ${planError?.message ?? 'réponse vide'}`);
    } else {
      floorPlanId = newPlan.id;
      console.log(`  ✅  Plan "Plan Test" créé`);
    }
  }

  console.log('\n🪑  Tables…');
  const tableIds: Record<string, string> = {};

  for (const table of TEST_TABLES) {
    const { data: existing } = await supabase
      .from('tables')
      .select('id, label')
      .eq('restaurant_id', testRestaurantId)
      .eq('label', table.label)
      .maybeSingle()
      .returns<TableRow | null>();

    if (existing) {
      console.log(`  ℹ️   ${pad(table.label, 4)} (${table.zone}) — existante`);
      tableIds[table.label] = existing.id;
    } else {
      const { data: newTable, error: tableError } = await supabase
        .from('tables')
        .insert({
          restaurant_id: testRestaurantId,
          floor_plan_id: floorPlanId,
          label:         table.label,
          capacity:      table.capacity,
          position_x:    table.position_x,
          position_y:    table.position_y,
          shape:         table.shape,
          zone:          table.zone,
          status:        'free',
        })
        .select('id, label')
        .single()
        .returns<TableRow>();

      if (tableError || !newTable) {
        console.error(`  ❌  Échec table ${table.label} : ${tableError?.message ?? 'réponse vide'}`);
      } else {
        tableIds[table.label] = newTable.id;
        console.log(`  ✅  ${pad(table.label, 4)} (${table.zone}, ${table.capacity} couverts) — créée`);
      }
    }
  }

  // ── 4. Clients fictifs ─────────────────────────────────────────────────────

  console.log('\n👥  Clients fictifs…');
  const guestIds: string[] = [];

  for (const guest of TEST_GUESTS) {
    const { data: existing } = await supabase
      .from('guests')
      .select('id, first_name, last_name')
      .eq('restaurant_id', testRestaurantId)
      .eq('phone', guest.phone)
      .maybeSingle()
      .returns<GuestRow | null>();

    if (existing) {
      const name = `${existing.first_name ?? ''} ${existing.last_name ?? ''}`.trim();
      console.log(`  ℹ️   ${pad(name, 16)} — existant`);
      guestIds.push(existing.id);
    } else {
      const { data: newGuest, error: guestError } = await supabase
        .from('guests')
        .insert({
          restaurant_id: testRestaurantId,
          first_name:    guest.first_name,
          last_name:     guest.last_name,
          phone:         guest.phone,
          email:         guest.email ?? null,
          source:        'manual',
        })
        .select('id, first_name, last_name')
        .single()
        .returns<GuestRow>();

      if (guestError || !newGuest) {
        console.error(`  ❌  Échec client ${guest.first_name} : ${guestError?.message ?? 'réponse vide'}`);
      } else {
        const name = `${newGuest.first_name ?? ''} ${newGuest.last_name ?? ''}`.trim();
        console.log(`  ✅  ${pad(name, 16)} — créé`);
        guestIds.push(newGuest.id);
      }
    }
  }

  // ── 5. Réservations fictives ───────────────────────────────────────────────

  console.log('\n📋  Réservations fictives…');

  const t1Id    = tableIds['T1'];
  const t2Id    = tableIds['T2'];
  const t3Id    = tableIds['T3'];
  const dejId   = shiftIds['Déjeuner Test'];
  const dinerId = shiftIds['Dîner Test'];
  const [gAlice, gBob, gCecile] = guestIds;

  const reservationsToCreate: Array<{ label: string; data: ReservationInsertData }> = [
    {
      label: 'Hier / Terminée',
      data:  {
        restaurant_id: testRestaurantId,
        guest_id:      gAlice  ?? null,
        table_id:      t1Id    ?? null,
        shift_id:      dejId   ?? null,
        date:          dateOffset(-1),
        time_slot:     '12:30',
        party_size:    2,
        status:        'completed',
        source:        'phone',
      },
    },
    {
      label: "Aujourd'hui / Confirmée",
      data:  {
        restaurant_id: testRestaurantId,
        guest_id:      gBob    ?? null,
        table_id:      t2Id    ?? null,
        shift_id:      dinerId ?? null,
        date:          dateOffset(0),
        time_slot:     '19:00',
        party_size:    4,
        status:        'confirmed',
        source:        'phone',
      },
    },
    {
      label: 'Demain / En attente',
      data:  {
        restaurant_id: testRestaurantId,
        guest_id:      gCecile ?? null,
        table_id:      t3Id    ?? null,
        shift_id:      dinerId ?? null,
        date:          dateOffset(1),
        time_slot:     '20:00',
        party_size:    3,
        status:        'pending',
        source:        'phone',
      },
    },
  ];

  for (const { label, data: insertData } of reservationsToCreate) {
    const { data: existing } = await supabase
      .from('reservations')
      .select('id')
      .eq('restaurant_id', testRestaurantId)
      .eq('date', insertData.date)
      .eq('time_slot', insertData.time_slot)
      .eq('party_size', insertData.party_size)
      .maybeSingle()
      .returns<{ id: string } | null>();

    if (existing) {
      console.log(`  ℹ️   ${label} — existante`);
    } else {
      const { error: resError } = await supabase.from('reservations').insert(insertData);
      if (resError) {
        console.error(`  ❌  Échec réservation "${label}" : ${resError.message}`);
      } else {
        console.log(`  ✅  ${label} — créée`);
      }
    }
  }

  // ── 6. Compte testeur ─────────────────────────────────────────────────────

  console.log('\n👤  Compte testeur…');

  if (!TESTEUR_ACCOUNT.email) {
    console.log('  ⚠️   Email testeur non configuré (TESTEUR_ACCOUNT dans staff-accounts.config.ts).');
    console.log('      Renseignez-le et relancez pour créer le compte testeur.');
  } else {
    // Vérifier si l'auth user existe
    const { data: listData, error: listError } = await supabase.auth.admin.listUsers({
      page: 1, perPage: 1000,
    });
    if (listError) {
      console.error(`  ❌  Impossible de lister les Auth users : ${listError.message}`);
    } else {
      const authUsers = listData?.users ?? [];
      const existingAuth = authUsers.find(u => u.email === TESTEUR_ACCOUNT.email);
      let testeurAuthId = existingAuth?.id ?? null;

      if (testeurAuthId) {
        console.log(`  ℹ️   Auth user existant (${testeurAuthId})`);
      } else {
        const { data: createData, error: createError } = await supabase.auth.admin.createUser({
          email:         TESTEUR_ACCOUNT.email,
          email_confirm: true,
        });
        if (createError || !createData?.user) {
          console.error(`  ❌  Échec création Auth testeur : ${createError?.message ?? 'réponse vide'}`);
        } else {
          testeurAuthId = createData.user.id;
          console.log(`  ✅  Auth user testeur créé (${testeurAuthId})`);
        }
      }

      if (testeurAuthId) {
        // Vérifier si le profil existe
        const { data: existingProfile } = await supabase
          .from('users')
          .select('id')
          .eq('id', testeurAuthId)
          .maybeSingle()
          .returns<ProfileRow | null>();

        if (existingProfile) {
          console.log('  ℹ️   Profil testeur existant — non modifié.');
        } else {
          const { error: profileError } = await supabase
            .from('users')
            .insert({
              id:            testeurAuthId,
              restaurant_id: testRestaurantId,
              full_name:     TESTEUR_ACCOUNT.fullName,
              role:          TESTEUR_ACCOUNT.role,
            });
          if (profileError) {
            console.error(`  ❌  Échec profil testeur : ${profileError.message}`);
          } else {
            console.log('  ✅  Profil testeur créé dans public.users');
          }
        }

        // Lien de configuration
        const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
          type:  'recovery',
          email: TESTEUR_ACCOUNT.email,
        });
        const actionLink = linkData?.properties?.action_link;
        if (linkError || !actionLink) {
          console.warn(`  ⚠️   Lien non généré : ${linkError?.message ?? 'réponse vide'}`);
          console.warn('      Utilisez Supabase Dashboard → Auth → Users → Reset password.');
        } else {
          console.log(`  🔑  Lien de configuration testeur (24h) :`);
          console.log(`      ${actionLink}`);
        }
      }
    }
  }

  // ── 7. Résumé final ───────────────────────────────────────────────────────

  console.log('\n' + '═'.repeat(62));
  console.log(`  ✅  Restaurant de test prêt : "${TEST_RESTAURANT_NAME}"`);
  console.log(`  restaurant_id test : ${testRestaurantId}`);
  console.log('\n  Prochaines étapes :');
  console.log('    1. Notez le restaurant_id test ci-dessus.');
  console.log('    2. Pour tester avec ce restaurant, remplacez RESTAURANT_ID');
  console.log('       dans .env.import par la valeur ci-dessus.');
  console.log('    3. Le compte testeur peut se connecter et ne verra que');
  console.log('       les données de "La Maison Test".');
  console.log('    4. Pour revenir au restaurant réel, restaurez le vrai RESTAURANT_ID.');
  console.log('═'.repeat(62) + '\n');
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
  console.error('Erreur fatale :', err instanceof Error ? err.message : err);
  process.exit(1);
});

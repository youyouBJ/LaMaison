/**
 * prepare-staff-accounts.ts
 *
 * Prépare les comptes staff pour le restaurant La Maison (restaurant réel).
 * Lit la liste depuis scripts/staff-accounts.config.ts.
 *
 * Modes :
 *   dry-run (défaut) : vérifie l'état sans rien créer
 *   apply            : crée les comptes Auth + profils, génère un lien de configuration
 *
 * Usage :
 *   npm run staff:prepare:dry-run
 *   npm run staff:prepare:apply -- --confirm=CREATE_STAFF_ACCOUNTS
 *
 * Variables requises dans .env.import :
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   RESTAURANT_ID   (uuid du restaurant "La Maison" dans Supabase)
 *
 * ⚠️  La service_role key est utilisée uniquement dans ce script.
 *     Elle ne doit jamais être importée dans src/ (app mobile).
 * ⚠️  Aucun mot de passe n'est affiché ni stocké.
 *     Les utilisateurs définissent leur mot de passe via le lien généré.
 */

import { config as dotenvConfig } from 'dotenv';
import { resolve }                 from 'path';
import { existsSync }              from 'fs';
import { createClient }            from '@supabase/supabase-js';
import type { SupabaseClient }     from '@supabase/supabase-js';
import { STAFF_ACCOUNTS }          from './staff-accounts.config';
import type { StaffAccountConfig } from './staff-accounts.config';

// ─── Env ──────────────────────────────────────────────────────────────────────

const envPath = resolve(process.cwd(), '.env.import');
if (!existsSync(envPath)) {
  console.error('❌  Fichier .env.import introuvable.');
  console.error('    Créez-le à partir de .env.import.example et renseignez les valeurs.');
  process.exit(1);
}
dotenvConfig({ path: envPath });

const supabaseUrl    = process.env['SUPABASE_URL'];
const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const restaurantId   = process.env['RESTAURANT_ID'];

if (!supabaseUrl) {
  console.error('❌  SUPABASE_URL manquant dans .env.import');
  process.exit(1);
}
if (!serviceRoleKey) {
  console.error('❌  SUPABASE_SERVICE_ROLE_KEY manquante dans .env.import');
  process.exit(1);
}
if (!restaurantId) {
  console.error('❌  RESTAURANT_ID manquant dans .env.import');
  console.error('    Récupérez-le dans Supabase : Table Editor → restaurants → colonne id');
  process.exit(1);
}

// Variables validées — on peut les utiliser comme string dès ici
const SUPABASE_URL    : string = supabaseUrl;
const RESTAURANT_ID   : string = restaurantId;
const SERVICE_ROLE_KEY: string = serviceRoleKey;

// ─── Args ─────────────────────────────────────────────────────────────────────

const CONFIRM_TOKEN = 'CREATE_STAFF_ACCOUNTS';
const args          = process.argv.slice(2);
const isApply       = args.includes('--apply') && args.includes(`--confirm=${CONFIRM_TOKEN}`);
const isDryRun      = !isApply;

// ─── Client (service_role — ne jamais importer dans src/) ─────────────────────

const supabase: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

// ─── Types internes ───────────────────────────────────────────────────────────

type AccountStatus =
  | 'missing_email'   // email non configuré dans la config
  | 'ready'           // email défini, aucun compte existant → à créer
  | 'partial'         // auth user existe mais profil public.users manquant
  | 'complete';       // auth user + profil existent déjà

type AccountCheck = {
  account:       StaffAccountConfig;
  status:        AccountStatus;
  authId:        string | null;
  profileExists: boolean;
};

type AuthUserRecord = { id: string; email: string | undefined };
type ProfileRecord  = { id: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function loadAuthUsers(): Promise<AuthUserRecord[]> {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`Impossible de lister les utilisateurs Auth : ${error.message}`);
  const users = data?.users ?? [];
  return users.map(u => ({ id: u.id, email: u.email }));
}

async function checkAccounts(accounts: StaffAccountConfig[]): Promise<AccountCheck[]> {
  const authUsers = await loadAuthUsers();
  const checks: AccountCheck[] = [];

  for (const account of accounts) {
    if (!account.email) {
      checks.push({ account, status: 'missing_email', authId: null, profileExists: false });
      continue;
    }

    const found = authUsers.find(u => u.email === account.email) ?? null;

    let profileExists = false;
    if (found) {
      const { data } = await supabase
        .from('users')
        .select('id')
        .eq('id', found.id)
        .maybeSingle()
        .returns<ProfileRecord | null>();
      profileExists = data !== null;
    }

    const status: AccountStatus =
      !found            ? 'ready'    :
      !profileExists    ? 'partial'  :
                          'complete';

    checks.push({ account, status, authId: found?.id ?? null, profileExists });
  }

  return checks;
}

// ─── Dry-run ──────────────────────────────────────────────────────────────────

async function runDryRun(): Promise<void> {
  console.log('\n' + '═'.repeat(62));
  console.log('  DRY-RUN — prepare-staff-accounts');
  console.log('═'.repeat(62));
  console.log(`  Supabase    : ${SUPABASE_URL}`);
  console.log(`  Restaurant  : ${RESTAURANT_ID}`);
  console.log('─'.repeat(62) + '\n');

  // Vérifier que le restaurant existe
  const { data: restaurant, error: restaurantError } = await supabase
    .from('restaurants')
    .select('id, name')
    .eq('id', RESTAURANT_ID)
    .maybeSingle()
    .returns<{ id: string; name: string } | null>();

  if (restaurantError || !restaurant) {
    console.error(`❌  Restaurant introuvable pour RESTAURANT_ID="${RESTAURANT_ID}"`);
    console.error('    Vérifiez la valeur dans .env.import');
    process.exit(1);
  }
  console.log(`✅  Restaurant trouvé : "${restaurant.name}"\n`);

  const checks = await checkAccounts(STAFF_ACCOUNTS);
  let missing = 0, toCreate = 0, partial = 0, complete = 0;

  for (const { account, status, authId } of checks) {
    const roleTag   = `[${account.role.toUpperCase().padEnd(7)}]`;
    const emailTag  = account.email || '(email non configuré)';
    console.log(`  ${account.fullName.padEnd(14)} ${roleTag}  ${emailTag}`);
    switch (status) {
      case 'missing_email':
        console.log(`      ⚠️   Email non renseigné — compléter dans staff-accounts.config.ts`);
        missing++;
        break;
      case 'ready':
        console.log(`      ✅  Compte inexistant → sera créé`);
        toCreate++;
        break;
      case 'partial':
        console.log(`      ⚠️   Auth user existe (${authId}) mais profil public.users manquant → sera complété`);
        partial++;
        break;
      case 'complete':
        console.log(`      ℹ️   Compte complet existant (auth + profil) — non modifié`);
        complete++;
        break;
    }
    console.log(`      Note : ${account.note}\n`);
  }

  console.log('─'.repeat(62));
  console.log(`  Résumé :`);
  if (toCreate > 0) console.log(`    ${toCreate}  compte(s) à créer`);
  if (partial  > 0) console.log(`    ${partial}  compte(s) partiel(s) à compléter`);
  if (complete > 0) console.log(`    ${complete}  compte(s) déjà complet(s) — non touchés`);
  if (missing  > 0) {
    console.log(`    ${missing}  compte(s) sans email — renseigner dans staff-accounts.config.ts`);
    console.log('\n  ⚠️   Des emails sont manquants. Complétez-les avant de lancer apply.');
  }
  if (toCreate > 0 || partial > 0) {
    console.log('\n  Pour créer les comptes :');
    console.log(`    npm run staff:prepare:apply -- --confirm=${CONFIRM_TOKEN}`);
  }
  console.log('═'.repeat(62) + '\n');
}

// ─── Apply ────────────────────────────────────────────────────────────────────

async function runApply(): Promise<void> {
  console.log('\n' + '═'.repeat(62));
  console.log('  APPLY — prepare-staff-accounts');
  console.log('═'.repeat(62));
  console.log(`  Restaurant : ${RESTAURANT_ID}`);
  console.log('─'.repeat(62) + '\n');

  const checks = await checkAccounts(STAFF_ACCOUNTS);

  for (const check of checks) {
    const { account, status, authId } = check;
    console.log(`\n── ${account.fullName} [${account.role}] ${'─'.repeat(40 - account.fullName.length)}`);
    console.log(`   Email : ${account.email || '(manquant)'}`);
    console.log(`   Note  : ${account.note}`);

    if (status === 'missing_email') {
      console.log('   ⚠️   Email non configuré — ignoré.');
      console.log('       Renseignez l\'email dans scripts/staff-accounts.config.ts puis relancez.');
      continue;
    }

    if (status === 'complete') {
      console.log('   ℹ️   Compte complet existant — non modifié.');
      continue;
    }

    let userId = authId;

    // ── Créer l'auth user si inexistant ───────────────────────────────────────
    if (!userId) {
      console.log('   ➕  Création de l\'utilisateur Auth…');
      const { data: createData, error: createError } = await supabase.auth.admin.createUser({
        email:         account.email,
        email_confirm: true,
        // Pas de mot de passe — l'utilisateur le définira via le lien généré ci-dessous
      });

      if (createError || !createData?.user) {
        console.error(`   ❌  Échec création Auth : ${createError?.message ?? 'réponse vide'}`);
        continue;
      }
      userId = createData.user.id;
      console.log(`   ✅  Auth user créé (${userId})`);
    } else {
      console.log(`   ℹ️   Auth user existant : ${userId}`);
    }

    // ── Créer le profil si manquant ───────────────────────────────────────────
    if (!check.profileExists) {
      console.log('   ➕  Création du profil dans public.users…');
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id:            userId,
          restaurant_id: RESTAURANT_ID,
          full_name:     account.fullName,
          role:          account.role,
        });

      if (profileError) {
        console.error(`   ❌  Échec création profil : ${profileError.message}`);
        continue;
      }
      console.log('   ✅  Profil créé dans public.users');
    } else {
      console.log('   ℹ️   Profil déjà existant — non modifié.');
    }

    // ── Générer un lien de configuration du mot de passe ─────────────────────
    console.log('   🔗  Génération du lien de définition du mot de passe…');
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type:  'recovery',
      email: account.email,
    });

    const actionLink = linkData?.properties?.action_link;
    if (linkError || !actionLink) {
      console.warn(`   ⚠️   Lien non généré : ${linkError?.message ?? 'réponse vide'}`);
      console.warn('       Envoyez un reset password depuis : Supabase Dashboard → Auth → Users');
    } else {
      console.log(`   🔑  Lien de configuration du mot de passe (valable 24h) :`);
      console.log(`       ${actionLink}`);
      console.log('       → Transmettez ce lien à la personne. Elle définira son propre mot de passe.');
    }
  }

  console.log('\n' + '═'.repeat(62));
  console.log('  Terminé.');
  console.log('═'.repeat(62) + '\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (isDryRun) {
    console.log('  (Mode dry-run — aucune modification. Lancez --apply pour créer les comptes.)');
    await runDryRun();
  } else {
    await runApply();
  }
}

main().catch((err: unknown) => {
  console.error('Erreur fatale :', err instanceof Error ? err.message : err);
  process.exit(1);
});

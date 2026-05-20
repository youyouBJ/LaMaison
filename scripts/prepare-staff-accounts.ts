/**
 * prepare-staff-accounts.ts
 *
 * Prépare les comptes staff pour le restaurant La Maison (restaurant réel).
 * Idempotent : peut être relancé plusieurs fois sans créer de doublons.
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
 *
 * Si "permission denied for table users" → exécuter :
 *   supabase/manual/grant_service_role.sql  dans Supabase → SQL Editor
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

if (!supabaseUrl)    { console.error('❌  SUPABASE_URL manquant dans .env.import');           process.exit(1); }
if (!serviceRoleKey) { console.error('❌  SUPABASE_SERVICE_ROLE_KEY manquante dans .env.import'); process.exit(1); }
if (!restaurantId)   {
  console.error('❌  RESTAURANT_ID manquant dans .env.import');
  console.error('    Récupérez-le dans Supabase : Table Editor → restaurants → colonne id');
  process.exit(1);
}

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

// ─── Hint permission ──────────────────────────────────────────────────────────

const PERM_HINT = [
  '   💡  Permissions manquantes pour service_role.',
  '       Exécutez ce SQL dans Supabase → SQL Editor :',
  '         GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.users        TO service_role;',
  '         GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shifts       TO service_role;',
  '         GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reservations TO service_role;',
  '       Fichier complet : supabase/manual/grant_service_role.sql',
].join('\n');

function isPermissionError(msg: string): boolean {
  return msg.toLowerCase().includes('permission denied');
}

// ─── Types internes ───────────────────────────────────────────────────────────

type AccountStatus =
  | 'missing_email'   // email non configuré dans la config
  | 'ready'           // auth user inexistant → à créer
  | 'partial'         // auth user existe mais profil public.users manquant
  | 'complete';       // auth user + profil existent déjà

type AccountCheck = {
  account:        StaffAccountConfig;
  status:         AccountStatus;
  authId:         string | null;
  profileExists:  boolean;
  profileCheckErr: string | null;  // erreur lors du SELECT profil (ex. permission denied)
};

type AuthUserRecord = { id: string; email: string | undefined };
type ProfileRecord  = { id: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function loadAuthUsers(): Promise<AuthUserRecord[]> {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`Impossible de lister les utilisateurs Auth : ${error.message}`);
  return (data?.users ?? []).map(u => ({ id: u.id, email: u.email }));
}

async function checkAccounts(accounts: StaffAccountConfig[]): Promise<AccountCheck[]> {
  const authUsers = await loadAuthUsers();
  const checks: AccountCheck[] = [];

  for (const account of accounts) {
    if (!account.email) {
      checks.push({ account, status: 'missing_email', authId: null, profileExists: false, profileCheckErr: null });
      continue;
    }

    const found = authUsers.find(u => u.email === account.email) ?? null;

    let profileExists    = false;
    let profileCheckErr: string | null = null;

    if (found) {
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('id', found.id)
        .maybeSingle()
        .returns<ProfileRecord | null>();

      if (error) {
        // Permission denied ou autre erreur — on ne peut pas déterminer l'état réel
        profileCheckErr = error.message;
        profileExists   = false;
      } else {
        profileExists = data !== null;
      }
    }

    const status: AccountStatus =
      !found         ? 'ready'   :
      !profileExists ? 'partial' :
                       'complete';

    checks.push({ account, status, authId: found?.id ?? null, profileExists, profileCheckErr });
  }

  return checks;
}

// ─── Dry-run ──────────────────────────────────────────────────────────────────

async function runDryRun(): Promise<void> {
  console.log('\n' + '═'.repeat(64));
  console.log('  DRY-RUN — prepare-staff-accounts');
  console.log('═'.repeat(64));
  console.log(`  Supabase    : ${SUPABASE_URL}`);
  console.log(`  Restaurant  : ${RESTAURANT_ID}`);
  console.log('─'.repeat(64) + '\n');

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

  // Tester l'accès en lecture à public.users
  const { error: permTest } = await supabase
    .from('users')
    .select('id')
    .limit(1);

  if (permTest && isPermissionError(permTest.message)) {
    console.warn('⚠️   ATTENTION : Accès refusé à public.users avec service_role.');
    console.warn('     Le dry-run est partiel. Exécutez d\'abord :');
    console.warn('     supabase/manual/grant_service_role.sql dans Supabase → SQL Editor\n');
  }

  const checks = await checkAccounts(STAFF_ACCOUNTS);
  let missing = 0, toCreate = 0, partial = 0, complete = 0, permErr = 0;

  for (const { account, status, authId, profileCheckErr } of checks) {
    const roleTag  = `[${account.role.toUpperCase().padEnd(7)}]`;
    const emailTag = account.email || '(email non configuré)';
    console.log(`  ${account.fullName.padEnd(14)} ${roleTag}  ${emailTag}`);

    switch (status) {
      case 'missing_email':
        console.log(`      ⚠️   Email non renseigné — compléter dans staff-accounts.config.ts`);
        missing++;
        break;
      case 'ready':
        console.log(`      ✅  Auth user inexistant → sera créé`);
        toCreate++;
        break;
      case 'partial':
        if (profileCheckErr) {
          console.log(`      ⚠️   Auth user existe (${authId})`);
          console.log(`      ❌  Impossible de vérifier le profil public.users : ${profileCheckErr}`);
          if (isPermissionError(profileCheckErr)) {
            console.log(`      💡  Exécutez supabase/manual/grant_service_role.sql puis relancez.`);
          }
          permErr++;
        } else {
          console.log(`      ⚠️   Auth user existe (${authId}) — profil public.users manquant → sera créé`);
        }
        partial++;
        break;
      case 'complete':
        console.log(`      ℹ️   Compte complet (auth ✓ + profil ✓) — non modifié`);
        complete++;
        break;
    }
    console.log(`      Note : ${account.note}\n`);
  }

  console.log('─'.repeat(64));
  console.log('  Résumé :');
  if (toCreate > 0) console.log(`    ${toCreate}  compte(s) à créer (auth + profil)`);
  if (partial  > 0) console.log(`    ${partial}  compte(s) partiel(s) — profil manquant à compléter`);
  if (complete > 0) console.log(`    ${complete}  compte(s) déjà complet(s) — non touchés`);
  if (missing  > 0) console.log(`    ${missing}  compte(s) sans email — renseigner dans staff-accounts.config.ts`);
  if (permErr  > 0) {
    console.log(`\n  ❌  ${permErr} erreur(s) de permission détectée(s).`);
    console.log('     Exécutez d\'abord supabase/manual/grant_service_role.sql');
    console.log('     puis relancez le dry-run pour confirmer l\'état.\n');
  } else if (toCreate > 0 || partial > 0) {
    console.log(`\n  Pour créer/compléter les comptes :`);
    console.log(`    npm run staff:prepare:apply -- --confirm=${CONFIRM_TOKEN}`);
  }
  console.log('═'.repeat(64) + '\n');
}

// ─── Apply ────────────────────────────────────────────────────────────────────

async function runApply(): Promise<void> {
  console.log('\n' + '═'.repeat(64));
  console.log('  APPLY — prepare-staff-accounts');
  console.log('═'.repeat(64));
  console.log(`  Restaurant : ${RESTAURANT_ID}`);
  console.log('─'.repeat(64) + '\n');

  const checks = await checkAccounts(STAFF_ACCOUNTS);
  let permErrorSeen = false;

  for (const check of checks) {
    const { account, status, authId } = check;
    console.log(`\n── ${account.fullName} [${account.role}] ${'─'.repeat(Math.max(0, 42 - account.fullName.length))}`);
    console.log(`   Email : ${account.email || '(manquant)'}`);
    console.log(`   Note  : ${account.note}`);

    if (status === 'missing_email') {
      console.log('   ⚠️   Email non configuré — ignoré.');
      console.log('       Renseignez l\'email dans scripts/staff-accounts.config.ts puis relancez.');
      continue;
    }

    if (status === 'complete') {
      console.log('   ℹ️   Compte complet (auth ✓ + profil ✓) — non modifié.');
      continue;
    }

    let userId = authId;

    // ── Créer l'auth user si inexistant ───────────────────────────────────────
    if (!userId) {
      console.log('   ➕  Création de l\'utilisateur Auth…');
      const { data: createData, error: createError } = await supabase.auth.admin.createUser({
        email:         account.email,
        email_confirm: true,
        // Pas de mot de passe — l'utilisateur le définira via le lien de récupération
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
        if (isPermissionError(profileError.message)) {
          console.error(PERM_HINT);
          permErrorSeen = true;
        }
        continue;
      }
      console.log('   ✅  Profil créé dans public.users');
    } else {
      console.log('   ℹ️   Profil déjà existant — non modifié.');
    }

    // ── Générer un lien de configuration du mot de passe ─────────────────────
    console.log('   🔗  Génération du lien de configuration du mot de passe…');
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type:  'recovery',
      email: account.email,
    });

    const actionLink = linkData?.properties?.action_link;
    if (linkError || !actionLink) {
      console.warn(`   ⚠️   Lien non généré : ${linkError?.message ?? 'réponse vide'}`);
      console.warn('       Envoyez un reset password depuis : Supabase Dashboard → Auth → Users');
    } else {
      console.log(`   🔑  Lien de configuration (valable 24h) :`);
      console.log(`       ${actionLink}`);
      console.log('       → Transmettez ce lien à la personne. Elle définira son propre mot de passe.');
    }
  }

  console.log('\n' + '═'.repeat(64));
  if (permErrorSeen) {
    console.log('  ⚠️   Des erreurs de permission ont empêché la création de certains profils.');
    console.log('      1. Exécutez supabase/manual/grant_service_role.sql dans Supabase → SQL Editor');
    console.log(`      2. Relancez : npm run staff:prepare:apply -- --confirm=${CONFIRM_TOKEN}`);
    console.log('         (idempotent — seuls les profils manquants seront créés)');
  } else {
    console.log('  ✅  Terminé sans erreur de permission.');
  }
  console.log('═'.repeat(64) + '\n');
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

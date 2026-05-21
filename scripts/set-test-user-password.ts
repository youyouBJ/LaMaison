/**
 * set-test-user-password.ts
 *
 * Définit le mot de passe d'un compte testeur Supabase Auth sans modifier
 * la base de données restaurant (tables public.*).
 *
 * Usage :
 *   TEST_USER_PASSWORD="motdepasse" npm run auth:set-test-password
 *
 * Variables requises dans .env.import :
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Variable requise en ligne de commande :
 *   TEST_USER_PASSWORD   (min. 8 caractères)
 *
 * ⚠️  Le mot de passe n'est jamais affiché ni stocké dans les logs.
 * ⚠️  La service_role key ne doit jamais être importée dans src/.
 */

import { config as dotenvConfig } from 'dotenv';
import { resolve }                 from 'path';
import { existsSync }              from 'fs';
import { createClient }            from '@supabase/supabase-js';

// ─── Constants ────────────────────────────────────────────────────────────────

const TEST_USER_EMAIL    = 'musicybj@gmail.com';
const PASSWORD_MIN_LENGTH = 8;

// ─── Env (.env.import) ────────────────────────────────────────────────────────

const envPath = resolve(process.cwd(), '.env.import');
if (!existsSync(envPath)) {
  console.error('❌  Fichier .env.import introuvable.');
  console.error('    Créez-le à partir de .env.import.example et renseignez les valeurs.');
  process.exit(1);
}
dotenvConfig({ path: envPath });

const supabaseUrl    = process.env['SUPABASE_URL'];
const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl)    { console.error('❌  SUPABASE_URL manquant dans .env.import');               process.exit(1); }
if (!serviceRoleKey) { console.error('❌  SUPABASE_SERVICE_ROLE_KEY manquante dans .env.import'); process.exit(1); }

const SUPABASE_URL     : string = supabaseUrl;
const SERVICE_ROLE_KEY : string = serviceRoleKey;

// ─── Env (ligne de commande) ──────────────────────────────────────────────────

const testUserPassword = process.env['TEST_USER_PASSWORD'];

if (!testUserPassword) {
  console.error('❌  TEST_USER_PASSWORD est absent.');
  console.error('    Usage : TEST_USER_PASSWORD="motdepasse" npm run auth:set-test-password');
  process.exit(1);
}

if (testUserPassword.length < PASSWORD_MIN_LENGTH) {
  console.error(`❌  TEST_USER_PASSWORD trop court (minimum ${PASSWORD_MIN_LENGTH} caractères).`);
  process.exit(1);
}

// ─── Supabase Admin ───────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\n🔍  Recherche du compte Auth pour : ${TEST_USER_EMAIL}`);

  // Récupérer la liste des utilisateurs et filtrer par email
  const { data: listData, error: listError } = await supabase.auth.admin.listUsers();

  if (listError) {
    console.error('❌  Impossible de récupérer la liste des utilisateurs Auth.');
    console.error(`    ${listError.message}`);
    process.exit(1);
  }

  const user = listData.users.find((u) => u.email === TEST_USER_EMAIL);

  if (!user) {
    console.error(`❌  Aucun compte Auth trouvé pour : ${TEST_USER_EMAIL}`);
    console.error('    Vérifiez que le compte existe dans Supabase → Authentication → Users.');
    process.exit(1);
  }

  console.log(`✅  Utilisateur trouvé — id : ${user.id}`);

  // Mise à jour du mot de passe
  const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
    password: testUserPassword,
  });

  if (updateError) {
    console.error('❌  Échec de la mise à jour du mot de passe.');
    console.error(`    ${updateError.message}`);
    process.exit(1);
  }

  console.log('✅  Mot de passe mis à jour avec succès.');
  console.log(`    Compte : ${TEST_USER_EMAIL}\n`);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`❌  Erreur inattendue : ${message}`);
  process.exit(1);
});

/**
 * Configuration des comptes staff — La Maison.
 *
 * Ce fichier est versionné dans Git (pas de secrets, pas de mots de passe).
 *
 * ÉTAPES :
 *   1. Vérifier les emails ci-dessous
 *   2. Lancer : npm run staff:prepare:dry-run  (vérifie sans créer)
 *   3. Lancer : npm run staff:prepare:apply -- --confirm=CREATE_STAFF_ACCOUNTS
 *
 * Pour le restaurant test :
 *   npm run test:seed:dry-run
 *   npm run test:seed:apply -- --confirm=CREATE_TEST_RESTAURANT
 */

import type { UserRole } from '../src/types/database';

export type StaffAccountConfig = {
  fullName: string;
  email:    string;
  role:     UserRole;
  note:     string;
};

// ─── Comptes staff du restaurant réel (La Maison) ─────────────────────────────
//
// Seuls les comptes avec un email renseigné sont créés par le script.
// Nabil : email non encore disponible — laissé en TODO, exclu du script.

export const STAFF_ACCOUNTS: StaffAccountConfig[] = [
  {
    fullName: 'Youssef',
    email:    'youssefbenjema@gmail.com',
    role:     'admin',
    note:     'Owner — accès complet (admin)',
  },
  {
    fullName: 'Anis',
    email:    'hiyatrade@gmail.com',
    role:     'manager',
    note:     'Manager — accès opérationnel (réservations, analytics, paramètres)',
  },
  // Nabil — email non encore disponible, à activer quand l'email sera fourni
  // {
  //   fullName: 'Nabil',
  //   email:    '',   // TODO : renseigner l'email de Nabil
  //   role:     'manager',
  //   note:     'Manager — accès opérationnel (réservations, analytics, paramètres)',
  // },
  {
    fullName: 'iPad Resto',
    email:    'direction1@lamaison-restaurant.com',
    role:     'host',
    note:     'iPad du restaurant — réservations, plan de salle, waitlist, clients uniquement',
  },
];

// ─── Compte testeur isolé (restaurant "La Maison Test" uniquement) ────────────
//
// ⚠️  Ce compte est lié UNIQUEMENT au restaurant "La Maison Test".
//     Il ne doit jamais être rattaché au restaurant réel.
//     Les RLS (restaurant_id) garantissent l'isolation totale :
//     le testeur ne voit pas les clients, réservations, tables ou paramètres
//     du vrai restaurant La Maison.

export const TESTEUR_ACCOUNT: StaffAccountConfig = {
  fullName: 'Testeur',
  email:    'musicybj@gmail.com',
  role:     'host',
  note:     'Compte testeur isolé — accès uniquement au restaurant "La Maison Test"',
};

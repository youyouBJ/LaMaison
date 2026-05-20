/**
 * Configuration des comptes staff — La Maison.
 *
 * Remplir les emails avant de lancer npm run staff:prepare:apply.
 * Ce fichier est versionné dans Git (pas de secrets, pas de mots de passe).
 *
 * ÉTAPES :
 *   1. Remplacer les emails vides ('') par les vrais emails
 *   2. Lancer : npm run staff:prepare:dry-run  (vérifier sans créer)
 *   3. Lancer : npm run staff:prepare:apply -- --confirm=CREATE_STAFF_ACCOUNTS
 */

import type { UserRole } from '../src/types/database';

export type StaffAccountConfig = {
  fullName: string;
  email:    string;   // '' = non encore renseigné — le dry-run l'indiquera
  role:     UserRole;
  note:     string;
};

// ─── Comptes staff du restaurant réel ─────────────────────────────────────────

export const STAFF_ACCOUNTS: StaffAccountConfig[] = [
  {
    fullName: 'Youssef',
    email:    '',   // TODO : renseigner l'email de Youssef
    role:     'admin',
    note:     'Owner — accès complet (admin)',
  },
  {
    fullName: 'Anis',
    email:    '',   // TODO : renseigner l'email de Anis
    role:     'manager',
    note:     'Manager — accès opérationnel (réservations, analytics, paramètres)',
  },
  {
    fullName: 'Nabil',
    email:    '',   // TODO : renseigner l'email de Nabil
    role:     'manager',
    note:     'Manager — accès opérationnel (réservations, analytics, paramètres)',
  },
  {
    fullName: 'iPad Resto',
    email:    '',   // TODO : renseigner l'email dédié à l'iPad du restaurant
    role:     'host',
    note:     'iPad du restaurant — réservations, plan de salle, waitlist, clients uniquement',
  },
];

// ─── Compte testeur isolé (restaurant "La Maison Test") ───────────────────────

export const TESTEUR_ACCOUNT: StaffAccountConfig = {
  fullName: 'Testeur',
  email:    '',   // TODO : renseigner l'email du compte testeur
  role:     'host',
  note:     'Compte testeur isolé — accès uniquement au restaurant "La Maison Test"',
};

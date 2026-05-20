# Comptes Staff — La Maison

## Système d'auth existant

L'app utilise **Supabase Auth** (email + mot de passe). Chaque utilisateur est composé de deux éléments :

1. **`auth.users`** — l'entrée Supabase Auth (gérée par Supabase, hors DB publique)
2. **`public.users`** — le profil staff (id = auth.users.id, restaurant_id, full_name, role)

Le RLS de toutes les tables est basé sur `current_user_restaurant_id()` qui lit `public.users.restaurant_id`. Un utilisateur ne voit **que** les données de son restaurant.

---

## Rôles disponibles

| Rôle      | Accès |
|-----------|-------|
| `admin`   | Accès complet — paramètres restaurant, gestion staff, tout |
| `manager` | Opérationnel + analytics + paramètres non-sensibles |
| `host`    | Réservations, plan de salle, waitlist, clients, WhatsApp/email |
| `waiter`  | Accès de base (lecture) |

> Les permissions fines par rôle (`waiter` vs `host`) sont partiellement implémentées dans les RLS.
> Une granularité supplémentaire est prévue en V2 (voir BACKLOG.md).

---

## Comptes prévus — restaurant réel

Configurés dans `scripts/staff-accounts.config.ts` :

| Nom         | Rôle      | Notes |
|-------------|-----------|-------|
| Youssef     | `admin`   | Owner — accès complet |
| Anis        | `manager` | Accès opérationnel |
| Nabil       | `manager` | Accès opérationnel |
| iPad Resto  | `host`    | Compte dédié à l'iPad du restaurant |

> **Les emails ne sont pas encore renseignés.**
> Voir section "Ce que vous devez fournir" en bas de ce document.

---

## Compte iPad Resto

L'iPad du restaurant a son propre compte (`host`) pour les raisons suivantes :
- Pas de données sensibles admin accessibles
- Peut être révoqué sans impact sur les autres comptes
- Facilite la traçabilité des actions (`created_by` sur les réservations)
- Email dédié (ex. `ipad@lamaison.tn`) non lié à une personne physique

---

## Compte testeur isolé

Un compte testeur est lié à un **second restaurant** : `"La Maison Test"`.

Grâce aux RLS filtrées par `restaurant_id`, le testeur :
- **Ne voit pas** les données du restaurant réel
- **Ne peut pas modifier** les vraies réservations, clients ou tables
- Accède uniquement au dataset minimal de test

Le dataset de test contient :
- 2 services (Déjeuner Test, Dîner Test)
- 5 tables (Salle ×2, Terrasse ×2, Bar ×1)
- 3 clients fictifs (Alice Dupont, Bob Martin, Cécile Moreau)
- 3 réservations (hier/terminée, aujourd'hui/confirmée, demain/en attente)

---

## Méthode de création des comptes

### Étape 1 — Renseigner les emails

Ouvrir `scripts/staff-accounts.config.ts` et remplacer les `''` par les vrais emails :

```typescript
{ fullName: 'Youssef',    email: 'youssef@lamaison.tn',  role: 'admin',   ... },
{ fullName: 'Anis',       email: 'anis@lamaison.tn',     role: 'manager', ... },
{ fullName: 'Nabil',      email: 'nabil@lamaison.tn',    role: 'manager', ... },
{ fullName: 'iPad Resto', email: 'ipad@lamaison.tn',     role: 'host',    ... },
```

### Étape 2 — Vérifier le RESTAURANT_ID

Dans `.env.import`, vérifier que `RESTAURANT_ID` correspond au vrai restaurant :

```
SUPABASE_URL=https://nosflczsevtrxnyienyn.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
RESTAURANT_ID=<uuid du restaurant "La Maison" dans Supabase>
```

### Étape 3 — Dry-run (sans création)

```bash
npm run staff:prepare:dry-run
```

Le script vérifie :
- Que le restaurant existe pour le RESTAURANT_ID fourni
- Si chaque compte Auth existe déjà
- Si chaque profil `public.users` existe déjà
- Affiche le plan d'action sans rien créer

### Étape 4 — Apply (création réelle)

```bash
npm run staff:prepare:apply -- --confirm=CREATE_STAFF_ACCOUNTS
```

Pour chaque compte :
1. Crée l'Auth user (si inexistant)
2. Crée le profil dans `public.users` (si inexistant)
3. **Génère un lien de définition du mot de passe** (valable 24h)
4. Affiche le lien dans la console

> ⚠️ **Aucun mot de passe n'est affiché ni stocké.**
> Le lien généré permet à chaque personne de définir son propre mot de passe.
> Transmettez le lien à la personne concernée — il expire après 24h.

---

## Restaurant de test

### Dry-run

```bash
npm run test:seed:dry-run
```

### Apply

```bash
npm run test:seed:apply -- --confirm=CREATE_TEST_RESTAURANT
```

Après l'apply, notez le `restaurant_id test` affiché. Pour tester l'app avec ce restaurant :
1. Remplacez `RESTAURANT_ID` dans `.env.import` par la valeur affichée
2. Le compte testeur est lié à ce restaurant_id → il voit uniquement le dataset de test

Pour revenir au restaurant réel, restaurez le vrai `RESTAURANT_ID`.

---

## Sécurité — service_role key

La `service_role` key (présente dans `.env.import`) :
- Bypass le RLS — accès admin total à la DB
- **Ne doit jamais être importée dans `src/`** (app mobile)
- **Ne doit jamais être committée dans Git**
- Utilisée uniquement dans `scripts/` via `process.env`
- `.env.import` est dans `.gitignore` ✓

---

## Ce que vous devez fournir

Avant de lancer `staff:prepare:apply`, communiquez les informations suivantes :

| Compte      | Email à fournir |
|-------------|-----------------|
| Youssef     | ❓ email personnel ou pro |
| Anis        | ❓ email personnel ou pro |
| Nabil       | ❓ email personnel ou pro |
| iPad Resto  | ❓ email dédié (ex. `ipad@lamaison.tn`) ou Gmail dédié |
| Testeur     | ❓ email pour les tests (peut être un alias ou un email jetable) |

Renseignez-les dans `scripts/staff-accounts.config.ts` puis lancez le dry-run pour vérifier.

---

## Ce qui reste à faire (V2)

- [ ] **Gestion équipe dans l'app** : liste des membres du staff (admins/managers seulement) avec ajout/suppression depuis l'app
- [ ] **Permissions fines `waiter`** : accès lectures uniquement (sans insert réservation)
- [ ] **Révocation de compte** : désactivation d'un auth user via le Dashboard Supabase
- [ ] **Rotation des liens** : script pour regénérer les liens de configuration expirés
- [ ] **Indicateur d'environnement** : badge "Environnement test" dans l'app si le restaurant s'appelle "La Maison Test"

---

*Document créé le 2026-05-20.*

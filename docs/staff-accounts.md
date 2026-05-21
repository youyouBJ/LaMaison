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

Le dataset test immersif contient (créé via `npm run test:seed:rich:apply`) :
- 2 services (Déjeuner Test, Dîner Test)
- ~20 tables (5 zones : Salle, Terrasse, Balcon, Bar, Lounge)
- ~120 clients fictifs (noms tunisiens, téléphones `+21699XXXXXX`, emails `@lamaison-test.local`)
- ~180 réservations (-30j / aujourd'hui / +30j — tous statuts)
- ~18 entrées waitlist
- ~30 enquêtes de satisfaction (feedback_surveys)
- Réservations multi-tables (reservation_tables)

Voir `docs/testflight.md → Dataset test immersif` pour le détail complet.

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

### Étape 1 — Créer le restaurant de test (minimal)

```bash
npm run test:seed:dry-run
npm run test:seed:apply -- --confirm=CREATE_TEST_RESTAURANT
```

### Étape 2 — Enrichir avec le dataset immersif

```bash
# Aperçu obligatoire avant apply
npm run test:seed:rich:dry-run

# Application (idempotent)
npm run test:seed:rich:apply -- --confirm=SEED_RICH_TEST_DATA
```

Le dataset immersif permet de tester toutes les fonctionnalités de l'app dans des conditions réalistes :
dashboard, rappels, réservations, plan de salle, waitlist, CRM, VIP, analytics, satisfaction, paramètres.

Après l'apply, le compte testeur (`musicybj@gmail.com`) voit uniquement les données de "La Maison Test".
Pour revenir au restaurant réel, aucune action requise — les RLS garantissent l'isolation.

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

---

## Envoi d'invitation depuis l'app (Edge Function)

### Architecture

```
App (admin/manager)
  │  supabase.functions.invoke('send-staff-invite', { targetUserId })
  ▼
Edge Function  supabase/functions/send-staff-invite/index.ts
  │  1. Valide JWT de l'appelant
  │  2. Vérifie rôle admin/manager dans public.users
  │  3. Vérifie que la cible appartient au même restaurant
  │  4. Récupère l'email via auth.admin.getUserById (service_role côté serveur)
  │  5. POST /auth/v1/recover → Supabase envoie l'email
  ▼
Supabase Auth → email "Réinitialiser le mot de passe" → utilisateur
```

**La `service_role` key reste uniquement dans l'Edge Function — jamais dans l'app mobile.**

### Section Équipe dans l'app

- Admin → Paramètres → section "Équipe"
- **V1 : visible uniquement pour le compte owner `youssefbenjema@gmail.com`**
  (même si un autre compte a le rôle `admin` ou `manager`, il ne voit pas cette section)
- Chaque membre : nom, badge rôle, bouton "Renvoyer invitation"
- Le bouton est désactivé pour l'utilisateur courant ("Vous")
- Loading → **"Envoyée ✓"** pendant 30 secondes → revient automatiquement à "Renvoyer invitation"
- Permet de renvoyer plusieurs fois sans recharger l'écran
- En cas d'erreur : message rouge, bouton immédiatement disponible

> La gestion équipe multi-admin (plusieurs owners) est prévue en V2.

### Déploiement de l'Edge Function

```bash
# Installer Supabase CLI si nécessaire
npm install -g supabase

# Se connecter
supabase login

# Déployer la fonction
supabase functions deploy send-staff-invite --project-ref nosflczsevtrxnyienyn

# Configurer les secrets (une seule fois)
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<votre_service_role_key> \
  --project-ref nosflczsevtrxnyienyn

# Optionnel : URL de redirection après configuration du mot de passe
supabase secrets set REDIRECT_URL=https://votre-app.com \
  --project-ref nosflczsevtrxnyienyn
```

> SUPABASE_URL et SUPABASE_ANON_KEY sont fournis automatiquement par Supabase.
> Ne jamais écrire la service_role key dans le code ou dans Git.

### Variables de l'Edge Function

| Variable | Source | Requis |
|---|---|---|
| `SUPABASE_URL` | Automatique (Supabase) | Oui |
| `SUPABASE_ANON_KEY` | Automatique (Supabase) | Oui |
| `SUPABASE_SERVICE_ROLE_KEY` | `supabase secrets set` | Oui |
| `REDIRECT_URL` | `supabase secrets set` | Non |

### Vérifications de sécurité de l'Edge Function

| Vérification | Comportement en cas d'échec |
|---|---|
| JWT absent | 401 Non authentifié |
| JWT invalide ou expiré | 401 Session invalide |
| Profil public.users absent | 401 Profil introuvable |
| Rôle host ou waiter | 403 Accès refusé |
| targetUserId absent / invalide | 400 |
| Cible dans un autre restaurant | 403 |
| Aucun compte Auth pour cet ID | 404 |
| Pas d'email sur le compte | 400 |
| Erreur envoi email Supabase | 500 |

### Scripts terminal (toujours disponibles en fallback)

```bash
npm run staff:prepare:dry-run
npm run staff:prepare:apply -- --confirm=CREATE_STAFF_ACCOUNTS
npm run test:seed:dry-run
npm run test:seed:apply -- --confirm=CREATE_TEST_RESTAURANT
```

---

## Ce qui reste à faire (V2)

- [ ] **Ajout/suppression de membres** : depuis l'app (actuellement lecture seule dans Équipe)
- [ ] **Permissions fines `waiter`** : accès lectures uniquement (sans insert réservation)
- [ ] **Révocation de compte** : désactivation d'un auth user via le Dashboard Supabase
- [ ] **Indicateur d'environnement** : badge "Environnement test" dans l'app si le restaurant s'appelle "La Maison Test"
- [ ] **Email automatique (Resend)** : remplacement de l'SMTP intégré Supabase par Resend pour un meilleur contrôle des templates d'invitation

---

*Document créé le 2026-05-20. Mis à jour le 2026-05-21 (Edge Function send-staff-invite).*

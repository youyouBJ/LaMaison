# Supabase — La Maison

Configuration et setup de la base de données Supabase pour le projet La Maison.

---

## Projet Supabase

- **Project ID** : `nosflczsevtrxnyienyn`
- **URL** : `https://nosflczsevtrxnyienyn.supabase.co`
- **Dashboard** : https://supabase.com/dashboard/project/nosflczsevtrxnyienyn

---

## Étapes à suivre après le premier clone

### 1. Appliquer la migration SQL

1. Ouvre le **Supabase Dashboard**
2. Va dans **SQL Editor**
3. Crée un **New query**
4. Copie-colle l'intégralité du fichier `supabase/migrations/001_initial_schema.sql`
5. Clique sur **Run** (▶)

La migration est **idempotente** : tu peux la relancer sans risque si nécessaire.

Vérifie ensuite dans **Table Editor** que les tables suivantes sont créées :
- `restaurants`
- `users`
- `floor_plans`
- `tables`
- `shifts`
- `guests`
- `reservations`
- `waitlist`
- `notifications_log`

---

### 2. Créer le premier utilisateur admin

#### 2a. Créer l'utilisateur dans Supabase Auth

1. Va dans **Authentication > Users**
2. Clique sur **Invite user** ou **Add user**
3. Renseigne l'email et le mot de passe du premier admin
4. Confirme la création
5. **Copie l'UUID** affiché dans la colonne `id` (format `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

#### 2b. Lier l'utilisateur à la table `public.users`

Dans le **SQL Editor**, exécute cette requête en remplaçant `AUTH_USER_ID_A_REMPLACER` par l'UUID copié :

```sql
INSERT INTO public.users (id, restaurant_id, full_name, role)
SELECT
  'AUTH_USER_ID_A_REMPLACER'::uuid,
  r.id,
  'Youssef Ben Jemaa',
  'admin'
FROM public.restaurants r
WHERE r.name = 'La Maison';
```

> ⚠️ Cette requête est exécutée avec les droits superuser du Dashboard (bypasse le RLS).
> Elle ne peut PAS être exécutée depuis l'app mobile (le RLS l'en empêche).

#### 2c. Vérifier l'association

```sql
SELECT
  u.id,
  u.full_name,
  u.role,
  r.name AS restaurant_name
FROM public.users u
JOIN public.restaurants r ON r.id = u.restaurant_id;
```

Tu dois voir une ligne avec le nom, le rôle `admin` et le restaurant `La Maison`.

---

### 3. Générer les types TypeScript

Après avoir appliqué la migration, génère les types TypeScript depuis le schéma réel :

#### Installation du CLI Supabase (si pas encore fait)

```bash
npm install -g supabase
```

#### Connexion

```bash
npx supabase login
```

#### Génération des types

```bash
npx supabase gen types typescript \
  --project-id nosflczsevtrxnyienyn \
  --schema public \
  > src/types/database.ts
```

> Ce fichier remplace le fichier manuel temporaire existant.
> Il est auto-généré et ne doit pas être modifié à la main.

#### Vérification TypeScript

```bash
npx tsc --noEmit
```

---

## Structure de la base de données

### Tables

| Table | Description |
|---|---|
| `restaurants` | Restaurants. Multi-tenant, chaque user appartient à un seul restaurant. |
| `users` | Profils staff. Liés à `auth.users`. Rôles : `admin > manager > host > waiter`. |
| `floor_plans` | Plans de salle. Layout JSON peuplé dans le module Plan de salle. |
| `tables` | Tables physiques avec position, capacité, zone, statut. |
| `shifts` | Services (Déjeuner, Dîner). Règles de créneaux et de durée. |
| `guests` | Base clients. Téléphone = identifiant métier principal. |
| `reservations` | Réservations liées à guests, tables, shifts. |
| `waitlist` | Liste d'attente. Synchronisée via Realtime. |
| `notifications_log` | Journal immuable des SMS/WhatsApp/Email envoyés. |

### Rôles staff

| Rôle | Permissions |
|---|---|
| `admin` | Tout : CRUD complet, gestion des users, suppression des réservations |
| `manager` | CRUD sauf gestion des users et config restaurant |
| `host` | Lecture + création/modification guests, réservations, waitlist |
| `waiter` | Lecture + création/modification réservations uniquement |

---

## Shifts initiaux — La Maison

### Convention des jours
PostgreSQL / JavaScript : `0 = dimanche`, `1 = lundi`, `2 = mardi`, ..., `6 = samedi`

### Déjeuner
- **Jours** : mardi → samedi + dimanche (fermé le lundi)
- **Horaires** : 12h00 → 16h45
- **Créneaux** : 15 min, max 30 couverts/créneau

### Dîner
- **Jours** : tous les jours (lundi inclus)
- **Horaires** : 17h00 → 00h00 (minuit)
- **⚠️ Règle applicative** : `end_time = '00:00'` signifie minuit.
  Si `end_time < start_time`, la fin est traitée comme le lendemain (J+1).

### Règles de durée (duration_rules)
```json
{
  "1":  90,
  "2":  120,
  "3":  120,
  "4":  120,
  "5":  120,
  "6":  150,
  "10": 180
}
```
Clé = taille du groupe (party_size). Valeur = durée en minutes.

---

## RLS — Points importants

### Pas de récursion infinie sur `users`

Les fonctions RLS (`current_user_restaurant_id`, `is_admin`, etc.) sont `SECURITY DEFINER`.
Elles accèdent à `public.users` en bypassant le RLS, évitant toute récursion.

### Premier utilisateur

Le premier admin **ne peut pas** être ajouté via l'app mobile (pas de RLS bypass).
Il doit être ajouté via le SQL Editor du Dashboard (étape 2 ci-dessus).

### Accès multi-tenant

Chaque utilisateur ne voit que les données de son `restaurant_id`.
Aucune donnée d'un autre restaurant n'est accessible, même partiellement.

---

## Realtime

Les tables suivantes sont publiées dans `supabase_realtime` pour la synchronisation temps réel :
- `reservations`
- `tables`
- `waitlist`
- `notifications_log`

L'intégration Realtime dans l'app sera ajoutée dans les modules Dashboard, Plan de salle et Réservations.

---

## Modules suivants

| Module | Tables principales |
|---|---|
| Plan de salle | `floor_plans`, `tables` |
| Réservations | `reservations`, `shifts`, `guests` |
| Clients | `guests` |
| Notifications | `notifications_log` |
| Paramètres | `restaurants`, `users` |

# Base de données — La Maison

Supabase PostgreSQL. Multi-tenant par `restaurant_id`.

- **Project ID** : `nosflczsevtrxnyienyn`
- **Dashboard** : https://supabase.com/dashboard/project/nosflczsevtrxnyienyn

---

## Tables principales

### `restaurants`
Cœur du multi-tenant. Chaque enregistrement est un restaurant isolé.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text | |
| `created_at` | timestamptz | |

### `users`
Profils staff, liés à `auth.users`. Un user appartient à un seul restaurant.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | = `auth.users.id` |
| `restaurant_id` | uuid FK | → `restaurants.id` |
| `full_name` | text | |
| `role` | text | `admin`, `manager`, `host`, `waiter` |
| `created_at` | timestamptz | |

### `tables`
Tables physiques du restaurant.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `restaurant_id` | uuid FK | |
| `number` | integer | Numéro affiché sur le plan |
| `capacity` | integer | |
| `zone` | text | `bar_central`, `bar_cigare`, `interieur`, `balcon`, `terrasse`, `lounge` |
| `status` | text | `free`, `reserved`, `occupied`, `unavailable` |
| `created_at` | timestamptz | |

### `shifts`
Services (Déjeuner, Dîner) avec leurs règles horaires.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `restaurant_id` | uuid FK | |
| `name` | text | Ex : "Déjeuner", "Dîner" |
| `days_of_week` | integer[] | `0=dim, 1=lun, …, 6=sam` |
| `start_time` | time | |
| `end_time` | time | `'00:00'` = minuit (fin J+1 si < start_time) |
| `slot_duration` | integer | Durée des créneaux en minutes (ex : 15) |
| `max_covers_per_slot` | integer | Max couverts par créneau |
| `duration_rules` | jsonb | `{"1": 90, "2": 120, …}` — durée par taille de groupe |

### `guests`
Base clients. Téléphone = identifiant métier principal.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `restaurant_id` | uuid FK | |
| `first_name` | text | |
| `last_name` | text | |
| `phone` | text | Identifiant principal (normalisé à l'import) |
| `email` | text | |
| `birthday` | date | |
| `notes` | text | |
| `vip` | boolean | |
| `tags` | text[] | Nettoyés à l'import SevenRooms |
| `visit_count` | integer | |
| `no_shows` | integer | |
| `cancels` | integer | |
| `avg_spend` | numeric | Dépense moyenne par visite |
| `avg_rating` | numeric | Note moyenne [0–5] |
| `last_visit` | date | |
| `marketing_opt_in` | boolean | |
| `source` | text | `'import'` (SevenRooms) ou `'manual'` |
| `created_at` | timestamptz | |

### `reservations`
Réservations liées à un guest, une table principale, et un shift.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `restaurant_id` | uuid FK | |
| `guest_id` | uuid FK nullable | `null` si walk-in |
| `table_id` | uuid FK nullable | Table principale |
| `shift_id` | uuid FK nullable | |
| `date` | date | |
| `time_slot` | time | |
| `party_size` | integer | |
| `status` | text | `confirmed`, `seated`, `completed`, `no_show`, `cancelled` |
| `source` | text | `walkin`, `phone`, `manual`, `online` |
| `notes` | text | |
| `created_by` | uuid FK | → `users.id` |
| `created_at` | timestamptz | |

### `reservation_tables` (migration 002)
Table de jointure N:N pour le multi-tables.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `reservation_id` | uuid FK | → `reservations.id` |
| `table_id` | uuid FK | → `tables.id` |
| `created_at` | timestamptz | |

**Règle** : `reservations.table_id` (table principale) est toujours renseigné en parallèle. `reservation_tables` contient toutes les tables, y compris la principale.

### `waitlist`
Liste d'attente, synchronisée en Realtime.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `restaurant_id` | uuid FK | |
| `guest_id` | uuid FK nullable | `null` si walk-in |
| `shift_id` | uuid FK nullable | Migration 003 |
| `date` | date | |
| `time_slot` | time nullable | Migration 003 |
| `party_size` | integer | |
| `status` | text | `waiting`, `notified`, `seated`, `left` |
| `notes` | text | |
| `created_at` | timestamptz | |

### `floor_plans`
Métadonnées du plan de salle (layout JSON). Le layout visuel est dans `floorPlanLayout.ts`.

### `notifications_log`
Journal immuable des SMS/WhatsApp/Email envoyés (module notifications — P1).

---

## Migrations

| Fichier | Contenu |
|---|---|
| `001_initial_schema.sql` | Schema complet, RLS, seeds (restaurant + shifts) |
| `002_reservation_tables.sql` | Table `reservation_tables` (multi-tables) |
| `003_waitlist_shift_time.sql` | Colonnes `shift_id` et `time_slot` sur `waitlist` |

Toutes les migrations sont idempotentes (`CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS`).

### Appliquer une migration

Les migrations s'appliquent via le **SQL Editor** du Dashboard Supabase. Ne pas utiliser le CLI Supabase en production sans validation.

Après migration, régénérer les types TypeScript :
```bash
npx supabase gen types typescript \
  --project-id nosflczsevtrxnyienyn \
  --schema public \
  > src/types/database.ts
```

---

## RLS — Row Level Security

Toutes les tables sont protégées par RLS. Chaque policy filtre par `restaurant_id` du user connecté.

### Fonctions helper (SECURITY DEFINER)

Ces fonctions bypassent le RLS pour éviter la récursion infinie :

```sql
current_user_restaurant_id() → uuid   -- restaurant_id du user connecté
is_admin()                   → bool   -- rôle admin ?
is_manager_or_above()        → bool   -- admin ou manager ?
```

### Isolation multi-tenant

Un utilisateur connecté ne voit **jamais** les données d'un autre restaurant. Toutes les policies incluent `restaurant_id = current_user_restaurant_id()`.

### Premier admin

Le premier admin **ne peut pas** être créé via l'app (le RLS l'en empêche). Il doit être inséré manuellement via le SQL Editor du Dashboard — voir [docs/supabase-setup.md](supabase-setup.md).

---

## Realtime

Tables publiées dans `supabase_realtime` :

| Table | Utilisé par |
|---|---|
| `reservations` | `useReservations`, `useReservationDetail`, `useFloorPlan` |
| `tables` | `useFloorPlan` |
| `waitlist` | `useWaitlist` |
| `notifications_log` | (futur) |

Chaque channel écoute les events `INSERT`, `UPDATE`, `DELETE` et déclenche un refetch complet.

---

## Accès service_role

La `service_role` key bypasse toutes les règles RLS. Elle est réservée aux :
- Scripts locaux d'import (`npm run import:sevenrooms`)
- Scripts de seed (`npm run seed:floor`)
- Opérations manuelles dans le SQL Editor

**Ne jamais** inclure la `service_role` key dans l'app mobile, dans le code versionné, ou dans les variables `EXPO_PUBLIC_*`.

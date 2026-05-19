# Setup Supabase — La Maison

Ce document reprend et complète `supabase/README.md`. Se référer à ce dernier pour le détail des shifts et de la structure RLS.

- **Project ID** : `nosflczsevtrxnyienyn`
- **URL** : `https://nosflczsevtrxnyienyn.supabase.co`
- **Dashboard** : https://supabase.com/dashboard/project/nosflczsevtrxnyienyn

---

## Étapes après le premier clone

### 1. Appliquer les migrations SQL

Dans le **SQL Editor** du Dashboard Supabase, exécuter dans l'ordre :

1. `supabase/migrations/001_initial_schema.sql` — schema complet, RLS, seeds
2. `supabase/migrations/002_reservation_tables.sql` — multi-tables
3. `supabase/migrations/003_waitlist_shift_time.sql` — shift_id + time_slot sur waitlist

Chaque migration est idempotente. Vérifier dans **Table Editor** que les tables sont créées :
`restaurants`, `users`, `floor_plans`, `tables`, `shifts`, `guests`, `reservations`, `reservation_tables`, `waitlist`, `notifications_log`

### 2. Créer le premier utilisateur admin

#### 2a. Créer dans Supabase Auth

1. **Authentication > Users** → **Add user**
2. Renseigner email et mot de passe
3. Copier l'UUID affiché

#### 2b. Lier à `public.users`

Dans le SQL Editor (remplacer `AUTH_USER_ID_A_REMPLACER` par l'UUID) :

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

Cette opération ne peut pas être faite depuis l'app mobile (RLS l'en empêche).

#### 2c. Vérifier

```sql
SELECT u.id, u.full_name, u.role, r.name AS restaurant_name
FROM public.users u
JOIN public.restaurants r ON r.id = u.restaurant_id;
```

### 3. Générer les types TypeScript

```bash
npx supabase gen types typescript \
  --project-id nosflczsevtrxnyienyn \
  --schema public \
  > src/types/database.ts
```

Vérifier ensuite :
```bash
npx tsc --noEmit
```

### 4. Seeder le plan de salle

```bash
npm run seed:floor
```

Ce script insère les tables physiques dans la table `tables` en base. À relancer si les tables sont vidées ou si le plan change.

---

## Récupérer les clés API

1. **Project Settings** → **API**
2. **Anon key** → `EXPO_PUBLIC_SUPABASE_ANON_KEY` (dans `.env`)
3. **Service role key** → `SUPABASE_SERVICE_ROLE_KEY` (dans `.env.import` uniquement)

La service_role key bypasse toutes les règles RLS. Ne jamais la mettre dans l'app.

---

## Points de vigilance

- Après chaque nouvelle migration, régénérer `src/types/database.ts`
- Le Realtime est activé sur `reservations`, `tables`, `waitlist` — vérifier dans **Database > Replication** si des problèmes de sync apparaissent
- Les fonctions RLS sont `SECURITY DEFINER` — les modifier avec précaution
- Si une migration échoue à mi-chemin, relancer le fichier complet (toutes les instructions sont idempotentes)

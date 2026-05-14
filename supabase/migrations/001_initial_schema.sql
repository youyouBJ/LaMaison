-- =============================================
-- La Maison — Initial Database Schema
-- Migration : 001_initial_schema.sql
-- =============================================
-- Idempotente : CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE FUNCTION,
-- DROP POLICY IF EXISTS, DROP TRIGGER IF EXISTS, WHERE NOT EXISTS sur les seeds.
-- Pas de DROP TABLE, pas de données fake.
--
-- ORDRE D'EXÉCUTION (dépendances respectées) :
--   1. Fonction générique update_updated_at_column (aucune dépendance table)
--   2. Tables (dans l'ordre des FK)
--   3. Index
--   4. Triggers updated_at
--   5. Fonctions helper RLS (dépendent de public.users → créées APRÈS)
--   6. Grants
--   7. Activation RLS
--   8. Policies RLS
--   9. Realtime
--  10. Seed data
-- =============================================


-- =============================================
-- SECTION 1 : FONCTION update_updated_at_column
-- Aucune dépendance sur une table — peut être créée en premier.
-- =============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- =============================================
-- SECTION 2 : TABLES
-- (dans l'ordre des dépendances FK)
-- =============================================

-- 2.1 restaurants
CREATE TABLE IF NOT EXISTS public.restaurants (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  address     text,
  phone       text,
  email       text,
  timezone    text        NOT NULL DEFAULT 'Africa/Tunis',
  logo_url    text,
  settings    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.restaurants IS 'Restaurants du système. Multi-tenant : chaque utilisateur est rattaché à un seul restaurant.';

-- 2.2 users (profil public lié à auth.users)
-- id = auth.users.id — l'admin insère manuellement après création dans Auth Dashboard.
CREATE TABLE IF NOT EXISTS public.users (
  id            uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id uuid        NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  full_name     text        NOT NULL,
  role          text        NOT NULL CHECK (role IN ('admin', 'manager', 'host', 'waiter')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.users IS 'Profils staff. Liés à auth.users et à un restaurant. Rôles : admin > manager > host > waiter.';

-- 2.3 floor_plans
CREATE TABLE IF NOT EXISTS public.floor_plans (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid        NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  layout        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.floor_plans IS 'Plans de salle. Le layout JSON sera peuplé dans le module Plan de salle.';

-- 2.4 tables (tables physiques du restaurant)
-- "tables" n'est pas un mot réservé PostgreSQL, le nom est valide.
CREATE TABLE IF NOT EXISTS public.tables (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid        NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  floor_plan_id uuid        REFERENCES public.floor_plans(id) ON DELETE SET NULL,
  label         text        NOT NULL,
  capacity      int         NOT NULL DEFAULT 2,
  position_x    float       NOT NULL DEFAULT 0,
  position_y    float       NOT NULL DEFAULT 0,
  shape         text        NOT NULL DEFAULT 'round' CHECK (shape IN ('round', 'square', 'rectangle')),
  zone          text        NOT NULL,
  status        text        NOT NULL DEFAULT 'free' CHECK (status IN ('free', 'occupied', 'reserved', 'unavailable')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.tables IS 'Tables physiques. Positions définies dans le module Plan de salle.';

-- 2.5 shifts (services : déjeuner / dîner)
-- Convention jours : 0=dimanche, 1=lundi, 2=mardi, 3=mercredi, 4=jeudi, 5=vendredi, 6=samedi
-- end_time = '00:00' signifie minuit. Si end_time < start_time → fin le lendemain (J+1) côté applicatif.
CREATE TABLE IF NOT EXISTS public.shifts (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id       uuid        NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name                text        NOT NULL,
  days_of_week        int[]       NOT NULL, -- 0=dim 1=lun 2=mar 3=mer 4=jeu 5=ven 6=sam
  start_time          time        NOT NULL,
  end_time            time        NOT NULL, -- 00:00 = minuit (J+1 si end < start)
  slot_duration       int         NOT NULL DEFAULT 15,  -- minutes par créneau
  max_covers_per_slot int         NOT NULL DEFAULT 30,
  duration_rules      jsonb       NOT NULL, -- {"party_size_as_string": duration_minutes}
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.shifts IS 'Services du restaurant. end_time 00:00 = minuit, traité comme J+1 si end_time < start_time.';

-- 2.6 guests (base clients)
-- Le téléphone est l''identifiant métier principal. Email et birthday non obligatoires.
CREATE TABLE IF NOT EXISTS public.guests (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id    uuid        NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  first_name       text,
  last_name        text,
  email            text,
  phone            text,
  birthday         date,
  notes            text,
  tags             text[]      NOT NULL DEFAULT '{}'::text[],
  visit_count      int         NOT NULL DEFAULT 0,
  cancels          int         NOT NULL DEFAULT 0,
  no_shows         int         NOT NULL DEFAULT 0,
  avg_spend        numeric(10,2),
  avg_rating       numeric(3,2),
  vip              boolean     NOT NULL DEFAULT false,
  marketing_opt_in boolean     NOT NULL DEFAULT false,
  source           text        NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'import', 'walkin')),
  last_visit       date,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.guests IS 'Base clients. Téléphone = identifiant métier principal. Email/birthday optionnels.';

-- 2.7 reservations
CREATE TABLE IF NOT EXISTS public.reservations (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid        NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  guest_id      uuid        REFERENCES public.guests(id) ON DELETE SET NULL,
  table_id      uuid        REFERENCES public.tables(id) ON DELETE SET NULL,
  shift_id      uuid        REFERENCES public.shifts(id) ON DELETE SET NULL,
  date          date        NOT NULL,
  time_slot     time        NOT NULL,
  party_size    int         NOT NULL CHECK (party_size > 0),
  status        text        NOT NULL DEFAULT 'confirmed'
                            CHECK (status IN ('confirmed', 'pending', 'cancelled', 'noshow', 'seated', 'completed')),
  notes         text,
  source        text        NOT NULL DEFAULT 'phone'
                            CHECK (source IN ('manual', 'phone', 'walkin')),
  created_by    uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.reservations IS 'Réservations. Liées à guests, tables, shifts. created_by = utilisateur staff.';

-- 2.8 waitlist
CREATE TABLE IF NOT EXISTS public.waitlist (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid        NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  guest_id      uuid        REFERENCES public.guests(id) ON DELETE SET NULL,
  date          date        NOT NULL,
  party_size    int         NOT NULL CHECK (party_size > 0),
  status        text        NOT NULL DEFAULT 'waiting'
                            CHECK (status IN ('waiting', 'notified', 'seated', 'left')),
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.waitlist IS 'Liste d''attente. Synchronisée en temps réel via Supabase Realtime.';

-- 2.9 notifications_log (immuable : pas de updated_at)
CREATE TABLE IF NOT EXISTS public.notifications_log (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  uuid        NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  reservation_id uuid        REFERENCES public.reservations(id) ON DELETE SET NULL,
  guest_id       uuid        REFERENCES public.guests(id) ON DELETE SET NULL,
  channel        text        NOT NULL CHECK (channel IN ('sms', 'whatsapp', 'email')),
  type           text        NOT NULL,
  status         text        NOT NULL DEFAULT 'pending' CHECK (status IN ('sent', 'failed', 'pending')),
  sent_at        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.notifications_log IS 'Journal des notifications. Immuable (pas de updated_at). Suppression admin uniquement.';


-- =============================================
-- SECTION 3 : INDEX
-- =============================================

CREATE INDEX IF NOT EXISTS idx_users_restaurant_id
  ON public.users(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_floor_plans_restaurant_id
  ON public.floor_plans(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_tables_restaurant_id
  ON public.tables(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_tables_floor_plan_id
  ON public.tables(floor_plan_id);
CREATE INDEX IF NOT EXISTS idx_tables_restaurant_status
  ON public.tables(restaurant_id, status);

CREATE INDEX IF NOT EXISTS idx_shifts_restaurant_id
  ON public.shifts(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_guests_restaurant_phone
  ON public.guests(restaurant_id, phone);
CREATE INDEX IF NOT EXISTS idx_guests_restaurant_email
  ON public.guests(restaurant_id, email);
CREATE INDEX IF NOT EXISTS idx_guests_vip
  ON public.guests(vip);
CREATE INDEX IF NOT EXISTS idx_guests_tags
  ON public.guests USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_reservations_restaurant_date
  ON public.reservations(restaurant_id, date);
CREATE INDEX IF NOT EXISTS idx_reservations_restaurant_date_slot
  ON public.reservations(restaurant_id, date, time_slot);
CREATE INDEX IF NOT EXISTS idx_reservations_restaurant_status
  ON public.reservations(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_reservations_guest_id
  ON public.reservations(guest_id);

CREATE INDEX IF NOT EXISTS idx_waitlist_restaurant_date
  ON public.waitlist(restaurant_id, date);
CREATE INDEX IF NOT EXISTS idx_waitlist_restaurant_status
  ON public.waitlist(restaurant_id, status);

CREATE INDEX IF NOT EXISTS idx_notifications_log_restaurant_id
  ON public.notifications_log(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_log_reservation_id
  ON public.notifications_log(reservation_id);


-- =============================================
-- SECTION 4 : TRIGGERS updated_at
-- (DROP IF EXISTS → idempotent)
-- =============================================

DROP TRIGGER IF EXISTS set_updated_at_restaurants ON public.restaurants;
CREATE TRIGGER set_updated_at_restaurants
  BEFORE UPDATE ON public.restaurants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_users ON public.users;
CREATE TRIGGER set_updated_at_users
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_floor_plans ON public.floor_plans;
CREATE TRIGGER set_updated_at_floor_plans
  BEFORE UPDATE ON public.floor_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_tables ON public.tables;
CREATE TRIGGER set_updated_at_tables
  BEFORE UPDATE ON public.tables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_shifts ON public.shifts;
CREATE TRIGGER set_updated_at_shifts
  BEFORE UPDATE ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_guests ON public.guests;
CREATE TRIGGER set_updated_at_guests
  BEFORE UPDATE ON public.guests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_reservations ON public.reservations;
CREATE TRIGGER set_updated_at_reservations
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_waitlist ON public.waitlist;
CREATE TRIGGER set_updated_at_waitlist
  BEFORE UPDATE ON public.waitlist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- notifications_log : pas de trigger updated_at (table immuable)


-- =============================================
-- SECTION 5 : FONCTIONS HELPER RLS
-- Créées APRÈS public.users (PostgreSQL 14+ valide les tables référencées
-- dans les corps de fonctions SQL au moment de la création).
-- SECURITY DEFINER : bypasse le RLS sur public.users pour éviter
-- toute récursion infinie dans les politiques de cette table.
-- =============================================

CREATE OR REPLACE FUNCTION public.current_user_restaurant_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT restaurant_id FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('admin', 'manager')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_host_or_above()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('admin', 'manager', 'host')
  );
$$;

CREATE OR REPLACE FUNCTION public.has_restaurant_access(target_restaurant_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND restaurant_id = target_restaurant_id
  );
$$;


-- =============================================
-- SECTION 6 : GRANTS
-- Le rôle "authenticated" doit avoir accès aux tables.
-- Le RLS (section 8) restreint ensuite l'accès aux lignes autorisées.
-- =============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.restaurants       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.users             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.floor_plans       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tables            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shifts            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.guests            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reservations      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.waitlist          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notifications_log TO authenticated;

GRANT EXECUTE ON FUNCTION public.update_updated_at_column()            TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_restaurant_id()          TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role()                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin()                            TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_manager_or_admin()                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_host_or_above()                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_restaurant_access(uuid)           TO authenticated;


-- =============================================
-- SECTION 7 : ACTIVATION ROW LEVEL SECURITY
-- =============================================

ALTER TABLE public.restaurants       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.floor_plans       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guests            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications_log ENABLE ROW LEVEL SECURITY;


-- =============================================
-- SECTION 8 : POLITIQUES RLS
-- Convention : DROP IF EXISTS → CREATE (idempotent).
-- Les fonctions helper (section 5) sont SECURITY DEFINER :
-- elles n'ont pas de récursion RLS sur la table users.
-- =============================================

-- ─── users ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "users_select_own_or_team" ON public.users;
CREATE POLICY "users_select_own_or_team" ON public.users
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR (
      restaurant_id = public.current_user_restaurant_id()
      AND public.current_user_role() IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "users_insert_admin" ON public.users;
CREATE POLICY "users_insert_admin" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (
    restaurant_id = public.current_user_restaurant_id()
    AND public.is_admin()
  );

DROP POLICY IF EXISTS "users_update_admin" ON public.users;
CREATE POLICY "users_update_admin" ON public.users
  FOR UPDATE TO authenticated
  USING (
    restaurant_id = public.current_user_restaurant_id()
    AND public.is_admin()
  )
  WITH CHECK (
    restaurant_id = public.current_user_restaurant_id()
    AND public.is_admin()
  );

DROP POLICY IF EXISTS "users_delete_admin" ON public.users;
CREATE POLICY "users_delete_admin" ON public.users
  FOR DELETE TO authenticated
  USING (
    restaurant_id = public.current_user_restaurant_id()
    AND public.is_admin()
  );

-- ─── restaurants ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "restaurants_select_own" ON public.restaurants;
CREATE POLICY "restaurants_select_own" ON public.restaurants
  FOR SELECT TO authenticated
  USING (id = public.current_user_restaurant_id());

DROP POLICY IF EXISTS "restaurants_update_admin" ON public.restaurants;
CREATE POLICY "restaurants_update_admin" ON public.restaurants
  FOR UPDATE TO authenticated
  USING (
    id = public.current_user_restaurant_id()
    AND public.is_admin()
  )
  WITH CHECK (
    id = public.current_user_restaurant_id()
    AND public.is_admin()
  );

-- ─── floor_plans ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "floor_plans_select_restaurant" ON public.floor_plans;
CREATE POLICY "floor_plans_select_restaurant" ON public.floor_plans
  FOR SELECT TO authenticated
  USING (restaurant_id = public.current_user_restaurant_id());

DROP POLICY IF EXISTS "floor_plans_insert_manager" ON public.floor_plans;
CREATE POLICY "floor_plans_insert_manager" ON public.floor_plans
  FOR INSERT TO authenticated
  WITH CHECK (
    restaurant_id = public.current_user_restaurant_id()
    AND public.is_manager_or_admin()
  );

DROP POLICY IF EXISTS "floor_plans_update_manager" ON public.floor_plans;
CREATE POLICY "floor_plans_update_manager" ON public.floor_plans
  FOR UPDATE TO authenticated
  USING (
    restaurant_id = public.current_user_restaurant_id()
    AND public.is_manager_or_admin()
  )
  WITH CHECK (
    restaurant_id = public.current_user_restaurant_id()
    AND public.is_manager_or_admin()
  );

DROP POLICY IF EXISTS "floor_plans_delete_manager" ON public.floor_plans;
CREATE POLICY "floor_plans_delete_manager" ON public.floor_plans
  FOR DELETE TO authenticated
  USING (
    restaurant_id = public.current_user_restaurant_id()
    AND public.is_manager_or_admin()
  );

-- ─── tables ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "tables_select_restaurant" ON public.tables;
CREATE POLICY "tables_select_restaurant" ON public.tables
  FOR SELECT TO authenticated
  USING (restaurant_id = public.current_user_restaurant_id());

DROP POLICY IF EXISTS "tables_insert_manager" ON public.tables;
CREATE POLICY "tables_insert_manager" ON public.tables
  FOR INSERT TO authenticated
  WITH CHECK (
    restaurant_id = public.current_user_restaurant_id()
    AND public.is_manager_or_admin()
  );

DROP POLICY IF EXISTS "tables_update_manager" ON public.tables;
CREATE POLICY "tables_update_manager" ON public.tables
  FOR UPDATE TO authenticated
  USING (
    restaurant_id = public.current_user_restaurant_id()
    AND public.is_manager_or_admin()
  )
  WITH CHECK (
    restaurant_id = public.current_user_restaurant_id()
    AND public.is_manager_or_admin()
  );

DROP POLICY IF EXISTS "tables_delete_manager" ON public.tables;
CREATE POLICY "tables_delete_manager" ON public.tables
  FOR DELETE TO authenticated
  USING (
    restaurant_id = public.current_user_restaurant_id()
    AND public.is_manager_or_admin()
  );

-- ─── shifts ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "shifts_select_restaurant" ON public.shifts;
CREATE POLICY "shifts_select_restaurant" ON public.shifts
  FOR SELECT TO authenticated
  USING (restaurant_id = public.current_user_restaurant_id());

DROP POLICY IF EXISTS "shifts_insert_manager" ON public.shifts;
CREATE POLICY "shifts_insert_manager" ON public.shifts
  FOR INSERT TO authenticated
  WITH CHECK (
    restaurant_id = public.current_user_restaurant_id()
    AND public.is_manager_or_admin()
  );

DROP POLICY IF EXISTS "shifts_update_manager" ON public.shifts;
CREATE POLICY "shifts_update_manager" ON public.shifts
  FOR UPDATE TO authenticated
  USING (
    restaurant_id = public.current_user_restaurant_id()
    AND public.is_manager_or_admin()
  )
  WITH CHECK (
    restaurant_id = public.current_user_restaurant_id()
    AND public.is_manager_or_admin()
  );

DROP POLICY IF EXISTS "shifts_delete_manager" ON public.shifts;
CREATE POLICY "shifts_delete_manager" ON public.shifts
  FOR DELETE TO authenticated
  USING (
    restaurant_id = public.current_user_restaurant_id()
    AND public.is_manager_or_admin()
  );

-- ─── guests ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "guests_select_restaurant" ON public.guests;
CREATE POLICY "guests_select_restaurant" ON public.guests
  FOR SELECT TO authenticated
  USING (restaurant_id = public.current_user_restaurant_id());

DROP POLICY IF EXISTS "guests_insert_host" ON public.guests;
CREATE POLICY "guests_insert_host" ON public.guests
  FOR INSERT TO authenticated
  WITH CHECK (
    restaurant_id = public.current_user_restaurant_id()
    AND public.is_host_or_above()
  );

DROP POLICY IF EXISTS "guests_update_host" ON public.guests;
CREATE POLICY "guests_update_host" ON public.guests
  FOR UPDATE TO authenticated
  USING (
    restaurant_id = public.current_user_restaurant_id()
    AND public.is_host_or_above()
  )
  WITH CHECK (
    restaurant_id = public.current_user_restaurant_id()
    AND public.is_host_or_above()
  );

DROP POLICY IF EXISTS "guests_delete_manager" ON public.guests;
CREATE POLICY "guests_delete_manager" ON public.guests
  FOR DELETE TO authenticated
  USING (
    restaurant_id = public.current_user_restaurant_id()
    AND public.is_manager_or_admin()
  );

-- ─── reservations ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "reservations_select_restaurant" ON public.reservations;
CREATE POLICY "reservations_select_restaurant" ON public.reservations
  FOR SELECT TO authenticated
  USING (restaurant_id = public.current_user_restaurant_id());

DROP POLICY IF EXISTS "reservations_insert_staff" ON public.reservations;
CREATE POLICY "reservations_insert_staff" ON public.reservations
  FOR INSERT TO authenticated
  WITH CHECK (restaurant_id = public.current_user_restaurant_id());

DROP POLICY IF EXISTS "reservations_update_staff" ON public.reservations;
CREATE POLICY "reservations_update_staff" ON public.reservations
  FOR UPDATE TO authenticated
  USING (restaurant_id = public.current_user_restaurant_id())
  WITH CHECK (restaurant_id = public.current_user_restaurant_id());

DROP POLICY IF EXISTS "reservations_delete_manager" ON public.reservations;
CREATE POLICY "reservations_delete_manager" ON public.reservations
  FOR DELETE TO authenticated
  USING (
    restaurant_id = public.current_user_restaurant_id()
    AND public.is_manager_or_admin()
  );

-- ─── waitlist ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "waitlist_select_restaurant" ON public.waitlist;
CREATE POLICY "waitlist_select_restaurant" ON public.waitlist
  FOR SELECT TO authenticated
  USING (restaurant_id = public.current_user_restaurant_id());

DROP POLICY IF EXISTS "waitlist_insert_host" ON public.waitlist;
CREATE POLICY "waitlist_insert_host" ON public.waitlist
  FOR INSERT TO authenticated
  WITH CHECK (
    restaurant_id = public.current_user_restaurant_id()
    AND public.is_host_or_above()
  );

DROP POLICY IF EXISTS "waitlist_update_host" ON public.waitlist;
CREATE POLICY "waitlist_update_host" ON public.waitlist
  FOR UPDATE TO authenticated
  USING (
    restaurant_id = public.current_user_restaurant_id()
    AND public.is_host_or_above()
  )
  WITH CHECK (
    restaurant_id = public.current_user_restaurant_id()
    AND public.is_host_or_above()
  );

DROP POLICY IF EXISTS "waitlist_delete_manager" ON public.waitlist;
CREATE POLICY "waitlist_delete_manager" ON public.waitlist
  FOR DELETE TO authenticated
  USING (
    restaurant_id = public.current_user_restaurant_id()
    AND public.is_manager_or_admin()
  );

-- ─── notifications_log ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "notifications_log_select_restaurant" ON public.notifications_log;
CREATE POLICY "notifications_log_select_restaurant" ON public.notifications_log
  FOR SELECT TO authenticated
  USING (restaurant_id = public.current_user_restaurant_id());

DROP POLICY IF EXISTS "notifications_log_insert_host" ON public.notifications_log;
CREATE POLICY "notifications_log_insert_host" ON public.notifications_log
  FOR INSERT TO authenticated
  WITH CHECK (
    restaurant_id = public.current_user_restaurant_id()
    AND public.is_host_or_above()
  );

DROP POLICY IF EXISTS "notifications_log_delete_admin" ON public.notifications_log;
CREATE POLICY "notifications_log_delete_admin" ON public.notifications_log
  FOR DELETE TO authenticated
  USING (
    restaurant_id = public.current_user_restaurant_id()
    AND public.is_admin()
  );


-- =============================================
-- SECTION 9 : REALTIME
-- Blocs DO idempotents : pas d'erreur si la table est déjà dans la publication.
-- =============================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['reservations', 'tables', 'waitlist', 'notifications_log']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname    = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename  = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END$$;


-- =============================================
-- SECTION 10 : DONNÉES INITIALES
-- Idempotent : WHERE NOT EXISTS sur chaque insert.
-- Pas de données fake clients ou réservations.
-- =============================================

DO $$
DECLARE
  v_restaurant_id  uuid;
  v_duration_rules jsonb := '{
    "1":  90,
    "2":  120,
    "3":  120,
    "4":  120,
    "5":  120,
    "6":  150,
    "10": 180
  }'::jsonb;
BEGIN

  -- ── Restaurant La Maison ──────────────────────────────────────────────────
  INSERT INTO public.restaurants (name, timezone, settings)
  SELECT
    'La Maison',
    'Africa/Tunis',
    '{
      "reservation_mode": "phone_only",
      "currency":         "TND",
      "country":          "Tunisia",
      "max_covers_per_slot": 30,
      "slot_duration":    15
    }'::jsonb
  WHERE NOT EXISTS (
    SELECT 1 FROM public.restaurants WHERE name = 'La Maison'
  );

  SELECT id INTO v_restaurant_id
  FROM public.restaurants WHERE name = 'La Maison';

  -- ── Shift Déjeuner ────────────────────────────────────────────────────────
  -- Jours : mar(2) mer(3) jeu(4) ven(5) sam(6) dim(0) — FERMÉ le lundi (1)
  INSERT INTO public.shifts (
    restaurant_id, name, days_of_week,
    start_time, end_time,
    slot_duration, max_covers_per_slot,
    duration_rules
  )
  SELECT
    v_restaurant_id,
    'Déjeuner',
    ARRAY[2, 3, 4, 5, 6, 0],
    '12:00'::time,
    '16:45'::time,
    15,
    30,
    v_duration_rules
  WHERE NOT EXISTS (
    SELECT 1 FROM public.shifts
    WHERE restaurant_id = v_restaurant_id AND name = 'Déjeuner'
  );

  -- ── Shift Dîner ───────────────────────────────────────────────────────────
  -- Tous les jours, y compris lundi.
  -- end_time = '00:00' = minuit.
  -- Règle applicative : si end_time < start_time → la fin est J+1 (lendemain).
  INSERT INTO public.shifts (
    restaurant_id, name, days_of_week,
    start_time, end_time,
    slot_duration, max_covers_per_slot,
    duration_rules
  )
  SELECT
    v_restaurant_id,
    'Dîner',
    ARRAY[0, 1, 2, 3, 4, 5, 6],
    '17:00'::time,
    '00:00'::time,
    15,
    30,
    v_duration_rules
  WHERE NOT EXISTS (
    SELECT 1 FROM public.shifts
    WHERE restaurant_id = v_restaurant_id AND name = 'Dîner'
  );

END$$;

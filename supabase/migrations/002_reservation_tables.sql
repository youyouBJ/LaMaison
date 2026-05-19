-- ─────────────────────────────────────────────────────────────────────────────
-- 002_reservation_tables.sql
-- Table de liaison pour réservations multi-tables.
-- reservations.table_id reste la table principale / première table.
-- reservation_tables contient toutes les tables liées, y compris la première.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.reservation_tables (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid        NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  table_id       uuid        NOT NULL REFERENCES public.tables(id)       ON DELETE CASCADE,
  restaurant_id  uuid        NOT NULL REFERENCES public.restaurants(id)  ON DELETE CASCADE,
  created_at     timestamptz DEFAULT now(),

  CONSTRAINT uq_reservation_table UNIQUE (reservation_id, table_id)
);

COMMENT ON TABLE public.reservation_tables IS
  'Liaison N-N entre réservations et tables. '
  'Pour les réservations mono-table, une ligne est insérée ici ET reservations.table_id est renseigné. '
  'Pour les réservations multi-tables, reservations.table_id = première table, '
  'et reservation_tables contient toutes les tables.';

-- ── Index ─────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_reservation_tables_restaurant_id
  ON public.reservation_tables(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_reservation_tables_reservation_id
  ON public.reservation_tables(reservation_id);

CREATE INDEX IF NOT EXISTS idx_reservation_tables_table_id
  ON public.reservation_tables(table_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.reservation_tables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rt_select_restaurant" ON public.reservation_tables;
CREATE POLICY "rt_select_restaurant" ON public.reservation_tables
  FOR SELECT
  USING (has_restaurant_access(restaurant_id));

DROP POLICY IF EXISTS "rt_insert_host" ON public.reservation_tables;
CREATE POLICY "rt_insert_host" ON public.reservation_tables
  FOR INSERT
  WITH CHECK (
    has_restaurant_access(restaurant_id)
    AND is_host_or_above()
  );

DROP POLICY IF EXISTS "rt_update_host" ON public.reservation_tables;
CREATE POLICY "rt_update_host" ON public.reservation_tables
  FOR UPDATE
  USING  (has_restaurant_access(restaurant_id) AND is_host_or_above())
  WITH CHECK (has_restaurant_access(restaurant_id) AND is_host_or_above());

DROP POLICY IF EXISTS "rt_delete_manager" ON public.reservation_tables;
CREATE POLICY "rt_delete_manager" ON public.reservation_tables
  FOR DELETE
  USING (
    has_restaurant_access(restaurant_id)
    AND is_manager_or_admin()
  );

-- ── Permissions ───────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reservation_tables TO authenticated;

-- ── Realtime ─────────────────────────────────────────────────────────────────
-- Robuste si déjà ajouté.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_publication_tables
    WHERE  pubname   = 'supabase_realtime'
    AND    schemaname = 'public'
    AND    tablename  = 'reservation_tables'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reservation_tables;
  END IF;
END;
$$;

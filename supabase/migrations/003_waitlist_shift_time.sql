-- ─────────────────────────────────────────────────────────────────────────────
-- 003_waitlist_shift_time.sql
-- Ajoute shift_id et time_slot à la table waitlist.
--
-- Raison : le module de liste d'attente nécessite de filtrer par service
-- (Déjeuner/Dîner) et de convertir une entrée waitlist en réservation avec
-- un créneau horaire défini.
--
-- ÉTAPES MANUELLES SUPABASE :
--   1. Ouvrir Supabase Dashboard → SQL Editor
--   2. Coller et exécuter ce fichier
--   3. Régénérer les types TypeScript :
--      npx supabase gen types typescript \
--        --project-id nosflczsevtrxnyienyn \
--        --schema public \
--        > /tmp/db_types.ts
--      (vérifier que /tmp/db_types.ts n'est pas vide avant de copier)
--      Puis remplacer src/types/database.ts avec le contenu généré.
--      Ou mettre à jour manuellement la section waitlist dans database.ts.
--
-- IDEMPOTENTE : utilise ADD COLUMN IF NOT EXISTS et CREATE INDEX IF NOT EXISTS.
-- NE casse PAS les policies RLS existantes.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Colonnes ──────────────────────────────────────────────────────────────────

ALTER TABLE public.waitlist
  ADD COLUMN IF NOT EXISTS shift_id  uuid REFERENCES public.shifts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS time_slot time;

-- ── Index ─────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_waitlist_restaurant_date_status
  ON public.waitlist (restaurant_id, date, status);

CREATE INDEX IF NOT EXISTS idx_waitlist_restaurant_date_shift
  ON public.waitlist (restaurant_id, date, shift_id);

-- ── Realtime ─────────────────────────────────────────────────────────────────
-- Robuste si déjà ajouté.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_publication_tables
    WHERE  pubname    = 'supabase_realtime'
    AND    schemaname = 'public'
    AND    tablename  = 'waitlist'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.waitlist;
  END IF;
END;
$$;

-- ============================================================
-- PERMISSIONS service_role — La Maison
-- ============================================================
--
-- PROBLÈME :
--   Les migrations n'accordent les droits DML (INSERT/UPDATE/DELETE)
--   qu'au rôle "authenticated" (utilisateurs connectés via l'app).
--   Le rôle "service_role" (utilisé par les scripts d'administration
--   locaux) bypass le RLS mais a quand même besoin de GRANTs
--   explicites au niveau PostgreSQL pour accéder aux tables.
--
--   Sans ces GRANTs, les scripts retournent :
--     "permission denied for table users"
--     "permission denied for table shifts"
--     "permission denied for table reservations"
--
-- SOLUTION :
--   Accorder les droits nécessaires à service_role sur toutes les
--   tables utilisées par les scripts locaux.
--
-- À EXÉCUTER :
--   Supabase Dashboard → SQL Editor → coller ce fichier → Run
--
-- SÉCURITÉ :
--   - Ne pas accorder ces droits à "anon" ou "authenticated"
--   - Ne pas désactiver le RLS
--   - Ne pas faire de DROP/DELETE
--   - La service_role key ne doit jamais être dans l'app mobile
--     (src/), uniquement dans scripts/ via .env.import
-- ============================================================

-- Profils staff (liés à auth.users)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.users             TO service_role;

-- Services / shifts
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.shifts            TO service_role;

-- Réservations
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reservations      TO service_role;

-- Tables multi-réservation
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reservation_tables TO service_role;

-- Restaurant (nom, timezone, settings)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.restaurants       TO service_role;

-- Plan de salle
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.floor_plans       TO service_role;

-- Tables physiques du restaurant
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tables            TO service_role;

-- Clients
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.guests            TO service_role;

-- Waitlist
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.waitlist          TO service_role;

-- Notifications (lecture seule suffit pour les scripts actuels)
GRANT SELECT ON TABLE public.notifications_log TO service_role;

-- ============================================================
-- VÉRIFICATION (optionnel — à lancer après les GRANTs)
-- ============================================================
--
-- SELECT grantee, table_name, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE grantee = 'service_role'
--   AND table_schema = 'public'
-- ORDER BY table_name, privilege_type;
--
-- Résultat attendu : service_role apparaît sur toutes les tables
-- avec SELECT, INSERT, UPDATE, DELETE.
-- ============================================================

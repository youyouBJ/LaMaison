-- =============================================
-- La Maison — Fix Feedback Survey Links RLS
-- Migration : 005_fix_feedback_survey_links_rls.sql
--
-- Problème : 004_feedback_surveys.sql a créé les tables et les policies RLS,
-- mais a oublié d'accorder les privileges de table au rôle `authenticated`.
-- Sans ces GRANT, Postgres rejette toute requête avec :
--   "permission denied for table feedback_survey_links"
-- même si les policies RLS autoriseraient l'opération.
--
-- Correction : accorder SELECT + INSERT sur feedback_survey_links,
-- et SELECT sur feedback_surveys, au rôle authenticated.
--
-- Les policies RLS (définies dans 004) continuent de filtrer l'accès
-- au restaurant de l'utilisateur connecté via current_user_restaurant_id().
--
-- La RPC submit_feedback_survey (SECURITY DEFINER) n'est pas affectée :
-- elle s'exécute avec les droits du propriétaire de la table et contourne
-- déjà le RLS.
-- =============================================

-- Accès staff authentifié aux liens d'enquête
GRANT SELECT, INSERT ON TABLE public.feedback_survey_links TO authenticated;

-- Accès staff authentifié aux réponses d'enquête (lecture seule)
GRANT SELECT ON TABLE public.feedback_surveys TO authenticated;

-- =============================================
-- La Maison — Feedback Surveys
-- Migration : 004_feedback_surveys.sql
-- Idempotente : CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
-- DROP POLICY IF EXISTS avant CREATE POLICY, CREATE OR REPLACE FUNCTION.
-- =============================================


-- =============================================
-- SECTION 1 : TABLES
-- =============================================

-- 1.1 feedback_survey_links
-- Lien unique généré par le staff, envoyé au client via WhatsApp/email manuel.
-- Le token est la clé publique permettant d'accéder au formulaire.
CREATE TABLE IF NOT EXISTS public.feedback_survey_links (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  uuid        NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  reservation_id uuid        REFERENCES public.reservations(id) ON DELETE CASCADE,
  guest_id       uuid        REFERENCES public.guests(id) ON DELETE SET NULL,
  token          text        UNIQUE NOT NULL,
  channel        text        NOT NULL DEFAULT 'manual',
  created_at     timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NULL,
  used_at        timestamptz NULL
);
COMMENT ON TABLE public.feedback_survey_links IS 'Liens d''enquête de satisfaction. Un lien = un token unique envoyé manuellement au client.';

-- 1.2 feedback_surveys
-- Réponse complète à une enquête (dimensions SevenRooms-compatibles).
CREATE TABLE IF NOT EXISTS public.feedback_surveys (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   uuid        NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  reservation_id  uuid        REFERENCES public.reservations(id) ON DELETE SET NULL,
  guest_id        uuid        REFERENCES public.guests(id) ON DELETE SET NULL,
  survey_link_id  uuid        REFERENCES public.feedback_survey_links(id) ON DELETE SET NULL,
  token           text        NOT NULL,
  rating_overall  integer     NOT NULL CHECK (rating_overall BETWEEN 1 AND 5),
  rating_food     integer     NULL CHECK (rating_food BETWEEN 1 AND 5),
  rating_drinks   integer     NULL CHECK (rating_drinks BETWEEN 1 AND 5),
  rating_service  integer     NULL CHECK (rating_service BETWEEN 1 AND 5),
  rating_ambience integer     NULL CHECK (rating_ambience BETWEEN 1 AND 5),
  recommended     boolean     NULL,
  comment         text        NULL,
  source          text        NOT NULL DEFAULT 'manual',
  submitted_at    timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.feedback_surveys IS 'Réponses aux enquêtes de satisfaction. Dimensions compatibles SevenRooms : overall/food/drinks/service/ambience/recommended.';


-- =============================================
-- SECTION 2 : INDEX
-- =============================================

CREATE INDEX IF NOT EXISTS idx_feedback_survey_links_token
  ON public.feedback_survey_links(token);

CREATE INDEX IF NOT EXISTS idx_feedback_survey_links_restaurant_reservation
  ON public.feedback_survey_links(restaurant_id, reservation_id);

CREATE INDEX IF NOT EXISTS idx_feedback_surveys_restaurant
  ON public.feedback_surveys(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_feedback_surveys_reservation
  ON public.feedback_surveys(reservation_id);

CREATE INDEX IF NOT EXISTS idx_feedback_surveys_guest
  ON public.feedback_surveys(guest_id);

CREATE INDEX IF NOT EXISTS idx_feedback_surveys_submitted_at
  ON public.feedback_surveys(submitted_at);


-- =============================================
-- SECTION 3 : ACTIVATION RLS
-- =============================================

ALTER TABLE public.feedback_survey_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_surveys       ENABLE ROW LEVEL SECURITY;


-- =============================================
-- SECTION 4 : POLICIES RLS
-- =============================================

-- feedback_survey_links : lecture par le staff du même restaurant
DROP POLICY IF EXISTS "feedback_links_select_staff" ON public.feedback_survey_links;
CREATE POLICY "feedback_links_select_staff"
  ON public.feedback_survey_links FOR SELECT
  TO authenticated
  USING (restaurant_id = public.current_user_restaurant_id());

-- feedback_survey_links : création par le staff du même restaurant
DROP POLICY IF EXISTS "feedback_links_insert_staff" ON public.feedback_survey_links;
CREATE POLICY "feedback_links_insert_staff"
  ON public.feedback_survey_links FOR INSERT
  TO authenticated
  WITH CHECK (restaurant_id = public.current_user_restaurant_id());

-- feedback_surveys : lecture par le staff du même restaurant
DROP POLICY IF EXISTS "feedback_surveys_select_staff" ON public.feedback_surveys;
CREATE POLICY "feedback_surveys_select_staff"
  ON public.feedback_surveys FOR SELECT
  TO authenticated
  USING (restaurant_id = public.current_user_restaurant_id());

-- Note : l'insertion dans feedback_surveys se fait via la RPC submit_feedback_survey
-- (security definer, accessible publiquement via le token).
-- Aucune policy INSERT directe n'est accordée sur la table.


-- =============================================
-- SECTION 5 : FONCTION RPC submit_feedback_survey
-- Accessible publiquement (anon) via token uniquement.
-- Security definer : contourne le RLS pour pouvoir insérer sans session.
-- =============================================

CREATE OR REPLACE FUNCTION public.submit_feedback_survey(
  p_token          text,
  p_rating_overall integer,
  p_rating_food    integer,
  p_rating_drinks  integer,
  p_rating_service integer,
  p_rating_ambience integer,
  p_recommended    boolean,
  p_comment        text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link        public.feedback_survey_links%ROWTYPE;
  v_feedback_id uuid;
BEGIN
  -- Retrouver le lien via le token
  SELECT * INTO v_link
    FROM public.feedback_survey_links
   WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'token_not_found');
  END IF;

  -- Vérifier l'expiration
  IF v_link.expires_at IS NOT NULL AND v_link.expires_at < now() THEN
    RETURN json_build_object('error', 'token_expired');
  END IF;

  -- Bloquer la double soumission
  IF v_link.used_at IS NOT NULL THEN
    RETURN json_build_object('error', 'already_submitted');
  END IF;

  -- Insérer le feedback
  INSERT INTO public.feedback_surveys (
    restaurant_id,
    reservation_id,
    guest_id,
    survey_link_id,
    token,
    rating_overall,
    rating_food,
    rating_drinks,
    rating_service,
    rating_ambience,
    recommended,
    comment,
    source
  ) VALUES (
    v_link.restaurant_id,
    v_link.reservation_id,
    v_link.guest_id,
    v_link.id,
    p_token,
    p_rating_overall,
    p_rating_food,
    p_rating_drinks,
    p_rating_service,
    p_rating_ambience,
    p_recommended,
    p_comment,
    'web'
  )
  RETURNING id INTO v_feedback_id;

  -- Marquer le lien comme utilisé
  UPDATE public.feedback_survey_links
     SET used_at = now()
   WHERE id = v_link.id;

  RETURN json_build_object('id', v_feedback_id);
END;
$$;

-- Accès public via anon (formulaire web sans login)
GRANT EXECUTE ON FUNCTION public.submit_feedback_survey TO anon;

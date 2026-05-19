import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { ReservationWithJoins } from '../types/reservations';
import {
  getFeedbackBaseUrl,
  generateFeedbackToken,
  buildFeedbackSurveyUrl,
} from '../utils/feedbackSurvey';

export interface FeedbackSurveyLinkResult {
  url: string;
  token: string;
}

// Discriminated union : soit les données, soit un message d'erreur précis.
// Permet aux composants d'afficher l'erreur Supabase exacte plutôt qu'un message générique.
export type SurveyLinkGetResult =
  | { data: FeedbackSurveyLinkResult; error: null }
  | { data: null; error: string };

// feedback_survey_links not yet in generated types; typed explicitly via unknown intermediate.
// These casts will become unnecessary after migration + type regeneration.
type LinkRow = { token: string };
type SelectBuilder = {
  eq: (col: string, val: string) => { maybeSingle: () => Promise<{ data: LinkRow | null; error: { message: string } | null }> };
};
type InsertResult = Promise<{ error: { message: string } | null }>;
type TableBuilder = { select: (cols: string) => SelectBuilder; insert: (row: Record<string, unknown>) => InsertResult };
type FromFn = (table: string) => TableBuilder;

export function useFeedbackSurveyLink() {
  const [loading, setLoading] = useState(false);

  // getOrCreate : récupère le lien existant ou en crée un nouveau.
  // Nécessite les champs complets de la réservation (restaurant_id, guest_id pour l'INSERT).
  const getOrCreate = useCallback(
    async (reservation: ReservationWithJoins): Promise<SurveyLinkGetResult> => {
      if (!reservation.id) {
        return { data: null, error: 'Réservation sans identifiant.' };
      }

      if (!getFeedbackBaseUrl()) {
        return { data: null, error: "URL d'enquête non configurée dans feedbackSurvey.ts." };
      }

      setLoading(true);

      const from = supabase.from.bind(supabase) as unknown as FromFn;

      try {
        const { data: existing, error: fetchError } = await from('feedback_survey_links')
          .select('token')
          .eq('reservation_id', reservation.id)
          .maybeSingle();

        if (fetchError) {
          return { data: null, error: `Erreur réseau : ${fetchError.message}` };
        }

        if (existing) {
          if (!existing.token) {
            return { data: null, error: "Token d'enquête invalide en base." };
          }
          const url = buildFeedbackSurveyUrl(existing.token);
          if (!url) {
            return { data: null, error: "Impossible de construire l'URL avec le token existant." };
          }
          return { data: { url, token: existing.token }, error: null };
        }

        // Créer un nouveau lien
        const token = generateFeedbackToken();
        const { error: insertError } = await from('feedback_survey_links').insert({
          restaurant_id:  reservation.restaurant_id,
          reservation_id: reservation.id,
          guest_id:       reservation.guest_id ?? null,
          token,
          channel:        'manual',
        });

        if (insertError) {
          return { data: null, error: `Erreur lors de la création : ${insertError.message}` };
        }

        const url = buildFeedbackSurveyUrl(token);
        if (!url) {
          return { data: null, error: "Impossible de construire l'URL après création." };
        }
        return { data: { url, token }, error: null };
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // getByReservationId : lookup-only, sans INSERT.
  // Utilisé depuis les écrans qui n'ont pas restaurant_id/guest_id (ex. FloorPlanScreen).
  const getByReservationId = useCallback(
    async (reservationId: string): Promise<SurveyLinkGetResult> => {
      if (!reservationId) {
        return { data: null, error: 'Identifiant de réservation manquant.' };
      }

      if (!getFeedbackBaseUrl()) {
        return { data: null, error: "URL d'enquête non configurée dans feedbackSurvey.ts." };
      }

      setLoading(true);

      const from = supabase.from.bind(supabase) as unknown as FromFn;

      try {
        const { data, error: fetchError } = await from('feedback_survey_links')
          .select('token')
          .eq('reservation_id', reservationId)
          .maybeSingle();

        if (fetchError) {
          return { data: null, error: `Erreur réseau : ${fetchError.message}` };
        }

        if (!data || !data.token) {
          return { data: null, error: "Aucun lien d'enquête. Ouvrez la fiche réservation pour en générer un." };
        }

        const url = buildFeedbackSurveyUrl(data.token);
        if (!url) {
          return { data: null, error: "Impossible de construire l'URL avec le token." };
        }

        return { data: { url, token: data.token }, error: null };
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { getOrCreate, getByReservationId, loading };
}

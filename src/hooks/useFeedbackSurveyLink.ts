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

// Le token est une chaîne publique de 32 caractères alphanumériques.
// Il ne contient aucune information client — il identifie uniquement la réservation
// auprès de la RPC `submit_feedback_survey` (accessible en anon).
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
  const [error, setError]     = useState<string | null>(null);

  const getOrCreate = useCallback(
    async (reservation: ReservationWithJoins): Promise<FeedbackSurveyLinkResult | null> => {
      if (!reservation.id) {
        setError('Réservation sans identifiant.');
        return null;
      }

      if (!getFeedbackBaseUrl()) {
        setError("URL d'enquête non configurée.");
        return null;
      }

      setLoading(true);
      setError(null);

      const from = supabase.from.bind(supabase) as unknown as FromFn;

      try {
        // Vérifier si un lien existe déjà pour cette réservation
        const { data: existing, error: fetchError } = await from('feedback_survey_links')
          .select('token')
          .eq('reservation_id', reservation.id)
          .maybeSingle();

        if (fetchError) {
          setError('Erreur lors de la vérification du lien.');
          return null;
        }

        if (existing) {
          const url = buildFeedbackSurveyUrl(existing.token);
          if (!url) {
            setError("URL d'enquête non configurée.");
            return null;
          }
          return { url, token: existing.token };
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
          setError("Erreur lors de la création du lien d'enquête.");
          return null;
        }

        const url = buildFeedbackSurveyUrl(token);
        if (!url) {
          setError("URL d'enquête non configurée.");
          return null;
        }
        return { url, token };
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const clearError = useCallback(() => setError(null), []);

  return { getOrCreate, loading, error, clearError };
}

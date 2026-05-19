// URL de base du formulaire public d'enquête.
// À renseigner quand la page web sera déployée (ex: https://lamaison.app/feedback).
// Tant qu'elle est vide, les boutons enquête affichent une erreur de configuration.
//
// Le token généré par generateFeedbackToken() est public : il identifie la réservation
// sans exposer aucune donnée client (nom, téléphone, email). La RPC submit_feedback_survey
// accepte ce token en accès anon — la sécurité repose sur son opacité (32 chars random),
// pas sur une session authentifiée.
export const LA_MAISON_FEEDBACK_BASE_URL = '';

export function getFeedbackBaseUrl(): string | null {
  return LA_MAISON_FEEDBACK_BASE_URL || null;
}

export function generateFeedbackToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

export function buildFeedbackSurveyUrl(token: string): string | null {
  const base = getFeedbackBaseUrl();
  if (!base) return null;
  return `${base}/${token}`;
}

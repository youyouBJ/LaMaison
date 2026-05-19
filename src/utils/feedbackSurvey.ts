// URL de base du formulaire public d'enquête de satisfaction.
// À remplacer par l'URL publique du formulaire feedback une fois Vercel/Expo Web configuré.
// Exemple : 'https://lamaison-feedback.vercel.app/feedback'
//
// Tant qu'elle est vide :
//   - buildFeedbackSurveyUrl() retourne null
//   - les boutons WhatsApp/Email enquête affichent "Lien d'enquête non configuré."
//   - aucun message n'est ouvert, évitant l'envoi d'un lien vide au client
//
// Le token est public (32 chars alphanumériques aléatoires). Il identifie la réservation
// sans exposer aucune donnée client. La RPC submit_feedback_survey est accessible en anon —
// la sécurité repose sur l'opacité du token, pas sur une session authentifiée.
export const LA_MAISON_FEEDBACK_BASE_URL = 'https://lamaison-feedback.vercel.app/feedback';

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

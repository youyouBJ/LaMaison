/**
 * send-staff-invite — Supabase Edge Function
 *
 * Permet à un admin ou manager d'envoyer un email d'invitation / configuration
 * de mot de passe à un membre de l'équipe.
 *
 * Sécurité :
 *   - La service_role key reste uniquement côté serveur (Edge Function)
 *   - Jamais retournée dans la réponse
 *   - L'appelant est vérifié via JWT + profil public.users
 *   - La cible est vérifiée dans le même restaurant que l'appelant
 *
 * Déploiement :
 *   supabase functions deploy send-staff-invite
 *
 * Secrets requis :
 *   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<votre_clé>
 *   supabase secrets set REDIRECT_URL=<url_de_redirection>  (optionnel)
 *   SUPABASE_URL et SUPABASE_ANON_KEY sont fournis automatiquement.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

// ─── CORS ─────────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ─── Types ────────────────────────────────────────────────────────────────────

type UserRole = 'admin' | 'manager' | 'host' | 'waiter';

type CallerProfile = {
  role:          UserRole;
  restaurant_id: string;
};

type TargetProfile = {
  restaurant_id: string;
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    status,
  });
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  // Pre-flight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return json({ success: false, error: 'Méthode non autorisée.' }, 405);
  }

  // ── 0. Env ─────────────────────────────────────────────────────────────────

  const supabaseUrl    = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey        = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json({ success: false, error: 'Configuration serveur manquante.' }, 500);
  }

  // ── 1. Valider le JWT de l'appelant ────────────────────────────────────────

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ success: false, error: 'Non authentifié.' }, 401);
  }

  // Client avec le token de l'appelant pour valider la session
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth:   { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user }, error: userError } = await callerClient.auth.getUser();
  if (userError || !user) {
    return json({ success: false, error: 'Session invalide ou expirée.' }, 401);
  }

  // ── 2. Charger le profil de l'appelant ─────────────────────────────────────

  // Client admin (service_role) pour les opérations privilégiées
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: callerData, error: callerError } = await adminClient
    .from('users')
    .select('role, restaurant_id')
    .eq('id', user.id)
    .single();

  if (callerError || !callerData) {
    return json({ success: false, error: 'Profil introuvable.' }, 401);
  }

  const callerProfile = callerData as CallerProfile;

  // ── 3. Vérifier le rôle ────────────────────────────────────────────────────
  // Admins et managers peuvent envoyer des invitations.
  // Hosts et waiters ne le peuvent pas.

  if (callerProfile.role !== 'admin' && callerProfile.role !== 'manager') {
    return json({
      success: false,
      error:   'Accès refusé. Seuls les admins et managers peuvent envoyer des invitations.',
    }, 403);
  }

  // ── 4. Parser le body ──────────────────────────────────────────────────────

  let targetUserId: string;
  try {
    const body = await req.json() as Record<string, unknown>;
    const raw  = body['targetUserId'];
    if (typeof raw !== 'string' || raw.trim() === '') {
      return json({ success: false, error: 'targetUserId requis.' }, 400);
    }
    targetUserId = raw.trim();
  } catch {
    return json({ success: false, error: 'Corps de requête JSON invalide.' }, 400);
  }

  // Validation UUID basique
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetUserId)) {
    return json({ success: false, error: 'targetUserId invalide.' }, 400);
  }

  // ── 5. Vérifier que la cible appartient au même restaurant ─────────────────

  const { data: targetData, error: targetError } = await adminClient
    .from('users')
    .select('restaurant_id')
    .eq('id', targetUserId)
    .single();

  if (targetError || !targetData) {
    return json({ success: false, error: 'Utilisateur introuvable dans ce restaurant.' }, 404);
  }

  const targetProfile = targetData as TargetProfile;

  if (targetProfile.restaurant_id !== callerProfile.restaurant_id) {
    return json({ success: false, error: "Cet utilisateur n'appartient pas à votre restaurant." }, 403);
  }

  // ── 6. Récupérer l'email de la cible via Auth admin ────────────────────────

  const { data: authUserData, error: authUserError } = await adminClient.auth.admin.getUserById(targetUserId);
  if (authUserError || !authUserData.user) {
    return json({ success: false, error: 'Compte Auth introuvable pour cet utilisateur.' }, 404);
  }

  const targetEmail = authUserData.user.email;
  if (!targetEmail) {
    return json({ success: false, error: "Aucun email associé à ce compte." }, 400);
  }

  // ── 7. Envoyer l'email de configuration via Supabase Auth ──────────────────
  // POST /auth/v1/recover déclenche l'envoi d'un email "Réinitialiser le mot de passe"
  // via le provider email configuré dans Supabase (SMTP intégré ou Resend).
  // Ce lien permet à un nouvel utilisateur de définir son mot de passe.

  const redirectUrl = Deno.env.get('REDIRECT_URL');
  const recoverBody: Record<string, string> = { email: targetEmail };
  if (redirectUrl) recoverBody['redirect_to'] = redirectUrl;

  const recoverRes = await fetch(`${supabaseUrl}/auth/v1/recover`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey':        serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify(recoverBody),
  });

  if (!recoverRes.ok) {
    const detail = await recoverRes.text().catch(() => '');
    console.error('[send-staff-invite] /auth/v1/recover erreur:', recoverRes.status, detail);
    return json({ success: false, error: "Erreur lors de l'envoi de l'email d'invitation." }, 500);
  }

  // ── 8. Succès ──────────────────────────────────────────────────────────────
  // Ne pas retourner l'email dans la réponse si la confidentialité est requise.
  // Ici on le retourne pour que l'app puisse confirmer à quel email l'invitation a été envoyée.

  return json({ success: true, message: 'Invitation envoyée', email: targetEmail }, 200);
});

/**
 * Supabase admin client for local scripts only.
 * Uses service_role key — bypasses RLS.
 * NEVER import this file from src/ (app mobile).
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function createSupabaseAdmin(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      'SUPABASE_URL manquant.\n→ Copiez .env.import.example vers .env.import et renseignez les valeurs.'
    );
  }
  if (!supabaseServiceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY manquante.\n→ Récupérez-la dans Supabase : Project Settings → API → service_role.'
    );
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

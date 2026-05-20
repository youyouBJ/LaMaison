import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase }                                  from '../lib/supabase';

type InviteStatus = 'idle' | 'loading' | 'success' | 'error';

type State = {
  statuses: Record<string, InviteStatus>;
  errors:   Record<string, string>;
};

type EdgeFnError = {
  message:  string;
  context?: unknown;
};

const SUCCESS_RESET_MS = 30_000;

function extractErrorMessage(fnError: EdgeFnError): string {
  // FunctionsHttpError stores the parsed response body in `context`
  const ctx = fnError.context;
  if (ctx !== null && ctx !== undefined && typeof ctx === 'object') {
    const body = ctx as Record<string, unknown>;
    if (typeof body['error'] === 'string') return body['error'];
  }
  return fnError.message || "Erreur lors de l'envoi.";
}

export function useStaffInvite() {
  const [state, setState] = useState<State>({ statuses: {}, errors: {} });

  // Map of userId → timer handle — cleaned up on unmount
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const handles = timers.current;
    return () => {
      for (const id of Object.values(handles)) clearTimeout(id);
    };
  }, []);

  const scheduleReset = useCallback((targetUserId: string): void => {
    // Cancel any existing timer for this user before setting a new one
    const existing = timers.current[targetUserId];
    if (existing !== undefined) clearTimeout(existing);

    timers.current[targetUserId] = setTimeout(() => {
      setState(prev => ({
        statuses: { ...prev.statuses, [targetUserId]: 'idle' },
        errors:   { ...prev.errors,   [targetUserId]: '' },
      }));
      delete timers.current[targetUserId];
    }, SUCCESS_RESET_MS);
  }, []);

  const sendInvite = useCallback(async (targetUserId: string): Promise<void> => {
    setState(prev => ({
      statuses: { ...prev.statuses, [targetUserId]: 'loading' },
      errors:   { ...prev.errors,   [targetUserId]: '' },
    }));

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        'send-staff-invite',
        { body: { targetUserId } },
      );

      if (fnError) {
        const msg = extractErrorMessage(fnError as EdgeFnError);
        setState(prev => ({
          statuses: { ...prev.statuses, [targetUserId]: 'error' },
          errors:   { ...prev.errors,   [targetUserId]: msg },
        }));
        return;
      }

      const result = data as { success?: boolean; error?: string } | null;
      if (!result?.success) {
        const msg = result?.error ?? 'Réponse invalide du serveur.';
        setState(prev => ({
          statuses: { ...prev.statuses, [targetUserId]: 'error' },
          errors:   { ...prev.errors,   [targetUserId]: msg },
        }));
        return;
      }

      setState(prev => ({
        statuses: { ...prev.statuses, [targetUserId]: 'success' },
        errors:   prev.errors,
      }));
      scheduleReset(targetUserId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'envoi.";
      setState(prev => ({
        statuses: { ...prev.statuses, [targetUserId]: 'error' },
        errors:   { ...prev.errors,   [targetUserId]: msg },
      }));
    }
  }, [scheduleReset]);

  const getStatus = useCallback(
    (id: string): InviteStatus => state.statuses[id] ?? 'idle',
    [state.statuses],
  );

  const getError = useCallback(
    (id: string): string | null => state.errors[id] || null,
    [state.errors],
  );

  return { sendInvite, getStatus, getError };
}

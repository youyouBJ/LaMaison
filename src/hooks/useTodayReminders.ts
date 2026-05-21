import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { getTodayDateString, formatTimeSlot, getCurrentTimeInTunis } from '../utils/date';
import { reservationNeedsPhoneConfirmation } from '../utils/reservationConfirmation';
import { useI18n } from '../i18n';
import type { TranslateFn } from '../i18n';
import type { DashboardReservation } from './useTodayDashboard';
import type { WaitlistEntryWithGuest } from '../types/waitlist';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReminderType =
  | 'pending_confirmation'
  | 'to_call'
  | 'arriving_soon'
  | 'waitlist_waiting'
  | 'survey_to_send'
  | 'noshow_today'
  | 'cancelled_today';

export type ReminderPriority = 'urgent' | 'todo' | 'info';

export type ReminderActionType =
  | 'open_reservation'
  | 'open_waitlist'
  | 'whatsapp_confirmation';

export type Reminder = {
  id: string;
  type: ReminderType;
  priority: ReminderPriority;
  title: string;
  description: string;
  timeLabel: string;
  reservationId?: string;
  guestId?: string;
  waitlistId?: string;
  guestPhone?: string;
  guestEmail?: string;
  actionLabel?: string;
  actionType?: ReminderActionType;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeToMinutes(hhmm: string): number {
  const s = hhmm.substring(0, 5);
  const colonIdx = s.indexOf(':');
  if (colonIdx === -1) return 0;
  const h = parseInt(s.substring(0, colonIdx), 10);
  const m = parseInt(s.substring(colonIdx + 1), 10);
  if (isNaN(h) || isNaN(m)) return 0;
  return h * 60 + m;
}

function getGuestFullName(r: DashboardReservation, noName: string): string {
  if (!r.guests) return noName;
  const parts = [r.guests.first_name, r.guests.last_name]
    .filter((p): p is string => Boolean(p));
  return parts.length > 0 ? parts.join(' ') : noName;
}

function getWaitlistGuestName(e: WaitlistEntryWithGuest, anonymous: string): string {
  if (!e.guests) return anonymous;
  const parts = [e.guests.first_name, e.guests.last_name]
    .filter((p): p is string => Boolean(p));
  return parts.length > 0 ? parts.join(' ') : anonymous;
}

// ─── Reminder computation ─────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<ReminderPriority, number> = { urgent: 0, todo: 1, info: 2 };

function computeReminders(
  reservations: DashboardReservation[],
  waitlistEntries: WaitlistEntryWithGuest[],
  t: TranslateFn,
): Reminder[] {
  const reminders: Reminder[] = [];
  const today = getTodayDateString();
  const currentTime = getCurrentTimeInTunis();
  const currentMinutes = timeToMinutes(currentTime);
  const noName = t('dashboard_guest_no_name');
  const anonymous = t('reminder_anonymous');

  let noshowCount = 0;
  let cancelledCount = 0;

  for (const r of reservations) {
    if (r.date !== today) continue;

    const name = getGuestFullName(r, noName);
    const time = formatTimeSlot(r.time_slot);
    const covers = t('guest_cover_count', { n: r.party_size, s: r.party_size > 1 ? 's' : '' });
    const phone = r.guests?.phone ?? null;
    const guestId = r.guest_id ?? undefined;

    if (r.status === 'pending') {
      reminders.push({
        id: `pending_${r.id}`,
        type: 'pending_confirmation',
        priority: 'urgent',
        title: t('reminder_to_confirm'),
        description: `${name} — ${covers} à ${time}`,
        timeLabel: time,
        reservationId: r.id,
        guestId,
        guestPhone: phone ?? undefined,
        actionLabel: t('reminder_see_reservation'),
        actionType: 'open_reservation',
      });
    } else if (r.status === 'confirmed' && reservationNeedsPhoneConfirmation(r)) {
      // Confirmed but phone confirmation not yet done
      reminders.push({
        id: `to_call_${r.id}`,
        type: 'to_call',
        priority: 'todo',
        title: t('dashboard_stat_to_call'),
        description: `${name} — ${covers} à ${time}`,
        timeLabel: time,
        reservationId: r.id,
        guestId,
        guestPhone: phone ?? undefined,
        actionLabel: t('reminder_see_reservation'),
        actionType: 'open_reservation',
      });
    } else if (r.status === 'confirmed') {
      // Arriving within 60 minutes (not already shown as to_call)
      const slotMinutes = timeToMinutes(r.time_slot);
      const diff = slotMinutes - currentMinutes;
      if (diff >= 0 && diff <= 60) {
        reminders.push({
          id: `arriving_${r.id}`,
          type: 'arriving_soon',
          priority: 'info',
          title: t('reminder_arriving_soon'),
          description: `${name} — ${covers} à ${time}`,
          timeLabel: time,
          reservationId: r.id,
          guestId,
          actionLabel: t('reminder_see_reservation'),
          actionType: 'open_reservation',
        });
      }
    } else if (r.status === 'completed') {
      const email = r.guests?.email ?? null;
      if (phone || email) {
        reminders.push({
          id: `survey_${r.id}`,
          type: 'survey_to_send',
          priority: 'todo',
          title: t('reminder_survey_send'),
          description: `${name} — ${covers} à ${time}`,
          timeLabel: time,
          reservationId: r.id,
          guestId,
          guestPhone: phone ?? undefined,
          guestEmail: email ?? undefined,
          actionLabel: t('reminder_open_to_send'),
          actionType: 'open_reservation',
        });
      }
    } else if (r.status === 'noshow') {
      noshowCount++;
    } else if (r.status === 'cancelled') {
      cancelledCount++;
    }
  }

  // Waitlist entries with status = waiting
  for (const e of waitlistEntries) {
    if (e.status !== 'waiting') continue;
    const name = getWaitlistGuestName(e, anonymous);
    const covers = t('guest_cover_count', { n: e.party_size, s: e.party_size > 1 ? 's' : '' });
    const timeLabel = e.time_slot ? formatTimeSlot(e.time_slot) : t('reminder_waiting_time');
    reminders.push({
      id: `waitlist_${e.id}`,
      type: 'waitlist_waiting',
      priority: 'urgent',
      title: t('res_waitlist_btn'),
      description: `${name} — ${covers}`,
      timeLabel,
      waitlistId: e.id,
      guestId: e.guest_id ?? undefined,
      actionLabel: t('reminder_see_waitlist'),
      actionType: 'open_waitlist',
    });
  }

  // Grouped info reminders for no-shows and cancellations
  if (noshowCount > 0) {
    reminders.push({
      id: 'noshow_today',
      type: 'noshow_today',
      priority: 'info',
      title: `${noshowCount} ${t('reminder_noshow_today', { s: noshowCount > 1 ? 's' : '' })}`,
      description: t('reminder_noshow_desc'),
      timeLabel: '',
    });
  }
  if (cancelledCount > 0) {
    reminders.push({
      id: 'cancelled_today',
      type: 'cancelled_today',
      priority: 'info',
      title: `${cancelledCount} ${t('reminder_cancelled_today', { s: cancelledCount > 1 ? 's' : '' })}`,
      description: t('reminder_cancelled_desc'),
      timeLabel: '',
    });
  }

  reminders.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  return reminders;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTodayReminders(
  reservations: DashboardReservation[],
  restaurantId: string | null,
) {
  const { t } = useI18n();
  const [loading, setLoading]                   = useState(false);
  const [error, setError]                       = useState<string | null>(null);
  const [waitlistEntries, setWaitlistEntries]   = useState<WaitlistEntryWithGuest[]>([]);

  const fetchWaitlist = useCallback(async (resId: string): Promise<void> => {
    const today = getTodayDateString();
    const { data, error: fetchError } = await supabase
      .from('waitlist')
      .select('*, guests(*), shifts(*)')
      .eq('restaurant_id', resId)
      .eq('date', today)
      .eq('status', 'waiting')
      .order('created_at', { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      return;
    }
    setWaitlistEntries((data as unknown as WaitlistEntryWithGuest[]) ?? []);
    setError(null);
  }, []);

  const refresh = useCallback((): void => {
    if (!restaurantId) return;
    setLoading(true);
    void fetchWaitlist(restaurantId).finally(() => { setLoading(false); });
  }, [restaurantId, fetchWaitlist]);

  useEffect(() => {
    if (!restaurantId) return;
    setLoading(true);
    void fetchWaitlist(restaurantId).finally(() => { setLoading(false); });
  }, [restaurantId, fetchWaitlist]);

  const reminders = useMemo(
    () => computeReminders(reservations, waitlistEntries, t),
    [reservations, waitlistEntries, t],
  );

  const urgentCount = useMemo(
    () => reminders.filter((r) => r.priority === 'urgent').length,
    [reminders],
  );

  return { loading, error, reminders, urgentCount, refresh };
}

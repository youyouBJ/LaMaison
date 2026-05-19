import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { colors, typography, spacing, radius } from '../theme';
import { formatTimeSlot, formatReadableDate } from '../utils/date';
import { formatReservationTables } from '../utils/reservationTables';
import { reservationNeedsPhoneConfirmation } from '../utils/reservationConfirmation';
import { isBirthdayReservation, isEventReservation } from '../utils/reservationOccasion';
import StatusBadge from './StatusBadge';
import type { ReservationWithJoins } from '../types/reservations';
import {
  openWhatsAppMessage,
  normalizePhoneForWhatsApp,
  buildReservationConfirmationMessage,
  buildReservationReminderMessage,
  buildSatisfactionMessage,
} from '../utils/whatsapp';

type Props = {
  reservation: ReservationWithJoins;
  onPress: () => void;
};

function guestDisplayName(r: ReservationWithJoins): string {
  if (!r.guests) return r.source === 'walkin' ? 'Client de passage' : 'Client sans nom';
  const parts = [r.guests.first_name, r.guests.last_name].filter((p): p is string => Boolean(p));
  return parts.length > 0 ? parts.join(' ') : 'Client sans nom';
}

export default function ReservationCard({ reservation: r, onPress }: Props): React.JSX.Element {
  const isVip       = r.guests?.vip === true;
  const isBirthday  = isBirthdayReservation(r.notes);
  const isEvent     = isEventReservation(r.notes);
  const needsCall   = reservationNeedsPhoneConfirmation(r);
  const phone       = r.guests?.phone ?? null;

  const [waFeedback, setWaFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const handleCall = () => {
    if (phone) { void Linking.openURL(`tel:${phone}`); }
  };

  const showWhatsApp =
    phone !== null &&
    r.status !== 'cancelled' &&
    r.status !== 'noshow';

  const handleWhatsApp = () => {
    const time    = formatTimeSlot(r.time_slot);
    const dateStr = (() => {
      try { return formatReadableDate(new Date(`${r.date}T12:00:00`)); }
      catch { return r.date; }
    })();
    let message: string;
    if (r.status === 'completed') {
      message = buildSatisfactionMessage();
    } else if (r.status === 'seated') {
      message = buildReservationReminderMessage({ time, partySize: r.party_size });
    } else {
      message = buildReservationConfirmationMessage({ date: dateStr, time, partySize: r.party_size });
    }
    void openWhatsAppMessage(phone, message).then((opened) => {
      setWaFeedback(
        opened
          ? { ok: true, text: 'WhatsApp ouvert' }
          : {
              ok: false,
              text: normalizePhoneForWhatsApp(phone)
                ? "Impossible d'ouvrir WhatsApp."
                : 'Numéro invalide.',
            },
      );
      setTimeout(() => setWaFeedback(null), 4000);
    });
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.timeChip}>
        <Text style={styles.timeText}>{formatTimeSlot(r.time_slot)}</Text>
      </View>
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{guestDisplayName(r)}</Text>
          {isVip && (
            <View style={styles.vipBadge}>
              <Text style={styles.vipText}>VIP</Text>
            </View>
          )}
          {isBirthday && (
            <View style={styles.birthdayBadge}>
              <Text style={styles.birthdayText}>Anniversaire</Text>
            </View>
          )}
          {isEvent && (
            <View style={styles.eventBadge}>
              <Text style={styles.eventText}>Événement</Text>
            </View>
          )}
          {needsCall && (
            <View style={styles.callBadge}>
              <Text style={styles.callBadgeText}>À appeler</Text>
            </View>
          )}
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {r.party_size} couvert{r.party_size > 1 ? 's' : ''}
          {phone ? ` · ${phone}` : ''}
          {(r.tables ?? r.reservation_tables?.length) ? ` · ${formatReservationTables(r.tables, r.reservation_tables)}` : ''}
        </Text>
        <View style={styles.bottomRow}>
          <StatusBadge status={r.status} />
          <View style={styles.bottomActions}>
            {showWhatsApp ? (
              <TouchableOpacity style={styles.waButton} onPress={handleWhatsApp} activeOpacity={0.75}>
                <Text style={styles.waButtonText}>WhatsApp</Text>
              </TouchableOpacity>
            ) : null}
            {phone ? (
              <TouchableOpacity style={styles.callButton} onPress={handleCall} activeOpacity={0.75}>
                <Text style={styles.callButtonText}>Appeler</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
        {waFeedback ? (
          <Text style={[styles.waFeedbackText, waFeedback.ok ? styles.waFeedbackOk : styles.waFeedbackErr]}>
            {waFeedback.text}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  timeChip: {
    backgroundColor: colors.goldLight,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginRight: spacing.md,
    minWidth: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeText: {
    fontFamily: typography.stat.fontFamily,
    fontSize: typography.small.fontSize,
    color: colors.gold,
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.xs,
  },
  name: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    flex: 1,
  },
  vipBadge: {
    backgroundColor: colors.goldLight,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  vipText: {
    ...typography.label,
    color: colors.gold,
  },
  birthdayBadge: {
    backgroundColor: colors.goldLight,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  birthdayText: {
    ...typography.label,
    color: colors.gold,
  },
  eventBadge: {
    backgroundColor: colors.ctaLight,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.cta,
  },
  eventText: {
    ...typography.label,
    color: colors.cta,
  },
  meta: {
    ...typography.small,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  callBadge: {
    backgroundColor: colors.ctaLight,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.cta,
  },
  callBadgeText: {
    ...typography.label,
    color: colors.cta,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  callButton: {
    backgroundColor: colors.goldLight,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  callButtonText: {
    ...typography.label,
    color: colors.gold,
  },
  waButton: {
    backgroundColor: colors.statusFreeLight,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.statusFree,
  },
  waButtonText: {
    ...typography.label,
    color: colors.statusFree,
  },
  waFeedbackText: {
    ...typography.small,
    marginTop: spacing.xs,
    fontFamily: typography.bodyMedium.fontFamily,
  },
  waFeedbackOk:  { color: colors.statusFree },
  waFeedbackErr: { color: colors.cta },
});

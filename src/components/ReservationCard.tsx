import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, typography, spacing, radius } from '../theme';
import { formatTimeSlot } from '../utils/date';
import StatusBadge from './StatusBadge';
import type { ReservationWithJoins } from '../types/reservations';

type Props = {
  reservation: ReservationWithJoins;
  onPress: () => void;
};

function guestDisplayName(r: ReservationWithJoins): string {
  if (!r.guests) return 'Client sans nom';
  const parts = [r.guests.first_name, r.guests.last_name].filter((p): p is string => Boolean(p));
  return parts.length > 0 ? parts.join(' ') : 'Client sans nom';
}

export default function ReservationCard({ reservation: r, onPress }: Props): React.JSX.Element {
  const isVip = r.guests?.vip === true;

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
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {r.party_size} couvert{r.party_size > 1 ? 's' : ''}
          {r.guests?.phone ? ` · ${r.guests.phone}` : ''}
          {r.tables?.label ? ` · ${r.tables.label}` : ''}
        </Text>
        <StatusBadge status={r.status} />
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
  meta: {
    ...typography.small,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
});

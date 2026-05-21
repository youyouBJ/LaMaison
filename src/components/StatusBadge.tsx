import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { typography, spacing, radius } from '../theme';
import { getReservationStatusColors } from '../utils/reservationStatus';
import type { ReservationStatus } from '../types/database';
import { useI18n } from '../i18n';
import type { TranslationKey } from '../i18n';

type Props = {
  status: ReservationStatus;
};

const STATUS_KEY_MAP: Record<ReservationStatus, TranslationKey> = {
  pending:   'status_pending',
  confirmed: 'status_confirmed',
  seated:    'status_seated',
  completed: 'status_completed',
  cancelled: 'status_cancelled',
  noshow:    'status_noshow',
};

export default function StatusBadge({ status }: Props): React.JSX.Element {
  const { t } = useI18n();
  const { backgroundColor, color } = getReservationStatusColors(status);
  const label = t(STATUS_KEY_MAP[status]);

  return (
    <View style={[styles.badge, { backgroundColor }]}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius:      radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs,
    alignSelf:         'flex-start',
  },
  text: {
    ...typography.label,
  },
});

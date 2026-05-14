import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { typography, spacing, radius } from '../theme';
import { getReservationStatusColors, getReservationStatusLabel } from '../utils/reservationStatus';
import type { ReservationStatus } from '../types/database';

type Props = {
  status: ReservationStatus;
};

export default function StatusBadge({ status }: Props): React.JSX.Element {
  const { backgroundColor, color } = getReservationStatusColors(status);
  const label = getReservationStatusLabel(status);

  return (
    <View style={[styles.badge, { backgroundColor }]}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
  },
  text: {
    ...typography.label,
  },
});

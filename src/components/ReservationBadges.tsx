import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, radius } from '../theme';
import VipBadge from './VipBadge';

type Props = {
  isVip?:      boolean;
  isBirthday?: boolean;
  isEvent?:    boolean;
};

export default function ReservationBadges({ isVip, isBirthday, isEvent }: Props): React.JSX.Element | null {
  if (!isVip && !isBirthday && !isEvent) return null;
  return (
    <View style={styles.row}>
      {isVip && <VipBadge small />}
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
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.xs,
    marginTop:     spacing.xs,
    alignSelf:     'flex-start',
  },
  birthdayBadge: {
    backgroundColor: colors.goldLight,
    borderRadius:    radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   2,
    borderWidth:     1,
    borderColor:     colors.gold,
  },
  birthdayText: {
    ...typography.label,
    color: colors.gold,
  },
  eventBadge: {
    backgroundColor: colors.ctaLight,
    borderRadius:    radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   2,
    borderWidth:     1,
    borderColor:     colors.cta,
  },
  eventText: {
    ...typography.label,
    color: colors.cta,
  },
});

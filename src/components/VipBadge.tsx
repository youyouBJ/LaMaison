import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, radius } from '../theme';

type Props = {
  small?: boolean;
};

export default function VipBadge({ small = false }: Props): React.JSX.Element {
  return (
    <View style={[styles.badge, small && styles.badgeSmall]}>
      <Text style={[styles.text, small && styles.textSmall]}>VIP</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor:   colors.goldLight,
    borderRadius:      radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs,
    borderWidth:       1,
    borderColor:       colors.gold,
    alignSelf:         'flex-start',
  },
  badgeSmall: {
    paddingHorizontal: spacing.xs,
    paddingVertical:   2,
  },
  text: {
    ...typography.label,
    color: colors.gold,
  },
  textSmall: {
    fontSize:      9,
    letterSpacing: 0.3,
  },
});

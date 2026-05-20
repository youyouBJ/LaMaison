import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, radius } from '../theme';

type Props = {
  label: string;
  value: number;
  accent?: string;
  valueText?: string;
};

export default function StatCard({ label, value, accent, valueText }: Props): React.JSX.Element {
  return (
    <View style={styles.card}>
      <Text style={[styles.value, accent ? { color: accent } : null]}>
        {valueText ?? value}
      </Text>
      <Text style={styles.label} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  value: {
    ...typography.stat,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  label: {
    ...typography.label,
    color: colors.textMuted,
    textAlign: 'center',
  },
});

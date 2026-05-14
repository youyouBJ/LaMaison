import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, radius } from '../theme';

type Props = {
  title?: string;
  children: React.ReactNode;
};

export default function SectionCard({ title, children }: Props): React.JSX.Element {
  return (
    <View style={styles.card}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
});

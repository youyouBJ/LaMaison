import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, typography, spacing, radius } from '../theme';

type Variant = 'primary' | 'secondary' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
};

export default function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
}: Props): React.JSX.Element {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[styles.btn, styles[variant], isDisabled && styles.disabled]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'secondary' ? colors.cta : colors.textOnDark}
          size="small"
        />
      ) : (
        <Text style={[styles.label, styles[`label_${variant}` as const]]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primary: {
    backgroundColor: colors.cta,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  danger: {
    backgroundColor: colors.ctaLight,
    borderWidth: 1,
    borderColor: colors.cta,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    ...typography.bodyMedium,
  },
  label_primary: {
    color: colors.textOnDark,
  },
  label_secondary: {
    color: colors.textPrimary,
  },
  label_danger: {
    color: colors.cta,
  },
});

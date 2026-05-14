import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, typography, spacing, radius } from '../theme';
import { normalizeTimeSlotForDisplay } from '../utils/reservationSlots';

type TimeSlotSelectorProps = {
  slots: string[];
  value?: string;
  onChange: (slot: string) => void;
  disabledSlots?: string[];
  label?: string;
  emptyMessage?: string;
};

export default function TimeSlotSelector({
  slots,
  value,
  onChange,
  disabledSlots = [],
  label,
  emptyMessage = 'Aucun créneau disponible',
}: TimeSlotSelectorProps): React.JSX.Element {
  const normalizedValue = value !== undefined ? normalizeTimeSlotForDisplay(value) : undefined;
  const normalizedDisabled = disabledSlots.map(normalizeTimeSlotForDisplay);

  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      {slots.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{emptyMessage}</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {slots.map((slot) => {
            const display = normalizeTimeSlotForDisplay(slot);
            const selected = display === normalizedValue;
            const disabled = normalizedDisabled.includes(display);

            return (
              <TouchableOpacity
                key={slot}
                style={[
                  styles.slotBtn,
                  selected && styles.slotBtnSelected,
                  disabled && !selected && styles.slotBtnDisabled,
                ]}
                onPress={() => onChange(slot)}
                disabled={disabled}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Créneau ${display}`}
                accessibilityState={{ selected, disabled }}
              >
                <Text
                  style={[
                    styles.slotText,
                    selected && styles.slotTextSelected,
                    disabled && !selected && styles.slotTextDisabled,
                  ]}
                >
                  {display}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  emptyText: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  slotBtn: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  slotBtnSelected: {
    backgroundColor: colors.cta,
    borderColor: colors.cta,
  },
  slotBtnDisabled: {
    opacity: 0.45,
  },
  slotText: {
    ...typography.small,
    color: colors.textSecondary,
  },
  slotTextSelected: {
    color: colors.textOnDark,
    fontFamily: typography.bodyMedium.fontFamily,
  },
  slotTextDisabled: {
    color: colors.textMuted,
  },
});

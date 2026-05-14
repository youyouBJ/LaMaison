import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radius } from '../theme';
import {
  addDaysToDateString,
  formatReadableDate,
  getTodayDateString,
  getTomorrowDateString,
} from '../utils/date';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

type Props = {
  value: string;                      // YYYY-MM-DD
  onChange: (date: string) => void;
  showQuickActions?: boolean;
  allowManualInput?: boolean;
  label?: string;
};

// Retourne true si la string YYYY-MM-DD représente une date calendaire valide.
function isValidDateString(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return (
    !isNaN(dt.getTime()) &&
    dt.getFullYear() === y &&
    dt.getMonth() === m - 1 &&
    dt.getDate() === d
  );
}

export default function DateSelector({
  value,
  onChange,
  showQuickActions = true,
  allowManualInput = false,
  label,
}: Props): React.JSX.Element {
  const today    = getTodayDateString();
  const tomorrow = getTomorrowDateString();

  const [inputText, setInputText] = useState(value);
  const [inputError, setInputError] = useState(false);

  // Synchronise l'input quand la valeur change depuis l'extérieur (flèches, boutons rapides).
  useEffect(() => {
    setInputText(value);
    setInputError(false);
  }, [value]);

  const readableDate = formatReadableDate(new Date(`${value}T12:00:00`));

  const handleManualChange = (text: string) => {
    setInputText(text);
    if (text.length === 0) { setInputError(false); return; }
    if (isValidDateString(text)) {
      setInputError(false);
      onChange(text);
    } else {
      setInputError(true);
    }
  };

  const hasExtras = showQuickActions || allowManualInput;

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.card}>

        {/* ── Navigation ── */}
        <View style={[styles.navRow, hasExtras && styles.navRowGap]}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => onChange(addDaysToDateString(value, -1))}
            accessibilityLabel="Jour précédent"
            accessibilityRole="button"
          >
            <Ionicons name={'chevron-back' as IoniconsName} size={20} color={colors.textPrimary} />
          </TouchableOpacity>

          <Text style={styles.dateText} numberOfLines={1} adjustsFontSizeToFit>
            {readableDate}
          </Text>

          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => onChange(addDaysToDateString(value, 1))}
            accessibilityLabel="Jour suivant"
            accessibilityRole="button"
          >
            <Ionicons name={'chevron-forward' as IoniconsName} size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* ── Raccourcis Aujourd'hui / Demain ── */}
        {showQuickActions ? (
          <View style={styles.quickRow}>
            <QuickBtn
              label="Aujourd'hui"
              active={value === today}
              onPress={() => onChange(today)}
            />
            <QuickBtn
              label="Demain"
              active={value === tomorrow}
              onPress={() => onChange(tomorrow)}
            />
          </View>
        ) : null}

        {/* ── Saisie manuelle AAAA-MM-JJ ── */}
        {allowManualInput ? (
          <View style={styles.inputBlock}>
            <TextInput
              style={[styles.input, inputError && styles.inputErrorBorder]}
              value={inputText}
              onChangeText={handleManualChange}
              placeholder="AAAA-MM-JJ"
              placeholderTextColor={colors.textMuted}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              returnKeyType="done"
              accessibilityLabel="Saisir une date manuellement"
            />
            {inputError ? (
              <Text style={styles.inputHint}>Format attendu : AAAA-MM-JJ</Text>
            ) : null}
          </View>
        ) : null}

      </View>
    </View>
  );
}

// ─── QuickBtn ────────────────────────────────────────────────────────────────

function QuickBtn({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <TouchableOpacity
      style={[styles.quickBtn, active && styles.quickBtnActive]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.quickText, active && styles.quickTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navRowGap: {
    marginBottom: spacing.md,
  },
  navBtn: {
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
  },
  dateText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },

  // Quick actions
  quickRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickBtn: {
    flex: 1,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickBtnActive: {
    backgroundColor: colors.goldLight,
    borderColor: colors.gold,
  },
  quickText: {
    ...typography.small,
    color: colors.textMuted,
  },
  quickTextActive: {
    color: colors.gold,
    fontFamily: typography.bodyMedium.fontFamily,
  },

  // Manual input
  inputBlock: {
    marginTop: spacing.md,
  },
  input: {
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inputErrorBorder: {
    borderColor: colors.cta,
  },
  inputHint: {
    ...typography.small,
    color: colors.cta,
    marginTop: spacing.xs,
  },
});

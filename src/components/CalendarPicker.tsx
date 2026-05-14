import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radius } from '../theme';
import {
  getMonthMatrix,
  getMonthLabel,
  addMonthsToDateString,
  isSameDate,
  isDateBefore,
  isDateAfter,
  getTodayDateString,
} from '../utils/date';
import type { CalendarDay } from '../utils/date';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

type CalendarPickerProps = {
  value: string;
  onChange: (date: string) => void;
  minDate?: string;
  maxDate?: string;
};

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const;
const CELL_SIZE = 32;

export default function CalendarPicker({
  value,
  onChange,
  minDate,
  maxDate,
}: CalendarPickerProps): React.JSX.Element {
  const [currentMonth, setCurrentMonth] = useState<string>(value);

  useEffect(() => {
    setCurrentMonth(value);
  }, [value]);

  const matrix = getMonthMatrix(currentMonth);
  const monthLabel = getMonthLabel(currentMonth);
  const today = getTodayDateString();

  const goToPrevMonth = () => setCurrentMonth((m) => addMonthsToDateString(m, -1));
  const goToNextMonth = () => setCurrentMonth((m) => addMonthsToDateString(m, 1));

  const isDayDisabled = (day: CalendarDay): boolean => {
    if (!day.isCurrentMonth) return true;
    if (minDate !== undefined && isDateBefore(day.date, minDate)) return true;
    if (maxDate !== undefined && isDateAfter(day.date, maxDate)) return true;
    return false;
  };

  const handleDayPress = (day: CalendarDay) => {
    if (isDayDisabled(day)) return;
    onChange(day.date);
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.card}>

        {/* Mois précédent / label / mois suivant */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={goToPrevMonth}
            accessibilityLabel="Mois précédent"
            accessibilityRole="button"
          >
            <Ionicons name={'chevron-back' as IoniconsName} size={18} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={goToNextMonth}
            accessibilityLabel="Mois suivant"
            accessibilityRole="button"
          >
            <Ionicons name={'chevron-forward' as IoniconsName} size={18} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* En-têtes jours de la semaine */}
        <View style={styles.row}>
          {DAY_LABELS.map((d) => (
            <Text key={d} style={styles.weekLabel}>{d}</Text>
          ))}
        </View>

        {/* Grille calendrier */}
        {matrix.map((week, weekIdx) => (
          <View key={weekIdx} style={styles.row}>
            {week.map((day) => {
              const selected = isSameDate(day.date, value) && day.isCurrentMonth;
              const disabled = isDayDisabled(day);
              const isToday = day.date === today && day.isCurrentMonth;
              const visible = day.isCurrentMonth;

              return (
                <TouchableOpacity
                  key={day.date}
                  style={styles.cellOuter}
                  onPress={() => handleDayPress(day)}
                  disabled={disabled}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={visible ? day.date : undefined}
                  accessibilityState={{ selected, disabled }}
                >
                  <View
                    style={[
                      styles.cellInner,
                      selected && styles.cellSelected,
                      !selected && isToday && styles.cellToday,
                    ]}
                  >
                    {visible ? (
                      <Text
                        style={[
                          styles.dayText,
                          selected && styles.dayTextSelected,
                          !selected && isToday && styles.dayTextToday,
                          !selected && !isToday && disabled && styles.dayTextDisabled,
                        ]}
                      >
                        {String(day.dayNumber)}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.md,
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  navBtn: {
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
  },
  monthLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
  },
  weekLabel: {
    flex: 1,
    fontFamily: typography.label.fontFamily,
    fontSize: typography.label.fontSize,
    letterSpacing: typography.label.letterSpacing,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.xs,
  },
  cellOuter: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  cellInner: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: CELL_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellSelected: {
    backgroundColor: colors.cta,
  },
  cellToday: {
    borderWidth: 1.5,
    borderColor: colors.gold,
  },
  dayText: {
    ...typography.small,
    color: colors.textPrimary,
  },
  dayTextSelected: {
    color: colors.textOnDark,
    fontFamily: typography.bodyMedium.fontFamily,
  },
  dayTextToday: {
    color: colors.gold,
    fontFamily: typography.bodyMedium.fontFamily,
  },
  dayTextDisabled: {
    color: colors.textMuted,
    opacity: 0.45,
  },
});

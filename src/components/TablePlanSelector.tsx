import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FloorCanvas from './FloorCanvas';
import {
  LA_MAISON_FLOOR_TABLES,
  LA_MAISON_FLOOR_LABELS,
  floorPlanColors,
} from '../utils/floorPlanLayout';
import type { FloorTableWithState, FloorTableStatus } from '../types/floor';
import type { TableRow } from '../hooks/useCreateReservation';
import { colors, typography, spacing, radius } from '../theme';
import { useI18n } from '../i18n';

interface Props {
  dbTables: TableRow[];
  selectedIds: string[];
  onConfirm: (ids: string[]) => void;
  onCancel: () => void;
}

export default function TablePlanSelector({
  dbTables,
  selectedIds,
  onConfirm,
  onCancel,
}: Props): React.JSX.Element {
  const { t } = useI18n();
  const [localSelectedIds, setLocalSelectedIds] = useState<string[]>(selectedIds);
  const [canvasLayout, setCanvasLayout]         = useState<{ w: number; h: number } | null>(null);

  const dbByLabel = useMemo(
    () => new Map<string, TableRow>(dbTables.map((t) => [t.label, t])),
    [dbTables],
  );

  const tables: FloorTableWithState[] = useMemo(() => {
    return LA_MAISON_FLOOR_TABLES.map((layout) => {
      const dbRow         = dbByLabel.get(String(layout.id));
      const isUnavailable = !dbRow || dbRow.status === 'unavailable';
      const isSelected    = dbRow ? localSelectedIds.includes(dbRow.id) : false;

      const computedStatus: FloorTableStatus = isUnavailable
        ? 'unavailable'
        : isSelected
          ? 'reserved'
          : 'free';

      return {
        ...layout,
        dbId:           dbRow?.id     ?? null,
        dbStatus:       dbRow?.status ?? 'free',
        computedStatus,
        reservation:    null,
        reservations:   [],
      };
    });
  }, [dbByLabel, localSelectedIds]);

  const handleTablePress = (table: FloorTableWithState) => {
    const { dbId, dbStatus } = table;
    if (!dbId || dbStatus === 'unavailable') return;
    setLocalSelectedIds((prev) =>
      prev.includes(dbId)
        ? prev.filter((id) => id !== dbId)
        : [...prev, dbId],
    );
  };

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setCanvasLayout({ w: width, h: height });
  };

  const selectedLabels = useMemo(() => {
    return localSelectedIds.map((id) => {
      const tbl = dbTables.find((dt) => dt.id === id);
      return tbl ? `Table ${tbl.label}` : id;
    });
  }, [localSelectedIds, dbTables]);

  const canConfirm = localSelectedIds.length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerAction}
          onPress={onCancel}
          accessibilityRole="button"
        >
          <Text style={styles.cancelText}>{t('common_cancel')}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{t('plan_title')}</Text>

        <TouchableOpacity
          style={styles.headerAction}
          onPress={() => onConfirm(localSelectedIds)}
          disabled={!canConfirm}
          accessibilityRole="button"
        >
          <Text style={[styles.confirmText, !canConfirm && styles.confirmTextDisabled]}>
            {t('common_confirm')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Subtitle ───────────────────────────────────────────────────────── */}
      <Text style={styles.subtitle}>{t('plan_subtitle')}</Text>

      {/* ── Selection summary ──────────────────────────────────────────────── */}
      {localSelectedIds.length > 0 ? (
        <View style={styles.selectionRow}>
          <Text style={styles.selectionText} numberOfLines={2}>
            {selectedLabels.join(' · ')}
          </Text>
          <TouchableOpacity
            onPress={() => setLocalSelectedIds([])}
            accessibilityRole="button"
          >
            <Text style={styles.clearText}>{t('common_clear')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ── Legend ────────────────────────────────────────────────────────── */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: floorPlanColors.statusFree }]} />
          <Text style={styles.legendText}>Disponible</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: floorPlanColors.statusReserved }]} />
          <Text style={styles.legendText}>Sélectionnée</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: floorPlanColors.statusUnavailable }]} />
          <Text style={styles.legendText}>Indisponible</Text>
        </View>
      </View>

      {/* ── Canvas ────────────────────────────────────────────────────────── */}
      <View style={styles.canvasArea} onLayout={handleLayout}>
        {canvasLayout ? (
          <FloorCanvas
            tables={tables}
            labels={LA_MAISON_FLOOR_LABELS}
            selectedTableId={null}
            onTablePress={handleTablePress}
            availableWidth={canvasLayout.w}
            availableHeight={canvasLayout.h}
          />
        ) : null}
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerAction: { minWidth: 64 },
  title: {
    ...typography.h2,
    color:       colors.textPrimary,
    flex:        1,
    textAlign:   'center',
  },
  cancelText:            { ...typography.body,       color: colors.cta },
  confirmText:           { ...typography.bodyMedium, color: colors.cta, textAlign: 'right' },
  confirmTextDisabled:   { color: colors.textMuted },

  subtitle: {
    ...typography.small,
    color:             colors.textMuted,
    textAlign:         'center',
    paddingHorizontal: spacing.xl,
    paddingTop:        spacing.sm,
    paddingBottom:     spacing.xs,
  },

  selectionRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.sm,
    backgroundColor:   colors.goldLight,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap:               spacing.md,
  },
  selectionText: {
    ...typography.small,
    color:       colors.gold,
    fontFamily:  typography.bodyMedium.fontFamily,
    flex:        1,
  },
  clearText: { ...typography.small, color: colors.cta },

  legend: {
    flexDirection:     'row',
    gap:               spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.sm,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
  legendText: { ...typography.small, color: colors.textMuted },

  canvasArea: { flex: 1, margin: spacing.sm },
});

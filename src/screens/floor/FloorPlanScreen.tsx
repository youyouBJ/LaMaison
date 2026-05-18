import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  LayoutChangeEvent,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radius } from '../../theme';
import { floorPlanColors } from '../../utils/floorPlanLayout';
import DateSelector from '../../components/DateSelector';
import FloorCanvas from '../../components/FloorCanvas';
import CreateReservationForTableForm from '../../components/CreateReservationForTableForm';
import { useFloorPlan } from '../../hooks/useFloorPlan';
import type { FloorTableWithState, FloorServiceFilter } from '../../types/floor';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const SERVICE_FILTERS: { key: FloorServiceFilter; label: string }[] = [
  { key: 'all',    label: 'Tous' },
  { key: 'lunch',  label: 'Déjeuner' },
  { key: 'dinner', label: 'Dîner' },
];

const LEGEND: { status: string; color: string; label: string }[] = [
  { status: 'free',        color: floorPlanColors.statusFree,        label: 'Libre' },
  { status: 'reserved',    color: floorPlanColors.statusReserved,    label: 'Réservée' },
  { status: 'occupied',    color: floorPlanColors.statusOccupied,    label: 'À table' },
  { status: 'unavailable', color: floorPlanColors.statusUnavailable, label: 'Indisponible' },
];

export default function FloorPlanScreen(): React.JSX.Element {
  const {
    loading,
    error,
    tables,
    labels,
    selectedDate,
    setSelectedDate,
    serviceFilter,
    setServiceFilter,
    selectedTable,
    setSelectedTable,
    refresh,
  } = useFloorPlan();

  const [canvasLayout, setCanvasLayout] = useState<{ w: number; h: number } | null>(null);
  const [showForm, setShowForm]         = useState(false);
  const [successMsg, setSuccessMsg]     = useState<string | null>(null);
  const successTimeoutRef               = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setCanvasLayout({ w: width, h: height });
  };

  const handleTablePress = (table: FloorTableWithState) => {
    if (selectedTable?.id === table.id) {
      setSelectedTable(null);
      setShowForm(false);
      setSuccessMsg(null);
    } else {
      setSelectedTable(table);
      setShowForm(false);
      setSuccessMsg(null);
    }
  };

  const handleFormSuccess = useCallback((_reservationId: string) => {
    setShowForm(false);
    refresh();
    if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    setSuccessMsg('Réservation créée avec succès.');
    successTimeoutRef.current = setTimeout(() => setSuccessMsg(null), 4000);
  }, [refresh]);

  return (
    <>
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.title}>Plan de salle</Text>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={refresh}
          accessibilityLabel="Rafraîchir"
          accessibilityRole="button"
        >
          <Ionicons name={'refresh-outline' as IoniconsName} size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* ── Controls (date + service) ──────────────────────────────────────── */}
      <View style={styles.controls}>
        <DateSelector
          value={selectedDate}
          onChange={setSelectedDate}
          showQuickActions
        />

        {/* Service chips */}
        <View style={styles.chipRow}>
          {SERVICE_FILTERS.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[styles.chip, serviceFilter === key && styles.chipActive]}
              onPress={() => setServiceFilter(key)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityState={{ selected: serviceFilter === key }}
            >
              <Text style={[styles.chipText, serviceFilter === key && styles.chipTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          {LEGEND.map(({ status, color, label }) => (
            <View key={status} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: color }]} />
              <Text style={styles.legendText}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Canvas area ─────────────────────────────────────────────────────── */}
      <View style={styles.canvasArea} onLayout={handleLayout}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.gold} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : canvasLayout ? (
          <FloorCanvas
            tables={tables}
            labels={labels}
            selectedTableId={selectedTable?.id ?? null}
            onTablePress={handleTablePress}
            availableWidth={canvasLayout.w}
            availableHeight={canvasLayout.h - (selectedTable ? DETAIL_PANEL_HEIGHT : 0)}
          />
        ) : null}
      </View>

      {/* ── Detail panel ───────────────────────────────────────────────────── */}
      {selectedTable ? (
        <TableDetailPanel
          table={selectedTable}
          successMsg={successMsg}
          onClose={() => { setSelectedTable(null); setShowForm(false); setSuccessMsg(null); }}
          onAddReservation={() => setShowForm(true)}
        />
      ) : null}

    </SafeAreaView>

    {/* ── Form modal ─────────────────────────────────────────────────────── */}
    {selectedTable && selectedTable.dbId ? (
      <Modal
        visible={showForm}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowForm(false)}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHandle} />
          <CreateReservationForTableForm
            tableId={selectedTable.dbId}
            tableLabel={String(selectedTable.id)}
            tableCapacity={selectedTable.capacity}
            initialDate={selectedDate}
            initialServiceFilter={serviceFilter}
            onSuccess={handleFormSuccess}
            onCancel={() => setShowForm(false)}
          />
        </SafeAreaView>
      </Modal>
    ) : null}
    </>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

const DETAIL_PANEL_HEIGHT = 240;

function TableDetailPanel({
  table,
  successMsg,
  onClose,
  onAddReservation,
}: {
  table: FloorTableWithState;
  successMsg: string | null;
  onClose: () => void;
  onAddReservation: () => void;
}): React.JSX.Element {
  const res = table.reservation;

  const statusLabel: Record<string, string> = {
    free:        'Libre',
    reserved:    'Réservée',
    occupied:    'À table',
    unavailable: 'Indisponible',
  };

  const statusColor: Record<string, string> = {
    free:        colors.statusFree,
    reserved:    colors.statusReserved,
    occupied:    colors.statusOccupied,
    unavailable: colors.statusUnavailable,
  };

  return (
    <View style={styles.detailPanel}>
      {/* Panel header */}
      <View style={styles.detailHeader}>
        <View>
          <Text style={styles.detailTitle}>Table {table.id}</Text>
          <Text style={styles.detailSub}>{table.zone.replace(/_/g, ' ')}</Text>
        </View>
        <View style={styles.detailHeaderRight}>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor[table.computedStatus]}20` }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor[table.computedStatus] }]} />
            <Text style={[styles.statusText, { color: statusColor[table.computedStatus] }]}>
              {statusLabel[table.computedStatus] ?? table.computedStatus}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            accessibilityLabel="Fermer"
            accessibilityRole="button"
          >
            <Ionicons name={'close' as IoniconsName} size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.detailMeta}>
        <Text style={styles.metaItem}>
          <Text style={styles.metaKey}>Capacité : </Text>
          <Text style={styles.metaVal}>{table.capacity} couvert{table.capacity > 1 ? 's' : ''}</Text>
        </Text>
      </View>

      {/* Reservation info + CTA */}
      <ScrollView style={styles.detailBody} showsVerticalScrollIndicator={false}>
        {successMsg ? (
          <View style={styles.successBanner}>
            <Ionicons name={'checkmark-circle-outline' as IoniconsName} size={15} color={colors.statusFree} />
            <Text style={styles.successText}>{successMsg}</Text>
          </View>
        ) : null}

        {res ? (
          <View style={styles.resCard}>
            <View style={styles.resRow}>
              <Ionicons name={'time-outline' as IoniconsName} size={14} color={colors.textMuted} />
              <Text style={styles.resText}>{res.timeSlot}</Text>
              {res.shiftName ? (
                <Text style={styles.resHint}> · {res.shiftName}</Text>
              ) : null}
            </View>
            <View style={styles.resRow}>
              <Ionicons name={'person-outline' as IoniconsName} size={14} color={colors.textMuted} />
              <Text style={styles.resText}>{res.guestName ?? 'Client non renseigné'}</Text>
            </View>
            <View style={styles.resRow}>
              <Ionicons name={'people-outline' as IoniconsName} size={14} color={colors.textMuted} />
              <Text style={styles.resText}>{res.partySize} couvert{res.partySize > 1 ? 's' : ''}</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.noRes}>Aucune réservation assignée</Text>
        )}
      </ScrollView>

      {/* Add reservation CTA */}
      {table.dbId ? (
        <TouchableOpacity
          style={styles.addResBtn}
          onPress={onAddReservation}
          activeOpacity={0.80}
          accessibilityRole="button"
          accessibilityLabel="Ajouter une réservation"
        >
          <Ionicons name={'add-circle-outline' as IoniconsName} size={16} color={colors.textOnDark} />
          <Text style={styles.addResBtnText}>Ajouter une réservation</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.noDbHint}>Table non synchronisée avec la base.</Text>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop:     spacing.md,
    paddingBottom:  spacing.sm,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  refreshBtn: {
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  // Controls
  controls: {
    paddingHorizontal: spacing.xl,
    paddingBottom:     spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.xs,
    borderRadius:      radius.xl,
    backgroundColor:   colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.cta,
    borderColor:     colors.cta,
  },
  chipText: {
    ...typography.small,
    color: colors.textMuted,
    fontFamily: 'Inter_500Medium',
  },
  chipTextActive: {
    color: colors.textOnDark,
  },

  // Legend
  legend: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.md,
    paddingVertical: spacing.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
  },
  legendDot: {
    width:        8,
    height:       8,
    borderRadius: 4,
  },
  legendText: {
    ...typography.small,
    color: colors.textMuted,
  },

  // Canvas
  canvasArea: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    ...typography.body,
    color: colors.cta,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },

  // Detail panel
  detailPanel: {
    height:          DETAIL_PANEL_HEIGHT,
    backgroundColor: colors.surface,
    borderTopWidth:  1,
    borderTopColor:  colors.border,
    paddingHorizontal: spacing.xl,
    paddingTop:      spacing.md,
    shadowColor:     colors.primary,
    shadowOffset:    { width: 0, height: -2 },
    shadowOpacity:   0.08,
    shadowRadius:    8,
    elevation:       8,
  },
  detailHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    marginBottom:   spacing.xs,
  },
  detailTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  detailSub: {
    ...typography.small,
    color: colors.textMuted,
    textTransform: 'capitalize',
  },
  detailHeaderRight: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  statusBadge: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical:  spacing.xs,
    borderRadius:    radius.xl,
  },
  statusDot: {
    width:        6,
    height:       6,
    borderRadius: 3,
  },
  statusText: {
    ...typography.small,
    fontFamily: 'Inter_500Medium',
  },
  closeBtn: {
    padding: spacing.xs,
  },
  detailMeta: {
    marginBottom: spacing.xs,
  },
  metaItem: {
    ...typography.small,
    color: colors.textSecondary,
  },
  metaKey: {
    color: colors.textMuted,
  },
  metaVal: {
    color: colors.textPrimary,
  },
  detailBody: {
    flex: 1,
  },

  // Reservation card in panel
  resCard: {
    backgroundColor: colors.surfaceWarm,
    borderRadius:    radius.md,
    borderWidth:     1,
    borderColor:     colors.borderLight,
    padding:         spacing.md,
    gap:             spacing.xs,
  },
  resRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
  },
  resText: {
    ...typography.small,
    color: colors.textPrimary,
  },
  resHint: {
    ...typography.small,
    color: colors.textMuted,
  },
  viewResBtn: {
    marginTop:       spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius:    radius.sm,
    backgroundColor: colors.border,
    alignItems:      'center',
    opacity:         0.5,
  },
  viewResBtnText: {
    ...typography.small,
    color: colors.textMuted,
    fontFamily: 'Inter_500Medium',
  },
  noRes: {
    ...typography.small,
    color: colors.textMuted,
    fontStyle: 'italic',
    paddingVertical: spacing.sm,
  },

  // Success banner in detail panel
  successBanner: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.xs,
    backgroundColor: colors.statusFreeLight,
    borderRadius:    radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    marginBottom:    spacing.sm,
    borderWidth:     1,
    borderColor:     colors.statusFree,
  },
  successText: {
    ...typography.small,
    color:      colors.statusFree,
    fontFamily: 'Inter_500Medium',
    flex:       1,
  },

  // Add reservation CTA
  addResBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing.sm,
    backgroundColor: colors.cta,
    borderRadius:    radius.md,
    paddingVertical: spacing.sm,
    marginTop:       spacing.sm,
  },
  addResBtnText: {
    ...typography.bodyMedium,
    color: colors.textOnDark,
  },
  noDbHint: {
    ...typography.small,
    color:           colors.textMuted,
    fontStyle:       'italic',
    textAlign:       'center',
    marginTop:       spacing.sm,
  },

  // Modal
  modalSafe: {
    flex:            1,
    backgroundColor: colors.background,
  },
  modalHandle: {
    width:           40,
    height:          4,
    borderRadius:    2,
    backgroundColor: colors.border,
    alignSelf:       'center',
    marginTop:       spacing.sm,
    marginBottom:    spacing.sm,
  },
});

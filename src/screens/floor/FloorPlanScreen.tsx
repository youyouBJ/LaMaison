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
import { getReservationStatusLabel, getReservationStatusColors } from '../../utils/reservationStatus';
import DateSelector from '../../components/DateSelector';
import FloorCanvas from '../../components/FloorCanvas';
import CreateReservationForTableForm from '../../components/CreateReservationForTableForm';
import { useFloorPlan } from '../../hooks/useFloorPlan';
import type { FloorTableWithState, FloorPlanReservation, FloorServiceFilter } from '../../types/floor';
import { isBirthdayReservation, displayNotes } from '../../utils/reservationOccasion';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

// ─── Service filter chips ─────────────────────────────────────────────────────

const SERVICE_FILTERS: { key: FloorServiceFilter; label: string }[] = [
  { key: 'all',    label: 'Tous' },
  { key: 'lunch',  label: 'Déjeuner' },
  { key: 'dinner', label: 'Dîner' },
];

// ─── Legend ───────────────────────────────────────────────────────────────────

const LEGEND: { status: string; color: string; label: string }[] = [
  { status: 'free',        color: floorPlanColors.statusFree,        label: 'Libre' },
  { status: 'reserved',    color: floorPlanColors.statusReserved,    label: 'Réservée' },
  { status: 'occupied',    color: floorPlanColors.statusOccupied,    label: 'À table' },
  { status: 'unavailable', color: floorPlanColors.statusUnavailable, label: 'Indisponible' },
];

// ─── Action button ────────────────────────────────────────────────────────────

type ActionVariant = 'seat' | 'complete' | 'confirm' | 'noshow' | 'cancel';

const ACTION_COLORS: Record<ActionVariant, { bg: string; border: string; text: string }> = {
  seat:     { bg: colors.cta,             border: colors.cta,        text: colors.textOnDark },
  complete: { bg: colors.statusFreeLight, border: colors.statusFree, text: colors.statusFree },
  confirm:  { bg: colors.goldLight,       border: colors.gold,       text: colors.gold },
  noshow:   { bg: colors.surface,         border: colors.border,     text: colors.textMuted },
  cancel:   { bg: colors.ctaLight,        border: colors.cta,        text: colors.cta },
};

function ActionButton({
  label,
  variant,
  onPress,
}: {
  label: string;
  variant: ActionVariant;
  onPress: () => void;
}): React.JSX.Element {
  const { bg, border, text } = ACTION_COLORS[variant];
  return (
    <TouchableOpacity
      style={[styles.actionBtn, { backgroundColor: bg, borderColor: border }]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[styles.actionBtnText, { color: text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Guest label helper ───────────────────────────────────────────────────────

function guestLabel(res: FloorPlanReservation): string {
  if (res.guestName) return res.guestName;
  if (res.source === 'walkin') return 'Client de passage';
  return 'Client sans nom';
}

// ─── Detail panel height ──────────────────────────────────────────────────────

const DETAIL_PANEL_HEIGHT = 360;

// ─── Main screen ──────────────────────────────────────────────────────────────

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
    actionError,
    updatingReservationId,
    clearActionError,
    seatReservation,
    completeReservation,
    markNoShow,
    cancelReservation,
    updateReservationStatus,
  } = useFloorPlan();

  const [canvasLayout, setCanvasLayout] = useState<{ w: number; h: number } | null>(null);
  const [showForm, setShowForm]         = useState(false);
  const [successMsg, setSuccessMsg]     = useState<string | null>(null);
  const successTimeoutRef               = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSuccess = useCallback((msg: string) => {
    if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    setSuccessMsg(msg);
    successTimeoutRef.current = setTimeout(() => setSuccessMsg(null), 4000);
  }, []);

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setCanvasLayout({ w: width, h: height });
  };

  const handleClosePanel = useCallback(() => {
    setSelectedTable(null);
    setShowForm(false);
    setSuccessMsg(null);
    clearActionError();
  }, [setSelectedTable, clearActionError]);

  const handleTablePress = (table: FloorTableWithState) => {
    if (selectedTable?.id === table.id) {
      handleClosePanel();
    } else {
      setSelectedTable(table);
      setShowForm(false);
      setSuccessMsg(null);
      clearActionError();
    }
  };

  const handleFormSuccess = useCallback((_reservationId: string) => {
    setShowForm(false);
    refresh();
    showSuccess('Réservation créée avec succès.');
  }, [refresh, showSuccess]);

  // ── Service action handlers ───────────────────────────────────────────────

  const handleSeat = useCallback(async (reservationId: string) => {
    const ok = await seatReservation(reservationId);
    if (ok) showSuccess('Réservation mise à table.');
  }, [seatReservation, showSuccess]);

  const handleComplete = useCallback(async (reservationId: string) => {
    const ok = await completeReservation(reservationId);
    if (ok) showSuccess('Réservation terminée.');
  }, [completeReservation, showSuccess]);

  const handleNoShow = useCallback(async (reservationId: string) => {
    const ok = await markNoShow(reservationId);
    if (ok) showSuccess('No-show enregistré.');
  }, [markNoShow, showSuccess]);

  const handleCancel = useCallback(async (reservationId: string) => {
    const ok = await cancelReservation(reservationId);
    if (ok) showSuccess('Réservation annulée.');
  }, [cancelReservation, showSuccess]);

  const handleConfirm = useCallback(async (reservationId: string) => {
    const ok = await updateReservationStatus(reservationId, 'confirmed');
    if (ok) showSuccess('Réservation confirmée.');
  }, [updateReservationStatus, showSuccess]);

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

      {/* ── Controls ──────────────────────────────────────────────────────── */}
      <View style={styles.controls}>
        <DateSelector
          value={selectedDate}
          onChange={setSelectedDate}
          showQuickActions
        />
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
        <View style={styles.legend}>
          {LEGEND.map(({ status, color, label }) => (
            <View key={status} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: color }]} />
              <Text style={styles.legendText}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Canvas ────────────────────────────────────────────────────────── */}
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

      {/* ── Detail panel ──────────────────────────────────────────────────── */}
      {selectedTable ? (
        <TableDetailPanel
          table={selectedTable}
          successMsg={successMsg}
          actionError={actionError}
          updatingReservationId={updatingReservationId}
          onClose={handleClosePanel}
          onAddReservation={() => setShowForm(true)}
          onSeat={(id) => { void handleSeat(id); }}
          onComplete={(id) => { void handleComplete(id); }}
          onConfirm={(id) => { void handleConfirm(id); }}
          onNoShow={(id) => { void handleNoShow(id); }}
          onCancel={(id) => { void handleCancel(id); }}
        />
      ) : null}

    </SafeAreaView>

    {/* ── Form modal ────────────────────────────────────────────────────── */}
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

// ─── Table detail panel ───────────────────────────────────────────────────────

function TableDetailPanel({
  table,
  successMsg,
  actionError,
  updatingReservationId,
  onClose,
  onAddReservation,
  onSeat,
  onComplete,
  onConfirm,
  onNoShow,
  onCancel,
}: {
  table: FloorTableWithState;
  successMsg: string | null;
  actionError: string | null;
  updatingReservationId: string | null;
  onClose: () => void;
  onAddReservation: () => void;
  onSeat: (id: string) => void;
  onComplete: (id: string) => void;
  onConfirm: (id: string) => void;
  onNoShow: (id: string) => void;
  onCancel: (id: string) => void;
}): React.JSX.Element {
  const STATUS_LABEL: Record<string, string> = {
    free:        'Libre',
    reserved:    'Réservée',
    occupied:    'À table',
    unavailable: 'Indisponible',
  };
  const STATUS_COLOR: Record<string, string> = {
    free:        colors.statusFree,
    reserved:    colors.statusReserved,
    occupied:    colors.statusOccupied,
    unavailable: colors.statusUnavailable,
  };

  const statusColor = STATUS_COLOR[table.computedStatus] ?? colors.textMuted;

  return (
    <View style={styles.detailPanel}>

      {/* Header */}
      <View style={styles.detailHeader}>
        <View style={styles.detailHeaderLeft}>
          <Text style={styles.detailTitle}>Table {table.id}</Text>
          <Text style={styles.detailSub}>
            {table.zone.replace(/_/g, ' ')} · {table.capacity} couvert{table.capacity > 1 ? 's' : ''}
          </Text>
        </View>
        <View style={styles.detailHeaderRight}>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {STATUS_LABEL[table.computedStatus] ?? table.computedStatus}
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

      {/* Scrollable body */}
      <ScrollView
        style={styles.detailBody}
        contentContainerStyle={styles.detailBodyContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Success banner */}
        {successMsg ? (
          <View style={styles.successBanner}>
            <Ionicons name={'checkmark-circle-outline' as IoniconsName} size={15} color={colors.statusFree} />
            <Text style={styles.successText}>{successMsg}</Text>
          </View>
        ) : null}

        {/* Error banner */}
        {actionError ? (
          <View style={styles.errorBanner}>
            <Ionicons name={'alert-circle-outline' as IoniconsName} size={15} color={colors.cta} />
            <Text style={styles.errorBannerText}>{actionError}</Text>
          </View>
        ) : null}

        {/* Reservation list */}
        {table.reservations.length === 0 ? (
          <Text style={styles.noRes}>Aucune réservation assignée</Text>
        ) : (
          table.reservations.map((res) => {
            const isUpdating  = updatingReservationId === res.id;
            const { backgroundColor: pillBg, color: pillText } = getReservationStatusColors(res.status);
            const resBirthday = isBirthdayReservation(res.notes);
            const resNotes    = displayNotes(res.notes);

            return (
              <View key={res.id} style={styles.resCard}>

                {/* Top row: time chip + info block + status pill */}
                <View style={styles.resHeaderRow}>
                  <View style={styles.resTimeChip}>
                    <Text style={styles.resTimeText}>{res.timeSlot.substring(0, 5)}</Text>
                  </View>
                  <View style={styles.resInfoBlock}>
                    <Text style={styles.resGuestName} numberOfLines={1}>
                      {guestLabel(res)}
                    </Text>
                    <Text style={styles.resMeta} numberOfLines={1}>
                      {res.partySize} couvert{res.partySize > 1 ? 's' : ''}
                      {res.tableLabels.length > 1 ? ` · Tables ${res.tableLabels.join(', ')}` : ''}
                      {res.shiftName ? ` · ${res.shiftName}` : ''}
                    </Text>
                    {resBirthday ? (
                      <View style={styles.birthdayBadge}>
                        <Text style={styles.birthdayBadgeText}>Anniversaire</Text>
                      </View>
                    ) : null}
                    {resNotes ? (
                      <Text style={styles.resNotes} numberOfLines={2}>{resNotes}</Text>
                    ) : null}
                  </View>
                  <View style={[styles.resPill, { backgroundColor: pillBg }]}>
                    <Text style={[styles.resPillText, { color: pillText }]}>
                      {getReservationStatusLabel(res.status)}
                    </Text>
                  </View>
                </View>

                {/* Actions */}
                {isUpdating ? (
                  <View style={styles.updatingRow}>
                    <ActivityIndicator size="small" color={colors.gold} />
                    <Text style={styles.updatingText}>Mise à jour…</Text>
                  </View>
                ) : (
                  <View style={styles.actionsRow}>
                    {res.status === 'pending' && (
                      <ActionButton label="Confirmer" variant="confirm" onPress={() => onConfirm(res.id)} />
                    )}
                    {(res.status === 'pending' || res.status === 'confirmed') && (
                      <ActionButton label="À table" variant="seat" onPress={() => onSeat(res.id)} />
                    )}
                    {res.status === 'seated' && (
                      <ActionButton label="Terminer" variant="complete" onPress={() => onComplete(res.id)} />
                    )}
                    {(res.status === 'pending' || res.status === 'confirmed') && (
                      <ActionButton label="No-show" variant="noshow" onPress={() => onNoShow(res.id)} />
                    )}
                    {(res.status === 'pending' || res.status === 'confirmed' || res.status === 'seated') && (
                      <ActionButton label="Annuler" variant="cancel" onPress={() => onCancel(res.id)} />
                    )}
                  </View>
                )}

              </View>
            );
          })
        )}
      </ScrollView>

      {/* Footer CTA */}
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
  safe: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop:        spacing.md,
    paddingBottom:     spacing.sm,
  },
  title: { ...typography.h1, color: colors.textPrimary },
  refreshBtn: {
    padding:         spacing.sm,
    borderRadius:    radius.sm,
    backgroundColor: colors.surface,
    borderWidth:     1,
    borderColor:     colors.border,
  },

  // Controls
  controls: {
    paddingHorizontal: spacing.xl,
    paddingBottom:     spacing.sm,
  },
  chipRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.xs,
    borderRadius:      radius.xl,
    backgroundColor:   colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.cta, borderColor: colors.cta },
  chipText: { ...typography.small, color: colors.textMuted, fontFamily: 'Inter_500Medium' },
  chipTextActive: { color: colors.textOnDark },

  // Legend
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, paddingVertical: spacing.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { ...typography.small, color: colors.textMuted },

  // Canvas
  canvasArea: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { ...typography.body, color: colors.cta, textAlign: 'center', paddingHorizontal: spacing.xl },

  // ── Detail panel ────────────────────────────────────────────────────────────
  detailPanel: {
    height:            DETAIL_PANEL_HEIGHT,
    backgroundColor:   colors.surface,
    borderTopWidth:    1,
    borderTopColor:    colors.border,
    paddingHorizontal: spacing.xl,
    paddingTop:        spacing.md,
    paddingBottom:     spacing.sm,
    shadowColor:       colors.primary,
    shadowOffset:      { width: 0, height: -2 },
    shadowOpacity:     0.08,
    shadowRadius:      8,
    elevation:         8,
  },
  detailHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    marginBottom:   spacing.sm,
  },
  detailHeaderLeft: { flex: 1 },
  detailTitle: { ...typography.h2, color: colors.textPrimary },
  detailSub: { ...typography.small, color: colors.textMuted, textTransform: 'capitalize' },
  detailHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusBadge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs,
    borderRadius:      radius.xl,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { ...typography.small, fontFamily: 'Inter_500Medium' },
  closeBtn: { padding: spacing.xs },

  // Scrollable body
  detailBody: { flex: 1 },
  detailBodyContent: { paddingBottom: spacing.xs },

  // No reservation
  noRes: { ...typography.small, color: colors.textMuted, fontStyle: 'italic', paddingVertical: spacing.sm },

  // Reservation card
  resCard: {
    backgroundColor: colors.surfaceWarm,
    borderRadius:    radius.md,
    borderWidth:     1,
    borderColor:     colors.borderLight,
    padding:         spacing.md,
    marginBottom:    spacing.sm,
  },
  resHeaderRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           spacing.sm,
    marginBottom:  spacing.sm,
  },
  resTimeChip: {
    backgroundColor: colors.goldLight,
    borderRadius:    radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs,
    minWidth:        46,
    alignItems:      'center',
    flexShrink:      0,
  },
  resTimeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize:   typography.small.fontSize,
    color:      colors.gold,
  },
  resInfoBlock: { flex: 1 },
  resGuestName: { ...typography.bodyMedium, color: colors.textPrimary, marginBottom: 2 },
  resMeta: { ...typography.small, color: colors.textMuted },
  resNotes: { ...typography.small, color: colors.textMuted, fontStyle: 'italic', marginTop: 2 },
  birthdayBadge: {
    backgroundColor: colors.goldLight,
    borderRadius:    radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   2,
    borderWidth:     1,
    borderColor:     colors.gold,
    alignSelf:       'flex-start',
    marginTop:       2,
  },
  birthdayBadgeText: { ...typography.label, color: colors.gold },
  resPill: {
    borderRadius:      radius.xl,
    paddingHorizontal: spacing.sm,
    paddingVertical:   2,
    flexShrink:        0,
    alignSelf:         'flex-start',
  },
  resPillText: { ...typography.label },

  // Action buttons row
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  actionBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical:   6,
    borderRadius:      radius.xl,
    borderWidth:       1,
  },
  actionBtnText: { ...typography.small, fontFamily: 'Inter_500Medium' },

  // Updating spinner row
  updatingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  updatingText: { ...typography.small, color: colors.textMuted },

  // Success banner
  successBanner: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.xs,
    backgroundColor:   colors.statusFreeLight,
    borderRadius:      radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    marginBottom:      spacing.sm,
    borderWidth:       1,
    borderColor:       colors.statusFree,
  },
  successText: { ...typography.small, color: colors.statusFree, fontFamily: 'Inter_500Medium', flex: 1 },

  // Error banner
  errorBanner: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.xs,
    backgroundColor:   colors.ctaLight,
    borderRadius:      radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    marginBottom:      spacing.sm,
    borderWidth:       1,
    borderColor:       colors.cta,
  },
  errorBannerText: { ...typography.small, color: colors.cta, fontFamily: 'Inter_500Medium', flex: 1 },

  // Add reservation CTA
  addResBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing.sm,
    backgroundColor: colors.cta,
    borderRadius:    radius.md,
    paddingVertical: spacing.sm,
    marginTop:       spacing.xs,
  },
  addResBtnText: { ...typography.bodyMedium, color: colors.textOnDark },
  noDbHint: {
    ...typography.small,
    color:     colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  // Modal
  modalSafe: { flex: 1, backgroundColor: colors.background },
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

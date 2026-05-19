import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, typography, spacing, radius, layout } from '../../theme';
import { useReservationDetail } from '../../hooks/useReservationDetail';
import { formatReadableDate, formatTimeSlot } from '../../utils/date';
import { getReservationStatusLabel, getReservationStatusColors } from '../../utils/reservationStatus';
import StatusBadge from '../../components/StatusBadge';
import SectionCard from '../../components/SectionCard';
import PrimaryButton from '../../components/PrimaryButton';
import type { ReservationsStackParamList } from '../../navigation/ReservationsNavigator';
import type { ReservationStatus } from '../../types/database';
import { formatReservationTables } from '../../utils/reservationTables';
import { reservationNeedsPhoneConfirmation } from '../../utils/reservationConfirmation';
import { isBirthdayReservation, displayNotes } from '../../utils/reservationOccasion';

type Props = NativeStackScreenProps<ReservationsStackParamList, 'ReservationDetail'>;

type ActionDef = { status: ReservationStatus; label: string; variant: 'primary' | 'secondary' | 'danger' };

// Actions contextuelles principales (flux normal)
const STATUS_ACTIONS: Record<ReservationStatus, ActionDef[]> = {
  pending: [
    { status: 'confirmed', label: 'Confirmer',      variant: 'primary'   },
    { status: 'seated',    label: 'Mettre à table', variant: 'secondary' },
    { status: 'noshow',    label: 'No-show',         variant: 'secondary' },
    { status: 'cancelled', label: 'Annuler',         variant: 'danger'    },
  ],
  confirmed: [
    { status: 'seated',    label: 'À table',         variant: 'primary'   },
    { status: 'noshow',    label: 'No-show',          variant: 'secondary' },
    { status: 'cancelled', label: 'Annuler',          variant: 'danger'    },
  ],
  seated: [
    { status: 'completed', label: 'Terminer',         variant: 'primary'   },
    { status: 'cancelled', label: 'Annuler',          variant: 'danger'    },
  ],
  completed: [],
  cancelled: [],
  noshow:    [],
};

// Labels courts pour la section correction
const CORRECTION_LABEL: Record<ReservationStatus, string> = {
  pending:   'En attente',
  confirmed: 'Confirmée',
  seated:    'À table',
  completed: 'Terminée',
  cancelled: 'Annulée',
  noshow:    'No-show',
};

// Couleurs chips correction (fond + texte)
const CORRECTION_COLORS: Record<ReservationStatus, { bg: string; text: string; border: string }> = {
  pending:   { bg: colors.sandLight,               text: colors.textSecondary,    border: colors.sand },
  confirmed: { bg: colors.goldLight,               text: colors.gold,             border: colors.gold },
  seated:    { bg: colors.statusOccupiedLight,     text: colors.statusOccupied,   border: colors.statusOccupied },
  completed: { bg: colors.statusFreeLight,         text: colors.statusFree,       border: colors.statusFree },
  cancelled: { bg: colors.statusUnavailableLight,  text: colors.statusUnavailable, border: colors.statusUnavailable },
  noshow:    { bg: colors.ctaLight,                text: colors.cta,              border: colors.cta },
};

const ALL_STATUSES: ReservationStatus[] = [
  'pending', 'confirmed', 'seated', 'completed', 'cancelled', 'noshow',
];

function guestName(r: NonNullable<ReturnType<typeof useReservationDetail>['reservation']>): string {
  if (!r.guests) return r.source === 'walkin' ? 'Client de passage' : 'Client sans nom';
  const parts = [r.guests.first_name, r.guests.last_name].filter((p): p is string => Boolean(p));
  return parts.length > 0 ? parts.join(' ') : 'Client sans nom';
}

export default function ReservationDetailScreen({ route }: Props): React.JSX.Element {
  const { reservationId } = route.params;
  const { loading, updating, error, reservation, refresh, updateStatus, confirmByPhone } =
    useReservationDetail(reservationId);

  const [correctionOpen, setCorrectionOpen] = useState(false);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} size="large" />
          <Text style={styles.loadingText}>Chargement…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !reservation) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.centered}>
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Réservation introuvable</Text>
            <Text style={styles.errorMessage}>{error ?? 'Aucune donnée disponible.'}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={refresh}>
              <Text style={styles.retryText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const r = reservation;
  const actions = STATUS_ACTIONS[r.status] ?? [];
  const { backgroundColor: statusBg, color: statusColor } = getReservationStatusColors(r.status);
  const isVip        = r.guests?.vip === true;
  const isBirthday   = isBirthdayReservation(r.notes);
  const cleanNotes   = displayNotes(r.notes);
  const isTerminal   = actions.length === 0;
  const needsPhoneConfirmation = reservationNeedsPhoneConfirmation(r);

  const dateLabel = (() => {
    try {
      return formatReadableDate(new Date(`${r.date}T12:00:00`));
    } catch {
      return r.date;
    }
  })();

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>

          {/* ── En-tête réservation ── */}
          <View style={styles.resHeader}>
            <View style={styles.resHeaderTime}>
              <View style={styles.timeChip}>
                <Text style={styles.timeText}>{formatTimeSlot(r.time_slot)}</Text>
              </View>
              <View>
                <Text style={styles.resDate}>{dateLabel}</Text>
                {r.shifts?.name ? (
                  <Text style={styles.resShift}>{r.shifts.name}</Text>
                ) : null}
              </View>
            </View>
            <View style={[styles.statusPill, { backgroundColor: statusBg }]}>
              <Text style={[styles.statusPillText, { color: statusColor }]}>
                {getReservationStatusLabel(r.status)}
              </Text>
            </View>
          </View>

          {/* ── Client ── */}
          <SectionCard title="Client">
            <View style={styles.guestRow}>
              <View style={styles.guestInfo}>
                <Text style={styles.guestName}>{guestName(r)}</Text>
                {r.guests?.phone ? (
                  <Text style={styles.guestMeta}>{r.guests.phone}</Text>
                ) : null}
                {r.guests?.email ? (
                  <Text style={styles.guestMeta}>{r.guests.email}</Text>
                ) : null}
              </View>
              {isVip && (
                <View style={styles.vipBadge}>
                  <Text style={styles.vipText}>VIP</Text>
                </View>
              )}
            </View>
          </SectionCard>

          {/* ── Détails réservation ── */}
          <SectionCard title="Réservation">
            <View style={styles.detailGrid}>
              <DetailRow label="Couverts" value={`${r.party_size} personne${r.party_size > 1 ? 's' : ''}`} />
              <DetailRow label="Table" value={formatReservationTables(r.tables, r.reservation_tables)} />
              <DetailRow label="Statut" value={<StatusBadge status={r.status} />} />
              <DetailRow label="Origine" value={r.source} />
              {isBirthday ? (
                <DetailRow label="Occasion" value={
                  <View style={styles.birthdayBadge}>
                    <Text style={styles.birthdayText}>Anniversaire</Text>
                  </View>
                } />
              ) : null}
              {cleanNotes ? <DetailRow label="Notes" value={cleanNotes} /> : null}
            </View>
          </SectionCard>

          {/* ── Confirmation téléphonique ── */}
          {needsPhoneConfirmation && (
            <SectionCard title="Confirmation téléphonique">
              {updating && (
                <View style={styles.updatingRow}>
                  <ActivityIndicator color={colors.gold} size="small" />
                  <Text style={styles.updatingText}>Mise à jour…</Text>
                </View>
              )}
              <PrimaryButton
                label="Confirmé par téléphone"
                onPress={() => { void confirmByPhone(); }}
                loading={false}
                disabled={updating}
                variant="secondary"
              />
            </SectionCard>
          )}

          {/* ── Actions ── */}
          {actions.length > 0 && (
            <SectionCard title="Actions">
              {updating && (
                <View style={styles.updatingRow}>
                  <ActivityIndicator color={colors.gold} size="small" />
                  <Text style={styles.updatingText}>Mise à jour…</Text>
                </View>
              )}
              <View style={styles.actionsGrid}>
                {actions.map((action) => (
                  <View key={action.status} style={styles.actionBtnWrapper}>
                    <PrimaryButton
                      label={action.label}
                      onPress={() => { void updateStatus(action.status); }}
                      loading={false}
                      disabled={updating}
                      variant={action.variant}
                    />
                  </View>
                ))}
              </View>
            </SectionCard>
          )}

          {/* ── Correction du statut ── */}
          <SectionCard title="Correction du statut">
            {isTerminal && !correctionOpen ? (
              <TouchableOpacity
                style={styles.correctionToggle}
                onPress={() => setCorrectionOpen(true)}
                activeOpacity={0.75}
              >
                <Text style={styles.correctionToggleText}>Modifier le statut…</Text>
              </TouchableOpacity>
            ) : null}

            {(correctionOpen || !isTerminal) ? (
              <>
                {updating && (
                  <View style={styles.updatingRow}>
                    <ActivityIndicator color={colors.gold} size="small" />
                    <Text style={styles.updatingText}>Mise à jour…</Text>
                  </View>
                )}
                <View style={styles.correctionGrid}>
                  {ALL_STATUSES.map((s) => {
                    const isCurrent = s === r.status;
                    const { bg, text, border } = CORRECTION_COLORS[s];
                    return (
                      <TouchableOpacity
                        key={s}
                        style={[
                          styles.correctionChip,
                          { backgroundColor: bg, borderColor: border },
                          isCurrent && styles.correctionChipCurrent,
                        ]}
                        onPress={() => { if (!isCurrent) void updateStatus(s); }}
                        disabled={isCurrent || updating}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.correctionChipText, { color: text }, isCurrent && styles.correctionChipTextCurrent]}>
                          {CORRECTION_LABEL[s]}
                          {isCurrent ? ' ✓' : ''}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {isTerminal ? (
                  <TouchableOpacity
                    style={styles.correctionClose}
                    onPress={() => setCorrectionOpen(false)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.correctionCloseText}>Fermer</Text>
                  </TouchableOpacity>
                ) : null}
              </>
            ) : null}
          </SectionCard>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | React.ReactNode;
}): React.JSX.Element {
  return (
    <View style={detailStyles.row}>
      <Text style={detailStyles.label}>{label}</Text>
      {typeof value === 'string' ? (
        <Text style={detailStyles.value}>{value}</Text>
      ) : (
        <View>{value}</View>
      )}
    </View>
  );
}

const detailStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  label: { ...typography.small, color: colors.textMuted },
  value: { ...typography.bodyMedium, color: colors.textPrimary, textAlign: 'right', flex: 1, marginLeft: spacing.md },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xxl },
  container: {
    padding: spacing.xl,
    maxWidth: layout.contentMaxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: { ...typography.body, color: colors.textMuted, marginTop: spacing.md, textAlign: 'center' },

  // Error
  errorCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  errorTitle: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.sm },
  errorMessage: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xl },
  retryButton: {
    backgroundColor: colors.cta,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  retryText: { ...typography.bodyMedium, color: colors.textOnDark },

  // Reservation header
  resHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  resHeaderTime: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  timeChip: {
    backgroundColor: colors.goldLight,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  timeText: {
    fontFamily: typography.stat.fontFamily,
    fontSize: typography.h2.fontSize,
    color: colors.gold,
  },
  resDate: { ...typography.bodyMedium, color: colors.textPrimary },
  resShift: { ...typography.small, color: colors.textMuted },
  statusPill: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  statusPillText: { ...typography.label },

  // Guest
  guestRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  guestInfo: { flex: 1, gap: spacing.xs },
  guestName: { ...typography.bodyMedium, color: colors.textPrimary },
  guestMeta: { ...typography.small, color: colors.textMuted },
  vipBadge: {
    backgroundColor: colors.goldLight,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  vipText: { ...typography.label, color: colors.gold },
  birthdayBadge: {
    backgroundColor: colors.goldLight,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  birthdayText: { ...typography.label, color: colors.gold },

  // Detail grid
  detailGrid: { gap: 0 },

  // Actions
  updatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  updatingText: { ...typography.small, color: colors.textMuted },
  actionsGrid: { gap: spacing.sm },
  actionBtnWrapper: {},

  // Correction section
  correctionToggle: {
    paddingVertical: spacing.sm,
    alignSelf: 'flex-start',
  },
  correctionToggleText: {
    ...typography.small,
    color: colors.gold,
    fontFamily: typography.bodyMedium.fontFamily,
  },
  correctionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  correctionChip: {
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
  },
  correctionChipCurrent: {
    opacity: 1,
    borderWidth: 2,
  },
  correctionChipText: {
    ...typography.small,
    fontFamily: typography.bodyMedium.fontFamily,
  },
  correctionChipTextCurrent: {
    fontFamily: typography.h2.fontFamily,
  },
  correctionClose: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
  },
  correctionCloseText: {
    ...typography.small,
    color: colors.textMuted,
  },
});

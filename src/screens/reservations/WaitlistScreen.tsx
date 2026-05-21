import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radius, layout } from '../../theme';
import { useWaitlist } from '../../hooks/useWaitlist';
import { FilterChip } from '../../components/FilterChip';
import DateSelector from '../../components/DateSelector';
import CreateWaitlistEntryForm from '../../components/CreateWaitlistEntryForm';
import VipBadge from '../../components/VipBadge';
import {
  getWaitlistStatusLabel,
  getWaitlistStatusColors,
} from '../../utils/waitlistStatus';
import type { ReservationsStackParamList } from '../../navigation/ReservationsNavigator';
import type { WaitlistEntryWithGuest, WaitlistServiceFilter } from '../../types/waitlist';
import {
  openWhatsAppMessage,
  normalizePhoneForWhatsApp,
  buildWaitlistReadyMessage,
} from '../../utils/whatsapp';
import { useI18n } from '../../i18n';

type Props = NativeStackScreenProps<ReservationsStackParamList, 'Waitlist'>;
type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

// ── Entry card ────────────────────────────────────────────────────────────────

type ConvertTargetStatus = 'confirmed' | 'seated';

type EntryCardProps = {
  entry:              WaitlistEntryWithGuest;
  actionLoadingId:    string | null;
  activeConvertId:    string | null;
  onNotify:           (id: string) => void;
  onSeat:             (id: string) => void;
  onLeft:             (id: string) => void;
  onWaiting:          (id: string) => void;
  onConvertRequest:   (id: string) => void;
  onConvertConfirm:   (id: string, targetStatus: ConvertTargetStatus) => Promise<void>;
  onConvertCancel:    () => void;
};

function EntryCard({
  entry,
  actionLoadingId,
  activeConvertId,
  onNotify,
  onSeat,
  onLeft,
  onWaiting,
  onConvertRequest,
  onConvertConfirm,
  onConvertCancel,
}: EntryCardProps): React.JSX.Element {
  const { t } = useI18n();
  const isLoading         = actionLoadingId === entry.id;
  const showConvertPicker = activeConvertId === entry.id;

  const [waFeedback, setWaFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const handleWhatsApp = () => {
    const phone   = entry.guests?.phone ?? null;
    const message = buildWaitlistReadyMessage();
    void openWhatsAppMessage(phone, message).then((opened) => {
      setWaFeedback(
        opened
          ? { ok: true, text: t('wl_wa_opened') }
          : {
              ok: false,
              text: normalizePhoneForWhatsApp(phone)
                ? t('wl_wa_cant_open')
                : t('wl_wa_invalid'),
            },
      );
      setTimeout(() => setWaFeedback(null), 4000);
    });
  };
  const { backgroundColor, color } = getWaitlistStatusColors(entry.status);
  const statusLabel = getWaitlistStatusLabel(entry.status);

  const guestName = entry.guests
    ? `${entry.guests.first_name ?? ''} ${entry.guests.last_name ?? ''}`.trim() ||
      entry.guests.phone ||
      t('wl_walkin')
    : t('wl_walkin');

  const timeDisplay = entry.time_slot ? entry.time_slot.substring(0, 5) : null;
  const shiftName   = entry.shifts?.name ?? null;

  // Toujours afficher des actions (correction possible sur tous les statuts)
  const showActions = !isLoading;

  return (
    <View style={styles.entryCard}>
      {/* ── Top row ── */}
      <View style={styles.entryTopRow}>
        <View style={styles.entryTimeBlock}>
          {timeDisplay ? <Text style={styles.entryTime}>{timeDisplay}</Text> : null}
          {shiftName ? <Text style={styles.entryShift}>{shiftName}</Text> : null}
        </View>
        <View style={[styles.entryBadge, { backgroundColor }]}>
          <Text style={[styles.entryBadgeText, { color }]}>{statusLabel}</Text>
        </View>
      </View>

      {/* ── Guest info ── */}
      <View style={styles.entryGuestRow}>
        <View style={styles.entryGuestInfo}>
          <View style={styles.entryNameRow}>
            <Text style={styles.entryGuestName}>{guestName}</Text>
            {entry.guests?.vip ? <VipBadge small /> : null}
          </View>
          {entry.guests?.phone ? (
            <Text style={styles.entryGuestSub}>{entry.guests.phone}</Text>
          ) : null}
        </View>
        <View style={styles.entryCoversBadge}>
          <Ionicons name={'people-outline' as IoniconsName} size={14} color={colors.textMuted} />
          <Text style={styles.entryCoversText}>{entry.party_size}</Text>
        </View>
      </View>

      {/* ── Notes ── */}
      {entry.notes ? (
        <Text style={styles.entryNotes} numberOfLines={2}>{entry.notes}</Text>
      ) : null}

      {/* ── WhatsApp feedback ── */}
      {waFeedback ? (
        <Text style={[styles.waFeedbackText, waFeedback.ok ? styles.waFeedbackOk : styles.waFeedbackErr]}>
          {waFeedback.text}
        </Text>
      ) : null}

      {/* ── Actions ── */}
      {isLoading ? (
        <View style={styles.entryLoadingRow}>
          <ActivityIndicator size="small" color={colors.gold} />
        </View>
      ) : showConvertPicker ? (
        /* ── Choix statut réservation ── */
        <View style={styles.convertPicker}>
          <Text style={styles.convertPickerLabel}>{t('wl_convert_title')}</Text>
          <View style={styles.convertPickerRow}>
            <TouchableOpacity
              style={styles.convertPickerBtnConfirmed}
              onPress={() => void onConvertConfirm(entry.id, 'confirmed')}
              activeOpacity={0.75}
            >
              <Text style={styles.convertPickerBtnConfirmedText}>{t('wl_convert_confirmed')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.convertPickerBtnSeated}
              onPress={() => void onConvertConfirm(entry.id, 'seated')}
              activeOpacity={0.75}
            >
              <Text style={styles.convertPickerBtnSeatedText}>{t('wl_convert_seated')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.convertPickerBtnCancel}
              onPress={onConvertCancel}
              activeOpacity={0.75}
            >
              <Ionicons name={'close' as IoniconsName} size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      ) : showActions ? (
        <View style={styles.entryActions}>
          {/* waiting : Prévenir / Installer / Parti / Convertir / WhatsApp */}
          {entry.status === 'waiting' ? (
            <>
              <ActionChip label={t('wl_action_notify')}   variant="notify"   onPress={() => onNotify(entry.id)} />
              <ActionChip label={t('wl_action_seat')}     variant="seat"     onPress={() => onSeat(entry.id)} />
              <ActionChip label={t('wl_action_left')}     variant="left"     onPress={() => onLeft(entry.id)} />
              <ActionChip label={t('wl_action_convert')}  variant="convert"  onPress={() => onConvertRequest(entry.id)} />
              {entry.guests?.phone ? (
                <ActionChip label={t('wl_action_whatsapp')} variant="whatsapp" onPress={handleWhatsApp} />
              ) : null}
            </>
          ) : null}
          {/* notified : Installer / Parti / Repasser en attente / Convertir / WhatsApp */}
          {entry.status === 'notified' ? (
            <>
              <ActionChip label={t('wl_action_seat')}     variant="seat"     onPress={() => onSeat(entry.id)} />
              <ActionChip label={t('wl_action_left')}     variant="left"     onPress={() => onLeft(entry.id)} />
              <ActionChip label={t('wl_action_waiting')}  variant="waiting"  onPress={() => onWaiting(entry.id)} />
              <ActionChip label={t('wl_action_convert')}  variant="convert"  onPress={() => onConvertRequest(entry.id)} />
              {entry.guests?.phone ? (
                <ActionChip label={t('wl_action_whatsapp')} variant="whatsapp" onPress={handleWhatsApp} />
              ) : null}
            </>
          ) : null}
          {/* seated : Parti / Repasser en attente */}
          {entry.status === 'seated' ? (
            <>
              <ActionChip label={t('wl_action_left')}    variant="left"    onPress={() => onLeft(entry.id)} />
              <ActionChip label={t('wl_action_waiting')} variant="waiting" onPress={() => onWaiting(entry.id)} />
            </>
          ) : null}
          {/* left : Repasser en attente */}
          {entry.status === 'left' ? (
            <ActionChip label={t('wl_action_waiting')} variant="waiting" onPress={() => onWaiting(entry.id)} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// ── ActionChip ────────────────────────────────────────────────────────────────

type ActionChipVariant = 'notify' | 'seat' | 'left' | 'waiting' | 'convert' | 'whatsapp';

const CHIP_STYLES: Record<ActionChipVariant, { bg: string; border: string; text: string }> = {
  notify:   { bg: colors.goldLight,             border: colors.gold,             text: colors.gold },
  seat:     { bg: colors.statusFreeLight,        border: colors.statusFree,       text: colors.statusFree },
  left:     { bg: colors.statusUnavailableLight, border: colors.statusUnavailable, text: colors.statusUnavailable },
  waiting:  { bg: colors.surface,               border: colors.border,           text: colors.textSecondary },
  convert:  { bg: colors.goldLight,             border: colors.gold,             text: colors.gold },
  whatsapp: { bg: colors.whatsapp,               border: colors.whatsapp,         text: colors.textOnDark },
};

function ActionChip({
  label,
  variant,
  onPress,
}: {
  label:   string;
  variant: ActionChipVariant;
  onPress: () => void;
}): React.JSX.Element {
  const { bg, border, text } = CHIP_STYLES[variant];
  return (
    <TouchableOpacity
      style={[styles.actionChip, { backgroundColor: bg, borderColor: border }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.actionChipText, { color: text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── StatPill ──────────────────────────────────────────────────────────────────

function StatPill({
  label,
  count,
  color,
  highlight = false,
}: {
  label:      string;
  count:      number;
  color:      string;
  highlight?: boolean;
}): React.JSX.Element {
  return (
    <View style={[styles.statPill, highlight && styles.statPillHighlight]}>
      <Text style={[styles.statPillCount, { color }, highlight && styles.statPillCountHighlight]}>
        {count}
      </Text>
      <Text style={[styles.statPillLabel, highlight && styles.statPillLabelHighlight]}>{label}</Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function WaitlistScreen({ navigation }: Props): React.JSX.Element {
  const { t } = useI18n();

  const SERVICE_OPTIONS: { key: WaitlistServiceFilter; label: string }[] = [
    { key: 'all',    label: t('wl_filter_all') },
    { key: 'lunch',  label: t('wl_filter_lunch') },
    { key: 'dinner', label: t('wl_filter_dinner') },
  ];

  const {
    loading,
    error,
    entries,
    allEntries,
    selectedDate,
    setSelectedDate,
    serviceFilter,
    setServiceFilter,
    shifts,
    refresh,
    createWaitlistEntry,
    markWaiting,
    markNotified,
    markSeated,
    markLeft,
    convertToReservation,
    searchGuests,
    guestSearchResults,
    searchLoading,
    actionLoadingId,
    actionError,
  } = useWaitlist();

  const [formVisible, setFormVisible]     = useState(false);
  const [submitting, setSubmitting]       = useState(false);
  const [formError, setFormError]         = useState<string | null>(null);
  const [convertError, setConvertError]   = useState<string | null>(null);
  const [activeConvertId, setActiveConvertId] = useState<string | null>(null);

  // ── Compteurs filtrés par date ET service (respectent le filtre actif) ───────

  const waitingCount  = entries.filter((e) => e.status === 'waiting').length;
  const notifiedCount = entries.filter((e) => e.status === 'notified').length;
  const seatedCount   = entries.filter((e) => e.status === 'seated').length;
  const leftCount     = entries.filter((e) => e.status === 'left').length;

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (input: Parameters<typeof createWaitlistEntry>[0]) => {
    setSubmitting(true);
    setFormError(null);
    try {
      await createWaitlistEntry(input);
      setFormVisible(false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConvertRequest = (id: string) => {
    setConvertError(null);
    setActiveConvertId(id);
  };

  const handleConvertConfirm = async (entryId: string, targetStatus: 'confirmed' | 'seated') => {
    setConvertError(null);
    try {
      const reservationId = await convertToReservation(entryId, targetStatus);
      setActiveConvertId(null);
      navigation.navigate('ReservationDetail', { reservationId });
    } catch (e) {
      setConvertError(e instanceof Error ? e.message : 'Erreur lors de la conversion');
      setActiveConvertId(null);
    }
  };

  const handleConvertCancel = () => setActiveConvertId(null);

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} size="large" />
          <Text style={styles.loadingText}>{t('wl_loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>{t('wl_error')}</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={refresh}>
              <Text style={styles.retryText}>{t('common_retry')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.gold} />
        }
      >
        <View style={styles.container}>

          {/* ── Header ── */}
          <View style={styles.headerRow}>
            <View>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => { navigation.goBack(); }}
                activeOpacity={0.7}
              >
                <Ionicons name={'chevron-back' as IoniconsName} size={16} color={colors.cta} />
                <Text style={styles.backButtonText}>{t('wl_back')}</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>{t('wl_title')}</Text>
            </View>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => { setFormError(null); setFormVisible(true); }}
              activeOpacity={0.8}
            >
              <Ionicons name={'add' as IoniconsName} size={18} color={colors.textOnDark} />
              <Text style={styles.addButtonText}>{t('wl_add')}</Text>
            </TouchableOpacity>
          </View>

          {/* ── Sélecteur de date ── */}
          <DateSelector value={selectedDate} onChange={setSelectedDate} showQuickActions />

          {/* ── Filtre service ── */}
          <View style={styles.serviceSection}>
            <Text style={styles.serviceSectionLabel}>{t('wl_service')}</Text>
            <View style={styles.serviceChips}>
              {SERVICE_OPTIONS.map(({ key, label }) => (
                <FilterChip
                  key={key}
                  label={label}
                  active={serviceFilter === key}
                  onPress={() => setServiceFilter(key)}
                />
              ))}
            </View>
          </View>

          {/* ── Compteurs ── */}
          <View style={styles.statsRow}>
            <StatPill label={t('wl_stat_waiting')}  count={waitingCount}  color={colors.gold}             highlight />
            <StatPill label={t('wl_stat_notified')} count={notifiedCount} color={colors.cta} />
            <StatPill label={t('wl_stat_seated')}   count={seatedCount}   color={colors.statusFree} />
            <StatPill label={t('wl_stat_left')}     count={leftCount}     color={colors.statusUnavailable} />
          </View>

          {/* ── Erreurs actions ── */}
          {(actionError ?? convertError) ? (
            <View style={styles.actionErrorCard}>
              <Text style={styles.actionErrorText}>{actionError ?? convertError}</Text>
            </View>
          ) : null}

          {/* ── Liste ── */}
          {entries.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name={'time-outline' as IoniconsName} size={32} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>{t('wl_no_entries')}</Text>
              <Text style={styles.emptySubtitle}>{t('wl_no_entries_sub')}</Text>
            </View>
          ) : (
            entries.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                actionLoadingId={actionLoadingId}
                activeConvertId={activeConvertId}
                onNotify={markNotified}
                onSeat={markSeated}
                onLeft={markLeft}
                onWaiting={markWaiting}
                onConvertRequest={handleConvertRequest}
                onConvertConfirm={handleConvertConfirm}
                onConvertCancel={handleConvertCancel}
              />
            ))
          )}

        </View>
      </ScrollView>

      {/* ── Modal formulaire ── */}
      <Modal
        visible={formVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setFormVisible(false)}
      >
        <CreateWaitlistEntryForm
          initialDate={selectedDate}
          shifts={shifts}
          guestSearchResults={guestSearchResults}
          searchLoading={searchLoading}
          submitting={submitting}
          error={formError}
          onSearchGuests={searchGuests}
          onSubmit={handleSubmit}
          onCancel={() => setFormVisible(false)}
        />
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

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
    flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl,
  },

  loadingText: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.md,
    textAlign: 'center',
  },

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
  errorTitle:   { ...typography.h2,        color: colors.textPrimary,   marginBottom: spacing.sm },
  errorMessage: { ...typography.body,      color: colors.textSecondary, marginBottom: spacing.xl },
  retryButton: {
    backgroundColor: colors.cta,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  retryText: { ...typography.bodyMedium, color: colors.textOnDark },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing.xl,
  },
  backButton: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
    marginBottom:  spacing.xs,
    alignSelf:     'flex-start',
  },
  backButtonText: {
    ...typography.label,
    color: colors.cta,
  },
  headerTitle: { ...typography.h1, color: colors.textPrimary },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cta,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  addButtonText: { ...typography.bodyMedium, color: colors.textOnDark },

  // Service filter
  serviceSection: { marginTop: spacing.md, marginBottom: spacing.md },
  serviceSectionLabel: { ...typography.label, color: colors.textMuted, marginBottom: spacing.sm },
  serviceChips: { flexDirection: 'row', gap: spacing.sm },

  // Stats
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  statPill: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  statPillCount: { ...typography.h2, marginBottom: 2 },
  statPillCountHighlight: { fontSize: 26 },
  statPillLabel: { ...typography.label, color: colors.textMuted, fontSize: 9 },
  statPillHighlight: {
    backgroundColor: colors.goldLight,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  statPillLabelHighlight: { color: colors.gold },

  // Action error
  actionErrorCard: {
    backgroundColor: colors.ctaLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  actionErrorText: { ...typography.small, color: colors.cta },

  // Empty
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  emptyTitle: { ...typography.bodyMedium, color: colors.textPrimary, textAlign: 'center' },
  emptySubtitle: { ...typography.small, color: colors.textMuted, textAlign: 'center' },

  // Entry card
  entryCard: {
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
  entryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  entryTimeBlock: { gap: 2 },
  entryTime:  { ...typography.h2,    color: colors.textPrimary },
  entryShift: { ...typography.label, color: colors.textMuted },
  entryBadge: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
  },
  entryBadgeText: { ...typography.label },
  entryGuestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  entryGuestInfo: { flex: 1 },
  entryNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  entryGuestName: { ...typography.bodyMedium, color: colors.textPrimary },
  entryGuestSub:  { ...typography.small, color: colors.textMuted },
  entryCoversBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  entryCoversText: { ...typography.bodyMedium, color: colors.textSecondary },
  entryNotes: { ...typography.small, color: colors.textMuted, marginBottom: spacing.sm, fontStyle: 'italic' },

  // WhatsApp feedback
  waFeedbackText: {
    ...typography.small,
    fontFamily: typography.bodyMedium.fontFamily,
    marginTop: spacing.xs,
  },
  waFeedbackOk:  { color: colors.statusFree },
  waFeedbackErr: { color: colors.cta },

  // Actions
  entryLoadingRow: {
    paddingTop: spacing.sm,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  entryActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  actionChip: {
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
  },
  actionChipText: {
    ...typography.small,
    fontFamily: typography.bodyMedium.fontFamily,
  },

  // Convert picker
  convertPicker: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  convertPickerLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  convertPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  convertPickerBtnConfirmed: {
    flex: 1,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.goldLight,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  convertPickerBtnConfirmedText: {
    ...typography.small,
    color: colors.gold,
    fontFamily: typography.bodyMedium.fontFamily,
  },
  convertPickerBtnSeated: {
    flex: 1,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.cta,
    borderWidth: 1,
    borderColor: colors.cta,
  },
  convertPickerBtnSeatedText: {
    ...typography.small,
    color: colors.textOnDark,
    fontFamily: typography.bodyMedium.fontFamily,
  },
  convertPickerBtnCancel: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
});

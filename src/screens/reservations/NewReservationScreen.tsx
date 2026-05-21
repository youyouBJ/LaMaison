import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, typography, spacing, radius, layout } from '../../theme';
import { useCreateReservation } from '../../hooks/useCreateReservation';
import { getTodayDateString } from '../../utils/date';
import { withBirthdayOccasion, withEventOccasion } from '../../utils/reservationOccasion';
import { isDateAllowedForShift, generateTimeSlots } from '../../utils/reservationSlots';
import SectionCard from '../../components/SectionCard';
import PrimaryButton from '../../components/PrimaryButton';
import VipBadge from '../../components/VipBadge';
import DateSelector from '../../components/DateSelector';
import CalendarPicker from '../../components/CalendarPicker';
import TimeSlotSelector from '../../components/TimeSlotSelector';
import TablePlanSelector from '../../components/TablePlanSelector';
import { useI18n } from '../../i18n';
import type { ReservationsStackParamList } from '../../navigation/ReservationsNavigator';
import type { GuestRow, TableRow } from '../../hooks/useCreateReservation';

type Props = NativeStackScreenProps<ReservationsStackParamList, 'NewReservation'>;

type FormState = {
  date: string;
  selectedShiftId: string;
  selectedTimeSlot: string;
  partySize: number;
  // Client
  isWalkIn: boolean;
  selectedGuest: GuestRow | null;
  guestSearchQuery: string;
  guestFirstName: string;
  guestLastName: string;
  guestPhone: string;
  guestEmail: string;
  guestVip: boolean;
  // Détails
  selectedTableIds: string[];
  status: 'confirmed' | 'pending';
  isBirthday: boolean;
  isEvent: boolean;
  notes: string;
};

const INITIAL_FORM: FormState = {
  date:              getTodayDateString(),
  selectedShiftId:   '',
  selectedTimeSlot:  '',
  partySize:         2,
  isWalkIn:          false,
  selectedGuest:     null,
  guestSearchQuery:  '',
  guestFirstName:    '',
  guestLastName:     '',
  guestPhone:        '',
  guestEmail:        '',
  guestVip:          false,
  selectedTableIds:  [],
  status:            'pending',
  isBirthday:        false,
  isEvent:           false,
  notes:             '',
};

export default function NewReservationScreen({ navigation }: Props): React.JSX.Element {
  const {
    loading,
    submitting,
    searchLoading,
    error,
    shifts,
    tables,
    guestSearchResults,
    searchGuests,
    createReservation,
    setError,
  } = useCreateReservation();

  const { t } = useI18n();
  const [form, setForm]                       = useState<FormState>(INITIAL_FORM);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showPlanSelector, setShowPlanSelector] = useState(false);

  const availableShifts = useMemo(
    () =>
      shifts
        .filter((s) => isDateAllowedForShift(form.date, s.days_of_week))
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [shifts, form.date],
  );

  const selectedShift = useMemo(
    () => shifts.find((s) => s.id === form.selectedShiftId) ?? null,
    [shifts, form.selectedShiftId],
  );

  const timeSlots = useMemo(
    () =>
      selectedShift
        ? generateTimeSlots(selectedShift.start_time, selectedShift.end_time, selectedShift.slot_duration)
        : [],
    [selectedShift],
  );

  const tablesByZone = useMemo(() => {
    const groups = new Map<string, TableRow[]>();
    for (const t of tables) {
      const zone = t.zone.trim() || 'Salle';
      const existing = groups.get(zone);
      if (existing !== undefined) {
        existing.push(t);
      } else {
        groups.set(zone, [t]);
      }
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'fr'))
      .map(([zone, items]) => ({ zone, items }));
  }, [tables]);

  const setDate = (d: string) =>
    setForm((prev) => ({ ...prev, date: d, selectedShiftId: '', selectedTimeSlot: '' }));

  const setShift = (id: string) =>
    setForm((prev) => ({ ...prev, selectedShiftId: id, selectedTimeSlot: '' }));

  const selectGuest = (g: GuestRow) =>
    setForm((prev) => ({
      ...prev,
      selectedGuest:  g,
      guestSearchQuery: '',
      guestFirstName: g.first_name ?? '',
      guestLastName:  g.last_name  ?? '',
      guestPhone:     g.phone      ?? '',
      guestEmail:     g.email      ?? '',
      guestVip:       g.vip,
    }));

  const clearGuest = () =>
    setForm((prev) => ({
      ...prev,
      selectedGuest:   null,
      guestFirstName:  '',
      guestLastName:   '',
      guestPhone:      '',
      guestEmail:      '',
      guestVip:        false,
    }));

  const handleClientType = (walkIn: boolean) =>
    setForm((prev) => ({
      ...prev,
      isWalkIn:        walkIn,
      selectedGuest:   null,
      guestSearchQuery: '',
      guestFirstName:  '',
      guestLastName:   '',
      guestPhone:      '',
      guestEmail:      '',
      guestVip:        false,
    }));

  const toggleTable = (tid: string) =>
    setForm((prev) => ({
      ...prev,
      selectedTableIds: prev.selectedTableIds.includes(tid)
        ? prev.selectedTableIds.filter((id) => id !== tid)
        : [...prev.selectedTableIds, tid],
    }));

  const handleSubmit = async () => {
    setValidationError(null);
    setError(null);

    if (!form.selectedShiftId) { setValidationError(t('new_res_err_no_service')); return; }
    if (!form.selectedTimeSlot) { setValidationError(t('new_res_err_no_slot')); return; }

    try {
      const firstName = form.guestFirstName.trim() || undefined;
      const lastName  = form.guestLastName.trim()  || undefined;
      const phone     = form.guestPhone.trim()     || undefined;
      const email     = form.guestEmail.trim()     || undefined;
      const hasAnyGuestInfo = Boolean(firstName ?? lastName ?? phone ?? email);

      let finalNotes = withEventOccasion(form.notes.trim() || null, form.isEvent);
      finalNotes = withBirthdayOccasion(finalNotes, form.isBirthday);

      const id = await createReservation({
        date:      form.date,
        timeSlot:  form.selectedTimeSlot,
        partySize: form.partySize,
        shiftId:   form.selectedShiftId,
        notes:     finalNotes ?? undefined,
        status:    form.status,
        tableIds:  form.selectedTableIds.length > 0 ? form.selectedTableIds : undefined,
        isWalkIn:  form.isWalkIn,
        guestId:   form.isWalkIn ? undefined : form.selectedGuest?.id,
        guest: form.isWalkIn || form.selectedGuest
          ? undefined
          : hasAnyGuestInfo
            ? { firstName, lastName, phone, email, vip: form.guestVip }
            : undefined,
      });
      navigation.replace('ReservationDetail', { reservationId: id });
    } catch (e) {
      setValidationError(e instanceof Error ? e.message : t('new_res_err_unknown'));
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} size="large" />
          <Text style={styles.loadingText}>{t('common_loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayError = validationError ?? error;

  return (
    <>
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            <Text style={styles.subtitle}>{t('new_res_subtitle')}</Text>

            {/* ── Date ── */}
            <DateSelector
              label={t('new_res_date')}
              value={form.date}
              onChange={setDate}
              showQuickActions
              allowManualInput
            />
            <CalendarPicker
              value={form.date}
              onChange={setDate}
            />

            {/* ── Service ── */}
            <SectionCard title={t('new_res_service')}>
              {availableShifts.length === 0 ? (
                <Text style={styles.infoText}>{t('new_res_no_service')}</Text>
              ) : (
                <View style={styles.shiftRow}>
                  {availableShifts.map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.shiftChip, form.selectedShiftId === s.id && styles.shiftChipActive]}
                      onPress={() => setShift(s.id)}
                    >
                      <Text style={[styles.shiftText, form.selectedShiftId === s.id && styles.shiftTextActive]}>
                        {s.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </SectionCard>

            {/* ── Créneau & Couverts ── */}
            {form.selectedShiftId ? (
              <SectionCard title={t('new_res_slot_covers')}>
                <TimeSlotSelector
                  slots={timeSlots}
                  value={form.selectedTimeSlot || undefined}
                  onChange={(slot) => setForm((prev) => ({ ...prev, selectedTimeSlot: slot }))}
                />

                <View style={styles.stepperRow}>
                  <Text style={styles.stepperLabel}>{t('new_res_covers')}</Text>
                  <View style={styles.stepper}>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => setForm((prev) => ({ ...prev, partySize: Math.max(1, prev.partySize - 1) }))}
                    >
                      <Text style={styles.stepBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.stepValue}>{form.partySize}</Text>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => setForm((prev) => ({ ...prev, partySize: Math.min(50, prev.partySize + 1) }))}
                    >
                      <Text style={styles.stepBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </SectionCard>
            ) : null}

            {/* ── Type de client ── */}
            <SectionCard title={t('new_res_client_type')}>
              <View style={styles.shiftRow}>
                <TouchableOpacity
                  style={[styles.shiftChip, !form.isWalkIn && styles.shiftChipActive]}
                  onPress={() => handleClientType(false)}
                >
                  <Text style={[styles.shiftText, !form.isWalkIn && styles.shiftTextActive]}>
                    {t('new_res_identified')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.shiftChip, form.isWalkIn && styles.shiftChipActive]}
                  onPress={() => handleClientType(true)}
                >
                  <Text style={[styles.shiftText, form.isWalkIn && styles.shiftTextActive]}>
                    {t('new_res_walkin')}
                  </Text>
                </TouchableOpacity>
              </View>
              {form.isWalkIn && (
                <Text style={styles.walkInHint}>
                  {t('new_res_walkin_hint')}
                </Text>
              )}
            </SectionCard>

            {/* ── Client ── */}
            {!form.isWalkIn && <SectionCard title={t('resd_section_guest')}>
              {form.selectedGuest ? (
                <View>
                  <View style={styles.selectedGuestCard}>
                    <View style={styles.selectedGuestInfo}>
                      <Text style={styles.selectedGuestName}>
                        {[form.selectedGuest.first_name, form.selectedGuest.last_name]
                          .filter(Boolean).join(' ') || t('new_res_guest_name')}
                      </Text>
                      <Text style={styles.selectedGuestPhone}>{form.selectedGuest.phone}</Text>
                      {form.selectedGuest.vip && <VipBadge small />}
                    </View>
                    <TouchableOpacity onPress={clearGuest}>
                      <Text style={styles.changeClient}>{t('new_res_change')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View>
                  {/* Recherche automatique */}
                  <View style={styles.searchRow}>
                    <TextInput
                      style={styles.searchInput}
                      placeholder={t('guests_search_placeholder')}
                      placeholderTextColor={colors.textMuted}
                      value={form.guestSearchQuery}
                      onChangeText={(t) => {
                        setForm((prev) => ({ ...prev, guestSearchQuery: t }));
                        searchGuests(t);
                      }}
                      returnKeyType="search"
                      autoCapitalize="none"
                    />
                    {searchLoading ? (
                      <ActivityIndicator color={colors.gold} size="small" />
                    ) : null}
                  </View>
                  {guestSearchResults.length > 0 ? (
                    <View style={styles.searchResults}>
                      {guestSearchResults.map((g) => (
                        <TouchableOpacity
                          key={g.id}
                          style={styles.searchResultItem}
                          onPress={() => selectGuest(g)}
                        >
                          <Text style={styles.resultName}>
                            {[g.first_name, g.last_name].filter(Boolean).join(' ') || t('new_res_guest_name')}
                          </Text>
                          <Text style={styles.resultPhone}>{g.phone}</Text>
                          {g.vip && <VipBadge small />}
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : !searchLoading && form.guestSearchQuery.trim().length >= 2 ? (
                    <Text style={styles.noResultsHint}>{t('guests_no_results')}</Text>
                  ) : null}

                  {/* Nouveau client */}
                  <Text style={styles.newClientLabel}>{t('new_res_new_client')}</Text>
                  <Text style={styles.guestHint}>{t('new_res_guest_hint')}</Text>
                  <View style={styles.formRow}>
                    <TextInput
                      style={[styles.input, styles.inputHalf]}
                      placeholder={t('new_res_first_name')}
                      placeholderTextColor={colors.textMuted}
                      value={form.guestFirstName}
                      onChangeText={(val) => setForm((prev) => ({ ...prev, guestFirstName: val }))}
                      autoCapitalize="words"
                    />
                    <TextInput
                      style={[styles.input, styles.inputHalf]}
                      placeholder={t('new_res_last_name')}
                      placeholderTextColor={colors.textMuted}
                      value={form.guestLastName}
                      onChangeText={(val) => setForm((prev) => ({ ...prev, guestLastName: val }))}
                      autoCapitalize="words"
                    />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder={t('new_res_phone')}
                    placeholderTextColor={colors.textMuted}
                    value={form.guestPhone}
                    onChangeText={(val) => setForm((prev) => ({ ...prev, guestPhone: val }))}
                    keyboardType="phone-pad"
                  />
                  <TextInput
                    style={styles.input}
                    placeholder={t('new_res_email')}
                    placeholderTextColor={colors.textMuted}
                    value={form.guestEmail}
                    onChangeText={(val) => setForm((prev) => ({ ...prev, guestEmail: val }))}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>{t('new_res_vip')}</Text>
                    <Switch
                      value={form.guestVip}
                      onValueChange={(v) => setForm((prev) => ({ ...prev, guestVip: v }))}
                      trackColor={{ false: colors.border, true: colors.goldLight }}
                      thumbColor={form.guestVip ? colors.gold : colors.sand}
                    />
                  </View>
                </View>
              )}
            </SectionCard>}

            {/* ── Occasion ── */}
            <SectionCard title={t('new_res_occasion')}>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>{t('new_res_birthday')}</Text>
                <Switch
                  value={form.isBirthday}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, isBirthday: v }))}
                  trackColor={{ false: colors.border, true: colors.goldLight }}
                  thumbColor={form.isBirthday ? colors.gold : colors.sand}
                />
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>{t('new_res_event')}</Text>
                <Switch
                  value={form.isEvent}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, isEvent: v }))}
                  trackColor={{ false: colors.border, true: colors.ctaLight }}
                  thumbColor={form.isEvent ? colors.cta : colors.sand}
                />
              </View>
            </SectionCard>

            {/* ── Table (optionnel) ── */}
            <SectionCard title={t('resd_table')}>
              <Text style={styles.tableHint}>{t('new_res_table_hint')}</Text>

              {/* Tables sélectionnées depuis le plan */}
              {form.selectedTableIds.length > 0 && (
                <View style={styles.selectedTablesList}>
                  {form.selectedTableIds.map((id) => {
                    const tbl = tables.find((tb) => tb.id === id);
                    if (!tbl) return null;
                    return (
                      <View key={id} style={styles.selectedTableChip}>
                        <Text style={styles.selectedTableChipText}>
                          Table {tbl.label} · {tbl.zone.replace(/_/g, ' ')}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Bouton plan de salle */}
              <TouchableOpacity
                style={styles.planBtn}
                onPress={() => setShowPlanSelector(true)}
                accessibilityRole="button"
              >
                <Text style={styles.planBtnText}>
                  {form.selectedTableIds.length > 0 ? t('new_res_edit_plan') : t('new_res_choose_plan')}
                </Text>
              </TouchableOpacity>

              {/* Sélecteur liste (maintenu) */}
              {form.selectedTableIds.length > 0 && (
                <TouchableOpacity
                  onPress={() => setForm((prev) => ({ ...prev, selectedTableIds: [] }))}
                >
                  <Text style={styles.clearTablesLink}>{t('new_res_clear_tables')}</Text>
                </TouchableOpacity>
              )}
              {tablesByZone.map(({ zone, items }) => (
                <View key={zone} style={styles.tableZoneGroup}>
                  <Text style={styles.tableZoneLabel}>{zone}</Text>
                  <View style={styles.tableChipRow}>
                    {items.map((tbl) => {
                      const isSelected = form.selectedTableIds.includes(tbl.id);
                      return (
                        <TouchableOpacity
                          key={tbl.id}
                          style={[styles.tableChip, isSelected && styles.tableChipActive]}
                          onPress={() => toggleTable(tbl.id)}
                        >
                          <Text style={[styles.tableChipText, isSelected && styles.tableChipTextActive]}>
                            {tbl.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
            </SectionCard>

            {/* ── Statut & Notes ── */}
            <SectionCard title={t('new_res_status_notes')}>
              <View style={styles.statusRow}>
                {(['confirmed', 'pending'] as const).map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.statusOption, form.status === s && styles.statusOptionActive]}
                    onPress={() => setForm((prev) => ({ ...prev, status: s }))}
                  >
                    <Text style={[styles.statusOptionText, form.status === s && styles.statusOptionTextActive]}>
                      {s === 'confirmed' ? t('status_confirmed') : t('status_pending')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder={t('new_res_notes')}
                placeholderTextColor={colors.textMuted}
                value={form.notes}
                onChangeText={(val) => setForm((prev) => ({ ...prev, notes: val }))}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </SectionCard>

            {/* ── Erreur ── */}
            {displayError ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{displayError}</Text>
              </View>
            ) : null}

            {/* ── Submit ── */}
            <PrimaryButton
              label={t('new_res_submit')}
              onPress={() => { void handleSubmit(); }}
              loading={submitting}
              disabled={submitting}
            />

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>

    {/* ── Plan selector modal ───────────────────────────────────────────── */}
    <Modal
      visible={showPlanSelector}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowPlanSelector(false)}
    >
      <TablePlanSelector
        dbTables={tables}
        selectedIds={form.selectedTableIds}
        onConfirm={(ids) => {
          setForm((prev) => ({ ...prev, selectedTableIds: ids }));
          setShowPlanSelector(false);
        }}
        onCancel={() => setShowPlanSelector(false)}
      />
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.xl },

  // Shifts
  shiftRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  shiftChip: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shiftChipActive: { backgroundColor: colors.ctaLight, borderColor: colors.cta },
  shiftText: { ...typography.bodyMedium, color: colors.textMuted },
  shiftTextActive: { color: colors.cta },

  // Walk-in hint
  walkInHint: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },

  // Plan selector button
  planBtn: {
    borderRadius:    radius.md,
    paddingVertical: spacing.md,
    alignItems:      'center',
    backgroundColor: colors.background,
    borderWidth:     1,
    borderColor:     colors.gold,
    marginBottom:    spacing.sm,
  },
  planBtnText: { ...typography.bodyMedium, color: colors.gold },

  // Selected tables from plan
  selectedTablesList: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.sm,
    marginBottom:  spacing.sm,
  },
  selectedTableChip: {
    borderRadius:      radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    backgroundColor:   colors.goldLight,
    borderWidth:       1,
    borderColor:       colors.gold,
  },
  selectedTableChipText: {
    ...typography.small,
    color:      colors.gold,
    fontFamily: typography.bodyMedium.fontFamily,
  },

  // Table picker
  tableHint: {
    ...typography.small,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    fontStyle: 'italic',
  },
  clearTablesLink: {
    ...typography.small,
    color: colors.cta,
    marginBottom: spacing.sm,
  },
  tableZoneGroup: {
    marginTop: spacing.sm,
  },
  tableZoneLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  tableChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tableChip: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tableChipActive: { backgroundColor: colors.ctaLight, borderColor: colors.cta },
  tableChipText: { ...typography.small, color: colors.textMuted },
  tableChipTextActive: { ...typography.small, color: colors.cta, fontFamily: typography.bodyMedium.fontFamily },

  // Stepper
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  stepperLabel: { ...typography.bodyMedium, color: colors.textPrimary },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  stepBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  stepBtnText: {
    fontFamily: typography.stat.fontFamily,
    fontSize: typography.h2.fontSize,
    color: colors.textPrimary,
  },
  stepValue: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    minWidth: 36,
    textAlign: 'center',
  },

  // Guest search
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  noResultsHint: {
    ...typography.small,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
  },
  searchResults: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  resultName: { ...typography.bodyMedium, color: colors.textPrimary, flex: 1 },
  resultPhone: { ...typography.small, color: colors.textMuted },

  // Selected guest
  selectedGuestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.goldLight,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  selectedGuestInfo: { flex: 1, gap: spacing.xs },
  selectedGuestName: { ...typography.bodyMedium, color: colors.textPrimary },
  selectedGuestPhone: { ...typography.small, color: colors.textMuted },
  changeClient: { ...typography.small, color: colors.cta, fontFamily: typography.bodyMedium.fontFamily },

  // New client form
  newClientLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  guestHint: {
    ...typography.small,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  formRow: { flexDirection: 'row', gap: spacing.sm },
  input: {
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  inputHalf: { flex: 1 },
  textArea: { minHeight: 80 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  switchLabel: { ...typography.body, color: colors.textPrimary },

  // Status
  statusRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statusOption: {
    flex: 1,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusOptionActive: { backgroundColor: colors.ctaLight, borderColor: colors.cta },
  statusOptionText: { ...typography.small, color: colors.textMuted, textAlign: 'center' },
  statusOptionTextActive: { color: colors.cta, fontFamily: typography.bodyMedium.fontFamily },

  // Info
  infoText: { ...typography.small, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.sm },

  // Error
  errorBanner: {
    backgroundColor: colors.ctaLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cta,
  },
  errorBannerText: { ...typography.small, color: colors.cta },
});

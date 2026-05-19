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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, typography, spacing, radius, layout } from '../../theme';
import { useCreateReservation } from '../../hooks/useCreateReservation';
import { getTodayDateString } from '../../utils/date';
import { withBirthdayOccasion } from '../../utils/reservationOccasion';
import { isDateAllowedForShift, generateTimeSlots } from '../../utils/reservationSlots';
import SectionCard from '../../components/SectionCard';
import PrimaryButton from '../../components/PrimaryButton';
import DateSelector from '../../components/DateSelector';
import CalendarPicker from '../../components/CalendarPicker';
import TimeSlotSelector from '../../components/TimeSlotSelector';
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
  status:            'confirmed',
  isBirthday:        false,
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

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [validationError, setValidationError] = useState<string | null>(null);

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

  const handleSearch = () => {
    void searchGuests(form.guestSearchQuery);
  };

  const handleSubmit = async () => {
    setValidationError(null);
    setError(null);

    if (!form.selectedShiftId) { setValidationError('Choisissez un service.'); return; }
    if (!form.selectedTimeSlot) { setValidationError('Choisissez un créneau.'); return; }

    try {
      const firstName = form.guestFirstName.trim() || undefined;
      const lastName  = form.guestLastName.trim()  || undefined;
      const phone     = form.guestPhone.trim()     || undefined;
      const email     = form.guestEmail.trim()     || undefined;
      const hasAnyGuestInfo = Boolean(firstName ?? lastName ?? phone ?? email);

      const finalNotes = withBirthdayOccasion(form.notes.trim() || null, form.isBirthday);

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
      setValidationError(e instanceof Error ? e.message : 'Erreur inconnue.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} size="large" />
          <Text style={styles.loadingText}>Chargement…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayError = validationError ?? error;

  return (
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
            <Text style={styles.subtitle}>Saisie téléphone</Text>

            {/* ── Date ── */}
            <DateSelector
              label="Date"
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
            <SectionCard title="Service">
              {availableShifts.length === 0 ? (
                <Text style={styles.infoText}>Aucun service disponible ce jour.</Text>
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
              <SectionCard title="Créneau & Couverts">
                <TimeSlotSelector
                  slots={timeSlots}
                  value={form.selectedTimeSlot || undefined}
                  onChange={(slot) => setForm((prev) => ({ ...prev, selectedTimeSlot: slot }))}
                />

                <View style={styles.stepperRow}>
                  <Text style={styles.stepperLabel}>Couverts</Text>
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
            <SectionCard title="Type de client">
              <View style={styles.shiftRow}>
                <TouchableOpacity
                  style={[styles.shiftChip, !form.isWalkIn && styles.shiftChipActive]}
                  onPress={() => handleClientType(false)}
                >
                  <Text style={[styles.shiftText, !form.isWalkIn && styles.shiftTextActive]}>
                    Client identifié
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.shiftChip, form.isWalkIn && styles.shiftChipActive]}
                  onPress={() => handleClientType(true)}
                >
                  <Text style={[styles.shiftText, form.isWalkIn && styles.shiftTextActive]}>
                    Client de passage
                  </Text>
                </TouchableOpacity>
              </View>
              {form.isWalkIn && (
                <Text style={styles.walkInHint}>
                  Pour les clients de dernière minute sans fiche client.
                </Text>
              )}
            </SectionCard>

            {/* ── Client ── */}
            {!form.isWalkIn && <SectionCard title="Client">
              {form.selectedGuest ? (
                <View>
                  <View style={styles.selectedGuestCard}>
                    <View style={styles.selectedGuestInfo}>
                      <Text style={styles.selectedGuestName}>
                        {[form.selectedGuest.first_name, form.selectedGuest.last_name]
                          .filter(Boolean).join(' ') || 'Client'}
                      </Text>
                      <Text style={styles.selectedGuestPhone}>{form.selectedGuest.phone}</Text>
                      {form.selectedGuest.vip && (
                        <View style={styles.vipBadge}><Text style={styles.vipText}>VIP</Text></View>
                      )}
                    </View>
                    <TouchableOpacity onPress={clearGuest}>
                      <Text style={styles.changeClient}>Changer</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View>
                  {/* Recherche */}
                  <View style={styles.searchRow}>
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Téléphone, nom ou email"
                      placeholderTextColor={colors.textMuted}
                      value={form.guestSearchQuery}
                      onChangeText={(t) => setForm((prev) => ({ ...prev, guestSearchQuery: t }))}
                      onSubmitEditing={handleSearch}
                      returnKeyType="search"
                      autoCapitalize="none"
                    />
                    <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
                      {searchLoading
                        ? <ActivityIndicator color={colors.textOnDark} size="small" />
                        : <Text style={styles.searchBtnText}>Chercher</Text>}
                    </TouchableOpacity>
                  </View>
                  {guestSearchResults.length > 0 && (
                    <View style={styles.searchResults}>
                      {guestSearchResults.map((g) => (
                        <TouchableOpacity
                          key={g.id}
                          style={styles.searchResultItem}
                          onPress={() => selectGuest(g)}
                        >
                          <Text style={styles.resultName}>
                            {[g.first_name, g.last_name].filter(Boolean).join(' ') || 'Client'}
                          </Text>
                          <Text style={styles.resultPhone}>{g.phone}</Text>
                          {g.vip && (
                            <View style={styles.vipBadge}><Text style={styles.vipText}>VIP</Text></View>
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {/* Nouveau client */}
                  <Text style={styles.newClientLabel}>Nouveau client</Text>
                  <Text style={styles.guestHint}>Client optionnel — à compléter plus tard si besoin.</Text>
                  <View style={styles.formRow}>
                    <TextInput
                      style={[styles.input, styles.inputHalf]}
                      placeholder="Prénom"
                      placeholderTextColor={colors.textMuted}
                      value={form.guestFirstName}
                      onChangeText={(t) => setForm((prev) => ({ ...prev, guestFirstName: t }))}
                      autoCapitalize="words"
                    />
                    <TextInput
                      style={[styles.input, styles.inputHalf]}
                      placeholder="Nom"
                      placeholderTextColor={colors.textMuted}
                      value={form.guestLastName}
                      onChangeText={(t) => setForm((prev) => ({ ...prev, guestLastName: t }))}
                      autoCapitalize="words"
                    />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Téléphone (optionnel)"
                    placeholderTextColor={colors.textMuted}
                    value={form.guestPhone}
                    onChangeText={(t) => setForm((prev) => ({ ...prev, guestPhone: t }))}
                    keyboardType="phone-pad"
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Email (optionnel)"
                    placeholderTextColor={colors.textMuted}
                    value={form.guestEmail}
                    onChangeText={(t) => setForm((prev) => ({ ...prev, guestEmail: t }))}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>Client VIP</Text>
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

            {/* ── Table (optionnel) ── */}
            <SectionCard title="Table">
              <Text style={styles.tableHint}>
                Optionnel — sélection multiple possible, peut être assignée plus tard depuis le plan.
              </Text>
              {form.selectedTableIds.length > 0 && (
                <TouchableOpacity
                  onPress={() => setForm((prev) => ({ ...prev, selectedTableIds: [] }))}
                >
                  <Text style={styles.clearTablesLink}>Effacer la sélection</Text>
                </TouchableOpacity>
              )}
              {tablesByZone.map(({ zone, items }) => (
                <View key={zone} style={styles.tableZoneGroup}>
                  <Text style={styles.tableZoneLabel}>{zone}</Text>
                  <View style={styles.tableChipRow}>
                    {items.map((t) => {
                      const isSelected = form.selectedTableIds.includes(t.id);
                      return (
                        <TouchableOpacity
                          key={t.id}
                          style={[styles.tableChip, isSelected && styles.tableChipActive]}
                          onPress={() => toggleTable(t.id)}
                        >
                          <Text style={[styles.tableChipText, isSelected && styles.tableChipTextActive]}>
                            {t.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
            </SectionCard>

            {/* ── Statut & Notes ── */}
            <SectionCard title="Statut & Notes">
              <View style={styles.statusRow}>
                {(['confirmed', 'pending'] as const).map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.statusOption, form.status === s && styles.statusOptionActive]}
                    onPress={() => setForm((prev) => ({ ...prev, status: s }))}
                  >
                    <Text style={[styles.statusOptionText, form.status === s && styles.statusOptionTextActive]}>
                      {s === 'confirmed' ? 'Confirmée' : 'En attente'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Anniversaire</Text>
                <Switch
                  value={form.isBirthday}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, isBirthday: v }))}
                  trackColor={{ false: colors.border, true: colors.goldLight }}
                  thumbColor={form.isBirthday ? colors.gold : colors.sand}
                />
              </View>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Notes (optionnel)"
                placeholderTextColor={colors.textMuted}
                value={form.notes}
                onChangeText={(t) => setForm((prev) => ({ ...prev, notes: t }))}
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
              label="Créer la réservation"
              onPress={() => { void handleSubmit(); }}
              loading={submitting}
              disabled={submitting}
            />

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  searchRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
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
  searchBtn: {
    backgroundColor: colors.cta,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
    minWidth: 80,
    alignItems: 'center',
  },
  searchBtnText: { ...typography.small, color: colors.textOnDark },
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
  statusOptionText: { ...typography.small, color: colors.textMuted },
  statusOptionTextActive: { color: colors.cta, fontFamily: typography.bodyMedium.fontFamily },

  // VIP
  vipBadge: {
    backgroundColor: colors.goldLight,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  vipText: { ...typography.label, color: colors.gold },

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

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radius } from '../theme';
import { useCreateReservation } from '../hooks/useCreateReservation';
import type { ShiftRow, TableRow, GuestRow } from '../hooks/useCreateReservation';
import DateSelector from './DateSelector';
import TimeSlotSelector from './TimeSlotSelector';
import PrimaryButton from './PrimaryButton';
import { generateTimeSlots, isDateAllowedForShift } from '../utils/reservationSlots';
import { parseDateString } from '../utils/date';
import type { FloorServiceFilter } from '../types/floor';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

export type CreateReservationForTableFormProps = {
  tableId:              string;
  tableLabel:           string;
  tableCapacity:        number;
  initialDate:          string;
  initialServiceFilter: FloorServiceFilter;
  onSuccess:            (reservationId: string) => void;
  onCancel:             () => void;
};

type GuestMode    = 'none' | 'existing' | 'new';
type ClientType   = 'identified' | 'walkin';
type StatusOption = 'confirmed' | 'pending' | 'seated';

// ── Shift helpers ─────────────────────────────────────────────────────────────

function isLunchShift(shift: ShiftRow): boolean {
  const n = shift.name.toLowerCase();
  return n.includes('déjeuner') || n.includes('lunch') || n.includes('midi');
}

function isDinnerShift(shift: ShiftRow): boolean {
  const n = shift.name.toLowerCase();
  return n.includes('dîner') || n.includes('dinner') || n.includes('soir');
}

function preferredShiftForFilter(
  forDate: ShiftRow[],
  filter:  FloorServiceFilter,
): ShiftRow | undefined {
  if (filter === 'lunch')  return forDate.find(isLunchShift)  ?? forDate[0];
  if (filter === 'dinner') return forDate.find(isDinnerShift) ?? forDate[0];
  return forDate.find(isDinnerShift) ?? forDate[0];
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CreateReservationForTableForm({
  tableId,
  tableLabel,
  tableCapacity,
  initialDate,
  initialServiceFilter,
  onSuccess,
  onCancel,
}: CreateReservationForTableFormProps): React.JSX.Element {
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

  // ── Date & service ────────────────────────────────────────────────────────
  const [date, setDate]                         = useState(initialDate);
  const [selectedShiftId, setSelectedShiftId]   = useState<string | null>(null);
  const [timeSlot, setTimeSlot]                 = useState<string | null>(null);

  // ── Couverts ──────────────────────────────────────────────────────────────
  const [partySize, setPartySize]               = useState(tableCapacity > 0 ? tableCapacity : 2);

  // ── Tables combinées ─────────────────────────────────────────────────────
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([tableId]);

  // ── Type client ───────────────────────────────────────────────────────────
  const [clientType, setClientType]             = useState<ClientType>('identified');

  // ── Statut ────────────────────────────────────────────────────────────────
  const [status, setStatus]                     = useState<StatusOption>('confirmed');

  // ── Notes ─────────────────────────────────────────────────────────────────
  const [notes, setNotes]                       = useState('');

  // ── Guest ─────────────────────────────────────────────────────────────────
  const [guestMode, setGuestMode]               = useState<GuestMode>('none');
  const [searchQuery, setSearchQuery]           = useState('');
  const [selectedGuestId, setSelectedGuestId]   = useState<string | null>(null);
  const [selectedGuestName, setSelectedGuestName] = useState<string | null>(null);
  const [newFirstName, setNewFirstName]         = useState('');
  const [newLastName, setNewLastName]           = useState('');
  const [newPhone, setNewPhone]                 = useState('');
  const [newEmail, setNewEmail]                 = useState('');
  const [newVip, setNewVip]                     = useState(false);
  const [newBirthday, setNewBirthday]           = useState('');
  const [showBirthday, setShowBirthday]         = useState(false);

  const autoSelectedRef = useRef(false);
  const isWalkIn = clientType === 'walkin';

  // ── Shifts filtrés & triés ────────────────────────────────────────────────
  const availableShifts = useMemo(
    () =>
      shifts
        .filter((s) => isDateAllowedForShift(date, s.days_of_week))
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [shifts, date],
  );

  // ── Tables par zone ───────────────────────────────────────────────────────
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

  // ── Auto-selection shift initial ──────────────────────────────────────────
  useEffect(() => {
    if (!shifts.length || autoSelectedRef.current) return;
    autoSelectedRef.current = true;
    const forDate = shifts.filter((s) => isDateAllowedForShift(date, s.days_of_week));
    const target = preferredShiftForFilter(forDate, initialServiceFilter);
    setSelectedShiftId(target?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shifts]);

  // ── Re-validation shift si date change ────────────────────────────────────
  useEffect(() => {
    setTimeSlot(null);
    if (!shifts.length) return;
    const forDate = shifts.filter((s) => isDateAllowedForShift(date, s.days_of_week));
    const stillValid = forDate.some((s) => s.id === selectedShiftId);
    if (!stillValid) {
      const target = preferredShiftForFilter(forDate, initialServiceFilter);
      setSelectedShiftId(target?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  // ── Reset time slot si shift change ──────────────────────────────────────
  const prevShiftRef = useRef(selectedShiftId);
  useEffect(() => {
    if (prevShiftRef.current === selectedShiftId) return;
    prevShiftRef.current = selectedShiftId;
    setTimeSlot(null);
  }, [selectedShiftId]);

  const selectedShift = shifts.find((s) => s.id === selectedShiftId) ?? null;
  const timeSlots = selectedShift
    ? generateTimeSlots(selectedShift.start_time, selectedShift.end_time, selectedShift.slot_duration)
    : [];

  // ── Guest handlers ────────────────────────────────────────────────────────
  const handleSearchGuests = useCallback(
    (q: string) => {
      setSearchQuery(q);
      void searchGuests(q);
    },
    [searchGuests],
  );

  const handleSelectGuest = useCallback((guest: GuestRow) => {
    setSelectedGuestId(guest.id);
    setSelectedGuestName(
      [guest.first_name, guest.last_name].filter(Boolean).join(' ') || 'Client',
    );
    setGuestMode('existing');
    setSearchQuery('');
  }, []);

  const handleClearGuest = useCallback(() => {
    setSelectedGuestId(null);
    setSelectedGuestName(null);
    setGuestMode('none');
    setSearchQuery('');
    setNewVip(false);
    setShowBirthday(false);
    setNewBirthday('');
  }, []);

  // ── Toggle client type ────────────────────────────────────────────────────
  const handleClientType = useCallback((type: ClientType) => {
    setClientType(type);
    if (type === 'walkin') {
      setStatus('seated');
      handleClearGuest();
    } else {
      setStatus('confirmed');
    }
  }, [handleClearGuest]);

  // ── Toggle table ──────────────────────────────────────────────────────────
  const toggleTable = useCallback((tid: string) => {
    setSelectedTableIds((prev) =>
      prev.includes(tid) ? prev.filter((id) => id !== tid) : [...prev, tid],
    );
  }, []);

  // ── Résumé tables ─────────────────────────────────────────────────────────
  const tablesSummary = useMemo(() => {
    if (selectedTableIds.length === 0) return 'Aucune table';
    const labels = selectedTableIds
      .map((id) => tables.find((t) => t.id === id)?.label ?? id)
      .sort();
    return selectedTableIds.length > 1
      ? `Tables ${labels.join(', ')}`
      : `Table ${labels[0]}`;
  }, [selectedTableIds, tables]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const canSubmit = !!date && !!selectedShiftId && !!timeSlot && partySize > 0;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !timeSlot || !selectedShiftId) return;
    setError(null);

    // Birthday validation
    let birthdayToSubmit: string | null = null;
    if (guestMode === 'new' && showBirthday && newBirthday.trim()) {
      const bval = newBirthday.trim();
      const parsed = parseDateString(bval);
      if (!parsed) {
        setError('Format anniversaire invalide. Utilisez AAAA-MM-JJ.');
        return;
      }
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (parsed > today) {
        setError("L'anniversaire ne peut pas être dans le futur.");
        return;
      }
      birthdayToSubmit = bval;
    }

    const hasNewGuestInfo = newFirstName || newLastName || newPhone || newEmail;
    try {
      const id = await createReservation({
        date,
        timeSlot,
        partySize,
        shiftId:   selectedShiftId,
        notes:     notes.trim() || undefined,
        status,
        tableIds:  selectedTableIds.length > 0 ? selectedTableIds : undefined,
        isWalkIn,
        guestId:   isWalkIn ? undefined : (selectedGuestId ?? undefined),
        guest:     isWalkIn || selectedGuestId || !hasNewGuestInfo
          ? undefined
          : {
              firstName: newFirstName.trim() || undefined,
              lastName:  newLastName.trim()  || undefined,
              phone:     newPhone.trim()     || undefined,
              email:     newEmail.trim()     || undefined,
              vip:       newVip,
              birthday:  birthdayToSubmit,
            },
      });
      onSuccess(id);
    } catch {
      // error state managed by the hook
    }
  }, [
    canSubmit, timeSlot, selectedShiftId, date, partySize, notes, status,
    selectedTableIds, isWalkIn, selectedGuestId,
    newFirstName, newLastName, newPhone, newEmail, newVip,
    guestMode, showBirthday, newBirthday,
    createReservation, setError, onSuccess,
  ]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  // ── Status options for walk-in from floor plan ────────────────────────────
  const statusOptions: Array<{ value: StatusOption; label: string }> = isWalkIn
    ? [
        { value: 'seated',    label: 'À table' },
        { value: 'confirmed', label: 'Confirmée' },
      ]
    : [
        { value: 'confirmed', label: 'Confirmée' },
        { value: 'pending',   label: 'En attente' },
      ];

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.formHeader}>
        <Text style={styles.formTitle}>Nouvelle réservation — {tablesSummary}</Text>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name={'alert-circle-outline' as IoniconsName} size={16} color={colors.cta} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* ── Section 1 : Date & Service ──────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Date & Service</Text>
        <DateSelector value={date} onChange={setDate} showQuickActions />
        <Text style={styles.fieldLabel}>Service</Text>
        <View style={styles.chipRow}>
          {availableShifts.length === 0 ? (
            <Text style={styles.emptyHint}>Aucun service disponible ce jour.</Text>
          ) : (
            availableShifts.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[styles.chip, selectedShiftId === s.id && styles.chipActive]}
                onPress={() => setSelectedShiftId(s.id)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedShiftId === s.id }}
              >
                <Text style={[styles.chipText, selectedShiftId === s.id && styles.chipTextActive]}>
                  {s.name}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </View>

      {/* ── Section 2 : Heure & Couverts ────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Heure & Couverts</Text>
        <TimeSlotSelector
          slots={timeSlots}
          value={timeSlot ?? undefined}
          onChange={setTimeSlot}
          label="Créneau"
          emptyMessage="Sélectionnez un service pour voir les créneaux."
        />
        <View style={styles.stepperRow}>
          <Text style={styles.fieldLabel}>Couverts</Text>
          <View style={styles.stepper}>
            <TouchableOpacity
              style={[styles.stepBtn, partySize <= 1 && styles.stepBtnDisabled]}
              onPress={() => setPartySize((p) => Math.max(1, p - 1))}
              disabled={partySize <= 1}
            >
              <Ionicons
                name={'remove' as IoniconsName}
                size={18}
                color={partySize <= 1 ? colors.textMuted : colors.textPrimary}
              />
            </TouchableOpacity>
            <Text style={styles.stepValue}>{partySize}</Text>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => setPartySize((p) => p + 1)}
            >
              <Ionicons name={'add' as IoniconsName} size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── Section 3 : Tables combinées ────────────────────────────────── */}
      {tablesByZone.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Tables combinées</Text>
          <Text style={styles.fieldHint}>Sélectionnez une ou plusieurs tables.</Text>
          {tablesByZone.map(({ zone, items }) => (
            <View key={zone} style={styles.zoneGroup}>
              <Text style={styles.zoneLabel}>{zone}</Text>
              <View style={styles.chipRow}>
                {items.map((t) => {
                  const isSelected = selectedTableIds.includes(t.id);
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.chip, isSelected && styles.chipActive]}
                      onPress={() => toggleTable(t.id)}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                    >
                      <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
          {selectedTableIds.length === 0 ? (
            <View style={styles.noTableRow}>
              <Ionicons name={'information-circle-outline' as IoniconsName} size={14} color={colors.textMuted} />
              <Text style={styles.noTableText}>Aucune table sélectionnée.</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* ── Section 4 : Type de client ──────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Type de client</Text>
        <View style={styles.chipRow}>
          <TouchableOpacity
            style={[styles.chip, styles.chipHalf, clientType === 'identified' && styles.chipActive]}
            onPress={() => handleClientType('identified')}
            activeOpacity={0.75}
          >
            <Text style={[styles.chipText, clientType === 'identified' && styles.chipTextActive]}>
              Client identifié
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, styles.chipHalf, clientType === 'walkin' && styles.chipActive]}
            onPress={() => handleClientType('walkin')}
            activeOpacity={0.75}
          >
            <Text style={[styles.chipText, clientType === 'walkin' && styles.chipTextActive]}>
              Client de passage
            </Text>
          </TouchableOpacity>
        </View>
        {isWalkIn ? (
          <Text style={styles.fieldHint}>Pour les clients de dernière minute sans fiche client.</Text>
        ) : null}
      </View>

      {/* ── Section 5 : Client (masqué en walk-in) ──────────────────────── */}
      {!isWalkIn ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Client (optionnel)</Text>

          {guestMode === 'existing' && selectedGuestId ? (
            <View style={styles.selectedGuest}>
              <Ionicons name={'person-circle-outline' as IoniconsName} size={18} color={colors.gold} />
              <Text style={styles.selectedGuestName} numberOfLines={1}>{selectedGuestName}</Text>
              <TouchableOpacity onPress={handleClearGuest} style={styles.clearBtn}>
                <Ionicons name={'close-circle' as IoniconsName} size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          ) : guestMode === 'new' ? (
            <View style={styles.newGuestForm}>
              <View style={styles.nameRow}>
                <TextInput
                  style={[styles.input, styles.inputHalf]}
                  value={newFirstName}
                  onChangeText={setNewFirstName}
                  placeholder="Prénom"
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="next"
                />
                <TextInput
                  style={[styles.input, styles.inputHalf]}
                  value={newLastName}
                  onChangeText={setNewLastName}
                  placeholder="Nom"
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="next"
                />
              </View>
              <TextInput
                style={styles.input}
                value={newPhone}
                onChangeText={setNewPhone}
                placeholder="Téléphone (optionnel)"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                returnKeyType="next"
              />
              <TextInput
                style={styles.input}
                value={newEmail}
                onChangeText={setNewEmail}
                placeholder="Email (optionnel)"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="done"
              />
              <View style={styles.vipRow}>
                <Text style={styles.vipLabel}>Client VIP</Text>
                <Switch
                  value={newVip}
                  onValueChange={setNewVip}
                  trackColor={{ false: colors.border, true: colors.goldLight }}
                  thumbColor={newVip ? colors.gold : colors.sand}
                />
              </View>
              <View style={styles.vipRow}>
                <Text style={styles.vipLabel}>Anniversaire</Text>
                <Switch
                  value={showBirthday}
                  onValueChange={(v) => { setShowBirthday(v); setNewBirthday(''); }}
                  trackColor={{ false: colors.border, true: colors.goldLight }}
                  thumbColor={showBirthday ? colors.gold : colors.sand}
                />
              </View>
              {showBirthday && (
                <TextInput
                  style={styles.input}
                  value={newBirthday}
                  onChangeText={setNewBirthday}
                  placeholder="AAAA-MM-JJ (optionnel)"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  maxLength={10}
                />
              )}
              <TouchableOpacity
                onPress={() => { setGuestMode('none'); setNewVip(false); setShowBirthday(false); setNewBirthday(''); }}
                style={styles.textLink}
              >
                <Text style={styles.textLinkText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TextInput
                style={styles.input}
                value={searchQuery}
                onChangeText={handleSearchGuests}
                placeholder="Rechercher un client par nom, tél, email…"
                placeholderTextColor={colors.textMuted}
                returnKeyType="search"
              />
              {searchLoading ? (
                <ActivityIndicator size="small" color={colors.gold} style={styles.searchSpinner} />
              ) : null}
              {guestSearchResults.length > 0 ? (
                <View style={styles.searchResults}>
                  {guestSearchResults.map((g) => (
                    <TouchableOpacity
                      key={g.id}
                      style={styles.searchResultItem}
                      onPress={() => handleSelectGuest(g)}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.searchResultName}>
                        {[g.first_name, g.last_name].filter(Boolean).join(' ') || 'Client'}
                      </Text>
                      {g.phone ? <Text style={styles.searchResultSub}>{g.phone}</Text> : null}
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
              <TouchableOpacity
                style={styles.newGuestTrigger}
                onPress={() => setGuestMode('new')}
                activeOpacity={0.75}
              >
                <Ionicons name={'person-add-outline' as IoniconsName} size={14} color={colors.gold} />
                <Text style={styles.newGuestTriggerText}>Créer un nouveau client</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : null}

      {/* ── Section 6 : Statut & Notes ──────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Statut & Notes</Text>
        <Text style={styles.fieldLabel}>Statut de la réservation</Text>
        <View style={styles.chipRow}>
          {statusOptions.map(({ value, label }) => (
            <TouchableOpacity
              key={value}
              style={[styles.chip, styles.chipHalf, status === value && styles.chipActive]}
              onPress={() => setStatus(value)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityState={{ selected: status === value }}
            >
              <Text style={[styles.chipText, status === value && styles.chipTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Notes (optionnel)"
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          returnKeyType="default"
        />
      </View>

      {/* ── Actions ─────────────────────────────────────────────────────── */}
      <View style={styles.actions}>
        <PrimaryButton
          label="Créer la réservation"
          onPress={() => { void handleSubmit(); }}
          loading={submitting}
          disabled={!canSubmit}
        />
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.75}>
          <Text style={styles.cancelBtnText}>Annuler</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  centered: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    padding:        spacing.xl,
  },
  scroll:    { flex: 1 },
  container: { padding: spacing.xl, paddingBottom: spacing.xxl },
  formHeader:  { marginBottom: spacing.lg },
  formTitle:   { ...typography.h2, color: colors.textPrimary },

  // Error banner
  errorBanner: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.sm,
    backgroundColor: colors.ctaLight,
    borderRadius:    radius.md,
    padding:         spacing.md,
    marginBottom:    spacing.lg,
    borderWidth:     1,
    borderColor:     colors.cta,
  },
  errorText: { ...typography.small, color: colors.cta, flex: 1 },

  // Section card
  section: {
    backgroundColor: colors.surface,
    borderRadius:    radius.lg,
    padding:         spacing.lg,
    marginBottom:    spacing.md,
    gap:             spacing.sm,
    borderWidth:     1,
    borderColor:     colors.borderLight,
    shadowColor:     colors.primary,
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.04,
    shadowRadius:    4,
    elevation:       1,
  },
  sectionLabel: { ...typography.label, color: colors.textMuted, marginBottom: spacing.xs },
  fieldLabel:   { ...typography.label, color: colors.textMuted },
  fieldHint:    { ...typography.small, color: colors.textMuted, fontStyle: 'italic' },
  emptyHint:    { ...typography.small, color: colors.textMuted, fontStyle: 'italic' },

  // Zone group (pour tables combinées)
  zoneGroup: { marginTop: spacing.xs },
  zoneLabel: { ...typography.label, color: colors.textMuted, marginBottom: spacing.xs },
  noTableRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
    marginTop:     spacing.xs,
  },
  noTableText: { ...typography.small, color: colors.textMuted, fontStyle: 'italic' },

  // Chips
  chipRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.sm,
    borderRadius:      radius.xl,
    backgroundColor:   colors.background,
    borderWidth:       1,
    borderColor:       colors.border,
  },
  chipHalf:       { flex: 1, alignItems: 'center' },
  chipActive:     { backgroundColor: colors.cta, borderColor: colors.cta },
  chipText:       { ...typography.small, color: colors.textMuted, fontFamily: 'Inter_500Medium' },
  chipTextActive: { color: colors.textOnDark },

  // Stepper
  stepperRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginTop:      spacing.xs,
  },
  stepper: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.sm,
    backgroundColor:   colors.background,
    borderRadius:      radius.md,
    borderWidth:       1,
    borderColor:       colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs,
  },
  stepBtn:         { padding: spacing.sm, borderRadius: radius.sm },
  stepBtnDisabled: { opacity: 0.4 },
  stepValue: {
    ...typography.h2,
    color:    colors.textPrimary,
    minWidth: 32,
    textAlign: 'center',
  },

  // Inputs
  input: {
    ...typography.body,
    color:             colors.textPrimary,
    backgroundColor:   colors.background,
    borderRadius:      radius.md,
    borderWidth:       1,
    borderColor:       colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
  },
  inputHalf:      { flex: 1 },
  inputMultiline: { minHeight: 72, paddingTop: spacing.sm },
  nameRow:        { flexDirection: 'row', gap: spacing.sm },

  // Guest — selected
  selectedGuest: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.sm,
    backgroundColor: colors.goldLight,
    borderRadius:    radius.md,
    padding:         spacing.md,
    borderWidth:     1,
    borderColor:     colors.gold,
  },
  selectedGuestName: { ...typography.bodyMedium, color: colors.textPrimary, flex: 1 },
  clearBtn:           { padding: spacing.xs },

  // Guest — new form
  newGuestForm: { gap: spacing.sm },
  vipRow: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingVertical: spacing.xs,
  },
  vipLabel: { ...typography.body, color: colors.textPrimary },
  textLink: { alignSelf: 'flex-start', paddingVertical: spacing.xs },
  textLinkText: { ...typography.small, color: colors.textMuted, textDecorationLine: 'underline' },

  // Guest — search
  searchSpinner: { marginTop: spacing.sm },
  searchResults: {
    backgroundColor: colors.surface,
    borderRadius:    radius.md,
    borderWidth:     1,
    borderColor:     colors.border,
    overflow:        'hidden',
    marginTop:       spacing.xs,
  },
  searchResultItem: {
    padding:           spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  searchResultName: { ...typography.bodyMedium, color: colors.textPrimary },
  searchResultSub:  { ...typography.small, color: colors.textMuted, marginTop: spacing.xs },
  newGuestTrigger: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.xs,
    paddingVertical: spacing.sm,
    alignSelf:       'flex-start',
  },
  newGuestTriggerText: { ...typography.small, color: colors.gold, fontFamily: 'Inter_500Medium' },

  // Actions
  actions: { gap: spacing.md, marginTop: spacing.sm },
  cancelBtn: { alignItems: 'center', paddingVertical: spacing.md },
  cancelBtnText: { ...typography.bodyMedium, color: colors.textMuted },
});

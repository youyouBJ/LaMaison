import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radius } from '../theme';
import { isDateAllowedForShift, generateTimeSlots } from '../utils/reservationSlots';
import DateSelector from './DateSelector';
import TimeSlotSelector from './TimeSlotSelector';
import PrimaryButton from './PrimaryButton';
import type { Database } from '../types/database';
import type { CreateWaitlistInput } from '../types/waitlist';

type ShiftRow = Database['public']['Tables']['shifts']['Row'];
type GuestRow = Database['public']['Tables']['guests']['Row'];

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

export type CreateWaitlistEntryFormProps = {
  initialDate:        string;
  shifts:             ShiftRow[];
  guestSearchResults: GuestRow[];
  searchLoading:      boolean;
  submitting:         boolean;
  error:              string | null;
  onSearchGuests:     (query: string) => Promise<void>;
  onSubmit:           (input: CreateWaitlistInput) => Promise<void>;
  onCancel:           () => void;
};

type ClientMode = 'identified' | 'walkin';
type GuestMode  = 'search' | 'new';

function isLunchShift(shift: ShiftRow): boolean {
  const n = shift.name.toLowerCase();
  return n.includes('déjeuner') || n.includes('dejeuner') || n.includes('lunch') || n.includes('midi');
}

function isDinnerShift(shift: ShiftRow): boolean {
  const n = shift.name.toLowerCase();
  return n.includes('dîner') || n.includes('diner') || n.includes('dinner') || n.includes('soir');
}

export default function CreateWaitlistEntryForm({
  initialDate,
  shifts,
  guestSearchResults,
  searchLoading,
  submitting,
  error,
  onSearchGuests,
  onSubmit,
  onCancel,
}: CreateWaitlistEntryFormProps): React.JSX.Element {
  const [date, setDate]                     = useState(initialDate);
  const [partySize, setPartySize]           = useState(2);
  const [selectedShiftId, setSelectedShiftId] = useState<string>('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
  const [clientMode, setClientMode]         = useState<ClientMode>('identified');
  const [guestMode, setGuestMode]           = useState<GuestMode>('search');
  const [selectedGuest, setSelectedGuest]   = useState<GuestRow | null>(null);
  const [guestSearch, setGuestSearch]       = useState('');
  const [firstName, setFirstName]           = useState('');
  const [lastName, setLastName]             = useState('');
  const [phone, setPhone]                   = useState('');
  const [email, setEmail]                   = useState('');
  const [vip, setVip]                       = useState(false);
  const [notes, setNotes]                   = useState('');
  const [formError, setFormError]           = useState<string | null>(null);

  // ── Shifts disponibles pour la date sélectionnée ─────────────────────────

  const shiftsForDate = useMemo(
    () => shifts.filter((s) => isDateAllowedForShift(date, s.days_of_week)),
    [date, shifts],
  );

  const lunchShift  = shiftsForDate.find(isLunchShift);
  const dinnerShift = shiftsForDate.find(isDinnerShift);

  const selectedShift = shiftsForDate.find((s) => s.id === selectedShiftId) ?? null;

  const timeSlots = useMemo(() => {
    if (!selectedShift) return [];
    return generateTimeSlots(selectedShift.start_time, selectedShift.end_time, selectedShift.slot_duration);
  }, [selectedShift]);

  // ── Quand la date change, réinitialiser le shift si plus disponible ───────

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    setSelectedTimeSlot('');
    // Garder le shift si encore valide, sinon reset
    if (selectedShiftId) {
      const shift = shifts.find((s) => s.id === selectedShiftId);
      if (!shift || !isDateAllowedForShift(newDate, shift.days_of_week)) {
        setSelectedShiftId('');
      }
    }
  };

  const handleShiftSelect = (shiftId: string) => {
    setSelectedShiftId(shiftId === selectedShiftId ? '' : shiftId);
    setSelectedTimeSlot('');
  };

  const handleGuestSearch = (q: string) => {
    setGuestSearch(q);
    void onSearchGuests(q);
  };

  const handleSelectGuest = (guest: GuestRow) => {
    setSelectedGuest(guest);
    setGuestSearch(`${guest.first_name ?? ''} ${guest.last_name ?? ''}`.trim());
  };

  const handlePartySizeChange = (delta: number) => {
    setPartySize((prev) => Math.max(1, Math.min(20, prev + delta)));
  };

  const handleSubmit = async () => {
    setFormError(null);
    if (partySize <= 0) { setFormError('Nombre de couverts invalide.'); return; }
    if (!date)          { setFormError('Date obligatoire.'); return; }

    try {
      await onSubmit({
        date,
        partySize,
        shiftId:   selectedShiftId || undefined,
        timeSlot:  selectedTimeSlot || undefined,
        guestId:   selectedGuest?.id,
        guest:     clientMode === 'identified' && guestMode === 'new' && !selectedGuest
          ? {
              firstName: firstName || undefined,
              lastName:  lastName  || undefined,
              phone:     phone     || undefined,
              email:     email     || undefined,
              vip,
            }
          : undefined,
        isWalkIn: clientMode === 'walkin',
        notes:    notes || undefined,
      });
    } catch {
      // L'erreur remonte via la prop `error`
    }
  };

  const displayName = (g: GuestRow) => {
    const name = `${g.first_name ?? ''} ${g.last_name ?? ''}`.trim();
    return name || g.phone || g.email || 'Client';
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.kav}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Nouvelle entrée</Text>
        <TouchableOpacity onPress={onCancel} style={styles.closeBtn} activeOpacity={0.7}>
          <Ionicons name={'close' as IoniconsName} size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Date ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Date</Text>
          <DateSelector value={date} onChange={handleDateChange} showQuickActions />
        </View>

        {/* ── Service ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Service</Text>
          {shiftsForDate.length === 0 ? (
            <View style={styles.noServiceCard}>
              <Text style={styles.noServiceText}>Aucun service disponible pour cette date.</Text>
            </View>
          ) : (
            <View style={styles.chipRow}>
              {lunchShift ? (
                <TouchableOpacity
                  style={[styles.serviceChip, selectedShiftId === lunchShift.id && styles.serviceChipActive]}
                  onPress={() => handleShiftSelect(lunchShift.id)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.serviceChipText, selectedShiftId === lunchShift.id && styles.serviceChipTextActive]}>
                    Déjeuner
                  </Text>
                </TouchableOpacity>
              ) : null}
              {dinnerShift ? (
                <TouchableOpacity
                  style={[styles.serviceChip, selectedShiftId === dinnerShift.id && styles.serviceChipActive]}
                  onPress={() => handleShiftSelect(dinnerShift.id)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.serviceChipText, selectedShiftId === dinnerShift.id && styles.serviceChipTextActive]}>
                    Dîner
                  </Text>
                </TouchableOpacity>
              ) : null}
              {/* Shifts sans Déjeuner/Dîner dans le nom */}
              {shiftsForDate
                .filter((s) => !isLunchShift(s) && !isDinnerShift(s))
                .map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.serviceChip, selectedShiftId === s.id && styles.serviceChipActive]}
                    onPress={() => handleShiftSelect(s.id)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.serviceChipText, selectedShiftId === s.id && styles.serviceChipTextActive]}>
                      {s.name}
                    </Text>
                  </TouchableOpacity>
                ))}
            </View>
          )}
        </View>

        {/* ── Créneau horaire (si shift sélectionné) ── */}
        {selectedShift && timeSlots.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Heure souhaitée (approximative)</Text>
            <View style={styles.card}>
              <TimeSlotSelector
                slots={timeSlots}
                value={selectedTimeSlot}
                onChange={setSelectedTimeSlot}
                emptyMessage="Aucun créneau disponible"
              />
            </View>
          </View>
        ) : null}

        {/* ── Couverts ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Couverts</Text>
          <View style={styles.card}>
            <View style={styles.counterRow}>
              <TouchableOpacity
                style={styles.counterBtn}
                onPress={() => handlePartySizeChange(-1)}
                activeOpacity={0.7}
              >
                <Ionicons name={'remove' as IoniconsName} size={20} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.counterValue}>{partySize}</Text>
              <TouchableOpacity
                style={styles.counterBtn}
                onPress={() => handlePartySizeChange(1)}
                activeOpacity={0.7}
              >
                <Ionicons name={'add' as IoniconsName} size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Type client ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Type de client</Text>
          <View style={styles.chipRow}>
            <TouchableOpacity
              style={[styles.serviceChip, clientMode === 'identified' && styles.serviceChipActive]}
              onPress={() => setClientMode('identified')}
              activeOpacity={0.75}
            >
              <Text style={[styles.serviceChipText, clientMode === 'identified' && styles.serviceChipTextActive]}>
                Client identifié
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.serviceChip, clientMode === 'walkin' && styles.serviceChipActive]}
              onPress={() => setClientMode('walkin')}
              activeOpacity={0.75}
            >
              <Text style={[styles.serviceChipText, clientMode === 'walkin' && styles.serviceChipTextActive]}>
                Client de passage
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Recherche client / nouveau client ── */}
        {clientMode === 'identified' ? (
          <View style={styles.section}>
            <View style={styles.guestModeRow}>
              <TouchableOpacity
                style={[styles.guestModeBtn, guestMode === 'search' && styles.guestModeBtnActive]}
                onPress={() => { setGuestMode('search'); setSelectedGuest(null); }}
                activeOpacity={0.75}
              >
                <Text style={[styles.guestModeBtnText, guestMode === 'search' && styles.guestModeBtnTextActive]}>
                  Rechercher
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.guestModeBtn, guestMode === 'new' && styles.guestModeBtnActive]}
                onPress={() => { setGuestMode('new'); setSelectedGuest(null); setGuestSearch(''); }}
                activeOpacity={0.75}
              >
                <Text style={[styles.guestModeBtnText, guestMode === 'new' && styles.guestModeBtnTextActive]}>
                  Nouveau client
                </Text>
              </TouchableOpacity>
            </View>

            {guestMode === 'search' ? (
              <View style={styles.card}>
                {selectedGuest ? (
                  <View style={styles.selectedGuestRow}>
                    <View style={styles.selectedGuestInfo}>
                      <Text style={styles.selectedGuestName}>{displayName(selectedGuest)}</Text>
                      {selectedGuest.phone ? (
                        <Text style={styles.selectedGuestSub}>{selectedGuest.phone}</Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      onPress={() => { setSelectedGuest(null); setGuestSearch(''); }}
                      style={styles.clearGuestBtn}
                      activeOpacity={0.7}
                    >
                      <Ionicons name={'close-circle' as IoniconsName} size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <View style={styles.searchRow}>
                      <Ionicons name={'search-outline' as IoniconsName} size={15} color={colors.textMuted} style={styles.searchIcon} />
                      <TextInput
                        style={styles.searchInput}
                        placeholder="Nom, téléphone, email…"
                        placeholderTextColor={colors.textMuted}
                        value={guestSearch}
                        onChangeText={handleGuestSearch}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      {searchLoading ? (
                        <ActivityIndicator size="small" color={colors.gold} />
                      ) : null}
                    </View>
                    {guestSearchResults.length > 0 ? (
                      <View style={styles.guestList}>
                        {guestSearchResults.map((g) => (
                          <TouchableOpacity
                            key={g.id}
                            style={styles.guestResultRow}
                            onPress={() => handleSelectGuest(g)}
                            activeOpacity={0.75}
                          >
                            <Text style={styles.guestResultName}>{displayName(g)}</Text>
                            {g.phone ? (
                              <Text style={styles.guestResultSub}>{g.phone}</Text>
                            ) : null}
                            {g.vip ? (
                              <View style={styles.vipBadge}>
                                <Text style={styles.vipBadgeText}>VIP</Text>
                              </View>
                            ) : null}
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : null}
                  </>
                )}
              </View>
            ) : (
              <View style={styles.card}>
                <View style={styles.fieldRow}>
                  <View style={styles.fieldHalf}>
                    <Text style={styles.fieldLabel}>Prénom</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={firstName}
                      onChangeText={setFirstName}
                      placeholder="Prénom"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                  <View style={styles.fieldHalf}>
                    <Text style={styles.fieldLabel}>Nom</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={lastName}
                      onChangeText={setLastName}
                      placeholder="Nom"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                </View>
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>Téléphone (optionnel)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="+216 XX XXX XXX"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                  />
                </View>
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>Email (optionnel)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="email@exemple.com"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Client VIP</Text>
                  <Switch
                    value={vip}
                    onValueChange={setVip}
                    trackColor={{ false: colors.border, true: colors.gold }}
                    thumbColor={colors.surface}
                  />
                </View>
              </View>
            )}
          </View>
        ) : null}

        {/* ── Notes ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Notes (optionnel)</Text>
          <View style={styles.card}>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Allergies, préférences, informations…"
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* ── Erreurs ── */}
        {(formError ?? error) ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{formError ?? error}</Text>
          </View>
        ) : null}

        {/* ── Boutons ── */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
            <Text style={styles.cancelBtnText}>Annuler</Text>
          </TouchableOpacity>
          <View style={styles.submitBtnWrapper}>
            <PrimaryButton
              label={submitting ? 'Ajout…' : 'Ajouter à la liste'}
              onPress={handleSubmit}
              disabled={submitting}
            />
          </View>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  kav: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  closeBtn: {
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    padding: spacing.xl,
    paddingBottom: spacing.xxl * 2,
  },

  // Section
  section: {
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },

  // Card
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

  // Service chips
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  serviceChip: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  serviceChipActive: {
    backgroundColor: colors.cta,
    borderColor: colors.cta,
  },
  serviceChipText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  serviceChipTextActive: {
    color: colors.textOnDark,
    fontFamily: typography.bodyMedium.fontFamily,
  },

  // No service
  noServiceCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  noServiceText: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
  },

  // Counter
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  counterBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  counterValue: {
    ...typography.h1,
    color: colors.textPrimary,
    minWidth: 40,
    textAlign: 'center',
  },

  // Guest mode
  guestModeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  guestModeBtn: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  guestModeBtnActive: {
    backgroundColor: colors.goldLight,
    borderColor: colors.gold,
  },
  guestModeBtnText: {
    ...typography.small,
    color: colors.textMuted,
  },
  guestModeBtnTextActive: {
    color: colors.gold,
    fontFamily: typography.bodyMedium.fontFamily,
  },

  // Search
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    paddingVertical: spacing.sm,
  },

  // Guest list
  guestList: {
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  guestResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  guestResultName: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    flex: 1,
  },
  guestResultSub: {
    ...typography.small,
    color: colors.textMuted,
  },

  // Selected guest
  selectedGuestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  selectedGuestInfo: {
    flex: 1,
  },
  selectedGuestName: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  selectedGuestSub: {
    ...typography.small,
    color: colors.textMuted,
  },
  clearGuestBtn: {
    padding: spacing.xs,
  },

  // VIP badge
  vipBadge: {
    backgroundColor: colors.goldLight,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  vipBadgeText: {
    ...typography.label,
    color: colors.gold,
  },

  // Fields
  fieldRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  fieldHalf: {
    flex: 1,
  },
  fieldBlock: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  fieldInput: {
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  switchLabel: {
    ...typography.body,
    color: colors.textPrimary,
  },

  // Notes
  notesInput: {
    ...typography.body,
    color: colors.textPrimary,
    minHeight: 80,
  },

  // Error
  errorCard: {
    backgroundColor: colors.ctaLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    ...typography.small,
    color: colors.cta,
  },

  // Actions
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  cancelBtn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cancelBtnText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  submitBtnWrapper: {
    flex: 1,
  },
});

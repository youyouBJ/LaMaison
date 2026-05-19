import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Switch,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, typography, spacing, radius, layout } from '../../theme';
import { useGuestDetail } from '../../hooks/useGuestDetail';
import SectionCard from '../../components/SectionCard';
import PrimaryButton from '../../components/PrimaryButton';
import StatusBadge from '../../components/StatusBadge';
import {
  formatGuestName,
  formatPhone,
  formatRating,
  formatCurrencyTND,
  formatDateShort,
  getDisplayableGuestTags,
} from '../../utils/format';
import { formatTimeSlot } from '../../utils/date';
import {
  openWhatsAppMessage,
  normalizePhoneForWhatsApp,
  buildGuestGenericMessage,
} from '../../utils/whatsapp';
import type { GuestsStackParamList } from '../../navigation/GuestsNavigator';
import type { ReservationWithDetail } from '../../hooks/useGuestDetail';

type Props = NativeStackScreenProps<GuestsStackParamList, 'GuestDetail'>;

type FormState = {
  first_name:       string;
  last_name:        string;
  phone:            string;
  email:            string;
  notes:            string;
  marketing_opt_in: boolean;
};

// ─── Composants locaux ────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function FieldInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  multiline,
  editable,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: React.ComponentProps<typeof TextInput>['keyboardType'];
  autoCapitalize?: React.ComponentProps<typeof TextInput>['autoCapitalize'];
  multiline?: boolean;
  editable?: boolean;
}): React.JSX.Element {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && styles.fieldInputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        autoCorrect={false}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        textAlignVertical={multiline ? 'top' : 'auto'}
        editable={editable !== false}
      />
    </View>
  );
}

function ReservationRow({ item }: { item: ReservationWithDetail }): React.JSX.Element {
  return (
    <View style={styles.resRow}>
      <View style={styles.resLeft}>
        <Text style={styles.resDate}>{formatDateShort(item.date)}</Text>
        <Text style={styles.resTime}>{formatTimeSlot(item.time_slot)}</Text>
        <Text style={styles.resCovers}>{item.party_size} couvert{item.party_size > 1 ? 's' : ''}</Text>
        {item.tables ? (
          <Text style={styles.resTable}>{item.tables.label}</Text>
        ) : null}
        {item.shifts ? (
          <Text style={styles.resShift}>{item.shifts.name}</Text>
        ) : null}
      </View>
      <StatusBadge status={item.status} />
    </View>
  );
}

// ─── Écran principal ──────────────────────────────────────────────────────────

export default function GuestDetailScreen({ route }: Props): React.JSX.Element {
  const { guestId } = route.params;
  const { loading, saving, error, guest, reservations, refresh, updateGuest, toggleVip } =
    useGuestDetail(guestId);

  const [form, setForm] = useState<FormState>({
    first_name:       '',
    last_name:        '',
    phone:            '',
    email:            '',
    notes:            '',
    marketing_opt_in: false,
  });
  const [saveSuccess, setSaveSuccess]   = useState(false);
  const [vipUpdating, setVipUpdating]   = useState(false);
  const [waFeedback, setWaFeedback]     = useState<{ ok: boolean; text: string } | null>(null);
  const formInitialized                 = useRef(false);
  const successTimer                    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waTimer                         = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (guest && !formInitialized.current) {
      formInitialized.current = true;
      setForm({
        first_name:       guest.first_name       ?? '',
        last_name:        guest.last_name        ?? '',
        phone:            guest.phone            ?? '',
        email:            guest.email            ?? '',
        notes:            guest.notes            ?? '',
        marketing_opt_in: guest.marketing_opt_in,
      });
    }
  }, [guest]);

  useEffect(() => {
    return () => {
      if (successTimer.current) clearTimeout(successTimer.current);
      if (waTimer.current)      clearTimeout(waTimer.current);
    };
  }, []);

  const setField = useCallback(
    (key: keyof FormState) => (value: string | boolean) =>
      setForm((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const handleSave = async () => {
    const ok = await updateGuest({
      first_name:       form.first_name.trim()  || null,
      last_name:        form.last_name.trim()   || null,
      phone:            form.phone.trim()       || null,
      email:            form.email.trim()       || null,
      notes:            form.notes.trim()       || null,
      marketing_opt_in: form.marketing_opt_in,
    });
    if (ok) {
      setSaveSuccess(true);
      if (successTimer.current) clearTimeout(successTimer.current);
      successTimer.current = setTimeout(() => setSaveSuccess(false), 2500);
    }
  };

  const handleToggleVip = useCallback(() => {
    setVipUpdating(true);
    void toggleVip().finally(() => setVipUpdating(false));
  }, [toggleVip]);

  const handleCall = () => {
    const phone = guest?.phone;
    if (phone) { void Linking.openURL(`tel:${phone}`); }
  };

  const handleWhatsAppContact = () => {
    const phone   = guest?.phone ?? null;
    const message = buildGuestGenericMessage();
    void openWhatsAppMessage(phone, message).then((opened) => {
      if (waTimer.current) clearTimeout(waTimer.current);
      setWaFeedback(
        opened
          ? { ok: true, text: 'WhatsApp ouvert' }
          : {
              ok: false,
              text: normalizePhoneForWhatsApp(phone)
                ? "Impossible d'ouvrir WhatsApp."
                : 'Numéro invalide.',
            },
      );
      waTimer.current = setTimeout(() => setWaFeedback(null), 4000);
    });
  };

  const handleRefresh   = () => { refresh(); };
  const handleSavePress = () => { void handleSave(); };

  // ── Loading ──
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

  // ── Client introuvable ──
  if (!guest && !loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Client introuvable.</Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={handleRefresh}>
            <Text style={styles.refreshBtnText}>Actualiser</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const guestName  = formatGuestName(guest?.first_name, guest?.last_name);
  const hasPhone   = Boolean(guest?.phone);
  const isVip      = guest?.vip ?? false;

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

            {/* ── Hero ── */}
            <View style={styles.hero}>
              <View style={styles.heroLeft}>
                <Text style={styles.heroName} numberOfLines={2}>{guestName}</Text>
                <Text style={styles.heroPhone}>{formatPhone(guest?.phone)}</Text>
              </View>
              {isVip ? (
                <View style={styles.vipBadge}>
                  <Text style={styles.vipText}>VIP</Text>
                </View>
              ) : null}
            </View>

            {/* ── Informations ── */}
            <SectionCard title="Informations">
              <FieldInput
                label="Prénom"
                value={form.first_name}
                onChangeText={setField('first_name')}
                placeholder="Prénom"
                autoCapitalize="words"
                editable={!saving}
              />
              <FieldInput
                label="Nom"
                value={form.last_name}
                onChangeText={setField('last_name')}
                placeholder="Nom"
                autoCapitalize="words"
                editable={!saving}
              />
              <FieldInput
                label="Téléphone"
                value={form.phone}
                onChangeText={setField('phone')}
                placeholder="Téléphone"
                keyboardType="phone-pad"
                autoCapitalize="none"
                editable={!saving}
              />
              <FieldInput
                label="Email"
                value={form.email}
                onChangeText={setField('email')}
                placeholder="Email (optionnel)"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!saving}
              />
            </SectionCard>

            {/* ── Contact ── */}
            {hasPhone ? (
              <SectionCard title="Contact">
                {waFeedback ? (
                  <View style={[styles.waBanner, waFeedback.ok ? styles.waBannerOk : styles.waBannerErr]}>
                    <Text style={[styles.waBannerText, waFeedback.ok ? styles.waBannerTextOk : styles.waBannerTextErr]}>
                      {waFeedback.text}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.contactRow}>
                  <TouchableOpacity
                    style={styles.contactBtn}
                    onPress={handleCall}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.contactBtnText}>Appeler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.contactBtnWa}
                    onPress={handleWhatsAppContact}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.contactBtnWaText}>WhatsApp</Text>
                  </TouchableOpacity>
                </View>
              </SectionCard>
            ) : null}

            {/* ── Statut client ── */}
            <SectionCard title="Statut client">
              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Text style={[styles.toggleLabel, isVip && styles.toggleLabelActive]}>
                    Client VIP
                  </Text>
                  <Text style={styles.toggleSub}>Marquer ce client comme VIP dans le CRM.</Text>
                </View>
                {vipUpdating ? (
                  <ActivityIndicator size="small" color={colors.gold} />
                ) : (
                  <Switch
                    value={isVip}
                    onValueChange={() => { handleToggleVip(); }}
                    trackColor={{ false: colors.border, true: colors.goldLight }}
                    thumbColor={isVip ? colors.gold : colors.sand}
                    disabled={saving}
                  />
                )}
              </View>
            </SectionCard>

            {/* ── Notes internes ── */}
            <SectionCard title="Notes internes">
              <FieldInput
                label=""
                value={form.notes}
                onChangeText={setField('notes')}
                placeholder="Notes internes (optionnel)"
                multiline
                editable={!saving}
              />
            </SectionCard>

            {/* ── Statistiques ── */}
            <SectionCard title="Statistiques">
              <InfoRow label="Visites"         value={String(guest?.visit_count ?? 0)} />
              <InfoRow label="Annulations"     value={String(guest?.cancels ?? 0)} />
              <InfoRow label="No-shows"        value={String(guest?.no_shows ?? 0)} />
              <InfoRow label="Dépense moy."    value={formatCurrencyTND(guest?.avg_spend)} />
              <InfoRow label="Rating moy."     value={formatRating(guest?.avg_rating)} />
              <InfoRow label="Dernière visite" value={formatDateShort(guest?.last_visit)} />
            </SectionCard>

            {/* ── Tags ── */}
            <SectionCard title="Tags">
              {(() => {
                const displayTags = getDisplayableGuestTags(guest?.tags);
                if (displayTags.length === 0) {
                  return <Text style={styles.tagsEmpty}>Aucun tag utile</Text>;
                }
                return (
                  <View style={styles.tagsRow}>
                    {displayTags.map((tag) => (
                      <View key={tag} style={styles.tagBadge}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                );
              })()}
            </SectionCard>

            {/* ── Données importées ── */}
            <SectionCard title="Données importées">
              <View style={styles.importedRow}>
                <View style={styles.importedInfo}>
                  <Text style={styles.importedLabel}>Opt-in marketing</Text>
                  <Text style={styles.importedSub}>Consentement importé depuis SevenRooms.</Text>
                </View>
                <Switch
                  value={form.marketing_opt_in}
                  onValueChange={(v) => setField('marketing_opt_in')(v)}
                  trackColor={{ false: colors.border, true: colors.goldLight }}
                  thumbColor={form.marketing_opt_in ? colors.gold : colors.sand}
                  disabled={saving}
                />
              </View>
            </SectionCard>

            {/* ── Historique réservations ── */}
            <SectionCard title="Historique réservations">
              {reservations.length === 0 ? (
                <Text style={styles.historyEmpty}>Aucune réservation enregistrée.</Text>
              ) : (
                reservations.map((item) => (
                  <ReservationRow key={item.id} item={item} />
                ))
              )}
            </SectionCard>

            {/* ── Bannière erreur ── */}
            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            ) : null}

            {/* ── Bannière succès ── */}
            {saveSuccess ? (
              <View style={styles.successBanner}>
                <Text style={styles.successBannerText}>Modifications enregistrées.</Text>
              </View>
            ) : null}

            {/* ── Actions ── */}
            <PrimaryButton
              label="Enregistrer"
              onPress={handleSavePress}
              loading={saving}
              disabled={saving}
            />

            <TouchableOpacity
              style={styles.refreshAction}
              onPress={handleRefresh}
              disabled={saving}
              activeOpacity={0.75}
            >
              <Text style={styles.refreshActionText}>Actualiser</Text>
            </TouchableOpacity>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex:   { flex: 1 },
  safe:   { flex: 1, backgroundColor: colors.background },
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
  loadingText: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  refreshBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.cta,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  refreshBtnText: {
    ...typography.bodyMedium,
    color: colors.textOnDark,
  },

  // Hero
  hero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  heroLeft: {
    flex: 1,
    gap: spacing.xs,
  },
  heroName: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  heroPhone: {
    ...typography.body,
    color: colors.textSecondary,
  },
  vipBadge: {
    backgroundColor: colors.goldLight,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.gold,
  },
  vipText: {
    ...typography.label,
    color: colors.gold,
  },

  // Field
  fieldBlock: {
    marginBottom: spacing.sm,
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
  fieldInputMultiline: {
    minHeight: 88,
  },

  // Contact section
  contactRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  contactBtn: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 48,
  },
  contactBtnText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  contactBtnWa: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.statusFreeLight,
    borderWidth: 1,
    borderColor: colors.statusFree,
    minHeight: 48,
  },
  contactBtnWaText: {
    ...typography.bodyMedium,
    color: colors.statusFree,
  },
  waBanner: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  waBannerOk: {
    backgroundColor: colors.statusFreeLight,
    borderColor: colors.statusFree,
  },
  waBannerErr: {
    backgroundColor: colors.ctaLight,
    borderColor: colors.cta,
  },
  waBannerText: { ...typography.small, fontFamily: typography.bodyMedium.fontFamily },
  waBannerTextOk:  { color: colors.statusFree },
  waBannerTextErr: { color: colors.cta },

  // Statut client — VIP toggle
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  toggleInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  toggleLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  toggleLabelActive: {
    color: colors.gold,
  },
  toggleSub: {
    ...typography.small,
    color: colors.textMuted,
  },

  // Données importées
  importedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  importedInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  importedLabel: {
    ...typography.small,
    color: colors.textSecondary,
    fontFamily: typography.bodyMedium.fontFamily,
  },
  importedSub: {
    ...typography.small,
    color: colors.textMuted,
  },

  // InfoRow
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  infoLabel: {
    ...typography.small,
    color: colors.textMuted,
  },
  infoValue: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },

  // Tags
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tagBadge: {
    backgroundColor: colors.ctaLight,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  tagText: {
    ...typography.label,
    textTransform: 'none' as const,
    letterSpacing: 0.2,
    color: colors.cta,
  },
  tagsEmpty: {
    ...typography.small,
    color: colors.textMuted,
  },

  // Reservation history
  resRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: spacing.sm,
  },
  resLeft: {
    flex: 1,
    gap: 2,
  },
  resDate: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  resTime: {
    ...typography.small,
    color: colors.textSecondary,
  },
  resCovers: {
    ...typography.small,
    color: colors.textMuted,
  },
  resTable: {
    ...typography.small,
    color: colors.textMuted,
  },
  resShift: {
    ...typography.small,
    color: colors.textMuted,
  },
  historyEmpty: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },

  // Banners
  errorBanner: {
    backgroundColor: colors.ctaLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cta,
  },
  errorBannerText: {
    ...typography.small,
    color: colors.cta,
  },
  successBanner: {
    backgroundColor: colors.statusFreeLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.statusFree,
  },
  successBannerText: {
    ...typography.small,
    color: colors.statusFree,
  },

  // Footer actions
  refreshAction: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  refreshActionText: {
    ...typography.small,
    color: colors.textMuted,
  },
});

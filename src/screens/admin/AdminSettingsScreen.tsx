import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, typography, spacing, radius, layout } from '../../theme';
import { useSettingsOverview, type SettingsData } from '../../hooks/useSettingsOverview';
import { useRestaurantSettings } from '../../hooks/useRestaurantSettings';
import { useShiftSettings } from '../../hooks/useShiftSettings';
import { useTableSettings } from '../../hooks/useTableSettings';
import { supabase } from '../../lib/supabase';
import type { AdminStackParamList } from '../../navigation/AdminNavigator';
import type { Database } from '../../types/database';

type ShiftRow = Database['public']['Tables']['shifts']['Row'];
type TableRow = Database['public']['Tables']['tables']['Row'];

type Props = {
  navigation: NativeStackNavigationProp<AdminStackParamList, 'AdminSettings'>;
};

// ─── Local draft types ────────────────────────────────────────────────────────

type RestDraft = {
  name:     string;
  address:  string;
  phone:    string;
  email:    string;
  timezone: string;
};

type ShiftDraft = {
  name:      string;
  days:      number[];
  start:     string;
  end:       string;
  slot:      string;
  maxCovers: string;
};

type TableDraft = {
  label:    string;
  zone:     string;
  capacity: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  admin:   'Admin',
  manager: 'Manager',
  host:    'Hôte',
  waiter:  'Serveur',
};

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

type ChannelStatus = 'active' | 'configured' | 'inactive' | 'soon';

type Channel = {
  icon:   React.ComponentProps<typeof Ionicons>['name'];
  label:  string;
  detail: string;
  status: ChannelStatus;
};

const CHANNELS: Channel[] = [
  { icon: 'logo-whatsapp',      label: 'WhatsApp manuel',     detail: "Envoi depuis l'app",        status: 'active'     },
  { icon: 'mail-outline',       label: 'Email manuel',         detail: "Envoi depuis l'app",        status: 'active'     },
  { icon: 'star-outline',       label: 'Enquête satisfaction', detail: 'Lien public configuré',     status: 'configured' },
  { icon: 'chatbubble-outline', label: 'SMS',                  detail: 'Non activé',                status: 'inactive'   },
  { icon: 'logo-whatsapp',      label: 'WhatsApp API',         detail: 'Automatisation à venir',    status: 'soon'       },
  { icon: 'mail',               label: 'Resend email',         detail: 'Envoi automatique à venir', status: 'soon'       },
];

const CHANNEL_STATUS_CONFIG: Record<ChannelStatus, { label: string; color: string; bg: string }> = {
  active:     { label: 'Actif',     color: colors.statusFree,  bg: colors.statusFreeLight },
  configured: { label: 'Configuré', color: colors.gold,        bg: colors.goldLight       },
  inactive:   { label: 'Inactif',   color: colors.textMuted,   bg: colors.borderLight     },
  soon:       { label: 'À venir',   color: colors.textMuted,   bg: colors.borderLight     },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidTime(t: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(t)) return false;
  const parts = t.split(':');
  const h = parseInt(parts[0] ?? '99', 10);
  const m = parseInt(parts[1] ?? '99', 10);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

function validateRestaurant(d: RestDraft): string | null {
  if (d.name.trim() === '') return 'Le nom du restaurant est requis.';
  if (d.email.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim()))
    return 'Format email invalide.';
  return null;
}

function validateShift(d: ShiftDraft): string | null {
  if (d.name.trim() === '') return 'Le nom du service est requis.';
  if (d.days.length === 0) return 'Sélectionnez au moins un jour.';
  if (!isValidTime(d.start)) return 'Heure de début invalide (HH:mm).';
  if (!isValidTime(d.end)) return 'Heure de fin invalide (HH:mm).';
  if (d.end <= d.start) return "L'heure de fin doit être après l'heure de début.";
  const slot = parseInt(d.slot, 10);
  if (isNaN(slot) || slot <= 0) return 'La durée du slot doit être un nombre positif.';
  const max = parseInt(d.maxCovers, 10);
  if (isNaN(max) || max <= 0) return 'Les couverts max doivent être un nombre positif.';
  return null;
}

function validateTable(d: TableDraft): string | null {
  if (d.label.trim() === '') return 'Le numéro / nom de la table est requis.';
  if (d.zone.trim() === '') return 'La zone est requise.';
  const cap = parseInt(d.capacity, 10);
  if (isNaN(cap) || cap < 1) return 'La capacité doit être au moins 1.';
  return null;
}

function formatDays(days: number[]): string {
  if (days.length === 0) return '–';
  if (days.length === 7) return 'Tous les jours';
  const sorted = [...days].sort((a, b) => a - b);
  const labels = sorted.map(d => DAY_LABELS[d] ?? `J${d}`);
  let consecutive = true;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) { consecutive = false; break; }
  }
  if (consecutive && sorted.length >= 3) {
    return `${labels[0]}–${labels[labels.length - 1]}`;
  }
  return labels.join(', ');
}

function fmtTime(t: string): string {
  return t.length >= 5 ? t.substring(0, 5) : t;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <View style={styles.card}>{children}</View>;
}

function Divider(): React.JSX.Element {
  return <View style={styles.divider} />;
}

function SectionHeader({ title }: { title: string }): React.JSX.Element {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function InfoRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function EditInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  autoCorrect,
}: {
  label:           string;
  value:           string;
  onChangeText:    (text: string) => void;
  placeholder?:    string;
  keyboardType?:   'default' | 'email-address' | 'numeric' | 'phone-pad' | 'numbers-and-punctuation';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  autoCorrect?:    boolean;
}): React.JSX.Element {
  return (
    <View style={styles.editInputGroup}>
      <Text style={styles.editInputLabel}>{label}</Text>
      <TextInput
        style={styles.editInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        autoCorrect={autoCorrect ?? false}
      />
    </View>
  );
}

function FormError({ error }: { error: string }): React.JSX.Element {
  return <Text style={styles.formError}>{error}</Text>;
}

function FormSuccess({ message }: { message: string }): React.JSX.Element {
  return <Text style={styles.formSuccess}>{message}</Text>;
}

function ActionButtons({
  onSave,
  onCancel,
  saving,
}: {
  onSave:   () => void;
  onCancel: () => void;
  saving:   boolean;
}): React.JSX.Element {
  return (
    <View style={styles.actionRow}>
      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={onSave}
        disabled={saving}
        activeOpacity={0.8}
      >
        {saving
          ? <ActivityIndicator color={colors.textOnDark} size="small" />
          : <Text style={styles.saveButtonText}>Enregistrer</Text>}
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.cancelButton}
        onPress={onCancel}
        disabled={saving}
        activeOpacity={0.7}
      >
        <Text style={styles.cancelButtonText}>Annuler</Text>
      </TouchableOpacity>
    </View>
  );
}

function EditButton({ onPress }: { onPress: () => void }): React.JSX.Element {
  return (
    <TouchableOpacity style={styles.editButton} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name="pencil-outline" size={14} color={colors.cta} />
      <Text style={styles.editButtonText}>Modifier</Text>
    </TouchableOpacity>
  );
}

function ZoneChipPicker({
  selected,
  zones,
  onSelect,
}: {
  selected: string;
  zones:    string[];
  onSelect: (zone: string) => void;
}): React.JSX.Element {
  return (
    <View style={styles.editInputGroup}>
      <Text style={styles.editInputLabel}>Zone</Text>
      {zones.length === 0 ? (
        <Text style={styles.formError}>Aucune zone disponible.</Text>
      ) : (
        <View style={styles.zonePickerRow}>
          {zones.map(zone => {
            const active = selected === zone;
            return (
              <TouchableOpacity
                key={zone}
                style={[styles.zoneChip, active && styles.zoneChipActive]}
                onPress={() => { onSelect(zone); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.zoneChipText, active && styles.zoneChipTextActive]}>
                  {zone}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

function DayChipRow({
  days,
  onChange,
}: {
  days:     number[];
  onChange: (days: number[]) => void;
}): React.JSX.Element {
  const toggle = (d: number): void => {
    const next = days.includes(d) ? days.filter(x => x !== d) : [...days, d];
    onChange(next);
  };
  return (
    <View style={styles.dayRow}>
      {DAY_LABELS.map((label, idx) => {
        const active = days.includes(idx);
        return (
          <TouchableOpacity
            key={idx}
            style={[styles.dayChip, active && styles.dayChipActive]}
            onPress={() => { toggle(idx); }}
            activeOpacity={0.7}
          >
            <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function SoonBadge(): React.JSX.Element {
  return (
    <View style={styles.soonBadge}>
      <Text style={styles.soonBadgeText}>À venir</Text>
    </View>
  );
}

function FixedBadge(): React.JSX.Element {
  return (
    <View style={styles.fixedBadge}>
      <Text style={styles.fixedBadgeText}>Fixe</Text>
    </View>
  );
}

function ChannelRow({ channel }: { channel: Channel }): React.JSX.Element {
  const cfg = CHANNEL_STATUS_CONFIG[channel.status];
  return (
    <View style={styles.channelRow}>
      <View style={styles.channelIcon}>
        <Ionicons name={channel.icon} size={18} color={colors.sand} />
      </View>
      <View style={styles.channelContent}>
        <Text style={styles.channelLabel}>{channel.label}</Text>
        <Text style={styles.channelDetail}>{channel.detail}</Text>
      </View>
      <View style={[styles.channelBadge, { backgroundColor: cfg.bg }]}>
        <Text style={[styles.channelBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AdminSettingsScreen({ navigation }: Props): React.JSX.Element {
  const { loading, error, data, refresh } = useSettingsOverview();

  const [localData, setLocalData] = useState<SettingsData | null>(null);
  useEffect(() => {
    if (data !== null) setLocalData(data);
  }, [data]);

  const restaurantId = localData?.restaurant.id ?? null;

  const {
    saving: savingRest,
    saveError: restSaveError,
    saveSuccess: restSaveSuccess,
    updateRestaurant,
  } = useRestaurantSettings(restaurantId);

  const {
    savingId: savingShiftId,
    saveError: shiftSaveError,
    savedId: savedShiftId,
    updateShift,
  } = useShiftSettings(restaurantId);

  const {
    savingId: savingTableId,
    saveError: tableSaveError,
    savedId: savedTableId,
    updateTable,
  } = useTableSettings(restaurantId);

  // Sign-out
  const [signingOut, setSigningOut]     = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  // Restaurant edit
  const [editingRest, setEditingRest]       = useState(false);
  const [restDraft, setRestDraft]           = useState<RestDraft>({ name: '', address: '', phone: '', email: '', timezone: '' });
  const [restFormError, setRestFormError]   = useState<string | null>(null);

  // Shift edit
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [shiftDraft, setShiftDraft]         = useState<ShiftDraft>({ name: '', days: [], start: '', end: '', slot: '', maxCovers: '' });
  const [shiftFormError, setShiftFormError] = useState<string | null>(null);

  // Table edit
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [tableDraft, setTableDraft]         = useState<TableDraft>({ label: '', zone: '', capacity: '' });
  const [tableFormError, setTableFormError] = useState<string | null>(null);

  // ── Tables grouped by zone ──────────────────────────────────────────────────

  const tablesByZone = useMemo((): Array<{ zone: string; tables: TableRow[] }> => {
    if (!localData) return [];
    const map = new Map<string, TableRow[]>();
    for (const t of localData.tableRows) {
      const arr = map.get(t.zone) ?? [];
      arr.push(t);
      map.set(t.zone, arr);
    }
    return Array.from(map.entries())
      .map(([zone, tables]) => ({
        zone,
        tables: [...tables].sort((a, b) =>
          a.label.localeCompare(b.label, 'fr', { numeric: true })
        ),
      }))
      .sort((a, b) => a.zone.localeCompare(b.zone, 'fr'));
  }, [localData]);

  const availableZones = useMemo((): string[] => tablesByZone.map(z => z.zone), [tablesByZone]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleSignOut = useCallback(async (): Promise<void> => {
    setSigningOut(true);
    setSignOutError(null);
    try {
      const { error: signOutErr } = await supabase.auth.signOut();
      if (signOutErr) {
        setSignOutError(signOutErr.message);
        setSigningOut(false);
      }
    } catch (e) {
      console.error('[AdminSettings] signOut threw:', e);
      setSignOutError('Erreur lors de la déconnexion.');
      setSigningOut(false);
    }
  }, []);

  const handleStartEditRest = useCallback((): void => {
    if (!localData) return;
    const { restaurant: r } = localData;
    setRestDraft({
      name:     r.name,
      address:  r.address ?? '',
      phone:    r.phone ?? '',
      email:    r.email ?? '',
      timezone: r.timezone,
    });
    setRestFormError(null);
    setEditingRest(true);
  }, [localData]);

  const handleCancelRest = useCallback((): void => {
    setEditingRest(false);
    setRestFormError(null);
  }, []);

  const handleSaveRest = useCallback((): void => {
    const err = validateRestaurant(restDraft);
    if (err) { setRestFormError(err); return; }
    void updateRestaurant(restDraft, updated => {
      setLocalData(prev => (prev ? { ...prev, restaurant: updated } : prev));
      setEditingRest(false);
      setRestFormError(null);
    });
  }, [restDraft, updateRestaurant]);

  const handleStartEditShift = useCallback((shift: ShiftRow): void => {
    setShiftDraft({
      name:      shift.name,
      days:      shift.days_of_week,
      start:     fmtTime(shift.start_time),
      end:       fmtTime(shift.end_time),
      slot:      String(shift.slot_duration),
      maxCovers: String(shift.max_covers_per_slot),
    });
    setShiftFormError(null);
    setEditingShiftId(shift.id);
  }, []);

  const handleCancelShift = useCallback((): void => {
    setEditingShiftId(null);
    setShiftFormError(null);
  }, []);

  const handleSaveShift = useCallback((): void => {
    if (!editingShiftId) return;
    const err = validateShift(shiftDraft);
    if (err) { setShiftFormError(err); return; }
    void updateShift(
      editingShiftId,
      {
        name:                shiftDraft.name,
        days_of_week:        shiftDraft.days,
        start_time:          shiftDraft.start,
        end_time:            shiftDraft.end,
        slot_duration:       parseInt(shiftDraft.slot, 10),
        max_covers_per_slot: parseInt(shiftDraft.maxCovers, 10),
      },
      updated => {
        setLocalData(prev =>
          prev ? { ...prev, shifts: prev.shifts.map(s => s.id === updated.id ? updated : s) } : prev
        );
        setEditingShiftId(null);
        setShiftFormError(null);
      },
    );
  }, [editingShiftId, shiftDraft, updateShift]);

  const handleStartEditTable = useCallback((table: TableRow): void => {
    setTableDraft({
      label:    table.label,
      zone:     table.zone,
      capacity: String(table.capacity),
    });
    setTableFormError(null);
    setEditingTableId(table.id);
  }, []);

  const handleCancelTable = useCallback((): void => {
    setEditingTableId(null);
    setTableFormError(null);
  }, []);

  const handleSaveTable = useCallback((): void => {
    if (!editingTableId) return;
    const err = validateTable(tableDraft);
    if (err) { setTableFormError(err); return; }
    void updateTable(
      editingTableId,
      {
        label:    tableDraft.label,
        zone:     tableDraft.zone,
        capacity: parseInt(tableDraft.capacity, 10),
      },
      updated => {
        setLocalData(prev =>
          prev ? { ...prev, tableRows: prev.tableRows.map(t => t.id === updated.id ? updated : t) } : prev
        );
        setEditingTableId(null);
        setTableFormError(null);
      },
    );
  }, [editingTableId, tableDraft, updateTable]);

  // ── Loading / Error states ────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} size="large" />
          <Text style={styles.loadingText}>Chargement des paramètres…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <View style={styles.errorCard}>
            <TouchableOpacity
              style={styles.backButtonInline}
              onPress={() => { navigation.goBack(); }}
            >
              <Ionicons name="chevron-back" size={18} color={colors.cta} />
              <Text style={styles.backText}>Admin</Text>
            </TouchableOpacity>
            <Text style={styles.errorTitle}>Impossible de charger les paramètres</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={refresh}>
              <Text style={styles.retryButtonText}>Réessayer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.signOutButtonSmall}
              onPress={() => { void handleSignOut(); }}
              disabled={signingOut}
            >
              {signingOut
                ? <ActivityIndicator color={colors.cta} size="small" />
                : <Text style={styles.signOutTextSmall}>Se déconnecter</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!localData) return <SafeAreaView style={styles.safe} />;

  const { restaurant, userProfile, shifts } = localData;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>

          {/* ── Back / Header ── */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => { navigation.goBack(); }}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={20} color={colors.cta} />
            <Text style={styles.backText}>Admin</Text>
          </TouchableOpacity>

          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>Paramètres</Text>
              <Text style={styles.headerSub}>Configuration du restaurant</Text>
            </View>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={refresh}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh-outline" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* ── 1. Restaurant ── */}
          <SectionHeader title="Restaurant" />

          {editingRest ? (
            <Card>
              <EditInput
                label="Nom *"
                value={restDraft.name}
                onChangeText={v => { setRestDraft(p => ({ ...p, name: v })); }}
                placeholder="La Maison"
                autoCapitalize="words"
              />
              <EditInput
                label="Adresse"
                value={restDraft.address}
                onChangeText={v => { setRestDraft(p => ({ ...p, address: v })); }}
                placeholder="Adresse du restaurant"
              />
              <EditInput
                label="Téléphone"
                value={restDraft.phone}
                onChangeText={v => { setRestDraft(p => ({ ...p, phone: v })); }}
                placeholder="+216 XX XXX XXX"
                keyboardType="phone-pad"
                autoCapitalize="none"
              />
              <EditInput
                label="Email"
                value={restDraft.email}
                onChangeText={v => { setRestDraft(p => ({ ...p, email: v })); }}
                placeholder="contact@restaurant.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <EditInput
                label="Fuseau horaire"
                value={restDraft.timezone}
                onChangeText={v => { setRestDraft(p => ({ ...p, timezone: v })); }}
                placeholder="Africa/Tunis"
                autoCapitalize="none"
              />
              {restFormError !== null && <FormError error={restFormError} />}
              {restSaveError !== null && <FormError error={restSaveError} />}
              {restSaveSuccess && <FormSuccess message="Modifications enregistrées." />}
              <ActionButtons onSave={handleSaveRest} onCancel={handleCancelRest} saving={savingRest} />
            </Card>
          ) : (
            <Card>
              <InfoRow label="Nom" value={restaurant.name} />
              {restaurant.address ? (
                <>
                  <Divider />
                  <InfoRow label="Adresse" value={restaurant.address} />
                </>
              ) : null}
              {restaurant.phone ? (
                <>
                  <Divider />
                  <InfoRow label="Téléphone" value={restaurant.phone} />
                </>
              ) : null}
              {restaurant.email ? (
                <>
                  <Divider />
                  <InfoRow label="Email" value={restaurant.email} />
                </>
              ) : null}
              <Divider />
              <InfoRow label="Fuseau" value={restaurant.timezone} />
              <Divider />
              <View style={styles.editButtonRow}>
                <EditButton onPress={handleStartEditRest} />
              </View>
            </Card>
          )}

          {/* ── 2. Compte ── */}
          <SectionHeader title="Compte" />
          <Card>
            <InfoRow label="Nom"        value={userProfile.fullName} />
            <Divider />
            <InfoRow label="Rôle"       value={ROLE_LABELS[userProfile.role] ?? userProfile.role} />
            <Divider />
            <InfoRow label="Restaurant" value={userProfile.restaurantName} />
            {userProfile.email ? (
              <>
                <Divider />
                <InfoRow label="Email" value={userProfile.email} />
              </>
            ) : null}
          </Card>

          {/* ── 3. Services ── */}
          <SectionHeader title="Services" />

          {shifts.length === 0 ? (
            <Card>
              <Text style={styles.emptyText}>Aucun service configuré.</Text>
            </Card>
          ) : (
            shifts.map(shift => {
              const isEditing = editingShiftId === shift.id;
              const isSaving  = savingShiftId  === shift.id;
              const isSaved   = savedShiftId   === shift.id;

              if (isEditing) {
                return (
                  <Card key={shift.id}>
                    <Text style={styles.editCardTitle}>{shift.name}</Text>
                    <EditInput
                      label="Nom du service"
                      value={shiftDraft.name}
                      onChangeText={v => { setShiftDraft(p => ({ ...p, name: v })); }}
                      placeholder="Déjeuner"
                      autoCapitalize="words"
                    />

                    <View style={styles.editInputGroup}>
                      <Text style={styles.editInputLabel}>Jours</Text>
                      <DayChipRow
                        days={shiftDraft.days}
                        onChange={days => { setShiftDraft(p => ({ ...p, days })); }}
                      />
                    </View>

                    <View style={styles.twoColRow}>
                      <View style={styles.twoColItem}>
                        <EditInput
                          label="Début (HH:mm)"
                          value={shiftDraft.start}
                          onChangeText={v => { setShiftDraft(p => ({ ...p, start: v })); }}
                          placeholder="12:00"
                          keyboardType="numbers-and-punctuation"
                          autoCapitalize="none"
                        />
                      </View>
                      <View style={styles.twoColItem}>
                        <EditInput
                          label="Fin (HH:mm)"
                          value={shiftDraft.end}
                          onChangeText={v => { setShiftDraft(p => ({ ...p, end: v })); }}
                          placeholder="14:30"
                          keyboardType="numbers-and-punctuation"
                          autoCapitalize="none"
                        />
                      </View>
                    </View>

                    <View style={styles.twoColRow}>
                      <View style={styles.twoColItem}>
                        <EditInput
                          label="Slot (min)"
                          value={shiftDraft.slot}
                          onChangeText={v => { setShiftDraft(p => ({ ...p, slot: v })); }}
                          placeholder="15"
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={styles.twoColItem}>
                        <EditInput
                          label="Couverts max"
                          value={shiftDraft.maxCovers}
                          onChangeText={v => { setShiftDraft(p => ({ ...p, maxCovers: v })); }}
                          placeholder="20"
                          keyboardType="numeric"
                        />
                      </View>
                    </View>

                    {shiftFormError !== null && <FormError error={shiftFormError} />}
                    {shiftSaveError !== null && <FormError error={shiftSaveError} />}
                    <ActionButtons onSave={handleSaveShift} onCancel={handleCancelShift} saving={isSaving} />
                  </Card>
                );
              }

              return (
                <View key={shift.id} style={styles.shiftCard}>
                  <View style={styles.shiftHeader}>
                    <Text style={styles.shiftName}>{shift.name}</Text>
                    <View style={styles.shiftBadge}>
                      <Text style={styles.shiftBadgeText}>{formatDays(shift.days_of_week)}</Text>
                    </View>
                  </View>
                  <Text style={styles.shiftHours}>{fmtTime(shift.start_time)}–{fmtTime(shift.end_time)}</Text>
                  <View style={styles.shiftMeta}>
                    <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                    <Text style={styles.shiftMetaText}>Slot {shift.slot_duration} min</Text>
                    <View style={styles.shiftMetaDot} />
                    <Ionicons name="people-outline" size={12} color={colors.textMuted} />
                    <Text style={styles.shiftMetaText}>{shift.max_covers_per_slot} couverts max</Text>
                  </View>
                  <View style={styles.shiftFooter}>
                    <EditButton onPress={() => { handleStartEditShift(shift); }} />
                    {isSaved && <Text style={styles.savedText}>Enregistré</Text>}
                  </View>
                </View>
              );
            })
          )}

          {/* ── 4. Tables ── */}
          <SectionHeader title="Tables" />

          <View style={styles.planNotice}>
            <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
            <Text style={styles.planNoticeText}>
              Position, forme et suppression des tables se gèrent dans le plan de salle. Seuls le nom, la zone et la capacité sont modifiables ici.
            </Text>
          </View>

          {tablesByZone.length === 0 ? (
            <Card>
              <Text style={styles.emptyText}>Aucune table configurée.</Text>
            </Card>
          ) : (
            tablesByZone.map(({ zone, tables }) => (
              <View key={zone} style={styles.zoneBlock}>
                <Text style={styles.zoneHeader}>{zone}</Text>
                <Card>
                  {tables.map((table, idx) => {
                    const isEditing = editingTableId === table.id;
                    const isSaving  = savingTableId  === table.id;
                    const isSaved   = savedTableId   === table.id;

                    return (
                      <React.Fragment key={table.id}>
                        {idx > 0 && <Divider />}

                        {isEditing ? (
                          <View style={styles.tableEditForm}>
                            <View style={styles.twoColRow}>
                              <View style={styles.twoColItem}>
                                <EditInput
                                  label="Numéro / Nom"
                                  value={tableDraft.label}
                                  onChangeText={v => { setTableDraft(p => ({ ...p, label: v })); }}
                                  placeholder="T1"
                                  autoCapitalize="none"
                                />
                              </View>
                              <View style={styles.twoColItem}>
                                <EditInput
                                  label="Capacité"
                                  value={tableDraft.capacity}
                                  onChangeText={v => { setTableDraft(p => ({ ...p, capacity: v })); }}
                                  placeholder="4"
                                  keyboardType="numeric"
                                />
                              </View>
                            </View>
                            <ZoneChipPicker
                              selected={tableDraft.zone}
                              zones={availableZones}
                              onSelect={zone => { setTableDraft(p => ({ ...p, zone })); }}
                            />
                            {tableFormError !== null && <FormError error={tableFormError} />}
                            {tableSaveError !== null && <FormError error={tableSaveError} />}
                            <ActionButtons onSave={handleSaveTable} onCancel={handleCancelTable} saving={isSaving} />
                          </View>
                        ) : (
                          <View style={styles.tableRow}>
                            <View style={styles.tableInfo}>
                              <Text style={styles.tableLabel}>{table.label}</Text>
                              <Text style={styles.tableMeta}>{table.capacity} pax</Text>
                            </View>
                            {isSaved
                              ? <Text style={styles.savedText}>Enregistré</Text>
                              : <EditButton onPress={() => { handleStartEditTable(table); }} />}
                          </View>
                        )}
                      </React.Fragment>
                    );
                  })}
                </Card>
              </View>
            ))
          )}

          {/* ── 5. Réservations ── */}
          <SectionHeader title="Réservations" />

          <Card>
            <View style={styles.ruleRow}>
              <View style={styles.ruleContent}>
                <Text style={styles.ruleLabel}>Statut à la création</Text>
                <Text style={styles.ruleValue}>En attente de confirmation</Text>
              </View>
              <FixedBadge />
            </View>
            <Divider />
            <View style={styles.ruleRow}>
              <View style={styles.ruleContent}>
                <Text style={styles.ruleLabel}>Intervalle de créneaux</Text>
                <Text style={styles.ruleValue}>15 min (selon le service)</Text>
              </View>
              <FixedBadge />
            </View>
            <Divider />
            <View style={styles.ruleRow}>
              <View style={styles.ruleContent}>
                <Text style={styles.ruleLabel}>Walk-ins</Text>
                <Text style={styles.ruleValue}>Autorisés</Text>
              </View>
              <FixedBadge />
            </View>
            <Divider />
            <View style={styles.ruleRow}>
              <View style={styles.ruleContent}>
                <Text style={styles.ruleLabel}>Durée par couvert</Text>
                <Text style={styles.ruleValue}>Règles par service</Text>
              </View>
              <SoonBadge />
            </View>
            <Divider />
            <View style={styles.ruleRow}>
              <View style={styles.ruleContent}>
                <Text style={styles.ruleLabel}>Capacité max</Text>
                <Text style={styles.ruleValue}>Couverts max par service</Text>
              </View>
              <SoonBadge />
            </View>
            <Divider />
            <View style={styles.ruleNotice}>
              <Text style={styles.ruleNoticeText}>
                Les règles "À venir" seront configurables dans une prochaine version.
              </Text>
            </View>
          </Card>

          {/* ── 6. Canaux et intégrations ── */}
          <SectionHeader title="Canaux et intégrations" />
          <Card>
            {CHANNELS.map((ch, idx) => (
              <React.Fragment key={ch.label}>
                {idx > 0 && <Divider />}
                <ChannelRow channel={ch} />
              </React.Fragment>
            ))}
          </Card>

          {/* ── 7. Session ── */}
          <SectionHeader title="Session" />
          <Card>
            <TouchableOpacity
              style={styles.signOutButton}
              onPress={() => { void handleSignOut(); }}
              disabled={signingOut}
            >
              {signingOut ? (
                <ActivityIndicator color={colors.cta} size="small" />
              ) : (
                <>
                  <Ionicons name="log-out-outline" size={16} color={colors.cta} />
                  <Text style={styles.signOutText}>Se déconnecter</Text>
                </>
              )}
            </TouchableOpacity>
            {signOutError !== null ? (
              <Text style={styles.signOutError}>{signOutError}</Text>
            ) : null}
          </Card>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CARD_SHADOW = {
  shadowColor:   colors.primary,
  shadowOffset:  { width: 0, height: 1 } as const,
  shadowOpacity: 0.06,
  shadowRadius:  4,
  elevation:     1,
};

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.background,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xxl },
  container: {
    padding:   spacing.xl,
    maxWidth:  layout.contentMaxWidth,
    width:     '100%',
    alignSelf: 'center',
  },
  centered: {
    flex:           1,
    justifyContent: 'center',
    alignItems:     'center',
    padding:        spacing.xl,
  },

  // Loading
  loadingText: {
    ...typography.body,
    color:     colors.textMuted,
    marginTop: spacing.md,
    textAlign: 'center',
  },

  // Error
  errorCard: {
    backgroundColor: colors.surface,
    borderRadius:    radius.lg,
    padding:         spacing.xl,
    width:           '100%',
    maxWidth:        400,
    ...CARD_SHADOW,
  },
  errorTitle: {
    ...typography.h2,
    color:        colors.textPrimary,
    marginBottom: spacing.sm,
  },
  errorMessage: {
    ...typography.body,
    color:        colors.textSecondary,
    marginBottom: spacing.xl,
  },
  retryButton: {
    backgroundColor: colors.cta,
    borderRadius:    radius.md,
    paddingVertical: spacing.md,
    alignItems:      'center',
  },
  retryButtonText: {
    ...typography.bodyMedium,
    color: colors.textOnDark,
  },

  // Back navigation
  backButton: {
    flexDirection:   'row',
    alignItems:      'center',
    alignSelf:       'flex-start',
    marginBottom:    spacing.md,
    paddingVertical: spacing.xs,
  },
  backButtonInline: {
    flexDirection: 'row',
    alignItems:    'center',
    marginBottom:  spacing.lg,
    alignSelf:     'flex-start',
  },
  backText: {
    ...typography.bodyMedium,
    color: colors.cta,
  },

  // Header
  headerRow: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
    marginBottom:   spacing.lg,
  },
  headerLeft: { flex: 1 },
  headerTitle: {
    ...typography.h1,
    color:        colors.textPrimary,
    marginBottom: spacing.xs,
  },
  headerSub: {
    ...typography.body,
    color: colors.textMuted,
  },
  refreshButton: {
    width:           36,
    height:          36,
    borderRadius:    radius.md,
    backgroundColor: colors.surface,
    alignItems:      'center',
    justifyContent:  'center',
    marginTop:       spacing.xs,
    ...CARD_SHADOW,
  },

  // Section headers
  sectionTitle: {
    ...typography.h2,
    color:        colors.textPrimary,
    marginTop:    spacing.xxl,
    marginBottom: spacing.md,
  },

  // Generic card
  card: {
    backgroundColor: colors.surface,
    borderRadius:    radius.lg,
    padding:         spacing.lg,
    ...CARD_SHADOW,
  },

  // Info rows
  infoRow: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    paddingVertical: spacing.sm,
    gap:             spacing.sm,
  },
  infoLabel: {
    ...typography.label,
    color:      colors.textMuted,
    width:      96,
    marginTop:  2,
    flexShrink: 0,
  },
  infoValue: {
    ...typography.body,
    color: colors.textPrimary,
    flex:  1,
  },
  divider: {
    height:           1,
    backgroundColor:  colors.borderLight,
    marginHorizontal: -spacing.lg,
  },

  // Edit button
  editButtonRow: {
    paddingTop: spacing.sm,
    alignItems: 'flex-start',
  },
  editButton: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.xs,
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius:      radius.md,
    borderWidth:       1,
    borderColor:       colors.cta,
    backgroundColor:   colors.ctaLight,
  },
  editButtonText: {
    ...typography.bodyMedium,
    color: colors.cta,
  },

  // Edit form inputs
  editInputGroup: {
    marginBottom: spacing.md,
  },
  editInputLabel: {
    ...typography.label,
    color:        colors.textMuted,
    marginBottom: spacing.xs,
  },
  editInput: {
    backgroundColor:   colors.background,
    borderRadius:      radius.md,
    borderWidth:       1,
    borderColor:       colors.border,
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color:             colors.textPrimary,
    minHeight:         44,
  },

  editCardTitle: {
    ...typography.bodyMedium,
    color:        colors.textMuted,
    marginBottom: spacing.md,
  },

  // Two-column layout for edit inputs
  twoColRow: {
    flexDirection: 'row',
    gap:           spacing.sm,
  },
  twoColItem: {
    flex: 1,
  },

  // Form feedback
  formError: {
    ...typography.small,
    color:        colors.cta,
    marginBottom: spacing.sm,
  },
  formSuccess: {
    ...typography.small,
    color:        colors.statusFree,
    marginBottom: spacing.sm,
  },

  // Action buttons (Save / Cancel)
  actionRow: {
    flexDirection: 'row',
    gap:           spacing.sm,
    marginTop:     spacing.sm,
  },
  saveButton: {
    flex:              1,
    backgroundColor:   colors.cta,
    borderRadius:      radius.md,
    paddingVertical:   spacing.md,
    alignItems:        'center',
    justifyContent:    'center',
    minHeight:         44,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    ...typography.bodyMedium,
    color: colors.textOnDark,
  },
  cancelButton: {
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius:      radius.md,
    borderWidth:       1,
    borderColor:       colors.border,
    alignItems:        'center',
    justifyContent:    'center',
    minHeight:         44,
  },
  cancelButtonText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },

  // Saved confirmation
  savedText: {
    ...typography.small,
    color: colors.statusFree,
  },

  // Day chips
  dayRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.xs,
    marginTop:     spacing.xs,
  },
  dayChip: {
    paddingVertical:   spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius:      radius.sm,
    borderWidth:       1,
    borderColor:       colors.border,
    backgroundColor:   colors.background,
  },
  dayChipActive: {
    backgroundColor: colors.cta,
    borderColor:     colors.cta,
  },
  dayChipText: {
    ...typography.label,
    color: colors.textSecondary,
  },
  dayChipTextActive: {
    color: colors.textOnDark,
  },

  // Shift cards (view mode)
  shiftCard: {
    backgroundColor: colors.surface,
    borderRadius:    radius.lg,
    padding:         spacing.lg,
    marginBottom:    spacing.sm,
    ...CARD_SHADOW,
  },
  shiftHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   spacing.xs,
  },
  shiftName: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  shiftBadge: {
    backgroundColor:   colors.goldLight,
    borderRadius:      radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   2,
  },
  shiftBadgeText: {
    ...typography.label,
    color: colors.gold,
  },
  shiftHours: {
    ...typography.h2,
    color:        colors.textPrimary,
    marginBottom: spacing.sm,
  },
  shiftMeta: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
  },
  shiftMetaText: {
    ...typography.small,
    color: colors.textMuted,
  },
  shiftMetaDot: {
    width:           3,
    height:          3,
    borderRadius:    2,
    backgroundColor: colors.sandLight,
    marginHorizontal: spacing.xs,
  },
  shiftFooter: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginTop:      spacing.md,
  },

  // Table section
  planNotice: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           spacing.xs,
    marginBottom:  spacing.md,
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor:   colors.surfaceWarm,
    borderRadius:      radius.md,
    borderLeftWidth:   2,
    borderLeftColor:   colors.sand,
  },
  planNoticeText: {
    ...typography.small,
    color: colors.textMuted,
    flex:  1,
  },
  zoneBlock: {
    marginBottom: spacing.md,
  },
  zoneHeader: {
    ...typography.label,
    color:        colors.textMuted,
    marginBottom: spacing.sm,
  },
  tableRow: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingVertical: spacing.sm,
    gap:             spacing.sm,
  },
  tableInfo: {
    flex:          1,
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.md,
  },
  tableLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  tableMeta: {
    ...typography.small,
    color: colors.textMuted,
  },
  tableEditForm: {
    paddingVertical: spacing.sm,
  },

  // Zone chip picker
  zonePickerRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.xs,
    marginTop:     spacing.xs,
  },
  zoneChip: {
    paddingVertical:   spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius:      radius.xl,
    borderWidth:       1,
    borderColor:       colors.border,
    backgroundColor:   colors.background,
  },
  zoneChipActive: {
    backgroundColor: colors.cta,
    borderColor:     colors.cta,
  },
  zoneChipText: {
    ...typography.small,
    color: colors.textSecondary,
  },
  zoneChipTextActive: {
    color: colors.textOnDark,
  },

  // Réservations rules
  ruleRow: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingVertical: spacing.sm,
    gap:             spacing.sm,
  },
  ruleContent: {
    flex: 1,
  },
  ruleLabel: {
    ...typography.label,
    color:        colors.textMuted,
    marginBottom: 2,
  },
  ruleValue: {
    ...typography.body,
    color: colors.textPrimary,
  },
  soonBadge: {
    backgroundColor:   colors.borderLight,
    borderRadius:      radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   2,
    flexShrink:        0,
  },
  soonBadgeText: {
    ...typography.label,
    color: colors.textMuted,
  },
  fixedBadge: {
    backgroundColor:   colors.goldLight,
    borderRadius:      radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   2,
    flexShrink:        0,
  },
  fixedBadgeText: {
    ...typography.label,
    color: colors.gold,
  },
  ruleNotice: {
    paddingTop: spacing.sm,
  },
  ruleNoticeText: {
    ...typography.small,
    color:     colors.textMuted,
    fontStyle: 'italic',
  },

  // Channels
  channelRow: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingVertical: spacing.sm,
    gap:             spacing.sm,
  },
  channelIcon: {
    width:           32,
    height:          32,
    borderRadius:    radius.sm,
    backgroundColor: colors.borderLight,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  channelContent: { flex: 1 },
  channelLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  channelDetail: {
    ...typography.small,
    color: colors.textMuted,
  },
  channelBadge: {
    borderRadius:      radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   2,
    flexShrink:        0,
  },
  channelBadgeText: {
    ...typography.label,
  },

  // Session
  signOutButton: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               spacing.sm,
    paddingVertical:   spacing.md,
    marginTop:         spacing.xs,
    borderRadius:      radius.md,
    borderWidth:       1,
    borderColor:       colors.cta,
    backgroundColor:   colors.ctaLight,
    minHeight:         44,
  },
  signOutText: {
    ...typography.bodyMedium,
    color: colors.cta,
  },
  signOutError: {
    ...typography.small,
    color:     colors.cta,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  signOutButtonSmall: {
    marginTop:       spacing.md,
    alignItems:      'center',
    paddingVertical: spacing.sm,
    minHeight:       36,
  },
  signOutTextSmall: {
    ...typography.small,
    color:              colors.textMuted,
    textDecorationLine: 'underline',
  },

  // Empty state
  emptyText: {
    ...typography.body,
    color:     colors.textMuted,
    textAlign: 'center',
    padding:   spacing.sm,
  },
});

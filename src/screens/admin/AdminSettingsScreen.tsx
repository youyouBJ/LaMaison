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
import { useTeamMembers }   from '../../hooks/useTeamMembers';
import { useStaffInvite }   from '../../hooks/useStaffInvite';
import { supabase } from '../../lib/supabase';
import type { AdminStackParamList } from '../../navigation/AdminNavigator';
import type { Database } from '../../types/database';
import { useI18n } from '../../i18n';
import type { TranslationKey, TranslateFn } from '../../i18n';

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

function getRoleLabel(role: string, t: TranslateFn): string {
  if (role === 'host')   return t('admin_role_host');
  if (role === 'waiter') return t('admin_role_waiter');
  return role.charAt(0).toUpperCase() + role.slice(1);
}

type ChannelStatus = 'active' | 'configured' | 'inactive' | 'soon';

type Channel = {
  icon:      React.ComponentProps<typeof Ionicons>['name'];
  labelKey:  TranslationKey;
  detailKey: TranslationKey;
  status:    ChannelStatus;
};

const CHANNELS: Channel[] = [
  { icon: 'logo-whatsapp',      labelKey: 'admin_channel_wa_manual',    detailKey: 'admin_channel_app_detail',    status: 'active'     },
  { icon: 'mail-outline',       labelKey: 'admin_channel_email_manual', detailKey: 'admin_channel_app_detail',    status: 'active'     },
  { icon: 'star-outline',       labelKey: 'admin_channel_survey',       detailKey: 'admin_channel_survey_detail', status: 'configured' },
  { icon: 'chatbubble-outline', labelKey: 'admin_channel_sms',          detailKey: 'admin_channel_sms_detail',    status: 'inactive'   },
  { icon: 'logo-whatsapp',      labelKey: 'admin_channel_wa_api',       detailKey: 'admin_channel_wa_api_detail', status: 'soon'       },
  { icon: 'mail',               labelKey: 'admin_channel_resend',       detailKey: 'admin_channel_resend_detail', status: 'soon'       },
];

const CHANNEL_STATUS_CONFIG: Record<ChannelStatus, { labelKey: TranslationKey; color: string; bg: string }> = {
  active:     { labelKey: 'admin_channel_active',     color: colors.statusFree,  bg: colors.statusFreeLight },
  configured: { labelKey: 'admin_channel_configured', color: colors.gold,        bg: colors.goldLight       },
  inactive:   { labelKey: 'admin_channel_inactive',   color: colors.textMuted,   bg: colors.borderLight     },
  soon:       { labelKey: 'admin_channel_soon',       color: colors.textMuted,   bg: colors.borderLight     },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidTime(t: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(t)) return false;
  const parts = t.split(':');
  const h = parseInt(parts[0] ?? '99', 10);
  const m = parseInt(parts[1] ?? '99', 10);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

function validateRestaurant(d: RestDraft, t: TranslateFn): string | null {
  if (d.name.trim() === '') return t('admin_val_rest_name');
  if (d.email.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim()))
    return t('admin_val_rest_email');
  return null;
}

function validateShift(d: ShiftDraft, t: TranslateFn): string | null {
  if (d.name.trim() === '') return t('admin_val_shift_name');
  if (d.days.length === 0) return t('admin_val_shift_days');
  if (!isValidTime(d.start)) return t('admin_val_shift_start');
  if (!isValidTime(d.end)) return t('admin_val_shift_end');
  if (d.end <= d.start) return t('admin_val_shift_end_after');
  const slot = parseInt(d.slot, 10);
  if (isNaN(slot) || slot <= 0) return t('admin_val_shift_slot');
  const max = parseInt(d.maxCovers, 10);
  if (isNaN(max) || max <= 0) return t('admin_val_shift_covers');
  return null;
}

function validateTable(d: TableDraft, t: TranslateFn): string | null {
  if (d.label.trim() === '') return t('admin_val_table_label');
  if (d.zone.trim() === '') return t('admin_val_table_zone');
  const cap = parseInt(d.capacity, 10);
  if (isNaN(cap) || cap < 1) return t('admin_val_table_capacity');
  return null;
}

function formatDays(days: number[], t: TranslateFn): string {
  if (days.length === 0) return '–';
  if (days.length === 7) return t('common_every_day');
  const sorted = [...days].sort((a, b) => a - b);
  const labels = sorted.map(d => t(`common_day_${d}` as TranslationKey));
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
  const { t } = useI18n();
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
          : <Text style={styles.saveButtonText}>{t('settings_save')}</Text>}
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.cancelButton}
        onPress={onCancel}
        disabled={saving}
        activeOpacity={0.7}
      >
        <Text style={styles.cancelButtonText}>{t('settings_cancel')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function EditButton({ onPress }: { onPress: () => void }): React.JSX.Element {
  const { t } = useI18n();
  return (
    <TouchableOpacity style={styles.editButton} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name="pencil-outline" size={14} color={colors.cta} />
      <Text style={styles.editButtonText}>{t('settings_edit')}</Text>
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
  const { t } = useI18n();
  return (
    <View style={styles.editInputGroup}>
      <Text style={styles.editInputLabel}>{t('admin_field_zone')}</Text>
      {zones.length === 0 ? (
        <Text style={styles.formError}>{t('admin_no_zones')}</Text>
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
  const { t } = useI18n();
  const toggle = (d: number): void => {
    const next = days.includes(d) ? days.filter(x => x !== d) : [...days, d];
    onChange(next);
  };
  return (
    <View style={styles.dayRow}>
      {([0, 1, 2, 3, 4, 5, 6] as const).map(idx => {
        const active = days.includes(idx);
        return (
          <TouchableOpacity
            key={idx}
            style={[styles.dayChip, active && styles.dayChipActive]}
            onPress={() => { toggle(idx); }}
            activeOpacity={0.7}
          >
            <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>
              {t(`common_day_${idx}` as TranslationKey)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function SoonBadge(): React.JSX.Element {
  const { t } = useI18n();
  return (
    <View style={styles.soonBadge}>
      <Text style={styles.soonBadgeText}>{t('admin_channel_soon')}</Text>
    </View>
  );
}

function FixedBadge(): React.JSX.Element {
  const { t } = useI18n();
  return (
    <View style={styles.fixedBadge}>
      <Text style={styles.fixedBadgeText}>{t('admin_badge_fixed')}</Text>
    </View>
  );
}

function ChannelRow({ channel }: { channel: Channel }): React.JSX.Element {
  const { t } = useI18n();
  const cfg = CHANNEL_STATUS_CONFIG[channel.status];
  return (
    <View style={styles.channelRow}>
      <View style={styles.channelIcon}>
        <Ionicons name={channel.icon} size={18} color={colors.sand} />
      </View>
      <View style={styles.channelContent}>
        <Text style={styles.channelLabel}>{t(channel.labelKey)}</Text>
        <Text style={styles.channelDetail}>{t(channel.detailKey)}</Text>
      </View>
      <View style={[styles.channelBadge, { backgroundColor: cfg.bg }]}>
        <Text style={[styles.channelBadgeText, { color: cfg.color }]}>{t(cfg.labelKey)}</Text>
      </View>
    </View>
  );
}

function InviteButton({
  id,
  status,
  onInvite,
}: {
  id:       string;
  status:   'idle' | 'loading' | 'success' | 'error';
  onInvite: (id: string) => void;
}): React.JSX.Element {
  const { t } = useI18n();
  return (
    <TouchableOpacity
      style={[
        styles.inviteButton,
        status === 'loading' && styles.inviteButtonDisabled,
        status === 'success' && styles.inviteButtonSuccess,
      ]}
      onPress={() => { onInvite(id); }}
      disabled={status === 'loading' || status === 'success'}
      activeOpacity={0.8}
    >
      {status === 'loading' ? (
        <ActivityIndicator color={colors.textOnDark} size="small" />
      ) : status === 'success' ? (
        <>
          <Ionicons name="checkmark" size={13} color={colors.statusFree} />
          <Text style={styles.inviteButtonSuccessText}>{t('settings_invite_sent')}</Text>
        </>
      ) : (
        <Text style={styles.inviteButtonText}>{t('settings_resend_invite')}</Text>
      )}
    </TouchableOpacity>
  );
}

function TeamMemberRow({
  id,
  fullName,
  role,
  isSelf,
  canInvite,
  status,
  errorMsg,
  onInvite,
}: {
  id:        string;
  fullName:  string;
  role:      string;
  isSelf:    boolean;
  canInvite: boolean;
  status:    'idle' | 'loading' | 'success' | 'error';
  errorMsg:  string | null;
  onInvite:  (id: string) => void;
}): React.JSX.Element {
  const { t } = useI18n();
  const roleLabel = getRoleLabel(role, t);

  return (
    <View style={styles.teamMemberRow}>
      <View style={styles.teamMemberInfo}>
        <Text style={styles.teamMemberName}>{fullName}</Text>
        <View style={styles.teamMemberRoleBadge}>
          <Text style={styles.teamMemberRoleText}>{roleLabel}</Text>
        </View>
        {errorMsg !== null && (
          <Text style={styles.teamInviteError} numberOfLines={2}>{errorMsg}</Text>
        )}
      </View>

      {canInvite && !isSelf && (
        <InviteButton id={id} status={status} onInvite={onInvite} />
      )}

      {isSelf && (
        <View style={styles.selfBadge}>
          <Text style={styles.selfBadgeText}>{t('admin_self_badge')}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AdminSettingsScreen({ navigation }: Props): React.JSX.Element {
  const { t, locale, setLocale } = useI18n();
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

  // Section Équipe visible uniquement pour le compte owner (Youssef) — V1
  // La gestion multi-admin est prévue en V2 (voir BACKLOG.md).
  const OWNER_EMAIL = 'youssefbenjema@gmail.com';
  const isOwnerAccount = localData?.userProfile.email === OWNER_EMAIL;
  const { members: teamMembers, loading: teamLoading, error: teamError } = useTeamMembers(
    isOwnerAccount ? restaurantId : null,
  );
  const { sendInvite, getStatus, getError: getInviteError } = useStaffInvite();

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
  const [tablesExpanded, setTablesExpanded] = useState(false);
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [tableDraft, setTableDraft]         = useState<TableDraft>({ label: '', zone: '', capacity: '' });
  const [tableFormError, setTableFormError] = useState<string | null>(null);

  // ── Tables grouped by zone ──────────────────────────────────────────────────

  const tablesByZone = useMemo((): Array<{ zone: string; tables: TableRow[] }> => {
    if (!localData) return [];
    const map = new Map<string, TableRow[]>();
    for (const row of localData.tableRows) {
      const arr = map.get(row.zone) ?? [];
      arr.push(row);
      map.set(row.zone, arr);
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
      if (__DEV__) console.error('[AdminSettings] signOut threw:', e);
      setSignOutError(t('admin_signout_error'));
      setSigningOut(false);
    }
  }, [t]);

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
    const err = validateRestaurant(restDraft, t);
    if (err) { setRestFormError(err); return; }
    void updateRestaurant(restDraft, updated => {
      setLocalData(prev => (prev ? { ...prev, restaurant: updated } : prev));
      setEditingRest(false);
      setRestFormError(null);
    });
  }, [restDraft, t, updateRestaurant]);

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
    const err = validateShift(shiftDraft, t);
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
  }, [editingShiftId, shiftDraft, t, updateShift]);

  const handleToggleTables = useCallback((): void => {
    setTablesExpanded(prev => {
      if (prev) {
        setEditingTableId(null);
        setTableFormError(null);
      }
      return !prev;
    });
  }, []);

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
    const err = validateTable(tableDraft, t);
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
          prev ? { ...prev, tableRows: prev.tableRows.map(row => row.id === updated.id ? updated : row) } : prev
        );
        setEditingTableId(null);
        setTableFormError(null);
      },
    );
  }, [editingTableId, t, tableDraft, updateTable]);

  // ── Loading / Error states ────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} size="large" />
          <Text style={styles.loadingText}>{t('settings_loading')}</Text>
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
              <Text style={styles.backText}>{t('settings_back')}</Text>
            </TouchableOpacity>
            <Text style={styles.errorTitle}>{t('settings_error')}</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={refresh}>
              <Text style={styles.retryButtonText}>{t('common_retry')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.signOutButtonSmall}
              onPress={() => { void handleSignOut(); }}
              disabled={signingOut}
            >
              {signingOut
                ? <ActivityIndicator color={colors.cta} size="small" />
                : <Text style={styles.signOutTextSmall}>{t('settings_sign_out')}</Text>}
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
            <Text style={styles.backText}>{t('settings_back')}</Text>
          </TouchableOpacity>

          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>{t('settings_title')}</Text>
              <Text style={styles.headerSub}>{t('settings_sub')}</Text>
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
          <SectionHeader title={t('settings_section_restaurant')} />

          {editingRest ? (
            <Card>
              <EditInput
                label={t('admin_field_name')}
                value={restDraft.name}
                onChangeText={v => { setRestDraft(p => ({ ...p, name: v })); }}
                placeholder="La Maison"
                autoCapitalize="words"
              />
              <EditInput
                label={t('admin_field_address')}
                value={restDraft.address}
                onChangeText={v => { setRestDraft(p => ({ ...p, address: v })); }}
                placeholder="Adresse du restaurant"
              />
              <EditInput
                label={t('admin_field_phone')}
                value={restDraft.phone}
                onChangeText={v => { setRestDraft(p => ({ ...p, phone: v })); }}
                placeholder="+216 XX XXX XXX"
                keyboardType="phone-pad"
                autoCapitalize="none"
              />
              <EditInput
                label={t('admin_field_email')}
                value={restDraft.email}
                onChangeText={v => { setRestDraft(p => ({ ...p, email: v })); }}
                placeholder="contact@restaurant.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <EditInput
                label={t('admin_field_timezone')}
                value={restDraft.timezone}
                onChangeText={v => { setRestDraft(p => ({ ...p, timezone: v })); }}
                placeholder="Africa/Tunis"
                autoCapitalize="none"
              />
              {restFormError !== null && <FormError error={restFormError} />}
              {restSaveError !== null && <FormError error={restSaveError} />}
              {restSaveSuccess && <FormSuccess message={t('settings_saved')} />}
              <ActionButtons onSave={handleSaveRest} onCancel={handleCancelRest} saving={savingRest} />
            </Card>
          ) : (
            <Card>
              <InfoRow label={t('admin_info_name')} value={restaurant.name} />
              {restaurant.address ? (
                <>
                  <Divider />
                  <InfoRow label={t('admin_info_address')} value={restaurant.address} />
                </>
              ) : null}
              {restaurant.phone ? (
                <>
                  <Divider />
                  <InfoRow label={t('admin_info_phone')} value={restaurant.phone} />
                </>
              ) : null}
              {restaurant.email ? (
                <>
                  <Divider />
                  <InfoRow label={t('admin_info_email')} value={restaurant.email} />
                </>
              ) : null}
              <Divider />
              <InfoRow label={t('admin_info_timezone')} value={restaurant.timezone} />
              <Divider />
              <View style={styles.editButtonRow}>
                <EditButton onPress={handleStartEditRest} />
              </View>
            </Card>
          )}

          {/* ── 2. Compte ── */}
          <SectionHeader title={t('settings_section_account')} />
          <Card>
            <InfoRow label={t('admin_info_name')}       value={userProfile.fullName} />
            <Divider />
            <InfoRow label={t('admin_info_role')}       value={getRoleLabel(userProfile.role, t)} />
            <Divider />
            <InfoRow label={t('admin_info_restaurant')} value={userProfile.restaurantName} />
            {userProfile.email ? (
              <>
                <Divider />
                <InfoRow label={t('admin_info_email')} value={userProfile.email} />
              </>
            ) : null}
          </Card>

          {/* ── 3. Équipe ── */}
          {isOwnerAccount && (
            <>
              <SectionHeader title={t('settings_section_team')} />
              {teamLoading ? (
                <Card>
                  <ActivityIndicator color={colors.gold} size="small" />
                </Card>
              ) : teamError !== null ? (
                <Card>
                  <Text style={styles.emptyText}>{teamError}</Text>
                </Card>
              ) : teamMembers.length === 0 ? (
                <Card>
                  <Text style={styles.emptyText}>{t('settings_no_team')}</Text>
                </Card>
              ) : (
                <Card>
                  {teamMembers.map((member, idx) => {
                    const isSelf = member.id === localData?.userProfile.id;
                    return (
                      <React.Fragment key={member.id}>
                        {idx > 0 && <Divider />}
                        <TeamMemberRow
                          id={member.id}
                          fullName={member.fullName}
                          role={member.role}
                          isSelf={isSelf}
                          canInvite={isOwnerAccount}
                          status={getStatus(member.id)}
                          errorMsg={getInviteError(member.id)}
                          onInvite={id => { void sendInvite(id); }}
                        />
                      </React.Fragment>
                    );
                  })}
                </Card>
              )}
            </>
          )}

          {/* ── 4. Services ── */}
          <SectionHeader title={t('settings_section_shifts')} />

          {shifts.length === 0 ? (
            <Card>
              <Text style={styles.emptyText}>{t('admin_no_shift')}</Text>
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
                      label={t('admin_field_shift_name')}
                      value={shiftDraft.name}
                      onChangeText={v => { setShiftDraft(p => ({ ...p, name: v })); }}
                      placeholder="Déjeuner"
                      autoCapitalize="words"
                    />

                    <View style={styles.editInputGroup}>
                      <Text style={styles.editInputLabel}>{t('admin_field_days')}</Text>
                      <DayChipRow
                        days={shiftDraft.days}
                        onChange={days => { setShiftDraft(p => ({ ...p, days })); }}
                      />
                    </View>

                    <View style={styles.twoColRow}>
                      <View style={styles.twoColItem}>
                        <EditInput
                          label={t('admin_field_start')}
                          value={shiftDraft.start}
                          onChangeText={v => { setShiftDraft(p => ({ ...p, start: v })); }}
                          placeholder="12:00"
                          keyboardType="numbers-and-punctuation"
                          autoCapitalize="none"
                        />
                      </View>
                      <View style={styles.twoColItem}>
                        <EditInput
                          label={t('admin_field_end')}
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
                          label={t('admin_field_slot')}
                          value={shiftDraft.slot}
                          onChangeText={v => { setShiftDraft(p => ({ ...p, slot: v })); }}
                          placeholder="15"
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={styles.twoColItem}>
                        <EditInput
                          label={t('admin_field_max_covers')}
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
                      <Text style={styles.shiftBadgeText}>{formatDays(shift.days_of_week, t)}</Text>
                    </View>
                  </View>
                  <Text style={styles.shiftHours}>{fmtTime(shift.start_time)}–{fmtTime(shift.end_time)}</Text>
                  <View style={styles.shiftMeta}>
                    <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                    <Text style={styles.shiftMetaText}>{t('admin_slot_duration', { n: shift.slot_duration })}</Text>
                    <View style={styles.shiftMetaDot} />
                    <Ionicons name="people-outline" size={12} color={colors.textMuted} />
                    <Text style={styles.shiftMetaText}>{t('admin_covers_max', { n: shift.max_covers_per_slot, s: shift.max_covers_per_slot > 1 ? 's' : '' })}</Text>
                  </View>
                  <View style={styles.shiftFooter}>
                    <EditButton onPress={() => { handleStartEditShift(shift); }} />
                    {isSaved && <Text style={styles.savedText}>{t('common_saved')}</Text>}
                  </View>
                </View>
              );
            })
          )}

          {/* ── 5. Tables ── */}
          <SectionHeader title={t('settings_section_tables')} />

          <Card>
            <View style={styles.tableSummaryRow}>
              <View style={styles.tableSummaryInfo}>
                <Text style={styles.tableSummaryTitle}>{t('admin_table_summary')}</Text>
                <Text style={styles.tableSummaryMeta}>
                  {t('admin_table_meta', {
                    tables: localData.tableRows.length,
                    ts:     localData.tableRows.length > 1 ? 's' : '',
                    zones:  tablesByZone.length,
                    zs:     tablesByZone.length > 1 ? 's' : '',
                  })}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.manageTablesButton}
                onPress={handleToggleTables}
                activeOpacity={0.7}
              >
                <Text style={styles.manageTablesText}>
                  {tablesExpanded ? t('settings_hide') : t('settings_manage_tables')}
                </Text>
                <Ionicons
                  name={tablesExpanded ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={colors.cta}
                />
              </TouchableOpacity>
            </View>
          </Card>

          {tablesExpanded && (
            <>
              <View style={styles.planNotice}>
                <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
                <Text style={styles.planNoticeText}>{t('admin_table_notice')}</Text>
              </View>

              {tablesByZone.length === 0 ? (
                <Card>
                  <Text style={styles.emptyText}>{t('admin_no_tables')}</Text>
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
                                      label={t('admin_field_table_label')}
                                      value={tableDraft.label}
                                      onChangeText={v => { setTableDraft(p => ({ ...p, label: v })); }}
                                      placeholder="T1"
                                      autoCapitalize="none"
                                    />
                                  </View>
                                  <View style={styles.twoColItem}>
                                    <EditInput
                                      label={t('admin_field_capacity')}
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
                                  onSelect={z => { setTableDraft(p => ({ ...p, zone: z })); }}
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
                                  ? <Text style={styles.savedText}>{t('common_saved')}</Text>
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
            </>
          )}

          {/* ── 6. Réservations ── */}
          <SectionHeader title={t('settings_section_reservations')} />

          <Card>
            <View style={styles.ruleRow}>
              <View style={styles.ruleContent}>
                <Text style={styles.ruleLabel}>{t('admin_res_rule_status')}</Text>
                <Text style={styles.ruleValue}>{t('admin_res_rule_status_val')}</Text>
              </View>
              <FixedBadge />
            </View>
            <Divider />
            <View style={styles.ruleRow}>
              <View style={styles.ruleContent}>
                <Text style={styles.ruleLabel}>{t('admin_res_rule_slot')}</Text>
                <Text style={styles.ruleValue}>{t('admin_res_rule_slot_val')}</Text>
              </View>
              <FixedBadge />
            </View>
            <Divider />
            <View style={styles.ruleRow}>
              <View style={styles.ruleContent}>
                <Text style={styles.ruleLabel}>{t('admin_res_rule_walkin')}</Text>
                <Text style={styles.ruleValue}>{t('admin_res_rule_walkin_val')}</Text>
              </View>
              <FixedBadge />
            </View>
            <Divider />
            <View style={styles.ruleRow}>
              <View style={styles.ruleContent}>
                <Text style={styles.ruleLabel}>{t('admin_res_rule_duration')}</Text>
                <Text style={styles.ruleValue}>{t('admin_res_rule_duration_val')}</Text>
              </View>
              <SoonBadge />
            </View>
            <Divider />
            <View style={styles.ruleRow}>
              <View style={styles.ruleContent}>
                <Text style={styles.ruleLabel}>{t('admin_res_rule_capacity')}</Text>
                <Text style={styles.ruleValue}>{t('admin_res_rule_capacity_val')}</Text>
              </View>
              <SoonBadge />
            </View>
            <Divider />
            <View style={styles.ruleNotice}>
              <Text style={styles.ruleNoticeText}>{t('admin_res_rule_soon_notice')}</Text>
            </View>
          </Card>

          {/* ── 7. Canaux et intégrations ── */}
          <SectionHeader title={t('settings_section_channels')} />
          <Card>
            {CHANNELS.map((ch, idx) => (
              <React.Fragment key={ch.labelKey}>
                {idx > 0 && <Divider />}
                <ChannelRow channel={ch} />
              </React.Fragment>
            ))}
          </Card>

          {/* ── 8. Langue ── */}
          <SectionHeader title={t('settings_section_language')} />
          <Card>
            <TouchableOpacity
              style={[styles.langOption, locale === 'fr' && styles.langOptionActive]}
              onPress={() => { setLocale('fr'); }}
              activeOpacity={0.75}
            >
              <Text style={[styles.langLabel, locale === 'fr' && styles.langLabelActive]}>
                {t('settings_lang_fr')}
              </Text>
              {locale === 'fr' && <Ionicons name="checkmark" size={16} color={colors.cta} />}
            </TouchableOpacity>
            <Divider />
            <TouchableOpacity
              style={[styles.langOption, locale === 'en' && styles.langOptionActive]}
              onPress={() => { setLocale('en'); }}
              activeOpacity={0.75}
            >
              <Text style={[styles.langLabel, locale === 'en' && styles.langLabelActive]}>
                {t('settings_lang_en')}
              </Text>
              {locale === 'en' && <Ionicons name="checkmark" size={16} color={colors.cta} />}
            </TouchableOpacity>
          </Card>

          {/* ── 9. Session ── */}
          <SectionHeader title={t('settings_section_session')} />
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
                  <Text style={styles.signOutText}>{t('settings_sign_out')}</Text>
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

  // Table summary (collapsed state)
  tableSummaryRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            spacing.md,
  },
  tableSummaryInfo: {
    flex: 1,
  },
  tableSummaryTitle: {
    ...typography.bodyMedium,
    color:        colors.textPrimary,
    marginBottom: 2,
  },
  tableSummaryMeta: {
    ...typography.small,
    color: colors.textMuted,
  },
  manageTablesButton: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.xs,
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius:      radius.md,
    borderWidth:       1,
    borderColor:       colors.cta,
    backgroundColor:   colors.ctaLight,
    flexShrink:        0,
  },
  manageTablesText: {
    ...typography.bodyMedium,
    color: colors.cta,
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

  // Team section
  teamMemberRow: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingVertical: spacing.sm,
    gap:             spacing.sm,
    minHeight:       48,
  },
  teamMemberInfo: {
    flex: 1,
    gap:  2,
  },
  teamMemberName: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  teamMemberRoleBadge: {
    alignSelf:         'flex-start',
    backgroundColor:   colors.goldLight,
    borderRadius:      radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   1,
    marginTop:         2,
  },
  teamMemberRoleText: {
    ...typography.label,
    color: colors.gold,
  },
  teamInviteError: {
    ...typography.small,
    color:     colors.cta,
    marginTop: spacing.xs,
  },
  inviteButton: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.xs,
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius:      radius.md,
    borderWidth:       1,
    borderColor:       colors.cta,
    backgroundColor:   colors.ctaLight,
    flexShrink:        0,
    minHeight:         36,
  },
  inviteButtonDisabled: {
    opacity: 0.6,
  },
  inviteButtonSuccess: {
    borderColor:     colors.statusFree,
    backgroundColor: colors.statusFreeLight,
  },
  inviteButtonText: {
    ...typography.small,
    color:      colors.cta,
    fontFamily: 'Inter_500Medium',
  },
  inviteButtonSuccessText: {
    ...typography.small,
    color:      colors.statusFree,
    fontFamily: 'Inter_500Medium',
  },
  selfBadge: {
    backgroundColor:   colors.borderLight,
    borderRadius:      radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   2,
    flexShrink:        0,
  },
  selfBadgeText: {
    ...typography.label,
    color: colors.textMuted,
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

  // Language picker
  langOption: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingVertical: spacing.md,
  },
  langOptionActive: {},
  langLabel: {
    ...typography.body,
    color: colors.textPrimary,
  },
  langLabelActive: {
    ...typography.bodyMedium,
    color: colors.cta,
  },
});

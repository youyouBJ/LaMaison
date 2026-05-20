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
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, typography, spacing, radius, layout } from '../../theme';
import { useSettingsOverview } from '../../hooks/useSettingsOverview';
import type { ZoneSummary } from '../../hooks/useSettingsOverview';
import { useDashboardExtended } from '../../hooks/useDashboardExtended';
import { supabase } from '../../lib/supabase';
import StatCard from '../../components/StatCard';
import type { AdminStackParamList } from '../../navigation/AdminNavigator';
import type { Database } from '../../types/database';

type ShiftRow      = Database['public']['Tables']['shifts']['Row'];
type IoniconsName  = React.ComponentProps<typeof Ionicons>['name'];

type Props = {
  navigation: NativeStackNavigationProp<AdminStackParamList, 'AdminSettings'>;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  admin:   'Admin',
  manager: 'Manager',
  host:    'Hôte',
  waiter:  'Serveur',
};

const DAY_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

type ChannelStatus = 'active' | 'configured' | 'inactive' | 'soon';

type Channel = {
  icon:   IoniconsName;
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
  active:     { label: 'Actif',     color: colors.statusFree,    bg: colors.statusFreeLight  },
  configured: { label: 'Configuré', color: colors.gold,          bg: colors.goldLight        },
  inactive:   { label: 'Inactif',   color: colors.textMuted,     bg: colors.borderLight      },
  soon:       { label: 'À venir',   color: colors.textMuted,     bg: colors.borderLight      },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDays(days: number[]): string {
  if (days.length === 0) return '–';
  if (days.length === 7) return 'Tous les jours';
  const sorted = [...days].sort((a, b) => a - b);
  const labels = sorted.map(d => DAY_SHORT[d] ?? `J${d}`);
  let consecutive = true;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) { consecutive = false; break; }
  }
  if (consecutive && sorted.length >= 3) {
    return `${labels[0]}–${labels[labels.length - 1]}`;
  }
  return labels.join(', ');
}

function formatTime(t: string): string {
  return t.length >= 5 ? t.substring(0, 5) : t;
}

function getRoleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

function fmtRating(v: number | null): string {
  if (v === null) return '—';
  return `${v.toFixed(1)} / 5`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function Divider(): React.JSX.Element {
  return <View style={styles.divider} />;
}

function SectionHeader({ title }: { title: string }): React.JSX.Element {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function Card({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <View style={styles.card}>{children}</View>;
}

function ShiftCard({ shift }: { shift: ShiftRow }): React.JSX.Element {
  const days  = formatDays(shift.days_of_week);
  const start = formatTime(shift.start_time);
  const end   = formatTime(shift.end_time);
  return (
    <View style={styles.shiftCard}>
      <View style={styles.shiftHeader}>
        <Text style={styles.shiftName}>{shift.name}</Text>
        <View style={styles.shiftBadge}>
          <Text style={styles.shiftBadgeText}>{days}</Text>
        </View>
      </View>
      <Text style={styles.shiftHours}>{start}–{end}</Text>
      <View style={styles.shiftMeta}>
        <View style={styles.shiftMetaItem}>
          <Ionicons name="time-outline" size={12} color={colors.textMuted} />
          <Text style={styles.shiftMetaText}>Slot {shift.slot_duration} min</Text>
        </View>
        <View style={styles.shiftMetaDot} />
        <View style={styles.shiftMetaItem}>
          <Ionicons name="people-outline" size={12} color={colors.textMuted} />
          <Text style={styles.shiftMetaText}>{shift.max_covers_per_slot} couverts max</Text>
        </View>
      </View>
    </View>
  );
}

function ZoneRow({ zone }: { zone: ZoneSummary }): React.JSX.Element {
  return (
    <View style={styles.zoneRow}>
      <View style={styles.zoneIcon}>
        <Ionicons name="grid-outline" size={14} color={colors.gold} />
      </View>
      <Text style={styles.zoneName} numberOfLines={1}>{zone.name}</Text>
      <Text style={styles.zoneCount}>
        {zone.tableCount} table{zone.tableCount > 1 ? 's' : ''}
      </Text>
    </View>
  );
}

function ChannelRow({ channel }: { channel: Channel }): React.JSX.Element {
  const config = CHANNEL_STATUS_CONFIG[channel.status];
  return (
    <View style={styles.channelRow}>
      <View style={styles.channelIcon}>
        <Ionicons name={channel.icon} size={18} color={colors.sand} />
      </View>
      <View style={styles.channelContent}>
        <Text style={styles.channelLabel}>{channel.label}</Text>
        <Text style={styles.channelDetail}>{channel.detail}</Text>
      </View>
      <View style={[styles.channelBadge, { backgroundColor: config.bg }]}>
        <Text style={[styles.channelBadgeText, { color: config.color }]}>{config.label}</Text>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AdminSettingsScreen({ navigation }: Props): React.JSX.Element {
  const { loading, error, data, refresh } = useSettingsOverview();
  const [signingOut, setSigningOut]       = useState(false);
  const [signOutError, setSignOutError]   = useState<string | null>(null);

  const restaurantId = data?.restaurant.id ?? null;
  const { loading: extLoading, stats: ext, refresh: extRefresh } = useDashboardExtended(restaurantId);

  const handleSignOut = async (): Promise<void> => {
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
  };

  const handleRefresh = (): void => {
    refresh();
    extRefresh();
  };

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
            <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
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

  if (!data) return <SafeAreaView style={styles.safe} />;

  const { restaurant, userProfile, shifts, floor, guests } = data;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>

          {/* ── Back button ── */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => { navigation.goBack(); }}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={20} color={colors.cta} />
            <Text style={styles.backText}>Admin</Text>
          </TouchableOpacity>

          {/* ── Header ── */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>Paramètres</Text>
              <Text style={styles.headerSub}>Configuration du restaurant</Text>
            </View>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={handleRefresh}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh-outline" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* ── Restaurant ── */}
          <SectionHeader title="Restaurant" />
          <Card>
            <InfoRow label="Nom"           value={restaurant.name} />
            {restaurant.address ? (
              <>
                <Divider />
                <InfoRow label="Adresse"   value={restaurant.address} />
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
                <InfoRow label="Email"     value={restaurant.email} />
              </>
            ) : null}
            <Divider />
            <InfoRow label="Fuseau"        value={restaurant.timezone} />
            <Divider />
            <InfoRow label="Réservations"  value="Téléphone uniquement" />
          </Card>

          {/* ── Compte ── */}
          <SectionHeader title="Compte" />
          <Card>
            <InfoRow label="Nom"           value={userProfile.fullName} />
            <Divider />
            <InfoRow label="Rôle"          value={getRoleLabel(userProfile.role)} />
            <Divider />
            <InfoRow label="Restaurant"    value={userProfile.restaurantName} />
            {userProfile.email ? (
              <>
                <Divider />
                <InfoRow label="Email"     value={userProfile.email} />
              </>
            ) : null}
          </Card>

          {/* ── Services ── */}
          <SectionHeader title="Services" />
          {shifts.length === 0 ? (
            <Card>
              <Text style={styles.emptyText}>Aucun service configuré.</Text>
            </Card>
          ) : (
            shifts.map((shift, idx) => (
              <ShiftCard key={shift.id ?? idx} shift={shift} />
            ))
          )}

          {/* ── Plan de salle ── */}
          <SectionHeader title="Plan de salle" />
          <View style={styles.kpiRow}>
            <StatCard label="Tables" value={floor.totalTables} accent={colors.gold} />
            <View style={styles.kpiGap} />
            <StatCard label="Zones"  value={floor.zoneCount} />
          </View>
          {floor.zones.length > 0 && (
            <Card>
              {floor.zones.map((z, idx) => (
                <React.Fragment key={z.name}>
                  {idx > 0 && <Divider />}
                  <ZoneRow zone={z} />
                </React.Fragment>
              ))}
            </Card>
          )}

          {/* ── Données importées ── */}
          <SectionHeader title="Données importées" />
          <View style={styles.kpiRow}>
            <StatCard label="Clients"    value={guests.total} />
            <View style={styles.kpiGap} />
            <StatCard label="VIP"        value={guests.vip} accent={colors.gold} />
          </View>
          <View style={styles.kpiRow}>
            <StatCard label="Avec tél."  value={guests.withPhone} />
            <View style={styles.kpiGap} />
            <StatCard label="Avec email" value={guests.withEmail} />
          </View>
          {extLoading ? (
            <View style={styles.extLoadingCard}>
              <ActivityIndicator color={colors.sand} size="small" />
            </View>
          ) : ext.sevenRooms.count > 0 ? (
            <Card>
              <InfoRow label="Clients notés" value={String(ext.sevenRooms.count)} />
              <Divider />
              <InfoRow label="Note moyenne"  value={fmtRating(ext.sevenRooms.avgRating)} />
            </Card>
          ) : null}

          {/* ── Canaux et intégrations ── */}
          <SectionHeader title="Canaux et intégrations" />
          <Card>
            {CHANNELS.map((ch, idx) => (
              <React.Fragment key={ch.label}>
                {idx > 0 && <Divider />}
                <ChannelRow channel={ch} />
              </React.Fragment>
            ))}
          </Card>

          {/* ── Session ── */}
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
            {signOutError ? (
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
    flex: 1,
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

  // Back navigation
  backButton: {
    flexDirection:  'row',
    alignItems:     'center',
    alignSelf:      'flex-start',
    marginBottom:   spacing.md,
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
    flexDirection:   'row',
    alignItems:      'flex-start',
    justifyContent:  'space-between',
    marginBottom:    spacing.lg,
  },
  headerLeft: {
    flex: 1,
  },
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

  // Loading
  loadingText: {
    ...typography.body,
    color:     colors.textMuted,
    marginTop: spacing.md,
    textAlign: 'center',
  },

  // Error card
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

  // KPI grid
  kpiRow: {
    flexDirection: 'row',
    marginBottom:  spacing.sm,
  },
  kpiGap: {
    width: spacing.sm,
  },

  // Ext loading
  extLoadingCard: {
    backgroundColor: colors.surface,
    borderRadius:    radius.lg,
    padding:         spacing.xl,
    alignItems:      'center',
    marginBottom:    spacing.sm,
    ...CARD_SHADOW,
  },

  // Empty state
  emptyText: {
    ...typography.body,
    color:     colors.textMuted,
    textAlign: 'center',
    padding:   spacing.sm,
  },

  // Shift cards
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
    gap:           spacing.sm,
  },
  shiftMetaItem: {
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
  },

  // Zone rows
  zoneRow: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingVertical: spacing.sm,
    gap:             spacing.sm,
  },
  zoneIcon: {
    width:           28,
    height:          28,
    borderRadius:    radius.sm,
    backgroundColor: colors.goldLight,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  zoneName: {
    ...typography.body,
    color: colors.textPrimary,
    flex:  1,
  },
  zoneCount: {
    ...typography.small,
    color: colors.textMuted,
  },

  // Channel rows
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
  channelContent: {
    flex: 1,
  },
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

  // Sign-out
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
});

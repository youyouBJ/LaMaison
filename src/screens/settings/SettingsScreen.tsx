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
import { colors, typography, spacing, radius, layout } from '../../theme';
import { useSettingsOverview } from '../../hooks/useSettingsOverview';
import { supabase } from '../../lib/supabase';
import StatCard from '../../components/StatCard';
import type { ZoneSummary } from '../../hooks/useSettingsOverview';
import type { Database } from '../../types/database';

type ShiftRow = Database['public']['Tables']['shifts']['Row'];
type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  admin:   'Admin',
  manager: 'Manager',
  host:    'Hôte',
  waiter:  'Serveur',
};

// 0=Dim, 1=Lun … 6=Sam (JavaScript convention)
const DAY_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

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

// ─── Upcoming features ────────────────────────────────────────────────────────

type Feature = { icon: IoniconsName; label: string };
const FEATURES: Feature[] = [
  { icon: 'logo-whatsapp',    label: 'WhatsApp Business' },
  { icon: 'mail-outline',     label: 'Email Resend' },
  { icon: 'chatbubble-outline', label: 'SMS secours' },
  { icon: 'card-outline',     label: 'Stripe abonnements' },
  { icon: 'business-outline', label: 'Multi-restaurants' },
  { icon: 'map-outline',      label: 'Éditeur plan avancé' },
];

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

function FeatureCard({ icon, label }: Feature): React.JSX.Element {
  return (
    <View style={styles.featureCard}>
      <Ionicons name={icon} size={20} color={colors.sand} />
      <Text style={styles.featureLabel} numberOfLines={2}>{label}</Text>
      <View style={styles.featureBadge}>
        <Text style={styles.featureBadgeText}>Bientôt</Text>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SettingsScreen(): React.JSX.Element {
  const { loading, error, data, refresh } = useSettingsOverview();
  const [signingOut, setSigningOut]         = useState(false);
  const [signOutError, setSignOutError]     = useState<string | null>(null);

  const handleSignOut = async (): Promise<void> => {
    setSigningOut(true);
    setSignOutError(null);
    try {
      const { error: signOutErr } = await supabase.auth.signOut();
      if (signOutErr) {
        setSignOutError(signOutErr.message);
        setSigningOut(false);
      }
      // On success the RootNavigator's onAuthStateChange fires and unmounts this screen.
    } catch (e) {
      console.error('[Settings] signOut threw:', e);
      setSignOutError('Erreur lors de la déconnexion.');
      setSigningOut(false);
    }
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

          {/* ── Header ── */}
          <Text style={styles.headerLabel}>Paramètres</Text>
          <Text style={styles.headerTitle}>Configuration</Text>
          <Text style={styles.headerSub}>{restaurant.name}</Text>

          {/* ── Refresh button ── */}
          <TouchableOpacity style={styles.refreshButton} onPress={refresh}>
            <Ionicons name="refresh-outline" size={16} color={colors.cta} />
            <Text style={styles.refreshButtonText}>Actualiser</Text>
          </TouchableOpacity>

          {/* ── Restaurant ── */}
          <SectionHeader title="Restaurant" />
          <Card>
            <InfoRow label="Nom"       value={restaurant.name} />
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
            <InfoRow label="Fuseau"    value={restaurant.timezone} />
            <Divider />
            <InfoRow label="Réservations" value="Téléphone uniquement" />
          </Card>

          {/* ── Compte staff ── */}
          <SectionHeader title="Compte" />
          <Card>
            <InfoRow label="Nom"        value={userProfile.fullName} />
            <Divider />
            <InfoRow label="Rôle"       value={getRoleLabel(userProfile.role)} />
            <Divider />
            <InfoRow label="Restaurant" value={userProfile.restaurantName} />
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
            <StatCard label="Zones" value={floor.zoneCount} />
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

          {/* ── Données clients ── */}
          <SectionHeader title="Données clients" />
          <View style={styles.kpiRow}>
            <StatCard label="Clients" value={guests.total} />
            <View style={styles.kpiGap} />
            <StatCard label="VIP" value={guests.vip} accent={colors.gold} />
          </View>
          <View style={[styles.kpiRow, styles.kpiRowGap]}>
            <StatCard label="Avec téléphone" value={guests.withPhone} />
            <View style={styles.kpiGap} />
            <StatCard label="Avec email" value={guests.withEmail} />
          </View>

          {/* ── Fonctionnalités à venir ── */}
          <SectionHeader title="Fonctionnalités à venir" />
          <View style={styles.featureGrid}>
            {FEATURES.map((f) => (
              <FeatureCard key={f.label} icon={f.icon} label={f.label} />
            ))}
          </View>

          {/* ── Session ── */}
          <SectionHeader title="Session" />
          <Card>
            {userProfile.email ? (
              <>
                <InfoRow label="Email" value={userProfile.email} />
                <Divider />
              </>
            ) : null}
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
    padding:      spacing.xl,
    maxWidth:     layout.contentMaxWidth,
    width:        '100%',
    alignSelf:    'center',
  },
  centered: {
    flex:            1,
    justifyContent:  'center',
    alignItems:      'center',
    padding:         spacing.xl,
  },

  // Loading
  loadingText: {
    ...typography.body,
    color:      colors.textMuted,
    marginTop:  spacing.md,
    textAlign:  'center',
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

  // Header
  headerLabel: {
    ...typography.label,
    color:        colors.textMuted,
    marginBottom: spacing.xs,
  },
  headerTitle: {
    ...typography.h1,
    color:        colors.textPrimary,
    marginBottom: spacing.xs,
  },
  headerSub: {
    ...typography.body,
    color:        colors.textMuted,
    marginBottom: spacing.lg,
  },

  // Refresh button
  refreshButton: {
    flexDirection:   'row',
    alignItems:      'center',
    alignSelf:       'flex-start',
    gap:             spacing.xs,
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor:   colors.ctaLight,
    borderRadius:      radius.md,
    marginBottom:      spacing.xl,
  },
  refreshButtonText: {
    ...typography.bodyMedium,
    color: colors.cta,
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
    flexDirection:  'row',
    alignItems:     'flex-start',
    paddingVertical: spacing.sm,
    gap:             spacing.sm,
  },
  infoLabel: {
    ...typography.label,
    color:     colors.textMuted,
    width:     96,
    marginTop: 2,
    flexShrink: 0,
  },
  infoValue: {
    ...typography.body,
    color: colors.textPrimary,
    flex:  1,
  },
  divider: {
    height:          1,
    backgroundColor: colors.borderLight,
    marginHorizontal: -spacing.lg,
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
    backgroundColor: colors.goldLight,
    borderRadius:    radius.sm,
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

  // KPI grid (reused from dashboard)
  kpiRow: {
    flexDirection: 'row',
    marginBottom:  spacing.sm,
  },
  kpiRowGap: {
    marginTop: 0,
  },
  kpiGap: {
    width: spacing.sm,
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

  // Feature grid
  featureGrid: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    gap:            spacing.sm,
    marginBottom:   spacing.sm,
  },
  featureCard: {
    backgroundColor: colors.surface,
    borderRadius:    radius.lg,
    padding:         spacing.lg,
    width:           '48%',
    gap:             spacing.sm,
    alignItems:      'flex-start',
    ...CARD_SHADOW,
  },
  featureLabel: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    flex:  1,
  },
  featureBadge: {
    backgroundColor: colors.borderLight,
    borderRadius:    radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   2,
  },
  featureBadgeText: {
    ...typography.label,
    color: colors.textMuted,
  },

  // Empty state
  emptyText: {
    ...typography.body,
    color:     colors.textMuted,
    textAlign: 'center',
    padding:   spacing.sm,
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
    color:                colors.textMuted,
    textDecorationLine:   'underline',
  },
});

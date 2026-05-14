import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radius, layout } from '../../theme';
import { useReservations } from '../../hooks/useReservations';
import ReservationCard from '../../components/ReservationCard';
import DateSelector from '../../components/DateSelector';
import type { ReservationsStackParamList } from '../../navigation/ReservationsNavigator';

type Props = NativeStackScreenProps<ReservationsStackParamList, 'ReservationList'>;

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

export default function ReservationListScreen({ navigation }: Props): React.JSX.Element {
  const { loading, error, reservations, selectedDate, setSelectedDate, refresh } = useReservations();

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} size="large" />
          <Text style={styles.loadingText}>Chargement des réservations…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Impossible de charger les réservations</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={refresh}>
              <Text style={styles.retryText}>Réessayer</Text>
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
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.gold} />
        }
      >
        <View style={styles.container}>

          {/* ── Header ── */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerLabel}>Réservations</Text>
              <Text style={styles.headerTitle}>Planning</Text>
            </View>
            <TouchableOpacity
              style={styles.newButton}
              onPress={() => navigation.navigate('NewReservation')}
              activeOpacity={0.8}
            >
              <Ionicons name={'add' as IoniconsName} size={18} color={colors.textOnDark} />
              <Text style={styles.newButtonText}>Nouvelle</Text>
            </TouchableOpacity>
          </View>

          {/* ── Sélecteur de date ── */}
          <DateSelector value={selectedDate} onChange={setSelectedDate} showQuickActions />

          {/* ── Liste ── */}
          <Text style={styles.listCount}>
            {reservations.length === 0
              ? 'Aucune réservation'
              : `${reservations.length} réservation${reservations.length > 1 ? 's' : ''}`}
          </Text>

          {reservations.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Aucune réservation</Text>
              <Text style={styles.emptySubtitle}>
                Créez une réservation téléphone pour ce service.
              </Text>
            </View>
          ) : (
            reservations.map((r) => (
              <ReservationCard
                key={r.id}
                reservation={r}
                onPress={() => navigation.navigate('ReservationDetail', { reservationId: r.id })}
              />
            ))
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
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

  // Loading
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
  errorTitle: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.sm },
  errorMessage: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xl },
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
  headerLabel: { ...typography.label, color: colors.textMuted, marginBottom: spacing.xs },
  headerTitle: { ...typography.h1, color: colors.textPrimary },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cta,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  newButtonText: { ...typography.bodyMedium, color: colors.textOnDark },

  // List
  listCount: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  emptyTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
  },
});

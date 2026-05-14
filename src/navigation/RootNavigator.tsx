import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { colors, typography } from '../theme';
import AuthNavigator from './AuthNavigator';
import MainTabs from './MainTabs';

// Realtime Supabase sera ajouté dans les modules suivants pour Dashboard, Réservations et Plan de salle.

export default function RootNavigator(): React.JSX.Element {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, updatedSession) => {
        setSession(updatedSession);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.cta} />
        <Text style={styles.loadingText}>Chargement…</Text>
      </View>
    );
  }

  return session ? <MainTabs /> : <AuthNavigator />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    ...typography.body,
    color: colors.textMuted,
  },
});

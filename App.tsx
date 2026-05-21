import 'react-native-gesture-handler';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import {
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import { StatusBar } from 'expo-status-bar';
import { colors } from './src/theme';
import RootNavigator from './src/navigation/RootNavigator';
import { I18nProvider } from './src/i18n';
import { assertSupabaseConfig } from './src/lib/supabase';

// --- ErrorBoundary -----------------------------------------------------------

type BoundaryState = { error: Error | null };

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  BoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  render(): React.ReactNode {
    const { error } = this.state;
    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>
            Une erreur est survenue au démarrage de l'application.
          </Text>
          {__DEV__ && (
            <Text style={styles.errorDetail}>{error.message}</Text>
          )}
        </View>
      );
    }
    return this.props.children;
  }
}

// --- App content -------------------------------------------------------------

function AppContent(): React.JSX.Element | null {
  // Throws if EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are
  // absent from the bundle — caught by AppErrorBoundary above.
  assertSupabaseConfig();

  const [fontsLoaded] = useFonts({
    PlayfairDisplay_700Bold,
    PlayfairDisplay_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.cta} />
      </View>
    );
  }

  return (
    <I18nProvider>
      <GestureHandlerRootView style={styles.root}>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
        <StatusBar style="dark" backgroundColor={colors.background} />
      </GestureHandlerRootView>
    </I18nProvider>
  );
}

export default function App(): React.JSX.Element {
  return (
    <AppErrorBoundary>
      <AppContent />
    </AppErrorBoundary>
  );
}

// --- Styles ------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loading: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 12,
  },
  errorDetail: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
});

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors, typography } from '../theme';
import GuestListScreen from '../screens/guests/GuestListScreen';
import GuestDetailScreen from '../screens/guests/GuestDetailScreen';

export type GuestsStackParamList = {
  GuestList:   undefined;
  GuestDetail: { guestId: string };
};

const Stack = createNativeStackNavigator<GuestsStackParamList>();

const sharedHeaderOptions = {
  headerStyle: { backgroundColor: colors.background },
  headerTitleStyle: { fontFamily: typography.h2.fontFamily, color: colors.textPrimary },
  headerTintColor: colors.cta,
  headerShadowVisible: false,
} as const;

export default function GuestsNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator
      screenOptions={{ contentStyle: { backgroundColor: colors.background } }}
    >
      <Stack.Screen
        name="GuestList"
        component={GuestListScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="GuestDetail"
        component={GuestDetailScreen}
        options={{ ...sharedHeaderOptions, headerTitle: 'Fiche client' }}
      />
    </Stack.Navigator>
  );
}

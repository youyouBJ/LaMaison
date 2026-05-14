import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors, typography } from '../theme';
import ReservationListScreen from '../screens/reservations/ReservationListScreen';
import NewReservationScreen from '../screens/reservations/NewReservationScreen';
import ReservationDetailScreen from '../screens/reservations/ReservationDetailScreen';

export type ReservationsStackParamList = {
  ReservationList: undefined;
  NewReservation: undefined;
  ReservationDetail: { reservationId: string };
};

const Stack = createNativeStackNavigator<ReservationsStackParamList>();

const sharedHeaderOptions = {
  headerStyle: { backgroundColor: colors.background },
  headerTitleStyle: { fontFamily: typography.h2.fontFamily, color: colors.textPrimary },
  headerTintColor: colors.cta,
  headerShadowVisible: false,
} as const;

export default function ReservationsNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator
      screenOptions={{ contentStyle: { backgroundColor: colors.background } }}
    >
      <Stack.Screen
        name="ReservationList"
        component={ReservationListScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="NewReservation"
        component={NewReservationScreen}
        options={{
          ...sharedHeaderOptions,
          headerTitle: 'Nouvelle réservation',
        }}
      />
      <Stack.Screen
        name="ReservationDetail"
        component={ReservationDetailScreen}
        options={{
          ...sharedHeaderOptions,
          headerTitle: 'Détail réservation',
        }}
      />
    </Stack.Navigator>
  );
}

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme';
import SettingsScreen from '../screens/settings/SettingsScreen';
import AdminSettingsScreen from '../screens/admin/AdminSettingsScreen';

export type AdminStackParamList = {
  AdminMain: undefined;
  AdminSettings: undefined;
};

const Stack = createNativeStackNavigator<AdminStackParamList>();

export default function AdminNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator
      screenOptions={{ contentStyle: { backgroundColor: colors.background } }}
    >
      <Stack.Screen
        name="AdminMain"
        component={SettingsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AdminSettings"
        component={AdminSettingsScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

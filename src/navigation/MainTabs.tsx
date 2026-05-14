import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { colors, spacing } from '../theme';
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import FloorPlanScreen from '../screens/floor/FloorPlanScreen';
import ReservationListScreen from '../screens/reservations/ReservationListScreen';
import GuestListScreen from '../screens/guests/GuestListScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';

export type MainTabsParamList = {
  Dashboard: undefined;
  FloorPlan: undefined;
  Reservations: undefined;
  Guests: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<MainTabsParamList>();

type TabIconProps = {
  focused: boolean;
  label: string;
};

function TabIcon({ focused, label }: TabIconProps): React.JSX.Element {
  return (
    <Text
      style={{
        fontSize: 20,
        opacity: focused ? 1 : 0.5,
      }}
    >
      {label}
    </Text>
  );
}

export default function MainTabs(): React.JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.cta,
        tabBarInactiveTintColor: colors.sand,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: spacing.sm,
          paddingTop: spacing.xs,
          height: 60,
        },
        tabBarLabelStyle: {
          fontFamily: 'Inter_500Medium',
          fontSize: 11,
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Accueil',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} label="🏠" />,
        }}
      />
      <Tab.Screen
        name="FloorPlan"
        component={FloorPlanScreen}
        options={{
          tabBarLabel: 'Plan',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} label="🗺️" />,
        }}
      />
      <Tab.Screen
        name="Reservations"
        component={ReservationListScreen}
        options={{
          tabBarLabel: 'Réservations',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} label="📅" />,
        }}
      />
      <Tab.Screen
        name="Guests"
        component={GuestListScreen}
        options={{
          tabBarLabel: 'Clients',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} label="👥" />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Paramètres',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} label="⚙️" />,
        }}
      />
    </Tab.Navigator>
  );
}

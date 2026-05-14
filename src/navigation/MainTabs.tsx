import React from 'react';
import { Platform, type PlatformIOSStatic } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import FloorPlanScreen from '../screens/floor/FloorPlanScreen';
import ReservationsNavigator from './ReservationsNavigator';
import GuestListScreen from '../screens/guests/GuestListScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';

export type MainTabsParamList = {
  Dashboard: undefined;
  FloorPlan: undefined;
  Reservations: undefined;
  Guests: undefined;
  Settings: undefined;
};

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const Tab = createBottomTabNavigator<MainTabsParamList>();

const isTablet =
  Platform.OS === 'ios' && (Platform as PlatformIOSStatic).isPad === true;
const TAB_BAR_HEIGHT = isTablet ? 72 : 60;
const TAB_ICON_SIZE = isTablet ? 26 : 24;

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
          height: TAB_BAR_HEIGHT,
          paddingTop: spacing.xs,
          paddingBottom: spacing.sm,
        },
        tabBarLabelStyle: {
          fontFamily: 'Inter_500Medium',
          fontSize: isTablet ? 12 : 11,
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Accueil',
          tabBarIcon: ({ focused, color }: { focused: boolean; color: string }) => (
            <Ionicons
              name={(focused ? 'home' : 'home-outline') as IoniconsName}
              size={TAB_ICON_SIZE}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="FloorPlan"
        component={FloorPlanScreen}
        options={{
          tabBarLabel: 'Plan',
          tabBarIcon: ({ focused, color }: { focused: boolean; color: string }) => (
            <Ionicons
              name={(focused ? 'grid' : 'grid-outline') as IoniconsName}
              size={TAB_ICON_SIZE}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Reservations"
        component={ReservationsNavigator}
        options={{
          tabBarLabel: 'Réservations',
          tabBarIcon: ({ focused, color }: { focused: boolean; color: string }) => (
            <Ionicons
              name={(focused ? 'calendar' : 'calendar-outline') as IoniconsName}
              size={TAB_ICON_SIZE}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Guests"
        component={GuestListScreen}
        options={{
          tabBarLabel: 'Clients',
          tabBarIcon: ({ focused, color }: { focused: boolean; color: string }) => (
            <Ionicons
              name={(focused ? 'people' : 'people-outline') as IoniconsName}
              size={TAB_ICON_SIZE}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Paramètres',
          tabBarIcon: ({ focused, color }: { focused: boolean; color: string }) => (
            <Ionicons
              name={(focused ? 'settings' : 'settings-outline') as IoniconsName}
              size={TAB_ICON_SIZE}
              color={color}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

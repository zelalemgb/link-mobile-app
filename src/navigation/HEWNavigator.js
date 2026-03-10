/**
 * HEWNavigator — Navigation stack for Health Extension Workers
 *
 * Structure:
 *   HEWTabs (bottom tabs)
 *     └─ HEWHome    (patient search + caseload)
 *     └─ HEWSync    (offline queue status)
 *   Stack screens (pushed on top of tabs)
 *     └─ HEWRecordNote  (visit note form)
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { tokens } from '../theme/tokens';

import HEWHomeScreen from '../screens/hew/HEWHomeScreen';
import HEWSyncScreen from '../screens/hew/HEWSyncScreen';
import HEWRecordNoteScreen from '../screens/hew/HEWRecordNoteScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// ─── Tab bar (Home + Sync) ─────────────────────────────────────────────────

function HEWTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color }) => {
          const name = route.name === 'HEWHome' ? 'users' : 'upload-cloud';
          return <Feather name={name} size={20} color={color} strokeWidth={focused ? 2.5 : 2} />;
        },
        tabBarActiveTintColor: '#0f766e',
        tabBarInactiveTintColor: tokens.colors.muted,
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: tokens.colors.border,
          height: 72,
          paddingBottom: 10,
          paddingTop: 6,
          backgroundColor: '#fff',
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
        headerStyle:       { backgroundColor: '#0f766e' },
        headerTitleStyle:  { color: '#fff', fontWeight: '700', fontSize: 16 },
        headerTintColor:   '#fff',
      })}
    >
      <Tab.Screen
        name="HEWHome"
        component={HEWHomeScreen}
        options={{ title: 'Patients', tabBarLabel: 'Patients' }}
      />
      <Tab.Screen
        name="HEWSync"
        component={HEWSyncScreen}
        options={{ title: 'Offline queue', tabBarLabel: 'Sync' }}
      />
    </Tab.Navigator>
  );
}

// ─── Root stack (tabs + note form as full-screen push) ────────────────────

export default function HEWNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="HEWTabs"
        component={HEWTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="HEWRecordNote"
        component={HEWRecordNoteScreen}
        options={{
          title: 'Log visit note',
          headerStyle:      { backgroundColor: '#0f766e' },
          headerTitleStyle: { color: '#fff', fontWeight: '700', fontSize: 16 },
          headerTintColor:  '#fff',
        }}
      />
    </Stack.Navigator>
  );
}

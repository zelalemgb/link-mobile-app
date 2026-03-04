import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import ErrorBoundary from "./components/ErrorBoundary";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { trackEvent } from "./lib/telemetry";
import LoginScreen from "./screens/LoginScreen";
import SymptomCheckerConversationalScreen from "./screens/SymptomCheckerConversationalScreen";

import MainTabs from "./navigation/MainTabs";
import HEWNavigator from "./navigation/HEWNavigator";
import ClinicianNavigator from "./navigation/ClinicianNavigator";

import { ToastProvider } from "./context/ToastContext";
import { DatabaseProvider } from "./context/DatabaseContext";
import { ConsultProvider } from "./context/ConsultContext";
import { AppLockProvider, useAppLock } from "./context/AppLockContext";
import AppLockScreen from "./screens/AppLockScreen";
import {
  registerBackgroundSyncAsync,
  unregisterBackgroundSyncAsync,
} from "./services/backgroundSyncService";

const Stack = createNativeStackNavigator();

export default function App() {
  React.useEffect(() => {
    trackEvent("app_start");
  }, []);

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AuthProvider>
          <DatabaseProvider>
            <AppLockProvider>
              <ToastProvider>
                <AppNavigator />
              </ToastProvider>
            </AppLockProvider>
          </DatabaseProvider>
        </AuthProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const AppNavigator = () => {
  const { isAuthenticated, loading, role } = useAuth();
  const { isLocked, hasPinSet, loading: lockLoading } = useAppLock();

  React.useEffect(() => {
    console.log("AppNavigator State:", { isAuthenticated, loading, role, isLocked, hasPinSet });
  }, [isAuthenticated, loading, role, isLocked, hasPinSet]);

  React.useEffect(() => {
    const configureBackgroundSync = async () => {
      try {
        if (isAuthenticated) {
          await registerBackgroundSyncAsync();
        } else {
          await unregisterBackgroundSyncAsync();
        }
      } catch (error) {
        console.warn("[sync-bg] registration update failed:", error?.message || error);
      }
    };

    configureBackgroundSync();
  }, [isAuthenticated]);

  // Show nothing while auth OR lock context is still initialising
  if (loading || (isAuthenticated && lockLoading)) {
    return (
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen
            name="Loading"
            component={() => null}
            options={{ headerShown: false }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  if (!isAuthenticated) {
    return (
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  // ── App-lock gate: PIN setup (first run) or unlock screen ─────────────
  // Shown after sign-in but before any PHI is visible.
  if (!hasPinSet || isLocked) {
    return <AppLockScreen />;
  }

  // ── HEW role: dedicated field-worker flow ─────────────────────────────
  if (role === "hew") {
    return (
      <NavigationContainer>
        <HEWNavigator />
      </NavigationContainer>
    );
  }

  // ── Clinician roles: nurse / doctor / admin / clinician ───────────────
  const CLINICIAN_ROLES = ["nurse", "doctor", "admin", "clinician", "health_officer"];
  if (role && CLINICIAN_ROLES.includes(role)) {
    return (
      <ConsultProvider>
        <NavigationContainer>
          <ClinicianNavigator />
        </NavigationContainer>
      </ConsultProvider>
    );
  }

  // ── Patient / default role: standard app ──────────────────────────────
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="Main"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="SymptomCheckerConversational"
          component={SymptomCheckerConversationalScreen}
          options={{ title: "ምልክት መለያ" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

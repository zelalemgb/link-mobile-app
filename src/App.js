import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import ErrorBoundary from "./components/ErrorBoundary";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { trackEvent } from "./lib/telemetry";
import LoginScreen from "./screens/LoginScreen";
import SymptomCheckerConversationalScreen from "./screens/SymptomCheckerConversationalScreen";
import PatientAppointmentsScreen from "./screens/PatientAppointmentsScreen";
import PatientConsentScreen from "./screens/PatientConsentScreen";
import PatientHealthRecordsScreen from "./screens/PatientHealthRecordsScreen";

import MainTabs from "./navigation/MainTabs";
import HEWNavigator from "./navigation/HEWNavigator";
import ClinicianNavigator from "./navigation/ClinicianNavigator";

import { ToastProvider } from "./context/ToastContext";
import { DatabaseProvider } from "./context/DatabaseContext";
import { ConsultProvider } from "./context/ConsultContext";
import { AppLockProvider, useAppLock } from "./context/AppLockContext";
import { FeatureFlagsProvider, useFeatureFlags } from "./context/FeatureFlagsContext";
import AppLockScreen from "./screens/AppLockScreen";
import {
  registerBackgroundSyncAsync,
  unregisterBackgroundSyncAsync,
} from "./services/backgroundSyncService";

const Stack = createNativeStackNavigator();
const LoadingScreen = () => null;

export default function App() {
  React.useEffect(() => {
    trackEvent("app_start");
  }, []);

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AuthProvider>
          <DatabaseProvider>
            <FeatureFlagsProvider>
              <AppLockProvider>
                <ToastProvider>
                  <AppNavigator />
                </ToastProvider>
              </AppLockProvider>
            </FeatureFlagsProvider>
          </DatabaseProvider>
        </AuthProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const AppNavigator = () => {
  const { isAuthenticated, loading, role, user } = useAuth();
  const { isLocked, hasPinSet, loading: lockLoading } = useAppLock();
  const { linkAgentMvp } = useFeatureFlags();

  const workspaceType = user?.workspace?.workspaceType || user?.workspace_type || null;
  const teamMode = user?.workspace?.teamMode || user?.team_mode || null;
  const isSoloProviderWorkspace = workspaceType === "provider" && (teamMode === "solo" || teamMode == null);

  React.useEffect(() => {
    console.log("AppNavigator State:", {
      isAuthenticated,
      loading,
      role,
      workspaceType,
      teamMode,
      isSoloProviderWorkspace,
      isLocked,
      hasPinSet,
    });
  }, [isAuthenticated, loading, role, workspaceType, teamMode, isSoloProviderWorkspace, isLocked, hasPinSet]);

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
            component={LoadingScreen}
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
  const CLINICIAN_ROLES = ["nurse", "doctor", "admin", "clinician", "health_officer", "clinical_officer"];
  const isClinicianRole = Boolean(role && CLINICIAN_ROLES.includes(role));
  if (isClinicianRole || isSoloProviderWorkspace) {
    return (
      <ConsultProvider>
        <NavigationContainer>
          <ClinicianNavigator shellMode={isSoloProviderWorkspace ? "solo_provider" : "default"} />
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
          options={{ title: linkAgentMvp ? "Link Agent" : "ምልክት መለያ" }}
        />
        <Stack.Screen
          name="PatientAppointments"
          component={PatientAppointmentsScreen}
          options={{ title: "Appointments" }}
        />
        <Stack.Screen
          name="PatientConsent"
          component={PatientConsentScreen}
          options={{ title: "Consent Center" }}
        />
        <Stack.Screen
          name="PatientHealthRecords"
          component={PatientHealthRecordsScreen}
          options={{ title: "Health Records" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

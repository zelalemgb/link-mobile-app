import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import ErrorBoundary from "./components/ErrorBoundary";
import { AuthProvider } from "./context/AuthContext";
import { trackEvent } from "./lib/telemetry";
import LoginScreen from "./screens/LoginScreen";
import { useAuth } from "./context/AuthContext";
import HomeScreen from "./screens/HomeScreen";
import SymptomCheckerScreen from "./screens/SymptomCheckerScreen";
import FacilityFinderScreen from "./screens/FacilityFinderScreen";
import HealthFeedScreen from "./screens/HealthFeedScreen";
import ProfileScreen from "./screens/ProfileScreen";
import SymptomCheckerConversationalScreen from "./screens/SymptomCheckerConversationalScreen";

import MainTabs from "./navigation/MainTabs";

import { ToastProvider } from "./context/ToastContext";

const Stack = createNativeStackNavigator();

export default function App() {
  React.useEffect(() => {
    trackEvent("app_start");
  }, []);

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AuthProvider>
          <ToastProvider>
            <AppNavigator />
          </ToastProvider>
        </AuthProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const AppNavigator = () => {
  const { isAuthenticated, loading } = useAuth();

  React.useEffect(() => {
    console.log("AppNavigator State:", { isAuthenticated, loading });
  }, [isAuthenticated, loading]);

  if (loading) {
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

  return (
    <NavigationContainer>
      {isAuthenticated ? (
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
      ) : (
        <Stack.Navigator>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
};

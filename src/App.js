import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "./screens/HomeScreen";
import SymptomCheckerScreen from "./screens/SymptomCheckerScreen";
import FacilityFinderScreen from "./screens/FacilityFinderScreen";
import HealthFeedScreen from "./screens/HealthFeedScreen";
import ProfileScreen from "./screens/ProfileScreen";

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: "Link Patient Home" }}
        />
        <Stack.Screen
          name="SymptomChecker"
          component={SymptomCheckerScreen}
          options={{ title: "Symptom Checker" }}
        />
        <Stack.Screen
          name="FacilityFinder"
          component={FacilityFinderScreen}
          options={{ title: "Find Facilities" }}
        />
        <Stack.Screen
          name="HealthFeed"
          component={HealthFeedScreen}
          options={{ title: "Health Feed" }}
        />
        <Stack.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ title: "My Profile" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

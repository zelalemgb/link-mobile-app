import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, typography } from "../theme/tokens";

import HomeScreen from "../screens/HomeScreen";
import SymptomCheckerScreen from "../screens/SymptomCheckerScreen";
import FacilityFinderScreen from "../screens/FacilityFinderScreen";
import HealthFeedScreen from "../screens/HealthFeedScreen";
import ProfileScreen from "../screens/ProfileScreen";

const Tab = createBottomTabNavigator();

const MainTabs = () => {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName;

                    if (route.name === "Home") {
                        iconName = "home";
                    } else if (route.name === "Symptoms") {
                        iconName = "activity";
                    } else if (route.name === "Facilities") {
                        iconName = "map-pin";
                    } else if (route.name === "Feed") {
                        iconName = "layers";
                    } else if (route.name === "Profile") {
                        iconName = "user";
                    }

                    return (
                        <Feather
                            name={iconName}
                            size={20}
                            color={color}
                            strokeWidth={focused ? 2.5 : 2}
                        />
                    );
                },
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.muted,
                tabBarStyle: {
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                    height: 75,
                    paddingBottom: spacing.xs,
                    paddingTop: spacing.xs,
                    backgroundColor: colors.surface,
                },
                tabBarLabelStyle: {
                    ...typography.caption,
                    fontWeight: "600",
                    marginBottom: 8,
                },
                headerShown: false,
            })}
        >
            <Tab.Screen
                name="Home"
                component={HomeScreen}
                options={{ title: "Home" }}
            />
            <Tab.Screen
                name="Symptoms"
                component={SymptomCheckerScreen}
                options={{ title: "Symptoms" }}
            />
            <Tab.Screen
                name="Facilities"
                component={FacilityFinderScreen}
                options={{ title: "Facilities" }}
            />
            <Tab.Screen
                name="Feed"
                component={HealthFeedScreen}
                options={{ title: "Health Feed" }}
            />
            <Tab.Screen
                name="Profile"
                component={ProfileScreen}
                options={{ title: "Profile" }}
            />
        </Tab.Navigator>
    );
};

export default MainTabs;

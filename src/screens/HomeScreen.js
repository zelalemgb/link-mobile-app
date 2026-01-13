import React from "react";
import { SafeAreaView, View, Text, StyleSheet, Pressable } from "react-native";

const HomeScreen = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container} testID="home-screen">
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to Link Mobile App</Text>
        <Text style={styles.subtitle}>Your digital health companion</Text>
        <Text style={styles.note} testID="home-note">
          Explore your care journey with quick access to symptom checks, nearby
          facilities, and your personalized health feed.
        </Text>
        <View style={styles.actions}>
          <Pressable
            style={styles.button}
            onPress={() => navigation.navigate("SymptomChecker")}
            testID="nav-symptom-checker"
          >
            <Text style={styles.buttonText}>Symptom Checker</Text>
          </Pressable>
          <Pressable
            style={styles.button}
            onPress={() => navigation.navigate("FacilityFinder")}
            testID="nav-facility-finder"
          >
            <Text style={styles.buttonText}>Find Facilities</Text>
          </Pressable>
          <Pressable
            style={styles.button}
            onPress={() => navigation.navigate("HealthFeed")}
            testID="nav-health-feed"
          >
            <Text style={styles.buttonText}>Health Feed</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => navigation.navigate("Profile")}
            testID="nav-profile"
          >
            <Text style={styles.secondaryButtonText}>My Profile</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: "#334155",
    marginBottom: 16,
  },
  note: {
    fontSize: 14,
    color: "#475569",
    textAlign: "center",
    maxWidth: 320,
    marginBottom: 24,
  },
  actions: {
    width: "100%",
    maxWidth: 320,
    gap: 12,
  },
  button: {
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: {
    color: "#f8fafc",
    fontWeight: "600",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#94a3b8",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#334155",
    fontWeight: "600",
  },
});

export default HomeScreen;

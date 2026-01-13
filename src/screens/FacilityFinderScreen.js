import React from "react";
import { SafeAreaView, View, Text, StyleSheet } from "react-native";

const FacilityFinderScreen = () => {
  return (
    <SafeAreaView style={styles.container} testID="facility-finder-screen">
      <View style={styles.content}>
        <Text style={styles.title}>Find Facilities</Text>
        <Text style={styles.subtitle}>
          Discover clinics and hospitals near you.
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#eef2ff",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1e1b4b",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: "#4338ca",
    textAlign: "center",
  },
});

export default FacilityFinderScreen;

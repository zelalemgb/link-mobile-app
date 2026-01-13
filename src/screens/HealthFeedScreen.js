import React from "react";
import { SafeAreaView, View, Text, StyleSheet } from "react-native";

const HealthFeedScreen = () => {
  return (
    <SafeAreaView style={styles.container} testID="health-feed-screen">
      <View style={styles.content}>
        <Text style={styles.title}>Health Feed</Text>
        <Text style={styles.subtitle}>
          Personalized tips and updates for your wellbeing.
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fef3c7",
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
    color: "#92400e",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: "#92400e",
    textAlign: "center",
  },
});

export default HealthFeedScreen;

import React from "react";
import { SafeAreaView, View, Text, StyleSheet } from "react-native";

const SymptomCheckerScreen = () => {
  return (
    <SafeAreaView style={styles.container} testID="symptom-checker-screen">
      <View style={styles.content}>
        <Text style={styles.title}>Symptom Checker</Text>
        <Text style={styles.subtitle}>
          Describe your symptoms to get guided next steps.
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9",
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
    color: "#0f172a",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: "#475569",
    textAlign: "center",
  },
});

export default SymptomCheckerScreen;

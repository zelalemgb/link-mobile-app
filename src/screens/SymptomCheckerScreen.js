import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Screen from "../components/ui/Screen";
import Card from "../components/ui/Card";
import { colors, spacing, typography } from "../theme/tokens";

const SymptomCheckerScreen = () => {
  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Symptom Checker</Text>
        <Text style={styles.subtitle}>
          Guidance tailored to your clinic network.
        </Text>
      </View>

      <Card>
        <Text style={styles.cardLabel}>Coming soon</Text>
        <Text style={styles.cardBody}>
          We’re preparing an AI-assisted triage flow with safe, clear medical
          guidance tailored to your clinic network.
        </Text>
      </Card>
    </Screen>
  );
};

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
  },
  cardLabel: {
    ...typography.caption,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  cardBody: {
    ...typography.body,
  },
});

export default SymptomCheckerScreen;

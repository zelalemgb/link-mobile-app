import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Screen from "../components/ui/Screen";
import Card from "../components/ui/Card";
import { colors, spacing, typography } from "../theme/tokens";

const HealthFeedScreen = () => {
  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Health Feed</Text>
        <Text style={styles.subtitle}>
          Personalized guidance for your goals.
        </Text>
      </View>

      <Card style={styles.card}>
        <Text style={styles.cardLabel}>Today</Text>
        <Text style={styles.cardTitle}>Hydration check</Text>
        <Text style={styles.cardBody}>
          Aim for 6–8 glasses of water. Consistent hydration keeps energy and
          focus stable throughout the day.
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
  card: {
    gap: spacing.xs,
  },
  cardLabel: {
    ...typography.caption,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.primary,
  },
  cardTitle: {
    ...typography.h3,
  },
  cardBody: {
    ...typography.body,
    color: colors.text,
  },
});

export default HealthFeedScreen;

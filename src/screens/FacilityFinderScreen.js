import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Screen from "../components/ui/Screen";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { colors, spacing, typography } from "../theme/tokens";

const FacilityFinderScreen = () => {
  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Find Facilities</Text>
        <Text style={styles.subtitle}>
          Explore clinics and hospitals around you.
        </Text>
      </View>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Nearby highlights</Text>
        <Text style={styles.cardBody}>
          Enable location sharing to see facilities, hours, and services around
          you.
        </Text>
        <View style={styles.cardActions}>
          <Button title="Enable location" onPress={() => { }} />
        </View>
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
    gap: spacing.sm,
  },
  cardTitle: {
    ...typography.h3,
  },
  cardBody: {
    ...typography.body,
    color: colors.text,
  },
  cardActions: {
    marginTop: spacing.sm,
  },
});

export default FacilityFinderScreen;

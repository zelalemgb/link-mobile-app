import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Screen from "../components/ui/Screen";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { colors, spacing, typography } from "../theme/tokens";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

const ProfileScreen = () => {
  const { signOut } = useAuth();

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>My Profile</Text>
        <Text style={styles.subtitle}>
          Manage your health records and preferences.
        </Text>
      </View>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Primary details</Text>
        <Text style={styles.cardBody}>Zelalem Giz · Addis Ababa</Text>
        <Button title="Update profile" onPress={() => { }} variant="secondary" />
        <Button
          title="Sign out"
          onPress={async () => {
            await supabase.auth.signOut();
            await signOut();
          }}
          variant="ghost"
        />
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
  },
});

export default ProfileScreen;

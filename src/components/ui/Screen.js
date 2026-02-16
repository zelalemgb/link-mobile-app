import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, StyleSheet, ScrollView } from "react-native";
import { colors, spacing } from "../../theme/tokens";

const Screen = ({ children, variant = "default", style, backgroundColor, scrollable = true }) => {
  const Container = scrollable ? ScrollView : View;

  return (
    <SafeAreaView
      style={[styles.root, backgroundColor && { backgroundColor }]}
    >
      <Container
        style={[
          styles.container,
          variant === "hero" && styles.hero,
          variant === "tight" && styles.tight,
          style,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </Container>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    padding: spacing.lg,
  },
  hero: {
    paddingTop: spacing.xl,
  },
  tight: {
    padding: spacing.md,
  },
});

export default Screen;

import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { colors, spacing, radius, typography } from "../../theme/tokens";

const Button = ({ title, onPress, variant = "primary", style, textStyle }) => {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === "primary" && styles.primary,
        variant === "secondary" && styles.secondary,
        variant === "ghost" && styles.ghost,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          variant === "secondary" && styles.textSecondary,
          variant === "ghost" && styles.textGhost,
          textStyle,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  ghost: {
    backgroundColor: "transparent",
  },
  pressed: {
    opacity: 0.85,
  },
  text: {
    ...typography.body,
    fontWeight: "600",
    color: colors.surface,
  },
  textSecondary: {
    color: colors.primary,
  },
  textGhost: {
    color: colors.primary,
  },
});

export default Button;

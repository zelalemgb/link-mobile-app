export const colors = {
  primary: "#4D2C91", // darkPurple
  primaryDark: "#371B73",
  primarySoft: "#D7C8F5", // lightPurple
  ink: "#121214",
  text: "#121214",
  muted: "#6B7280",
  border: "#E5E7EB",
  surface: "#FFFFFF",
  background: "#F7F5FB", // softWhite
  success: "#0F766E",
  warning: "#B45309",
  danger: "#B91C1C",
  green: "#B9F0D8", // Brand Green
};

export const typography = {
  h1: { fontSize: 26, fontWeight: "700", color: colors.ink },
  h2: { fontSize: 20, fontWeight: "600", color: colors.ink },
  h3: { fontSize: 16, fontWeight: "600", color: colors.ink },
  body: { fontSize: 14, color: colors.text },
  caption: { fontSize: 12, color: colors.muted },
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 20,
  xl: 28,
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
};

export const shadow = {
  card: {
    shadowColor: "#0B1220",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
};

// Convenience aggregate — HEW screens import `{ tokens }`
export const tokens = {
  colors,
  typography,
  spacing,
  radii: radius,
  shadow,
};

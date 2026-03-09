import React from "react";
import { View, Text, StyleSheet, ActivityIndicator, Platform, Pressable } from "react-native";
import Screen from "../components/ui/Screen";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { colors, spacing, typography } from "../theme/tokens";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";

const isWeb = Platform.OS === "web";

// ── Demo PINs (web only) ────────────────────────────────────────────────────
const DEMO_USERS = {
  "1234": {
    token: "demo-token-abebe",
    label: "Patient",
    profile: {
      id: "demo-patient-abebe-001",
      role: "patient",
      full_name: "Abebe Metaferia Alemey",
      first_name: "Abebe",
      last_name: "Alemey",
      email: "abebe.metaferia@linkhc.org",
      phone: "+251911000001",
      facility_id: "demo-facility-zelalem-001",
      facility_name: "Zelalem Hospital",
    },
  },
  "5678": {
    token: "demo-token-birtukan-hew",
    label: "Health Extension Worker",
    profile: {
      id: "demo-hew-birtukan-001",
      role: "hew",
      full_name: "Birtukan Tadesse",
      first_name: "Birtukan",
      last_name: "Tadesse",
      email: "birtukan.tadesse@linkhc.org",
      phone: "+251911000099",
      facility_id: "demo-facility-zelalem-001",
      facility_name: "Zelalem Hospital",
    },
  },
};

const LoginScreen = () => {
  const { signInWithToken } = useAuth();
  const { showToast } = useToast();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [mode, setMode] = React.useState(isWeb ? "pin" : "pin"); // Default to PIN mode on all platforms

  // ── 4-digit demo PIN login (works on all platforms) ─────────────────────
  const handlePinLogin = async () => {
    if (pin.length !== 4) {
      setError("Please enter a 4-digit PIN");
      return;
    }

    const match = DEMO_USERS[pin];
    if (!match) {
      setError("Invalid PIN. Try 1234 (Patient) or 5678 (HEW).");
      return;
    }

    setLoading(true);
    setError("");
    try {
      showToast(`Welcome, ${match.profile.first_name}! (${match.label})`, "success");
      await signInWithToken(match.token, match.profile);
    } catch (err) {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Native: full email/password login ───────────────────────────────────
  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      const token = data?.session?.access_token;
      if (!token) {
        setError("Unable to start session. Please try again.");
        return;
      }

      await signInWithToken(token);
      await api.get("/auth/profile");
    } catch (err) {
      setError(err?.message || "Sign in failed.");
    } finally {
      setLoading(false);
    }
  };

  // ── PIN login UI (default on all platforms) ─────────────────────────────
  if (mode === "pin") {
    return (
      <Screen variant="hero">
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Link Health</Text>
          <Text style={styles.title}>Mobile Portal</Text>
          <Text style={styles.subtitle}>
            Enter your 4-digit PIN to sign in.
          </Text>
        </View>

        <Card style={styles.card}>
          <Text style={styles.label}>PIN</Text>
          <Input
            value={pin}
            onChangeText={(text) => {
              const digits = text.replace(/\D/g, "").slice(0, 4);
              setPin(digits);
              setError("");
            }}
            keyboardType="numeric"
            secureTextEntry
            placeholder="••••"
            maxLength={4}
            testID="login-pin"
          />

          <View style={styles.pinDots}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i < pin.length && styles.dotFilled,
                ]}
              />
            ))}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <Button
              title="Sign in"
              onPress={handlePinLogin}
              disabled={loading || pin.length !== 4}
            />
            {loading && <ActivityIndicator color={colors.primary} />}
          </View>
        </Card>

        <View style={styles.testActions}>
          <Text style={styles.hintText}>Zelalem Hospital · Demo Mode</Text>
          <Text style={[styles.hintText, { marginTop: 8 }]}>1234 = Patient (Abebe)  ·  5678 = HEW (Birtukan)</Text>
          {!isWeb && (
            <Pressable onPress={() => { setMode("email"); setError(""); }} style={styles.switchMode}>
              <Text style={styles.switchModeText}>Use email / password instead</Text>
            </Pressable>
          )}
        </View>
      </Screen>
    );
  }

  // ── Email/password login UI (native only, accessible via toggle) ───────
  return (
    <Screen variant="hero">
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Link Health</Text>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>
          Sign in with your clinic credentials.
        </Text>
      </View>

      <Card style={styles.card}>
        <Text style={styles.label}>Email</Text>
        <Input
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="name@clinic.com"
          testID="login-email"
        />

        <Text style={styles.label}>Password</Text>
        <Input
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
          testID="login-password"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.actions}>
          <Button title="Sign in" onPress={handleLogin} disabled={loading} />
          {loading && <ActivityIndicator color={colors.primary} />}
        </View>
      </Card>

      <View style={styles.testActions}>
        <Pressable onPress={() => { setMode("pin"); setError(""); }} style={styles.switchMode}>
          <Text style={styles.switchModeText}>Use demo PIN instead</Text>
        </Pressable>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.xl,
  },
  eyebrow: {
    ...typography.caption,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.h1,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.muted,
  },
  card: {
    gap: spacing.sm,
  },
  label: {
    ...typography.caption,
    color: colors.muted,
  },
  actions: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  testActions: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: "center",
  },
  error: {
    color: colors.danger,
    ...typography.caption,
  },
  pinDots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginVertical: spacing.sm,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: "transparent",
  },
  dotFilled: {
    backgroundColor: colors.primary || "#4D2C91",
    borderColor: colors.primary || "#4D2C91",
  },
  hintText: {
    fontSize: 12,
    color: colors.muted,
    textAlign: "center",
  },
  switchMode: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  switchModeText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary || "#4D2C91",
    textAlign: "center",
  },
});

export default LoginScreen;

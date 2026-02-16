import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import Screen from "../components/ui/Screen";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { colors, spacing, typography } from "../theme/tokens";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";

const LoginScreen = () => {
  const { signInWithToken } = useAuth();
  const { showToast } = useToast();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const handleLogin = async () => {
    // FOR TESTING: Allow bypass if no email/password provided
    if (!email.trim() && !password) {
      setLoading(true);
      try {
        await signInWithToken("test-token-bypass");
        return;
      } catch (err) {
        setError("Bypass failed");
      } finally {
        setLoading(false);
      }
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

  return (
    <Screen variant="hero">
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Link Health</Text>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>
          Sign in to continue your care journey.
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
        <Button
          title="Skip Login (Test Mode)"
          variant="ghost"
          onPress={async () => {
            console.log("Bypassing login for testing...");
            setLoading(true);
            try {
              showToast("Entering test mode...", "success");
              await signInWithToken("test-token-bypass");
            } catch (err) {
              console.error("Bypass failed:", err);
              showToast("Bypass failed", "error");
              setError("Bypass failed");
            } finally {
              setLoading(false);
            }
          }}
        />
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
});

export default LoginScreen;

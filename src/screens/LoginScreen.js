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

// ── Demo PINs (secondary path) ────────────────────────────────────────────
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

const normalizePhoneNumber = (value) => (value || "").replace(/\s+/g, "").trim();

const buildPatientProfile = (patient, fallbackPhone) => {
  const source = patient && typeof patient === "object" ? patient : {};
  const fullName = source.name || source.full_name || "Patient";
  const [firstName, ...lastNameParts] = String(fullName).trim().split(/\s+/);
  return {
    ...source,
    id: source.id || "patient",
    role: "patient",
    full_name: fullName,
    first_name: source.first_name || firstName || "Patient",
    last_name: source.last_name || lastNameParts.join(" "),
    phone: source.phone || source.phone_number || fallbackPhone || "",
  };
};

const LoginScreen = () => {
  const { signInWithToken } = useAuth();
  const { showToast } = useToast();
  const [phoneNumber, setPhoneNumber] = React.useState("");
  const [otp, setOtp] = React.useState("");
  const [otpRequested, setOtpRequested] = React.useState(false);
  const [requiresRegistration, setRequiresRegistration] = React.useState(false);
  const [name, setName] = React.useState("");
  const [dateOfBirth, setDateOfBirth] = React.useState("");
  const [gender, setGender] = React.useState("");
  const [emergencyContactName, setEmergencyContactName] = React.useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [mode, setMode] = React.useState("patient");

  const resetOtpFlow = React.useCallback(() => {
    setOtp("");
    setOtpRequested(false);
    setRequiresRegistration(false);
    setName("");
    setDateOfBirth("");
    setGender("");
    setEmergencyContactName("");
    setEmergencyContactPhone("");
  }, []);

  const switchMode = React.useCallback((nextMode) => {
    setMode(nextMode);
    setError("");
  }, []);

  const completePatientSignIn = React.useCallback(async ({ sessionToken, patient, fallbackPhone }) => {
    if (!sessionToken) {
      setError("Unable to start patient session. Please try again.");
      return;
    }

    const profile = buildPatientProfile(patient, fallbackPhone);
    await signInWithToken(sessionToken, profile);
    showToast(`Welcome, ${profile.first_name}!`, "success");
  }, [showToast, signInWithToken]);

  const handleRequestOtp = async () => {
    if (loading) return;

    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    if (!normalizedPhone || normalizedPhone.length < 8) {
      setError("Please enter a valid phone number.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await api.post(
        "/patient-auth/request-otp",
        { phoneNumber: normalizedPhone },
        { auth: false }
      );
      setOtpRequested(true);
      setRequiresRegistration(false);
      showToast("Verification code sent.", "success");
    } catch (err) {
      setError(err?.message || "Unable to send verification code.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (loading) return;

    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    if (!normalizedPhone || normalizedPhone.length < 8) {
      setError("Please enter a valid phone number.");
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      setError("Please enter the 6-digit verification code.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await api.post(
        "/patient-auth/verify-otp",
        { phoneNumber: normalizedPhone, otp },
        { auth: false }
      );
      await completePatientSignIn({
        sessionToken: response?.sessionToken,
        patient: response?.patient,
        fallbackPhone: normalizedPhone,
      });
    } catch (err) {
      if (err?.status === 404 && err?.payload?.error === "patient_not_found") {
        setRequiresRegistration(true);
        showToast("Phone verified. Complete registration to continue.", "success");
      } else {
        setError(err?.message || "Unable to verify code.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterPatient = async () => {
    if (loading) return;

    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    const normalizedEmergencyPhone = normalizePhoneNumber(emergencyContactPhone);

    if (!normalizedPhone || normalizedPhone.length < 8) {
      setError("Please enter a valid phone number.");
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      setError("Please enter the 6-digit verification code.");
      return;
    }
    if (!name.trim()) {
      setError("Please enter your full name.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await api.post(
        "/patient-auth/register",
        {
          phoneNumber: normalizedPhone,
          otp,
          name: name.trim(),
          dateOfBirth: dateOfBirth.trim() || undefined,
          gender: gender.trim() || undefined,
          emergencyContactName: emergencyContactName.trim() || undefined,
          emergencyContactPhone: normalizedEmergencyPhone || undefined,
        },
        { auth: false }
      );
      await completePatientSignIn({
        sessionToken: response?.sessionToken,
        patient: response?.patient,
        fallbackPhone: normalizedPhone,
      });
    } catch (err) {
      if (err?.status === 409 && err?.payload?.error === "patient_exists") {
        setRequiresRegistration(false);
        setError("Patient already exists. Verify the OTP to sign in.");
      } else {
        setError(err?.message || "Unable to complete registration.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── 4-digit demo PIN login (secondary/testing path) ────────────────────
  const handlePinLogin = async () => {
    if (loading) return;

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

  // ── Clinician / HEW email login (native) ───────────────────────────────
  const handleClinicianLogin = async () => {
    if (loading) return;

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

  // ── Patient OTP login UI (default) ─────────────────────────────────────
  if (mode === "patient") {
    return (
      <Screen variant="hero">
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Link Health</Text>
          <Text style={styles.title}>Patient Portal</Text>
          <Text style={styles.subtitle}>
            Sign in with your phone number to access your Link records.
          </Text>
        </View>

        <Card style={styles.card}>
          <Text style={styles.label}>Phone number</Text>
          <Input
            value={phoneNumber}
            onChangeText={(text) => {
              setPhoneNumber(text);
              setError("");
            }}
            keyboardType="phone-pad"
            autoCapitalize="none"
            placeholder="+251 911 000 001"
            testID="login-phone"
          />

          {otpRequested ? (
            <>
              <Text style={styles.label}>Verification code</Text>
              <Input
                value={otp}
                onChangeText={(text) => {
                  setOtp(text.replace(/\D/g, "").slice(0, 6));
                  setError("");
                }}
                keyboardType="numeric"
                placeholder="123456"
                maxLength={6}
                testID="login-otp"
              />
            </>
          ) : null}

          {requiresRegistration ? (
            <>
              <Text style={styles.registrationHint}>
                We did not find an existing account for this phone number. Complete a quick setup.
              </Text>

              <Text style={styles.label}>Full name</Text>
              <Input
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  setError("");
                }}
                placeholder="Abebe Metaferia Alemey"
                testID="register-name"
              />

              <Text style={styles.label}>Date of birth (optional)</Text>
              <Input
                value={dateOfBirth}
                onChangeText={setDateOfBirth}
                placeholder="1990-01-31"
                autoCapitalize="none"
              />

              <Text style={styles.label}>Gender (optional)</Text>
              <Input
                value={gender}
                onChangeText={setGender}
                placeholder="female / male / other"
                autoCapitalize="none"
              />

              <Text style={styles.label}>Emergency contact name (optional)</Text>
              <Input
                value={emergencyContactName}
                onChangeText={setEmergencyContactName}
                placeholder="Relative or caregiver"
              />

              <Text style={styles.label}>Emergency contact phone (optional)</Text>
              <Input
                value={emergencyContactPhone}
                onChangeText={setEmergencyContactPhone}
                keyboardType="phone-pad"
                placeholder="+251 9..."
              />
            </>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            {!otpRequested ? (
              <Button title="Send code" onPress={handleRequestOtp} />
            ) : null}
            {otpRequested && !requiresRegistration ? (
              <Button title="Verify and sign in" onPress={handleVerifyOtp} />
            ) : null}
            {otpRequested && requiresRegistration ? (
              <Button title="Create account" onPress={handleRegisterPatient} />
            ) : null}
            {otpRequested ? (
              <Button
                title="Use another phone number"
                variant="secondary"
                onPress={resetOtpFlow}
              />
            ) : null}
            {loading && <ActivityIndicator color={colors.primary} />}
          </View>
        </Card>

        <View style={styles.testActions}>
          <Pressable onPress={() => switchMode("email")} style={styles.switchMode}>
            <Text style={styles.switchModeText}>Clinician or HEW sign in</Text>
          </Pressable>
          <Pressable onPress={() => switchMode("pin")} style={styles.switchMode}>
            <Text style={styles.switchModeText}>Use demo PIN instead</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  // ── Demo PIN UI (secondary path) ───────────────────────────────────────
  if (mode === "pin") {
    return (
      <Screen variant="hero">
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Link Health</Text>
          <Text style={styles.title}>Demo Mode</Text>
          <Text style={styles.subtitle}>
            Use demo PINs only for sandbox testing.
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
            <Button title="Sign in with demo PIN" onPress={handlePinLogin} />
            {loading && <ActivityIndicator color={colors.primary} />}
          </View>
        </Card>

        <View style={styles.testActions}>
          <Text style={styles.hintText}>1234 = Patient (Abebe) · 5678 = HEW (Birtukan)</Text>
          <Pressable onPress={() => switchMode("patient")} style={styles.switchMode}>
            <Text style={styles.switchModeText}>Back to patient OTP sign in</Text>
          </Pressable>
          {!isWeb ? (
            <Pressable onPress={() => switchMode("email")} style={styles.switchMode}>
              <Text style={styles.switchModeText}>Use clinician email sign in</Text>
            </Pressable>
          ) : null}
        </View>
      </Screen>
    );
  }

  // ── Clinician email/password login UI ──────────────────────────────────
  return (
    <Screen variant="hero">
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Link Health</Text>
        <Text style={styles.title}>Clinician Sign In</Text>
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
          <Button title="Sign in" onPress={handleClinicianLogin} />
          {loading && <ActivityIndicator color={colors.primary} />}
        </View>
      </Card>

      <View style={styles.testActions}>
        <Pressable onPress={() => switchMode("patient")} style={styles.switchMode}>
          <Text style={styles.switchModeText}>Back to patient OTP sign in</Text>
        </Pressable>
        <Pressable onPress={() => switchMode("pin")} style={styles.switchMode}>
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
  registrationHint: {
    ...typography.caption,
    color: colors.muted,
    marginBottom: spacing.xs,
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

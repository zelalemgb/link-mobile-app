import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import Screen from "../components/ui/Screen";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { colors, spacing, typography, radius, shadow } from "../theme/tokens";
import { getActiveVisit } from "../services/patientService";
import { useFeatureFlags } from "../context/FeatureFlagsContext";

const QUICK_PROMPTS = [
  {
    id: "symptoms-now",
    label: "Check symptoms now",
    prompt: "I have symptoms and need guidance on what to do next.",
  },
  {
    id: "medicine-question",
    label: "Medication question",
    prompt: "I have a question about my medicine, side effects, and what warning signs I should watch for.",
  },
  {
    id: "lab-question",
    label: "Understand lab results",
    prompt: "Help me understand my recent lab result and whether I should return to clinic.",
  },
  {
    id: "care-seeking",
    label: "Should I seek care now?",
    prompt: "Based on my current symptoms, should I seek care now or monitor at home?",
  },
];

const STAGE_LABELS = {
  registered: "Registration",
  at_triage: "Triage",
  vitals_taken: "Vitals",
  with_doctor: "Consultation",
  at_lab: "Lab",
  at_imaging: "Imaging",
  at_pharmacy: "Pharmacy",
};

const SymptomCheckerScreen = ({ navigation }) => {
  const { linkAgentMvp } = useFeatureFlags();
  const [activeVisit, setActiveVisit] = useState(null);
  const [loadingVisit, setLoadingVisit] = useState(true);

  const loadActiveVisit = useCallback(async () => {
    try {
      const response = await getActiveVisit();
      setActiveVisit(response?.activeVisit || null);
    } catch (error) {
      setActiveVisit(null);
    } finally {
      setLoadingVisit(false);
    }
  }, []);

  useEffect(() => {
    loadActiveVisit();
  }, [loadActiveVisit]);

  const openGuidedChat = useCallback(
    (starterPrompt, autoSend = false) => {
      navigation.navigate("SymptomCheckerConversational", {
        starterPrompt,
        autoSend,
      });
    },
    [navigation]
  );

  const openFacilities = useCallback(() => {
    const routeNames = navigation?.getState?.()?.routeNames || [];
    if (routeNames.includes("Facilities")) {
      navigation.navigate("Facilities");
      return;
    }
    navigation.navigate("Main", { screen: "Facilities" });
  }, [navigation]);

  const openAppointments = useCallback(() => {
    navigation.navigate("PatientAppointments", {
      startBooking: true,
    });
  }, [navigation]);

  const openRecords = useCallback(() => {
    navigation.navigate("PatientHealthRecords");
  }, [navigation]);

  const currentStage = activeVisit?.current_journey_stage || activeVisit?.status || null;
  const currentStageLabel = STAGE_LABELS[currentStage] || currentStage || "In progress";

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>{linkAgentMvp ? "Link Agent" : "Symptom Checker"}</Text>
        <Text style={styles.subtitle}>
          Ask health questions, check symptoms, and move directly to care when needed.
        </Text>
      </View>

      <Card style={styles.agentCard}>
        <Text style={styles.cardLabel}>
          {linkAgentMvp ? "Link Agent + CDSS safety checks" : "Guided symptom support"}
        </Text>
        <Text style={styles.cardBody}>
          This assistant helps with symptom understanding, care-seeking advice, and follow-up questions.
        </Text>
        <Button
          title="Start guided chat"
          onPress={() => openGuidedChat("", false)}
          style={styles.primaryAction}
        />
      </Card>

      <Text style={styles.sectionTitle}>Quick prompts</Text>
      <View style={styles.promptGrid}>
        {QUICK_PROMPTS.map((prompt) => (
          <Pressable
            key={prompt.id}
            onPress={() => openGuidedChat(prompt.prompt, true)}
            style={styles.promptCard}
          >
            <Text style={styles.promptLabel}>{prompt.label}</Text>
            <Text style={styles.promptHint}>Send to Link Agent</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Care handoff</Text>
      <Card style={styles.handoffCard}>
        {loadingVisit ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Checking your current care context...</Text>
          </View>
        ) : activeVisit ? (
          <Text style={styles.handoffBody}>
            You have an active visit at <Text style={styles.handoffStrong}>{currentStageLabel}</Text>. Ask follow-up
            questions, then open records or continue care handoff.
          </Text>
        ) : (
          <Text style={styles.handoffBody}>
            No active visit found. If symptoms are concerning, connect to a linked clinic and request care.
          </Text>
        )}
        <View style={styles.actionRow}>
          <Button title="Find linked clinics" variant="secondary" onPress={openFacilities} style={styles.rowButton} />
          <Button title="Book appointment" onPress={openAppointments} style={styles.rowButton} />
        </View>
        <Button title="Open records" variant="ghost" onPress={openRecords} style={styles.recordsButton} />
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
  sectionTitle: {
    ...typography.caption,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    fontWeight: "700",
    letterSpacing: 0.3,
    color: colors.text,
  },
  agentCard: {
    marginBottom: spacing.sm,
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
    marginBottom: spacing.md,
  },
  primaryAction: {
    alignSelf: "flex-start",
  },
  promptGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  promptCard: {
    width: "48%",
    minHeight: 92,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    justifyContent: "space-between",
    ...shadow.card,
  },
  promptLabel: {
    ...typography.body,
    fontWeight: "600",
    color: colors.text,
  },
  promptHint: {
    ...typography.caption,
    color: colors.muted,
  },
  handoffCard: {
    marginTop: spacing.xs,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  loadingText: {
    ...typography.caption,
    color: colors.muted,
  },
  handoffBody: {
    ...typography.body,
    marginBottom: spacing.sm,
  },
  handoffStrong: {
    fontWeight: "700",
    color: colors.primary,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  rowButton: {
    flex: 1,
    minWidth: 140,
  },
  recordsButton: {
    marginTop: spacing.sm,
    alignSelf: "flex-start",
  },
});

export default SymptomCheckerScreen;

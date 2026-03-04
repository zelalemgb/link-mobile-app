import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";

const severityColor = {
  critical: "#b91c1c",
  high: "#b45309",
  medium: "#0369a1",
  low: "#0f766e",
};

const normalizeSeverity = (severity) => {
  const s = String(severity || "").toLowerCase();
  if (s === "critical" || s === "high" || s === "medium" || s === "low") return s;
  return "medium";
};

const decisionLabel = (decision) => {
  if (decision === "accepted") return "Accepted";
  if (decision === "dismissed") return "Overridden";
  return "Pending review";
};

export default function CdssExplainabilityPanel({ alerts, decisions, onDecision }) {
  if (!Array.isArray(alerts) || alerts.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Feather name="shield" size={14} color="#0f766e" />
        <Text style={styles.headerTitle}>Clinical safety checks</Text>
      </View>
      {alerts.map((alert) => {
        const severity = normalizeSeverity(alert.severity);
        const color = severityColor[severity];
        const decision = decisions?.[alert.ruleId]?.decision || null;

        return (
          <View key={alert.ruleId} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={[styles.severityBadge, { borderColor: color }]}>
                <Text style={[styles.severityText, { color }]}>{severity}</Text>
              </View>
              <Text style={styles.confidenceText}>
                confidence {Math.round(Number(alert.confidence || 0) * 100)}%
              </Text>
            </View>

            <Text style={styles.ruleName}>{alert.ruleName}</Text>

            <Text style={styles.label}>Triggering inputs</Text>
            {(alert.triggeringInputs || []).map((input, index) => (
              <Text key={`${alert.ruleId}_${index}`} style={styles.inputRow}>
                • {input}
              </Text>
            ))}

            <Text style={styles.label}>Recommended action</Text>
            <Text style={styles.recommendation}>{alert.recommendedAction}</Text>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, decision === "accepted" && styles.actionBtnAccept]}
                onPress={() => onDecision(alert.ruleId, "accepted")}
              >
                <Text
                  style={[
                    styles.actionBtnText,
                    decision === "accepted" && styles.actionBtnTextActive,
                  ]}
                >
                  Accept
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, decision === "dismissed" && styles.actionBtnDismiss]}
                onPress={() => onDecision(alert.ruleId, "dismissed")}
              >
                <Text
                  style={[
                    styles.actionBtnText,
                    decision === "dismissed" && styles.actionBtnTextActive,
                  ]}
                >
                  Override
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.decisionText}>Clinician decision: {decisionLabel(decision)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#bae6fd",
    backgroundColor: "#f0f9ff",
    padding: 12,
    gap: 10,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerTitle: { fontSize: 13, fontWeight: "700", color: "#0f766e" },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#ffffff",
    padding: 10,
    gap: 4,
  },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  severityBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  severityText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  confidenceText: { fontSize: 11, color: "#475569" },
  ruleName: { fontSize: 13, fontWeight: "700", color: "#0f172a" },
  label: { fontSize: 11, fontWeight: "700", color: "#334155", marginTop: 2 },
  inputRow: { fontSize: 11, color: "#334155" },
  recommendation: { fontSize: 12, color: "#1f2937" },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  actionBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
  },
  actionBtnAccept: {
    borderColor: "#0f766e",
    backgroundColor: "#0f766e",
  },
  actionBtnDismiss: {
    borderColor: "#92400e",
    backgroundColor: "#92400e",
  },
  actionBtnText: { fontSize: 12, fontWeight: "700", color: "#334155" },
  actionBtnTextActive: { color: "#fff" },
  decisionText: { fontSize: 11, color: "#475569", marginTop: 2 },
});

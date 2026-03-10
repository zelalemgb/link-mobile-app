import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, Modal, Pressable, RefreshControl, ScrollView, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import Screen from "../components/ui/Screen";
import Button from "../components/ui/Button";
import { colors, spacing, radius, typography, shadow } from "../theme/tokens";
import { getActiveVisit, getPatientStats } from "../services/patientService";
import { formatVisitForDisplay } from "../utils/journeyMapper";

const HomeScreen = () => {
  const [showJourney, setShowJourney] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [patientData, setPatientData] = useState(null);
  const [activeVisit, setActiveVisit] = useState(null);
  const [stats, setStats] = useState({ totalVisits: 0, activeTasks: 0, visitsToday: 0 });
  const [journeySteps, setJourneySteps] = useState([]);
  const navigation = useNavigation();

  const fetchData = useCallback(async () => {
    try {
      setError(null);

      // Fetch active visit and stats in parallel
      const [visitResponse, statsResponse] = await Promise.all([
        getActiveVisit(),
        getPatientStats(),
      ]);

      setPatientData(visitResponse.patient);
      setActiveVisit(visitResponse.activeVisit);
      setStats(statsResponse);

      // Format journey steps if there's an active visit
      if (visitResponse.activeVisit) {
        const formattedVisit = formatVisitForDisplay(visitResponse.activeVisit);
        setJourneySteps(formattedVisit.journeySteps);
      } else {
        setJourneySteps([]);
      }
    } catch (err) {
      console.error("Failed to fetch patient data:", err);
      setError(err.message || "Failed to load patient data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  // Get patient name
  const patientName = patientData?.full_name || patientData?.first_name || "Patient";

  // Get current stage info
  const currentStage = activeVisit?.current_journey_stage || activeVisit?.status || "No active visit";
  const provider = activeVisit?.provider || "Staff";

  // Format current stage label
  const stageLabels = {
    registered: "Registration",
    at_triage: "Triage",
    vitals_taken: "Vitals Capture",
    with_doctor: "Consultation",
    at_lab: "Lab / Diagnostic",
    at_imaging: "Imaging",
    at_pharmacy: "Pharmacy",
  };
  const currentStageLabel = stageLabels[currentStage] || currentStage;

  if (loading) {
    return (
      <Screen backgroundColor={palette.white} style={styles.screenContainer}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={palette.darkPurple} />
          <Text style={styles.loadingText}>Loading patient data...</Text>
        </View>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen backgroundColor={palette.white} style={styles.screenContainer}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
          <Button title="Retry" onPress={fetchData} style={{ marginTop: spacing.md }} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor={palette.white} style={styles.screenContainer}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.darkPurple} />
        }
      >
        <View style={styles.canvas} testID="home-screen">
          <View style={styles.topRow}>
            <View style={styles.brandRow}>
              <View style={styles.logoBadge}>
                <Text style={styles.logoText}>LH</Text>
              </View>
              <Text style={styles.brandText}>Link Health</Text>
            </View>
            <View style={styles.iconRow}>
              <View style={styles.iconDot} />
              <View style={styles.iconRing} />
            </View>
          </View>

          <View style={styles.header}>
            <Text style={styles.greetingTitle}>Hello, {patientName} 👋</Text>
          </View>

          {activeVisit ? (
            <Pressable onPress={() => setShowJourney(true)} style={styles.bannerCard}>
              <View style={styles.bannerBadge}>
                <Text style={styles.bannerBadgeText}>LIVE</Text>
              </View>
              <View style={styles.bannerCopy}>
                <Text style={styles.bannerTitle}>Active visit status</Text>
                <Text style={styles.bannerSubtitle}>
                  Current stage: {currentStageLabel} · {provider}
                </Text>
              </View>
              <View style={styles.bannerAction}>
                <Text style={styles.bannerActionText}>View Journey</Text>
              </View>
            </Pressable>
          ) : (
            <View style={styles.bannerCard}>
              <View style={styles.bannerCopy}>
                <Text style={styles.bannerTitle}>No active visit</Text>
                <Text style={styles.bannerSubtitle}>
                  You don't have any active visits at the moment
                </Text>
              </View>
            </View>
          )}

          <View style={styles.statsRow}>
            <View style={[styles.statPill, styles.statPurple]}>
              <Text style={styles.statValue}>{stats.totalVisits}</Text>
              <Text style={styles.statLabel}>Records</Text>
            </View>
            <View style={[styles.statPill, styles.statGreen]}>
              <Text style={styles.statValue}>{stats.activeTasks}</Text>
              <Text style={styles.statLabel}>Tasks</Text>
            </View>
            <View style={[styles.statPill, styles.statDark]}>
              <Text style={[styles.statValue, styles.statValueLight]}>{stats.visitsToday}</Text>
              <Text style={[styles.statLabel, styles.statValueLight]}>
                Today
              </Text>
            </View>
          </View>

          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Overview</Text>
            <Text style={styles.sectionLink}>See all</Text>
          </View>

          <View style={styles.cardGrid}>
            <Pressable
              style={[styles.largeCard, styles.greenCard]}
              onPress={() => navigation.navigate("SymptomCheckerConversational")}
            >
              <Text style={styles.cardTitle}>Symptom Check</Text>
              <Text style={styles.cardBody}>
                Answer a few quick questions and get guidance.
              </Text>
              <View style={styles.actionPill}>
                <Text style={styles.actionText}>Start now</Text>
              </View>
            </Pressable>
            <View style={styles.smallColumn}>
              <View style={[styles.smallCard, styles.lightPurpleCard]}>
                <Text style={styles.cardTitle}>Find care</Text>
                <Text style={styles.cardBody}>
                  Nearby clinics &amp; pharmacies.
                </Text>
                <Text style={styles.cardMeta}>Open map</Text>
              </View>
              <View style={[styles.smallCard, styles.darkPurpleCard]}>
                <Text style={[styles.cardTitle, styles.lightText]}>
                  Health feed
                </Text>
                <Text style={[styles.cardBody, styles.lightText]}>
                  New tips for your routine.
                </Text>
                <Text style={[styles.cardMeta, styles.lightText]}>View</Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Services</Text>
          </View>

          <View style={styles.servicesRow}>
            <Pressable
              style={[styles.serviceCard, styles.lightPurpleCard]}
              onPress={() => navigation.navigate("PatientAppointments")}
            >
              <Text style={styles.cardTitle}>Appointments</Text>
              <Text style={styles.cardBody}>Book &amp; manage visits.</Text>
              <Text style={styles.cardMeta}>Book now</Text>
            </Pressable>
            <Pressable
              style={[styles.serviceCard, styles.greenCard]}
              onPress={() => navigation.navigate("PatientConsent")}
            >
              <Text style={styles.cardTitle}>Consent</Text>
              <Text style={styles.cardBody}>Manage data sharing.</Text>
              <Text style={styles.cardMeta}>Manage</Text>
            </Pressable>
            <Pressable
              style={[styles.serviceCard, { backgroundColor: palette.softWhite, borderWidth: 1, borderColor: palette.lightPurple }]}
              onPress={() => navigation.navigate("PatientHealthRecords")}
            >
              <Text style={styles.cardTitle}>Records</Text>
              <Text style={styles.cardBody}>Your health docs.</Text>
              <Text style={styles.cardMeta}>View</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={showJourney}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowJourney(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Visit Journey</Text>
              <Pressable onPress={() => setShowJourney(false)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </Pressable>
            </View>

            <View style={styles.journeyContainer}>
              {journeySteps.length > 0 ? (
                journeySteps.map((step, index) => (
                  <View key={step.id} style={styles.journeyItem}>
                    <View style={styles.journeyLineColumn}>
                      <View style={[
                        styles.journeyDot,
                        step.status === "completed" && styles.dotCompleted,
                        step.status === "active" && styles.dotActive
                      ]} />
                      {index < journeySteps.length - 1 && (
                        <View style={[
                          styles.journeyLine,
                          step.status === "completed" && styles.lineCompleted
                        ]} />
                      )}
                    </View>
                    <View style={styles.journeyTextColumn}>
                      <Text style={[
                        styles.journeyLabel,
                        step.status === "active" && styles.labelActive
                      ]}>
                        {step.label}
                      </Text>
                      <Text style={styles.journeyTime}>{step.time}</Text>
                    </View>
                    {step.status === "active" && (
                      <View style={styles.activeTag}>
                        <Text style={styles.activeTagText}>In Progress</Text>
                      </View>
                    )}
                  </View>
                ))
              ) : (
                <Text style={styles.noJourneyText}>No journey data available</Text>
              )}
            </View>

            <Button title="Close" onPress={() => setShowJourney(false)} style={{ marginTop: spacing.lg }} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
};

const palette = {
  darkPurple: "#4D2C91",
  lightPurple: "#D7C8F5",
  green: "#B9F0D8",
  black: "#121214",
  white: "#FFFFFF",
  softWhite: "#F7F5FB",
};

const styles = StyleSheet.create({
  screenContainer: {
    padding: 0,
  },
  canvas: {
    flex: 1,
    backgroundColor: palette.white,
    padding: spacing.lg,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: palette.lightPurple,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    color: palette.darkPurple,
    fontWeight: "800",
    fontSize: 12,
  },
  brandText: {
    fontSize: 14,
    fontWeight: "700",
    color: palette.darkPurple,
    letterSpacing: 0.5,
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  iconDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.green,
  },
  iconRing: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: palette.darkPurple,
  },
  header: {
    marginBottom: spacing.md,
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: palette.black,
  },
  subtitle: {
    fontSize: 14,
    color: palette.black,
    opacity: 0.6,
    maxWidth: 320,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statPill: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    alignItems: "center",
  },
  statPurple: {
    backgroundColor: palette.lightPurple,
  },
  statGreen: {
    backgroundColor: palette.green,
  },
  statDark: {
    backgroundColor: palette.darkPurple,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
    color: palette.black,
  },
  statLabel: {
    fontSize: 12,
    color: palette.black,
    opacity: 0.7,
  },
  statValueLight: {
    color: palette.white,
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: palette.black,
  },
  sectionLink: {
    fontSize: 12,
    fontWeight: "600",
    color: palette.darkPurple,
  },
  servicesRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  serviceCard: {
    flex: 1,
    borderRadius: 18,
    padding: spacing.md,
    minHeight: 100,
    justifyContent: "space-between",
  },
  cardGrid: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  largeCard: {
    flex: 1,
    borderRadius: 20,
    padding: spacing.md,
    justifyContent: "space-between",
    minHeight: 190,
    backgroundColor: palette.green,
  },
  smallColumn: {
    flex: 1,
    gap: spacing.md,
  },
  smallCard: {
    borderRadius: 18,
    padding: spacing.md,
    minHeight: 90,
    justifyContent: "space-between",
  },
  greenCard: {
    backgroundColor: palette.green,
  },
  lightPurpleCard: {
    backgroundColor: palette.lightPurple,
  },
  darkPurpleCard: {
    backgroundColor: palette.darkPurple,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: palette.black,
    marginBottom: spacing.xs,
  },
  cardBody: {
    fontSize: 12,
    color: palette.black,
    opacity: 0.7,
  },
  cardMeta: {
    marginTop: spacing.sm,
    fontSize: 12,
    fontWeight: "600",
    color: palette.black,
  },
  actionPill: {
    alignSelf: "flex-start",
    marginTop: spacing.md,
    backgroundColor: palette.white,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "700",
    color: palette.darkPurple,
  },
  lightText: {
    color: palette.white,
  },
  bannerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.softWhite,
    borderRadius: 22,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.lightPurple,
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  bannerBadge: {
    backgroundColor: palette.darkPurple,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginRight: spacing.md,
  },
  bannerBadgeText: {
    color: palette.white,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  bannerCopy: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: palette.black,
    marginBottom: 2,
  },
  bannerSubtitle: {
    fontSize: 13,
    color: palette.black,
    opacity: 0.5,
  },
  bannerAction: {
    backgroundColor: palette.lightPurple,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  bannerActionText: {
    fontSize: 11,
    fontWeight: "700",
    color: palette.darkPurple,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  modalTitle: {
    ...typography.h2,
    fontWeight: "700",
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: palette.lightPurple,
  },
  closeButtonText: {
    fontSize: 14,
    color: palette.darkPurple,
    fontWeight: "700",
  },
  journeyContainer: {
    paddingLeft: spacing.sm,
  },
  journeyItem: {
    flexDirection: "row",
    marginBottom: 0,
    minHeight: 70,
  },
  journeyLineColumn: {
    width: 20,
    alignItems: "center",
  },
  journeyDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.border,
    zIndex: 2,
  },
  dotCompleted: {
    backgroundColor: palette.green,
  },
  dotActive: {
    backgroundColor: palette.darkPurple,
    borderWidth: 3,
    borderColor: palette.lightPurple,
  },
  journeyLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#EFEFEF",
    marginVertical: -2,
  },
  lineCompleted: {
    backgroundColor: palette.green,
  },
  journeyTextColumn: {
    flex: 1,
    marginLeft: spacing.lg,
    paddingBottom: spacing.lg,
  },
  journeyLabel: {
    ...typography.h3,
    color: colors.muted,
    marginBottom: 4,
  },
  labelActive: {
    color: palette.darkPurple,
    fontWeight: "700",
  },
  journeyTime: {
    ...typography.caption,
  },
  activeTag: {
    backgroundColor: palette.lightPurple,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    height: 24,
  },
  activeTagText: {
    fontSize: 10,
    color: palette.darkPurple,
    fontWeight: "700",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 14,
    color: palette.darkPurple,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  errorText: {
    fontSize: 16,
    color: colors.error,
    textAlign: "center",
  },
  scrollView: {
    flex: 1,
  },
  noJourneyText: {
    fontSize: 14,
    color: palette.black,
    opacity: 0.6,
    textAlign: "center",
    paddingVertical: spacing.lg,
  },
});

export default HomeScreen;

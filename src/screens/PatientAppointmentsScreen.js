import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Modal,
  Pressable,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Alert,
  Platform,
} from "react-native";
import Screen from "../components/ui/Screen";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { colors, spacing, radius, typography, shadow } from "../theme/tokens";
import { getAppointments, getFacilities, createAppointment } from "../services/patientService";
import { useToast } from "../context/ToastContext";

const STATUS_CONFIG = {
  confirmed: { label: "Confirmed", bg: "#D1FAE5", text: "#065F46" },
  pending: { label: "Pending", bg: "#FEF3C7", text: "#92400E" },
  declined: { label: "Declined", bg: "#FEE2E2", text: "#991B1B" },
  cancelled: { label: "Cancelled", bg: "#F3F4F6", text: "#6B7280" },
};

const TIME_SLOTS = [
  { value: "morning", label: "Morning (8AM - 12PM)" },
  { value: "afternoon", label: "Afternoon (12PM - 5PM)" },
  { value: "evening", label: "Evening (5PM - 8PM)" },
];

const PatientAppointmentsScreen = () => {
  const [appointments, setAppointments] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  // Form state
  const [selectedFacility, setSelectedFacility] = useState("");
  const [requestedDate, setRequestedDate] = useState("");
  const [timeSlot, setTimeSlot] = useState("");
  const [reason, setReason] = useState("");
  const [showFacilityPicker, setShowFacilityPicker] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [apptRes, facRes] = await Promise.all([
        getAppointments(),
        getFacilities(),
      ]);
      setAppointments(apptRes.appointments || []);
      setFacilities(facRes.facilities || []);
    } catch (err) {
      console.error("Failed to load appointments:", err);
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

  const resetForm = () => {
    setSelectedFacility("");
    setRequestedDate("");
    setTimeSlot("");
    setReason("");
  };

  const handleSubmit = async () => {
    if (!selectedFacility || !requestedDate || !reason.trim()) {
      Alert.alert("Missing Fields", "Please fill in facility, date, and reason.");
      return;
    }

    setSubmitting(true);
    try {
      await createAppointment({
        facilityId: selectedFacility,
        requestedDate,
        requestedTimeSlot: timeSlot || undefined,
        reason: reason.trim(),
      });
      showToast("Appointment requested successfully", "success");
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (err) {
      Alert.alert("Error", "Failed to submit appointment request.");
    } finally {
      setSubmitting(false);
    }
  };

  const callFacility = (phone) => {
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  const selectedFacilityName = facilities.find((f) => f.id === selectedFacility)?.name || "Select facility";

  if (loading) {
    return (
      <Screen backgroundColor={palette.white} style={styles.screen}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={palette.darkPurple} />
          <Text style={styles.loadingText}>Loading appointments...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor={palette.white} style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.darkPurple} />}
      >
        <Text style={styles.heading}>My Appointments</Text>
        <Text style={styles.subtitle}>Manage your appointment requests</Text>

        {appointments.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No appointments yet</Text>
            <Text style={styles.emptyBody}>Book your first appointment to get started.</Text>
          </View>
        ) : (
          appointments.map((apt) => {
            const status = STATUS_CONFIG[apt.status] || STATUS_CONFIG.pending;
            return (
              <Card key={apt.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.facilityName}>{apt.facilities?.name || "Unknown Facility"}</Text>
                  <View style={[styles.badge, { backgroundColor: status.bg }]}>
                    <Text style={[styles.badgeText, { color: status.text }]}>{status.label}</Text>
                  </View>
                </View>
                <View style={styles.cardRow}>
                  <Text style={styles.label}>Date:</Text>
                  <Text style={styles.value}>{apt.requested_date}</Text>
                </View>
                {apt.requested_time_slot && (
                  <View style={styles.cardRow}>
                    <Text style={styles.label}>Time:</Text>
                    <Text style={styles.value}>
                      {TIME_SLOTS.find((t) => t.value === apt.requested_time_slot)?.label || apt.requested_time_slot}
                    </Text>
                  </View>
                )}
                <View style={styles.cardRow}>
                  <Text style={styles.label}>Reason:</Text>
                  <Text style={[styles.value, { flex: 1 }]}>{apt.reason}</Text>
                </View>
                {apt.status === "confirmed" && apt.facilities?.phone_number && (
                  <Pressable
                    style={styles.callButton}
                    onPress={() => callFacility(apt.facilities.phone_number)}
                  >
                    <Text style={styles.callButtonText}>Call Facility</Text>
                  </Pressable>
                )}
              </Card>
            );
          })
        )}
      </ScrollView>

      <View style={styles.fabContainer}>
        <Pressable style={styles.fab} onPress={() => setShowModal(true)}>
          <Text style={styles.fabText}>+ Book Appointment</Text>
        </Pressable>
      </View>

      {/* Create appointment modal */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Book Appointment</Text>
              <Pressable onPress={() => { setShowModal(false); resetForm(); }} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll}>
              {/* Facility picker */}
              <Text style={styles.fieldLabel}>Facility *</Text>
              <Pressable style={styles.pickerButton} onPress={() => setShowFacilityPicker(!showFacilityPicker)}>
                <Text style={selectedFacility ? styles.pickerText : styles.pickerPlaceholder}>
                  {selectedFacilityName}
                </Text>
              </Pressable>
              {showFacilityPicker && (
                <View style={styles.pickerDropdown}>
                  {facilities.map((fac) => (
                    <Pressable
                      key={fac.id}
                      style={[styles.pickerOption, selectedFacility === fac.id && styles.pickerOptionSelected]}
                      onPress={() => { setSelectedFacility(fac.id); setShowFacilityPicker(false); }}
                    >
                      <Text style={styles.pickerOptionText}>{fac.name}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Date */}
              <Text style={styles.fieldLabel}>Preferred Date *</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                value={requestedDate}
                onChangeText={setRequestedDate}
                placeholderTextColor="#9CA3AF"
              />

              {/* Time slot */}
              <Text style={styles.fieldLabel}>Preferred Time</Text>
              <View style={styles.timeSlotRow}>
                {TIME_SLOTS.map((slot) => (
                  <Pressable
                    key={slot.value}
                    style={[styles.timeSlotChip, timeSlot === slot.value && styles.timeSlotChipActive]}
                    onPress={() => setTimeSlot(timeSlot === slot.value ? "" : slot.value)}
                  >
                    <Text style={[styles.timeSlotText, timeSlot === slot.value && styles.timeSlotTextActive]}>
                      {slot.value.charAt(0).toUpperCase() + slot.value.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Reason */}
              <Text style={styles.fieldLabel}>Reason for Visit *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe the reason for your visit..."
                value={reason}
                onChangeText={setReason}
                multiline
                numberOfLines={3}
                placeholderTextColor="#9CA3AF"
              />
            </ScrollView>

            <Button
              title={submitting ? "Submitting..." : "Request Appointment"}
              onPress={handleSubmit}
              style={styles.submitBtn}
            />
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
  screen: { padding: 0 },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: 100 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl },
  loadingText: { marginTop: spacing.md, fontSize: 14, color: palette.darkPurple },
  heading: { fontSize: 22, fontWeight: "700", color: palette.black, marginBottom: 4 },
  subtitle: { fontSize: 14, color: palette.black, opacity: 0.5, marginBottom: spacing.lg },

  emptyState: { alignItems: "center", paddingVertical: spacing.xl * 2 },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: palette.black, marginBottom: 8 },
  emptyBody: { fontSize: 14, color: palette.black, opacity: 0.5 },

  card: { marginBottom: spacing.md, padding: spacing.md },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  facilityName: { fontSize: 16, fontWeight: "700", color: palette.black, flex: 1, marginRight: spacing.sm },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  cardRow: { flexDirection: "row", marginBottom: 6 },
  label: { fontSize: 13, fontWeight: "600", color: palette.black, opacity: 0.5, marginRight: 8, width: 50 },
  value: { fontSize: 13, color: palette.black },

  callButton: {
    marginTop: spacing.sm,
    backgroundColor: palette.lightPurple,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  callButtonText: { fontSize: 13, fontWeight: "700", color: palette.darkPurple },

  fabContainer: {
    position: "absolute",
    bottom: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
  },
  fab: {
    backgroundColor: palette.darkPurple,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    ...shadow.card,
  },
  fabText: { color: palette.white, fontSize: 15, fontWeight: "700" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: "85%",
  },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg },
  modalTitle: { ...typography.h2, fontWeight: "700" },
  closeBtn: { padding: 8, borderRadius: 20, backgroundColor: palette.lightPurple },
  closeBtnText: { fontSize: 14, color: palette.darkPurple, fontWeight: "700" },
  modalScroll: { marginBottom: spacing.md },

  fieldLabel: { fontSize: 13, fontWeight: "600", color: palette.black, marginBottom: 6, marginTop: spacing.md },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    fontSize: 14,
    color: palette.black,
    backgroundColor: palette.softWhite,
  },
  textArea: { minHeight: 80, textAlignVertical: "top" },

  pickerButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    backgroundColor: palette.softWhite,
  },
  pickerText: { fontSize: 14, color: palette.black },
  pickerPlaceholder: { fontSize: 14, color: "#9CA3AF" },
  pickerDropdown: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: palette.white,
    marginTop: 4,
  },
  pickerOption: { padding: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  pickerOptionSelected: { backgroundColor: palette.lightPurple },
  pickerOptionText: { fontSize: 14, color: palette.black },

  timeSlotRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  timeSlotChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: palette.softWhite,
  },
  timeSlotChipActive: { backgroundColor: palette.darkPurple, borderColor: palette.darkPurple },
  timeSlotText: { fontSize: 13, color: palette.black },
  timeSlotTextActive: { color: palette.white, fontWeight: "600" },

  submitBtn: { marginTop: spacing.sm },
});

export default PatientAppointmentsScreen;

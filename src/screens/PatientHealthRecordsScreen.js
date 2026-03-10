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
  Share,
  Alert,
} from "react-native";
import Screen from "../components/ui/Screen";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { colors, spacing, radius, typography, shadow } from "../theme/tokens";
import { getDocuments, getSyncedRecords, uploadDocument, deleteDocument } from "../services/patientService";
import { useToast } from "../context/ToastContext";
import { useFeatureFlags } from "../context/FeatureFlagsContext";

const DOC_TYPES = [
  { value: "prescription", label: "Prescription", bg: "#DBEAFE", text: "#1E40AF" },
  { value: "lab_result", label: "Lab Result", bg: "#D1FAE5", text: "#065F46" },
  { value: "imaging", label: "Imaging", bg: "#FEF3C7", text: "#92400E" },
  { value: "visit_summary", label: "Visit Summary", bg: "#E0E7FF", text: "#3730A3" },
  { value: "referral_summary", label: "Referral Summary", bg: "#FEE2E2", text: "#991B1B" },
  { value: "vaccination", label: "Vaccination", bg: "#FCE7F3", text: "#9D174D" },
  { value: "other", label: "Other", bg: "#F3F4F6", text: "#6B7280" },
];

const getDocTypeConfig = (type) => DOC_TYPES.find((d) => d.value === type) || DOC_TYPES.find((d) => d.value === "other");

const PatientHealthRecordsScreen = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showFilterPicker, setShowFilterPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [growthLinks, setGrowthLinks] = useState(null);
  const { showToast } = useToast();
  const { patientRecordsSync, linkAgentMvp } = useFeatureFlags();

  // Upload form state
  const [uploadType, setUploadType] = useState("prescription");
  const [providerName, setProviderName] = useState("");
  const [docDate, setDocDate] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [showTypePicker, setShowTypePicker] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [docsResponse, syncedResponse] = await Promise.all([
        getDocuments(),
        getSyncedRecords(80).catch((error) => {
          console.error("Failed to load synced records:", error);
          return { records: [] };
        }),
      ]);

      const synced = (syncedResponse.records || []).map((record) => ({
        ...record,
        synced: true,
      }));
      const manual = (docsResponse.documents || []).map((record) => ({
        ...record,
        synced: false,
      }));

      setDocuments([...synced, ...manual]);
      setGrowthLinks(syncedResponse.growth || null);
    } catch (err) {
      console.error("Failed to load documents:", err);
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
    setUploadType("prescription");
    setProviderName("");
    setDocDate("");
    setDescription("");
    setTags("");
  };

  const handleUpload = async () => {
    if (!docDate.trim()) {
      Alert.alert("Missing Fields", "Please provide at least a document date.");
      return;
    }
    setSubmitting(true);
    try {
      await uploadDocument({
        documentType: uploadType,
        documentDate: docDate,
        providerName: providerName.trim() || undefined,
        description: description.trim() || undefined,
        tags: tags.trim() || undefined,
      });
      showToast("Document uploaded successfully", "success");
      setShowUploadModal(false);
      resetForm();
      fetchData();
    } catch (err) {
      Alert.alert("Error", "Failed to upload document.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (doc) => {
    if (doc.synced) {
      Alert.alert("Synced Record", "This record comes from a Link visit and cannot be deleted from the app.");
      return;
    }

    Alert.alert("Delete Document", `Are you sure you want to delete "${doc.description || doc.document_type}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDocument(doc.id);
            showToast("Document deleted", "success");
            setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
          } catch (err) {
            Alert.alert("Error", "Failed to delete document.");
          }
        },
      },
    ]);
  };

  const handleDownload = (url) => {
    if (url) Linking.openURL(url);
  };

  const handleOpenExternal = async (url) => {
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert("Unable to open link", "Please try again in a moment.");
    }
  };

  const handleShareGrowthLink = async () => {
    const message = growthLinks?.shareMessage || "Use Link Patient to keep your records connected.";
    const url = growthLinks?.patientAppInstallUrl;
    try {
      await Share.share({
        message: url ? `${message}\n${url}` : message,
      });
    } catch (error) {
      Alert.alert("Unable to share", "Please try again in a moment.");
    }
  };

  // Filter and search
  const filtered = documents.filter((doc) => {
    if (filterType !== "all" && doc.document_type !== filterType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchDesc = (doc.description || "").toLowerCase().includes(q);
      const matchProvider = (doc.provider_name || "").toLowerCase().includes(q);
      const matchTags = (doc.tags || []).some((t) => t.toLowerCase().includes(q));
      return matchDesc || matchProvider || matchTags;
    }
    return true;
  });

  const selectedTypeLabel = getDocTypeConfig(uploadType).label;
  const filterLabel = filterType === "all" ? "All Types" : getDocTypeConfig(filterType).label;

  if (loading) {
    return (
      <Screen backgroundColor={palette.white} style={styles.screen}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={palette.darkPurple} />
          <Text style={styles.loadingText}>Loading health records...</Text>
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
        <Text style={styles.heading}>Health Records</Text>
        <Text style={styles.subtitle}>Your synced visit records and uploaded documents</Text>
        {patientRecordsSync && (
          <View style={styles.rolloutCard}>
            <Text style={styles.rolloutTitle}>
              {linkAgentMvp ? "Link Agent + record sync active" : "Automatic record sync active"}
            </Text>
            <Text style={styles.rolloutBody}>
              Visit summaries, prescriptions, lab results, and referral summaries from Link visits appear here
              automatically. Manual uploads continue to work the same way.
            </Text>
          </View>
        )}
        {growthLinks && (
          <View style={styles.growthCard}>
            <Text style={styles.growthTitle}>Keep care connected after every visit</Text>
            <Text style={styles.growthBody}>
              Open affiliated clinic discovery, symptom guidance, or share the patient app link directly from here.
            </Text>
            <View style={styles.growthActions}>
              <Pressable style={styles.growthActionBtn} onPress={() => handleOpenExternal(growthLinks.facilityFinderUrl)}>
                <Text style={styles.growthActionText}>Find linked clinics</Text>
              </Pressable>
              <Pressable style={styles.growthActionBtn} onPress={() => handleOpenExternal(growthLinks.symptomCheckUrl)}>
                <Text style={styles.growthActionText}>Symptom guidance</Text>
              </Pressable>
              <Pressable style={styles.growthActionBtn} onPress={handleShareGrowthLink}>
                <Text style={styles.growthActionText}>Share app link</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Search + Filter */}
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by description, provider, or tag..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View style={styles.filterRow}>
          <Pressable style={styles.filterChip} onPress={() => setShowFilterPicker(!showFilterPicker)}>
            <Text style={styles.filterChipText}>{filterLabel} ▾</Text>
          </Pressable>
          {showFilterPicker && (
            <View style={styles.filterDropdown}>
              <Pressable style={styles.filterOption} onPress={() => { setFilterType("all"); setShowFilterPicker(false); }}>
                <Text style={styles.filterOptionText}>All Types</Text>
              </Pressable>
              {DOC_TYPES.map((dt) => (
                <Pressable
                  key={dt.value}
                  style={styles.filterOption}
                  onPress={() => { setFilterType(dt.value); setShowFilterPicker(false); }}
                >
                  <Text style={styles.filterOptionText}>{dt.label}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No documents found</Text>
            <Text style={styles.emptyBody}>
              {documents.length === 0
                ? "Synced visit documents will appear here automatically. You can also upload your first health record manually."
                : "Try adjusting your search or filter."}
            </Text>
          </View>
        ) : (
          filtered.map((doc) => {
            const typeConfig = getDocTypeConfig(doc.document_type);
            return (
              <Card key={doc.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={[styles.typeBadge, { backgroundColor: typeConfig.bg }]}>
                    <Text style={[styles.typeBadgeText, { color: typeConfig.text }]}>{typeConfig.label}</Text>
                  </View>
                  <Text style={styles.docDate}>{doc.document_date}</Text>
                </View>
                {doc.provider_name && (
                  <Text style={styles.providerText}>Provider: {doc.provider_name}</Text>
                )}
                {doc.description && (
                  <Text style={styles.descText}>{doc.description}</Text>
                )}
                {doc.tags && doc.tags.length > 0 && (
                  <View style={styles.tagsRow}>
                    {doc.tags.map((tag, i) => (
                      <View key={i} style={styles.tag}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
                <View style={styles.cardActions}>
                  {doc.file_url ? (
                    <Pressable style={styles.actionBtn} onPress={() => handleDownload(doc.file_url)}>
                      <Text style={styles.actionBtnText}>Download</Text>
                    </Pressable>
                  ) : null}
                  {doc.synced ? (
                    <View style={styles.syncedActions}>
                      <View style={styles.syncedPill}>
                        <Text style={styles.syncedPillText}>Synced from Link visit</Text>
                      </View>
                      {doc.continuity_url ? (
                        <Pressable style={[styles.actionBtn, styles.continueBtn]} onPress={() => handleOpenExternal(doc.continuity_url)}>
                          <Text style={styles.actionBtnText}>Continue care</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : (
                    <Pressable style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDelete(doc)}>
                      <Text style={styles.deleteBtnText}>Delete</Text>
                    </Pressable>
                  )}
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      <View style={styles.fabContainer}>
        <Pressable style={styles.fab} onPress={() => setShowUploadModal(true)}>
          <Text style={styles.fabText}>+ Upload Document</Text>
        </Pressable>
      </View>

      {/* Upload modal */}
      <Modal visible={showUploadModal} animationType="slide" transparent onRequestClose={() => setShowUploadModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Upload Document</Text>
              <Pressable onPress={() => { setShowUploadModal(false); resetForm(); }} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll}>
              <Text style={styles.fieldLabel}>Document Type *</Text>
              <Pressable style={styles.pickerButton} onPress={() => setShowTypePicker(!showTypePicker)}>
                <Text style={styles.pickerText}>{selectedTypeLabel}</Text>
              </Pressable>
              {showTypePicker && (
                <View style={styles.pickerDropdown}>
                  {DOC_TYPES.map((dt) => (
                    <Pressable
                      key={dt.value}
                      style={[styles.pickerOption, uploadType === dt.value && styles.pickerOptionSelected]}
                      onPress={() => { setUploadType(dt.value); setShowTypePicker(false); }}
                    >
                      <Text style={styles.pickerOptionText}>{dt.label}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <Text style={styles.fieldLabel}>Document Date *</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                value={docDate}
                onChangeText={setDocDate}
                placeholderTextColor="#9CA3AF"
              />

              <Text style={styles.fieldLabel}>Provider Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Dr. Abebe"
                value={providerName}
                onChangeText={setProviderName}
                placeholderTextColor="#9CA3AF"
              />

              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe the document..."
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                placeholderTextColor="#9CA3AF"
              />

              <Text style={styles.fieldLabel}>Tags (comma-separated)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. infection, fever"
                value={tags}
                onChangeText={setTags}
                placeholderTextColor="#9CA3AF"
              />
            </ScrollView>

            <Button
              title={submitting ? "Uploading..." : "Upload Document"}
              onPress={handleUpload}
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
  subtitle: { fontSize: 14, color: palette.black, opacity: 0.5, marginBottom: spacing.md },
  rolloutCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.lightPurple,
    backgroundColor: "#F3EEFF",
    ...shadow.card,
  },
  rolloutTitle: { fontSize: 14, fontWeight: "700", color: palette.darkPurple, marginBottom: 6 },
  rolloutBody: { fontSize: 13, color: palette.black, opacity: 0.75, lineHeight: 18 },
  growthCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#BFD8FF",
    backgroundColor: "#F4F8FF",
    ...shadow.card,
  },
  growthTitle: { fontSize: 14, fontWeight: "700", color: palette.darkPurple, marginBottom: 6 },
  growthBody: { fontSize: 13, color: palette.black, opacity: 0.72, lineHeight: 18 },
  growthActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.sm },
  growthActionBtn: {
    borderRadius: 10,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: "#BFD8FF",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  growthActionText: { fontSize: 12, fontWeight: "700", color: palette.darkPurple },

  searchRow: { marginBottom: spacing.sm },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    fontSize: 14,
    color: palette.black,
    backgroundColor: palette.softWhite,
  },
  filterRow: { marginBottom: spacing.lg, zIndex: 10 },
  filterChip: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: palette.softWhite,
  },
  filterChipText: { fontSize: 13, fontWeight: "600", color: palette.darkPurple },
  filterDropdown: {
    position: "absolute",
    top: 36,
    left: 0,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: palette.white,
    zIndex: 20,
    minWidth: 180,
    ...shadow.card,
  },
  filterOption: { padding: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  filterOptionText: { fontSize: 14, color: palette.black },

  emptyState: { alignItems: "center", paddingVertical: spacing.xl * 2 },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: palette.black, marginBottom: 8 },
  emptyBody: { fontSize: 14, color: palette.black, opacity: 0.5 },

  card: { marginBottom: spacing.md, padding: spacing.md },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  typeBadgeText: { fontSize: 11, fontWeight: "700" },
  docDate: { fontSize: 12, color: palette.black, opacity: 0.5 },
  providerText: { fontSize: 13, fontWeight: "600", color: palette.black, opacity: 0.7, marginBottom: 4 },
  descText: { fontSize: 13, color: palette.black, marginBottom: 8 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  tag: { backgroundColor: palette.softWhite, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  tagText: { fontSize: 11, color: palette.darkPurple },

  cardActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  syncedActions: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  actionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: palette.lightPurple,
  },
  actionBtnText: { fontSize: 12, fontWeight: "700", color: palette.darkPurple },
  continueBtn: { backgroundColor: "#DBEAFE" },
  deleteBtn: { backgroundColor: "#FEE2E2" },
  deleteBtnText: { fontSize: 12, fontWeight: "700", color: "#991B1B" },
  syncedPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#E8F6EE",
    borderWidth: 1,
    borderColor: "#9BD4B3",
  },
  syncedPillText: { fontSize: 12, fontWeight: "700", color: "#0F5132" },

  fabContainer: { position: "absolute", bottom: spacing.lg, left: spacing.lg, right: spacing.lg },
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
  submitBtn: { marginTop: spacing.sm },
});

export default PatientHealthRecordsScreen;

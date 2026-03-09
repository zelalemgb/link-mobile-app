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
} from "react-native";
import Screen from "../components/ui/Screen";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { colors, spacing, radius, typography, shadow } from "../theme/tokens";
import { getDocuments, uploadDocument, deleteDocument } from "../services/patientService";
import { useToast } from "../context/ToastContext";

const DOC_TYPES = [
  { value: "prescription", label: "Prescription", bg: "#DBEAFE", text: "#1E40AF" },
  { value: "lab_result", label: "Lab Result", bg: "#D1FAE5", text: "#065F46" },
  { value: "imaging", label: "Imaging", bg: "#FEF3C7", text: "#92400E" },
  { value: "visit_summary", label: "Visit Summary", bg: "#E0E7FF", text: "#3730A3" },
  { value: "vaccination", label: "Vaccination", bg: "#FCE7F3", text: "#9D174D" },
  { value: "other", label: "Other", bg: "#F3F4F6", text: "#6B7280" },
];

const getDocTypeConfig = (type) => DOC_TYPES.find((d) => d.value === type) || DOC_TYPES[5];

const PatientHealthRecordsScreen = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showFilterPicker, setShowFilterPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  // Upload form state
  const [uploadType, setUploadType] = useState("prescription");
  const [providerName, setProviderName] = useState("");
  const [docDate, setDocDate] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [showTypePicker, setShowTypePicker] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await getDocuments();
      setDocuments(res.documents || []);
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
        <Text style={styles.subtitle}>Your medical documents and records</Text>

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
              {documents.length === 0 ? "Upload your first health record." : "Try adjusting your search or filter."}
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
                  <Pressable style={styles.actionBtn} onPress={() => handleDownload(doc.file_url)}>
                    <Text style={styles.actionBtnText}>Download</Text>
                  </Pressable>
                  <Pressable style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDelete(doc)}>
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </Pressable>
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
  actionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: palette.lightPurple,
  },
  actionBtnText: { fontSize: 12, fontWeight: "700", color: palette.darkPurple },
  deleteBtn: { backgroundColor: "#FEE2E2" },
  deleteBtnText: { fontSize: 12, fontWeight: "700", color: "#991B1B" },

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

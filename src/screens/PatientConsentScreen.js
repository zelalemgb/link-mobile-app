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
  Alert,
  Switch,
} from "react-native";
import Screen from "../components/ui/Screen";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { colors, spacing, radius, typography, shadow } from "../theme/tokens";
import { getFacilities, grantConsent, revokeConsent, getConsentHistory } from "../services/patientService";
import { useToast } from "../context/ToastContext";

// ── Localization ──────────────────────────────────────────────────────────
const LOCALE = {
  en: {
    grantTab: "Grant",
    revokeTab: "Revoke",
    historyTab: "History",
    grantTitle: "Grant Consent",
    grantDesc: "Allow a facility to access your medical records",
    facility: "Facility",
    selectFacility: "Select a facility",
    consentScope: "Consent Scope",
    recordsAccess: "Medical Records Access",
    providerTarget: "Provider Target",
    facilityCareTeam: "Facility Care Team",
    specificProvider: "Specific Provider",
    providerName: "Provider Name",
    purpose: "Purpose (Optional)",
    purposePlaceholder: "Why are you granting this consent?",
    comprehension: "Comprehension Attestation",
    comprehensionPlaceholder: "In your own words, explain what you understand about sharing your records...",
    comprehensionMin: "Minimum 20 characters required",
    comprehensionLang: "Comprehension Language",
    confirmCheck: "I understand and confirm this consent",
    submit: "Grant Consent",
    revokeTitle: "Revoke Consent",
    revokeDesc: "Withdraw a previously granted consent",
    revokeReason: "Reason for Revocation",
    revokeReasonPlaceholder: "Why do you want to revoke this consent?",
    confirmPhrase: 'Type "REVOKE" to confirm',
    revokeBtn: "Revoke Consent",
    historyTitle: "Consent History",
    historyDesc: "A record of all consent actions",
    granted: "Granted",
    revoked: "Revoked",
    noHistory: "No consent history yet",
    noConsents: "No active consents to revoke",
    highRiskWarning: "High-Risk Warnings Detected",
    lowComprehension: "Comprehension text may be too short (< 80 characters)",
    languageMismatch: "Comprehension language differs from app language",
    overrideRequired: "Override documentation required",
    overrideReason: "Override Reason",
  },
  am: {
    grantTab: "ስጥ",
    revokeTab: "ሰርዝ",
    historyTab: "ታሪክ",
    grantTitle: "ፈቃድ ስጥ",
    grantDesc: "ተቋም የሕክምና መዝገብዎን እንዲያገኝ ይፍቀዱ",
    facility: "ተቋም",
    selectFacility: "ተቋም ይምረጡ",
    consentScope: "የፈቃድ ወሰን",
    recordsAccess: "የሕክምና መዝገብ ማግኘት",
    providerTarget: "አቅራቢ ዒላማ",
    facilityCareTeam: "የተቋም እንክብካቤ ቡድን",
    specificProvider: "ልዩ አቅራቢ",
    providerName: "የአቅራቢ ስም",
    purpose: "ዓላማ (አማራጭ)",
    purposePlaceholder: "ይህን ፈቃድ ለምን እየሰጡ ነው?",
    comprehension: "የግንዛቤ ማረጋገጫ",
    comprehensionPlaceholder: "መዝገቦችዎን ስለማጋራት የሚረዱትን በራስዎ ቃላት ያብራሩ...",
    comprehensionMin: "ቢያንስ 20 ቁምፊ ያስፈልጋል",
    comprehensionLang: "የግንዛቤ ቋንቋ",
    confirmCheck: "ይህን ፈቃድ ተረድቼ አረጋግጣለሁ",
    submit: "ፈቃድ ስጥ",
    revokeTitle: "ፈቃድ ሰርዝ",
    revokeDesc: "ቀደም ሲል የተሰጠ ፈቃድ ያስወግዱ",
    revokeReason: "የመሰረዝ ምክንያት",
    revokeReasonPlaceholder: "ይህን ፈቃድ ለምን መሰረዝ ይፈልጋሉ?",
    confirmPhrase: 'ለማረጋገጥ "REVOKE" ይተይቡ',
    revokeBtn: "ፈቃድ ሰርዝ",
    historyTitle: "የፈቃድ ታሪክ",
    historyDesc: "የሁሉም ፈቃድ እርምጃዎች መዝገብ",
    granted: "ተሰጥቷል",
    revoked: "ተሰርዟል",
    noHistory: "ገና የፈቃድ ታሪክ የለም",
    noConsents: "ለመሰረዝ ንቁ ፈቃዶች የሉም",
    highRiskWarning: "ከፍተኛ-ስጋት ማስጠንቀቂያዎች ተገኝተዋል",
    lowComprehension: "የግንዛቤ ጽሑፍ በጣም አጭር ሊሆን ይችላል (< 80 ቁምፊዎች)",
    languageMismatch: "የግንዛቤ ቋንቋ ከመተግበሪያ ቋንቋ ይለያል",
    overrideRequired: "የውሳኔ ሰነድ ያስፈልጋል",
    overrideReason: "የውሳኔ ምክንያት",
  },
};

const TABS = ["grant", "revoke", "history"];

const PatientConsentScreen = () => {
  const [lang, setLang] = useState("en");
  const t = LOCALE[lang];

  const [activeTab, setActiveTab] = useState("grant");
  const [facilities, setFacilities] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  // Grant form state
  const [grantFacility, setGrantFacility] = useState("");
  const [providerTargetType, setProviderTargetType] = useState("facility_care_team");
  const [providerTargetName, setProviderTargetName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [comprehensionText, setComprehensionText] = useState("");
  const [comprehensionLang, setComprehensionLang] = useState("en");
  const [confirmed, setConfirmed] = useState(false);
  const [showGrantFacilityPicker, setShowGrantFacilityPicker] = useState(false);
  const [highRiskOverride, setHighRiskOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  // Revoke state
  const [revokeFacility, setRevokeFacility] = useState("");
  const [revokeReasonText, setRevokeReasonText] = useState("");
  const [revokeConfirmPhrase, setRevokeConfirmPhrase] = useState("");
  const [showRevokeFacilityPicker, setShowRevokeFacilityPicker] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [facRes, histRes] = await Promise.all([
        getFacilities(),
        getConsentHistory(),
      ]);
      setFacilities(facRes.facilities || []);
      setHistory(histRes.history || []);
    } catch (err) {
      console.error("Failed to load consent data:", err);
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

  // High-risk detection
  const warnings = [];
  if (comprehensionText.length > 0 && comprehensionText.length < 80) warnings.push("lowComprehension");
  if (comprehensionLang !== lang) warnings.push("languageMismatch");

  const resetGrantForm = () => {
    setGrantFacility("");
    setProviderTargetType("facility_care_team");
    setProviderTargetName("");
    setPurpose("");
    setComprehensionText("");
    setComprehensionLang("en");
    setConfirmed(false);
    setHighRiskOverride(false);
    setOverrideReason("");
  };

  const handleGrant = async () => {
    if (!grantFacility) { Alert.alert("Error", t.selectFacility); return; }
    if (comprehensionText.length < 20) { Alert.alert("Error", t.comprehensionMin); return; }
    if (!confirmed) { Alert.alert("Error", t.confirmCheck); return; }
    if (warnings.length > 0 && !highRiskOverride) {
      Alert.alert(t.highRiskWarning, t.overrideRequired);
      return;
    }

    setSubmitting(true);
    try {
      await grantConsent({
        facilityId: grantFacility,
        consentType: "records_access",
        comprehensionText,
        comprehensionLanguage: comprehensionLang,
        uiLanguage: lang,
        purpose: purpose.trim() || undefined,
        highRiskOverride: warnings.length > 0 ? true : undefined,
        overrideReason: overrideReason.trim() || undefined,
        providerTargetType,
        providerTargetName: providerTargetType === "specific_provider" ? providerTargetName.trim() : undefined,
      });
      showToast(lang === "en" ? "Consent granted successfully" : "ፈቃድ በተሳካ ሁኔታ ተሰጥቷል", "success");
      resetGrantForm();
      fetchData();
    } catch (err) {
      Alert.alert("Error", "Failed to grant consent.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeFacility) { Alert.alert("Error", t.selectFacility); return; }
    if (revokeConfirmPhrase.toUpperCase() !== "REVOKE") {
      Alert.alert("Error", t.confirmPhrase);
      return;
    }

    setSubmitting(true);
    try {
      await revokeConsent({
        facilityId: revokeFacility,
        consentType: "records_access",
        reason: revokeReasonText.trim() || undefined,
      });
      showToast(lang === "en" ? "Consent revoked" : "ፈቃድ ተሰርዟል", "success");
      setRevokeFacility("");
      setRevokeReasonText("");
      setRevokeConfirmPhrase("");
      fetchData();
    } catch (err) {
      Alert.alert("Error", "Failed to revoke consent.");
    } finally {
      setSubmitting(false);
    }
  };

  const grantFacilityName = facilities.find((f) => f.id === grantFacility)?.name || t.selectFacility;
  const revokeFacilityName = facilities.find((f) => f.id === revokeFacility)?.name || t.selectFacility;

  if (loading) {
    return (
      <Screen backgroundColor={palette.white} style={styles.screen}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={palette.darkPurple} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor={palette.white} style={styles.screen}>
      {/* Language toggle */}
      <View style={styles.langRow}>
        <Pressable
          style={[styles.langChip, lang === "en" && styles.langChipActive]}
          onPress={() => setLang("en")}
        >
          <Text style={[styles.langText, lang === "en" && styles.langTextActive]}>English</Text>
        </Pressable>
        <Pressable
          style={[styles.langChip, lang === "am" && styles.langChipActive]}
          onPress={() => setLang("am")}
        >
          <Text style={[styles.langText, lang === "am" && styles.langTextActive]}>አማርኛ</Text>
        </Pressable>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {t[`${tab}Tab`]}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.darkPurple} />}
      >
        {/* ── GRANT TAB ──────────────────────────────────────────────── */}
        {activeTab === "grant" && (
          <View>
            <Text style={styles.heading}>{t.grantTitle}</Text>
            <Text style={styles.subtitle}>{t.grantDesc}</Text>

            {/* Facility */}
            <Text style={styles.fieldLabel}>{t.facility} *</Text>
            <Pressable style={styles.pickerButton} onPress={() => setShowGrantFacilityPicker(!showGrantFacilityPicker)}>
              <Text style={grantFacility ? styles.pickerText : styles.pickerPlaceholder}>{grantFacilityName}</Text>
            </Pressable>
            {showGrantFacilityPicker && (
              <View style={styles.pickerDropdown}>
                {facilities.map((fac) => (
                  <Pressable
                    key={fac.id}
                    style={[styles.pickerOption, grantFacility === fac.id && styles.pickerOptionSelected]}
                    onPress={() => { setGrantFacility(fac.id); setShowGrantFacilityPicker(false); }}
                  >
                    <Text style={styles.pickerOptionText}>{fac.name}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Consent scope */}
            <Text style={styles.fieldLabel}>{t.consentScope}</Text>
            <View style={styles.readOnlyField}>
              <Text style={styles.readOnlyText}>{t.recordsAccess}</Text>
            </View>

            {/* Provider target */}
            <Text style={styles.fieldLabel}>{t.providerTarget}</Text>
            <View style={styles.radioGroup}>
              <Pressable
                style={[styles.radioOption, providerTargetType === "facility_care_team" && styles.radioSelected]}
                onPress={() => setProviderTargetType("facility_care_team")}
              >
                <Text style={[styles.radioText, providerTargetType === "facility_care_team" && styles.radioTextSelected]}>
                  {t.facilityCareTeam}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.radioOption, providerTargetType === "specific_provider" && styles.radioSelected]}
                onPress={() => setProviderTargetType("specific_provider")}
              >
                <Text style={[styles.radioText, providerTargetType === "specific_provider" && styles.radioTextSelected]}>
                  {t.specificProvider}
                </Text>
              </Pressable>
            </View>

            {providerTargetType === "specific_provider" && (
              <>
                <Text style={styles.fieldLabel}>{t.providerName}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t.providerName}
                  value={providerTargetName}
                  onChangeText={setProviderTargetName}
                  placeholderTextColor="#9CA3AF"
                />
              </>
            )}

            {/* Purpose */}
            <Text style={styles.fieldLabel}>{t.purpose}</Text>
            <TextInput
              style={styles.input}
              placeholder={t.purposePlaceholder}
              value={purpose}
              onChangeText={setPurpose}
              placeholderTextColor="#9CA3AF"
            />

            {/* Comprehension */}
            <Text style={styles.fieldLabel}>{t.comprehension} *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t.comprehensionPlaceholder}
              value={comprehensionText}
              onChangeText={setComprehensionText}
              multiline
              numberOfLines={4}
              placeholderTextColor="#9CA3AF"
            />
            {comprehensionText.length > 0 && comprehensionText.length < 20 && (
              <Text style={styles.errorText}>{t.comprehensionMin}</Text>
            )}

            {/* Comprehension language */}
            <Text style={styles.fieldLabel}>{t.comprehensionLang}</Text>
            <View style={styles.radioGroup}>
              <Pressable
                style={[styles.radioOption, comprehensionLang === "en" && styles.radioSelected]}
                onPress={() => setComprehensionLang("en")}
              >
                <Text style={[styles.radioText, comprehensionLang === "en" && styles.radioTextSelected]}>English</Text>
              </Pressable>
              <Pressable
                style={[styles.radioOption, comprehensionLang === "am" && styles.radioSelected]}
                onPress={() => setComprehensionLang("am")}
              >
                <Text style={[styles.radioText, comprehensionLang === "am" && styles.radioTextSelected]}>አማርኛ</Text>
              </Pressable>
            </View>

            {/* High-risk warnings */}
            {warnings.length > 0 && (
              <Card style={styles.warningCard}>
                <Text style={styles.warningTitle}>{t.highRiskWarning}</Text>
                {warnings.includes("lowComprehension") && (
                  <Text style={styles.warningText}>{t.lowComprehension}</Text>
                )}
                {warnings.includes("languageMismatch") && (
                  <Text style={styles.warningText}>{t.languageMismatch}</Text>
                )}
                <View style={styles.overrideRow}>
                  <Text style={styles.overrideLabel}>{t.overrideRequired}</Text>
                  <Switch
                    value={highRiskOverride}
                    onValueChange={setHighRiskOverride}
                    trackColor={{ true: palette.darkPurple }}
                  />
                </View>
                {highRiskOverride && (
                  <>
                    <Text style={styles.fieldLabel}>{t.overrideReason}</Text>
                    <TextInput
                      style={styles.input}
                      value={overrideReason}
                      onChangeText={setOverrideReason}
                      placeholderTextColor="#9CA3AF"
                    />
                  </>
                )}
              </Card>
            )}

            {/* Confirmation */}
            <Pressable style={styles.checkRow} onPress={() => setConfirmed(!confirmed)}>
              <View style={[styles.checkbox, confirmed && styles.checkboxChecked]}>
                {confirmed && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkLabel}>{t.confirmCheck}</Text>
            </Pressable>

            <Button
              title={submitting ? "..." : t.submit}
              onPress={handleGrant}
              style={styles.submitBtn}
            />
          </View>
        )}

        {/* ── REVOKE TAB ─────────────────────────────────────────────── */}
        {activeTab === "revoke" && (
          <View>
            <Text style={styles.heading}>{t.revokeTitle}</Text>
            <Text style={styles.subtitle}>{t.revokeDesc}</Text>

            {/* Facility */}
            <Text style={styles.fieldLabel}>{t.facility} *</Text>
            <Pressable style={styles.pickerButton} onPress={() => setShowRevokeFacilityPicker(!showRevokeFacilityPicker)}>
              <Text style={revokeFacility ? styles.pickerText : styles.pickerPlaceholder}>{revokeFacilityName}</Text>
            </Pressable>
            {showRevokeFacilityPicker && (
              <View style={styles.pickerDropdown}>
                {facilities.map((fac) => (
                  <Pressable
                    key={fac.id}
                    style={[styles.pickerOption, revokeFacility === fac.id && styles.pickerOptionSelected]}
                    onPress={() => { setRevokeFacility(fac.id); setShowRevokeFacilityPicker(false); }}
                  >
                    <Text style={styles.pickerOptionText}>{fac.name}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Reason */}
            <Text style={styles.fieldLabel}>{t.revokeReason}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t.revokeReasonPlaceholder}
              value={revokeReasonText}
              onChangeText={setRevokeReasonText}
              multiline
              numberOfLines={3}
              placeholderTextColor="#9CA3AF"
            />

            {/* Confirmation phrase */}
            <Text style={styles.fieldLabel}>{t.confirmPhrase}</Text>
            <TextInput
              style={styles.input}
              placeholder="REVOKE"
              value={revokeConfirmPhrase}
              onChangeText={setRevokeConfirmPhrase}
              autoCapitalize="characters"
              placeholderTextColor="#9CA3AF"
            />

            <Button
              title={submitting ? "..." : t.revokeBtn}
              onPress={handleRevoke}
              style={[styles.submitBtn, { backgroundColor: "#B91C1C" }]}
            />
          </View>
        )}

        {/* ── HISTORY TAB ────────────────────────────────────────────── */}
        {activeTab === "history" && (
          <View>
            <Text style={styles.heading}>{t.historyTitle}</Text>
            <Text style={styles.subtitle}>{t.historyDesc}</Text>

            {history.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>{t.noHistory}</Text>
              </View>
            ) : (
              history.map((entry) => {
                const isGrant = entry.action === "grant";
                return (
                  <Card key={entry.id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={[styles.actionBadge, isGrant ? styles.grantBadge : styles.revokeBadge]}>
                        <Text style={[styles.actionBadgeText, isGrant ? styles.grantBadgeText : styles.revokeBadgeText]}>
                          {isGrant ? t.granted : t.revoked}
                        </Text>
                      </View>
                      <Text style={styles.historyDate}>
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <Text style={styles.historyFacility}>{entry.facilityName}</Text>
                    <Text style={styles.historyType}>
                      {entry.consentType === "records_access" ? t.recordsAccess : entry.consentType}
                    </Text>
                    {entry.metadata?.comprehensionLanguage && (
                      <Text style={styles.historyMeta}>
                        Language: {entry.metadata.comprehensionLanguage === "am" ? "አማርኛ" : "English"}
                      </Text>
                    )}
                    {entry.reason && (
                      <Text style={styles.historyMeta}>Reason: {entry.reason}</Text>
                    )}
                  </Card>
                );
              })
            )}
          </View>
        )}
      </ScrollView>
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
  scrollContent: { padding: spacing.lg, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },

  langRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  langChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: palette.softWhite,
  },
  langChipActive: { backgroundColor: palette.darkPurple, borderColor: palette.darkPurple },
  langText: { fontSize: 13, color: palette.black },
  langTextActive: { color: palette.white, fontWeight: "600" },

  tabBar: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: palette.softWhite,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: { backgroundColor: palette.darkPurple, borderColor: palette.darkPurple },
  tabText: { fontSize: 14, fontWeight: "600", color: palette.black },
  tabTextActive: { color: palette.white },

  heading: { fontSize: 20, fontWeight: "700", color: palette.black, marginBottom: 4 },
  subtitle: { fontSize: 13, color: palette.black, opacity: 0.5, marginBottom: spacing.lg },

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
  errorText: { fontSize: 12, color: "#B91C1C", marginTop: 4 },

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

  readOnlyField: {
    borderRadius: radius.sm,
    padding: spacing.sm,
    backgroundColor: palette.softWhite,
    borderWidth: 1,
    borderColor: colors.border,
  },
  readOnlyText: { fontSize: 14, color: palette.black, opacity: 0.7 },

  radioGroup: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  radioOption: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: palette.softWhite,
  },
  radioSelected: { backgroundColor: palette.darkPurple, borderColor: palette.darkPurple },
  radioText: { fontSize: 13, color: palette.black },
  radioTextSelected: { color: palette.white, fontWeight: "600" },

  warningCard: {
    backgroundColor: "#FEF3C7",
    borderColor: "#F59E0B",
    marginTop: spacing.md,
    padding: spacing.md,
  },
  warningTitle: { fontSize: 14, fontWeight: "700", color: "#92400E", marginBottom: 8 },
  warningText: { fontSize: 13, color: "#92400E", marginBottom: 4 },
  overrideRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.sm },
  overrideLabel: { fontSize: 13, fontWeight: "600", color: "#92400E" },

  checkRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.lg, gap: spacing.sm },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: palette.darkPurple, borderColor: palette.darkPurple },
  checkmark: { color: palette.white, fontSize: 14, fontWeight: "700" },
  checkLabel: { fontSize: 14, color: palette.black, flex: 1 },

  submitBtn: { marginTop: spacing.lg },

  emptyState: { alignItems: "center", paddingVertical: spacing.xl * 2 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: palette.black, opacity: 0.5 },

  card: { marginBottom: spacing.md, padding: spacing.md },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  actionBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  actionBadgeText: { fontSize: 11, fontWeight: "700" },
  grantBadge: { backgroundColor: "#D1FAE5" },
  grantBadgeText: { color: "#065F46" },
  revokeBadge: { backgroundColor: "#FEE2E2" },
  revokeBadgeText: { color: "#991B1B" },
  historyDate: { fontSize: 12, color: palette.black, opacity: 0.5 },
  historyFacility: { fontSize: 15, fontWeight: "700", color: palette.black, marginBottom: 2 },
  historyType: { fontSize: 13, color: palette.black, opacity: 0.7, marginBottom: 4 },
  historyMeta: { fontSize: 12, color: palette.black, opacity: 0.5 },
});

export default PatientConsentScreen;

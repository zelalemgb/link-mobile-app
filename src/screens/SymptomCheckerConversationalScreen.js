import React, { useState, useRef, useCallback, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Pressable,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import Screen from "../components/ui/Screen";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import { colors, spacing, radius, typography, shadow } from "../theme/tokens";
import { Feather } from "@expo/vector-icons";
import { requestPatientSymptomAssessment } from "../services/linkAgentService";
import { evaluateOfflineSymptomGuidance } from "../services/offlineCdssService";
import { logSymptomCheck } from "../services/patientService";

const AMHARIC_GREETING = "እንደምን ዋሉ? ሊንክ ጤና ረዳት ነኝ። ዛሬ እንዴት ሊረዳዎት ይችላል? ምልክቶችዎን ቢነግሩኝ በአማርኛ መወያየት እንችላለን::";
const AMHARIC_PLACEHOLDER = "እባክዎን ምልክቶችዎን ይዘርዝሩ...";
const AMHARIC_ERROR = "ይቅርታ፣ ችግር ተፈጥሯል:: እባክዎን እንደገና ይሞክሩ::";

const URGENCY_LABELS = {
    emergency: "Emergency",
    clinic_soon: "Clinic Soon",
    review: "Clinical Review",
    self_care: "Self Care",
};

const normalizeList = (value) => {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))];
};

const getUrgencyLabel = (urgency) => URGENCY_LABELS[urgency] || "Clinical Review";
const shouldShowCareHandoff = (urgency, redFlags) =>
    urgency === "emergency" || urgency === "clinic_soon" || (Array.isArray(redFlags) && redFlags.length > 0);

const SymptomCheckerConversationalScreen = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const [messages, setMessages] = useState([
        { id: "1", text: AMHARIC_GREETING, sender: "ai" },
    ]);
    const [inputText, setInputText] = useState("");
    const [loading, setLoading] = useState(false);
    const flatListRef = useRef();
    const consumedStarterPromptRef = useRef(null);
    const starterPrompt = String(route?.params?.starterPrompt || "").trim();
    const autoSendStarter = Boolean(route?.params?.autoSend);

    const openFacilityFinder = useCallback(() => {
        const routeNames = navigation?.getState?.()?.routeNames || [];
        if (routeNames.includes("Facilities")) {
            navigation.navigate("Facilities");
            return;
        }
        navigation.navigate("Main", { screen: "Facilities" });
    }, [navigation]);

    const openAppointmentBooking = useCallback(() => {
        navigation.navigate("PatientAppointments", {
            startBooking: true,
        });
    }, [navigation]);

    const openHealthRecords = useCallback(() => {
        navigation.navigate("PatientHealthRecords");
    }, [navigation]);

    const persistSymptomLog = async ({
        userInput,
        responseText,
        urgency,
        nextSteps,
        safetyNotes,
        redFlags,
        sourceStatus,
        source,
    }) => {
        try {
            await logSymptomCheck({
                symptom_data: {
                    userInput,
                    sourceStatus: sourceStatus || "generated",
                    source: source || "local_ai",
                    nextSteps: normalizeList(nextSteps),
                    safetyNotes: normalizeList(safetyNotes),
                    redFlags: normalizeList(redFlags),
                },
                urgency_level: urgency || "review",
                recommendations: [responseText, ...normalizeList(nextSteps)].filter(Boolean).join(" "),
            });
        } catch (error) {
            // Non-blocking: symptom checker must continue even if logging fails.
            console.error("Failed to persist symptom check log:", error);
        }
    };

    const sendPrompt = useCallback(async (promptText) => {
        const normalizedPrompt = String(promptText || "").trim();
        if (!normalizedPrompt || loading) return false;

        const userMessage = { id: Date.now().toString(), text: normalizedPrompt, sender: "user" };
        setMessages((prev) => [...prev, userMessage]);
        const currentInput = normalizedPrompt;
        setLoading(true);
        const conversationHistory = [...messages, userMessage];
        const conversation = conversationHistory.map((m) => ({
            role: m.sender === "user" ? "user" : "agent",
            message: m.text,
        }));
        const offlineGuidance = evaluateOfflineSymptomGuidance({
            message: currentInput,
            conversation: conversationHistory,
        });

        try {
            const result = await requestPatientSymptomAssessment({
                message: currentInput,
                conversation,
                locale: "am",
                includeAuth: true,
            });

            const content = result?.content || {};
            let responseText =
                content.response ||
                content.answer ||
                content.message ||
                result?.message ||
                "";
            if (!responseText.trim()) {
                responseText = offlineGuidance.referralRecommendation || AMHARIC_ERROR;
            }

            const sourceStatus = result?.agent?.status || "generated";
            const source = result?.agent?.source || "local_ai";
            const urgency = content.urgency || offlineGuidance.urgency || "review";
            const redFlags = normalizeList([...(content.redFlags || []), ...offlineGuidance.redFlags]);
            const nextSteps = normalizeList([...(content.nextSteps || []), ...offlineGuidance.nextSteps]);
            const showCareHandoff = shouldShowCareHandoff(urgency, redFlags);
            const showAppointmentHandoff = urgency === "clinic_soon" || urgency === "review";
            const safetyNotes = normalizeList([
                ...(content.safetyNotes || []),
                ...offlineGuidance.safetyNotes,
                sourceStatus === "fallback"
                    ? "AI service fallback mode active. Local safety guidance is applied."
                    : "",
            ]);

            const aiResponse = {
                id: (Date.now() + 1).toString(),
                text: responseText,
                sender: "ai",
                meta: {
                    urgency,
                    urgencyLabel: getUrgencyLabel(urgency),
                    nextSteps,
                    safetyNotes,
                    redFlags,
                    referralRecommendation:
                        content.referralRecommendation || offlineGuidance.referralRecommendation,
                    sourceStatus,
                    source,
                    showCareHandoff,
                    showAppointmentHandoff,
                    showRecordsHandoff: true,
                },
            };

            setMessages((prev) => [...prev, aiResponse]);
            void persistSymptomLog({
                userInput: currentInput,
                responseText,
                urgency,
                nextSteps,
                safetyNotes,
                redFlags,
                sourceStatus,
                source,
            });
        } catch (err) {
            console.error("AI Analysis failed:", err);
            const fallbackText = `${AMHARIC_ERROR}\n\n${offlineGuidance.referralRecommendation}`;
            const errorMessage = {
                id: Date.now().toString(),
                text: fallbackText,
                sender: "ai",
                isError: true,
                meta: {
                    urgency: offlineGuidance.urgency || "review",
                    urgencyLabel: getUrgencyLabel(offlineGuidance.urgency || "review"),
                    nextSteps: normalizeList(offlineGuidance.nextSteps),
                    safetyNotes: normalizeList([
                        ...offlineGuidance.safetyNotes,
                        "Network or AI issue detected. Using offline safety guidance.",
                    ]),
                    redFlags: normalizeList(offlineGuidance.redFlags),
                    referralRecommendation: offlineGuidance.referralRecommendation,
                    sourceStatus: "fallback",
                    source: "rules",
                    showCareHandoff: true,
                    showAppointmentHandoff: true,
                    showRecordsHandoff: true,
                },
            };
            setMessages((prev) => [...prev, errorMessage]);
            void persistSymptomLog({
                userInput: currentInput,
                responseText: fallbackText,
                urgency: offlineGuidance.urgency || "review",
                nextSteps: offlineGuidance.nextSteps,
                safetyNotes: offlineGuidance.safetyNotes,
                redFlags: offlineGuidance.redFlags,
                sourceStatus: "fallback",
                source: "rules",
            });
        } finally {
            setLoading(false);
        }
        return true;
    }, [loading, messages]);

    const handleSend = useCallback(async () => {
        const didSend = await sendPrompt(inputText);
        if (didSend) {
            setInputText("");
        }
    }, [inputText, sendPrompt]);

    useEffect(() => {
        if (!starterPrompt) return;
        const starterKey = `${starterPrompt}:${autoSendStarter ? "auto" : "draft"}`;
        if (consumedStarterPromptRef.current === starterKey) return;

        consumedStarterPromptRef.current = starterKey;
        if (autoSendStarter) {
            setInputText("");
            void sendPrompt(starterPrompt);
        } else {
            setInputText(starterPrompt);
        }

        if (navigation?.setParams) {
            navigation.setParams({
                starterPrompt: undefined,
                autoSend: undefined,
            });
        }
    }, [autoSendStarter, navigation, sendPrompt, starterPrompt]);

    const renderMessage = ({ item }) => {
        const urgency = item?.meta?.urgency || "review";
        const urgencyStyle =
            urgency === "emergency"
                ? styles.urgencyEmergency
                : urgency === "clinic_soon"
                    ? styles.urgencyClinicSoon
                    : urgency === "self_care"
                        ? styles.urgencySelfCare
                        : styles.urgencyReview;

        return (
            <View
                style={[
                    styles.messageBubble,
                    item.sender === "user" ? styles.userBubble : styles.aiBubble,
                    item.isError && styles.errorBubble,
                ]}
            >
                <Text style={[styles.messageText, item.sender === "user" && styles.userMessageText]}>
                    {item.text}
                </Text>

                {item.sender === "ai" && item?.meta?.urgencyLabel && (
                    <View style={styles.metaSection}>
                        <View style={[styles.urgencyBadge, urgencyStyle]}>
                            <Text style={styles.urgencyText}>{item.meta.urgencyLabel}</Text>
                        </View>
                    </View>
                )}

                {item.sender === "ai" && item?.meta?.redFlags?.length > 0 && (
                    <View style={styles.metaSection}>
                        <Text style={styles.metaTitle}>Danger signs</Text>
                        {item.meta.redFlags.map((flag) => (
                            <Text key={flag} style={styles.metaListItem}>
                                - {flag}
                            </Text>
                        ))}
                    </View>
                )}

                {item.sender === "ai" && item?.meta?.nextSteps?.length > 0 && (
                    <View style={styles.metaSection}>
                        <Text style={styles.metaTitle}>Next steps</Text>
                        {item.meta.nextSteps.map((step) => (
                            <Text key={step} style={styles.metaListItem}>
                                - {step}
                            </Text>
                        ))}
                    </View>
                )}

                {item.sender === "ai" && item?.meta?.safetyNotes?.length > 0 && (
                    <View style={styles.metaSection}>
                        <Text style={styles.metaTitle}>Safety notes</Text>
                        {item.meta.safetyNotes.map((note) => (
                            <Text key={note} style={styles.metaListItemMuted}>
                                - {note}
                            </Text>
                        ))}
                    </View>
                )}

                {item.sender === "ai" && item?.meta?.sourceStatus && (
                    <Text style={styles.sourceNote}>
                        {item.meta.sourceStatus === "fallback"
                            ? "Guidance mode: Safe fallback using local rules."
                            : "Guidance mode: Link Agent with CDSS safety checks."}
                    </Text>
                )}

                {item.sender === "ai" &&
                    (item?.meta?.showCareHandoff || item?.meta?.showAppointmentHandoff || item?.meta?.showRecordsHandoff) && (
                        <View style={styles.handoffRow}>
                            {item.meta.showCareHandoff ? (
                                <Pressable
                                    style={[styles.handoffButton, styles.handoffButtonPrimary]}
                                    onPress={openFacilityFinder}
                                >
                                    <Text style={styles.handoffButtonPrimaryText}>Find clinic</Text>
                                </Pressable>
                            ) : null}
                            {item.meta.showAppointmentHandoff ? (
                                <Pressable style={styles.handoffButton} onPress={openAppointmentBooking}>
                                    <Text style={styles.handoffButtonText}>Book appointment</Text>
                                </Pressable>
                            ) : null}
                            {item.meta.showRecordsHandoff ? (
                                <Pressable style={styles.handoffButton} onPress={openHealthRecords}>
                                    <Text style={styles.handoffButtonText}>View records</Text>
                                </Pressable>
                            ) : null}
                        </View>
                    )}
            </View>
        );
    };

    return (
        <Screen scrollable={false} backgroundColor={colors.background}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.container}
                keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
            >
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.messageList}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
                />

                <View style={styles.inputContainer}>
                    <Input
                        style={styles.input}
                        placeholder={AMHARIC_PLACEHOLDER}
                        value={inputText}
                        onChangeText={setInputText}
                        multiline
                    />
                    <Button
                        style={styles.sendButton}
                        onPress={handleSend}
                        disabled={loading || !inputText.trim()}
                    >
                        {loading ? (
                            <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                            <Feather name="send" size={20} color="#FFF" />
                        )}
                    </Button>
                </View>
            </KeyboardAvoidingView>
        </Screen>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    messageList: {
        padding: spacing.md,
        paddingBottom: spacing.xl,
    },
    messageBubble: {
        maxWidth: "80%",
        padding: spacing.md,
        borderRadius: radius.lg,
        marginBottom: spacing.md,
        ...shadow.card,
    },
    userBubble: {
        alignSelf: "flex-end",
        backgroundColor: colors.primary,
        borderBottomRightRadius: 4,
    },
    aiBubble: {
        alignSelf: "flex-start",
        backgroundColor: colors.surface,
        borderBottomLeftRadius: 4,
    },
    errorBubble: {
        backgroundColor: "#FEE2E2",
        borderWidth: 1,
        borderColor: "#EF4444",
    },
    messageText: {
        ...typography.body,
        lineHeight: 20,
    },
    userMessageText: {
        color: "#FFF",
    },
    metaSection: {
        marginTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: spacing.sm,
        gap: 2,
    },
    metaTitle: {
        ...typography.caption,
        fontWeight: "700",
        color: colors.text,
    },
    metaListItem: {
        ...typography.caption,
        color: colors.text,
        lineHeight: 16,
    },
    metaListItemMuted: {
        ...typography.caption,
        color: colors.textSecondary || "#6B7280",
        lineHeight: 16,
    },
    sourceNote: {
        ...typography.caption,
        marginTop: spacing.sm,
        color: colors.muted,
        fontStyle: "italic",
    },
    handoffRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.xs,
        marginTop: spacing.sm,
    },
    handoffButton: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.full || 999,
        paddingHorizontal: spacing.sm,
        paddingVertical: 6,
        backgroundColor: colors.background,
    },
    handoffButtonPrimary: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    handoffButtonText: {
        ...typography.caption,
        color: colors.text,
        fontWeight: "700",
    },
    handoffButtonPrimaryText: {
        ...typography.caption,
        color: "#FFF",
        fontWeight: "700",
    },
    urgencyBadge: {
        alignSelf: "flex-start",
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: radius.full || 999,
    },
    urgencyEmergency: {
        backgroundColor: "#FEE2E2",
    },
    urgencyClinicSoon: {
        backgroundColor: "#FEF3C7",
    },
    urgencyReview: {
        backgroundColor: "#DBEAFE",
    },
    urgencySelfCare: {
        backgroundColor: "#DCFCE7",
    },
    urgencyText: {
        ...typography.caption,
        fontWeight: "700",
        color: colors.text,
    },
    inputContainer: {
        flexDirection: "row",
        padding: spacing.md,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        alignItems: "flex-end",
        gap: spacing.sm,
    },
    input: {
        flex: 1,
        minHeight: 45,
        maxHeight: 120,
        backgroundColor: colors.background,
        borderWidth: 0,
    },
    sendButton: {
        width: 45,
        height: 45,
        borderRadius: 22.5,
        paddingHorizontal: 0,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.primary,
    },
});

export default SymptomCheckerConversationalScreen;

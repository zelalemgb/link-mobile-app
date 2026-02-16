import React, { useState, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from "react-native";
import Screen from "../components/ui/Screen";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import { colors, spacing, radius, typography, shadow } from "../theme/tokens";
import { getAuthToken } from "../lib/auth";
import { API_BASE_URL } from "../lib/env";
import { Feather } from "@expo/vector-icons";

const buildUrl = (path) => {
    const base = API_BASE_URL.endsWith("/api")
        ? API_BASE_URL
        : `${API_BASE_URL.replace(/\/$/, "")}/api`;
    return `${base}${path.startsWith("/") ? path : `/${path}`}`;
};

const AMHARIC_GREETING = "እንደምን ዋሉ? ሊንክ ጤና ረዳት ነኝ። ዛሬ እንዴት ሊረዳዎት ይችላል? ምልክቶችዎን ቢነግሩኝ በአማርኛ መወያየት እንችላለን::";
const AMHARIC_PLACEHOLDER = "እባክዎን ምልክቶችዎን ይዘርዝሩ...";
const AMHARIC_ERROR = "ይቅርታ፣ ችግር ተፈጥሯል:: እባክዎን እንደገና ይሞክሩ::";

const SymptomCheckerConversationalScreen = () => {
    const [messages, setMessages] = useState([
        { id: "1", text: AMHARIC_GREETING, sender: "ai" },
    ]);
    const [inputText, setInputText] = useState("");
    const [loading, setLoading] = useState(false);
    const flatListRef = useRef();

    const handleSend = async () => {
        if (!inputText.trim() || loading) return;

        const userMessage = { id: Date.now().toString(), text: inputText, sender: "user" };
        setMessages((prev) => [...prev, userMessage]);
        const currentInput = inputText;
        setInputText("");
        setLoading(true);

        try {
            // Build conversation history for context
            const history = messages
                .map((m) => (m.sender === "user" ? `Patient: ${m.text}` : `Doctor: ${m.text}`))
                .join("\n");

            // Strong Amharic-first system prompt
            const systemPrompt = `You are a medical assistant for Ethiopian patients. You MUST respond in Amharic (አማርኛ) language. Be empathetic, ask clarifying questions, and provide health guidance.

Conversation history:
${history}

Patient: ${currentInput}
Doctor (respond in Amharic):`;

            console.log("Sending prompt to AI:", systemPrompt.substring(0, 200) + "...");

            // Use FormData to match backend expectations
            const formData = new FormData();
            formData.append('prompt', systemPrompt);

            // Use public endpoint (no auth required)
            const apiUrl = buildUrl('/ai/analyze-public');

            console.log("API URL:", apiUrl);

            const response = await fetch(apiUrl, {
                method: 'POST',
                body: formData,
            });

            console.log("Response status:", response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error("API Error Response:", errorText);

                // If auth failed, try without auth for testing
                if (response.status === 401) {
                    console.log("Auth failed, retrying without auth...");
                    const retryResponse = await fetch(apiUrl, {
                        method: 'POST',
                        body: formData,
                    });

                    if (!retryResponse.ok) {
                        const retryError = await retryResponse.text();
                        throw new Error(`API request failed (${retryResponse.status}): ${retryError}`);
                    }

                    const retryResult = await retryResponse.json();
                    console.log("AI Response (no auth):", retryResult);

                    const aiResponse = {
                        id: (Date.now() + 1).toString(),
                        text: retryResult.response || "ምላሽ አልተቀበልኩም",
                        sender: "ai"
                    };

                    setMessages((prev) => [...prev, aiResponse]);
                    return;
                }

                throw new Error(`API request failed (${response.status}): ${errorText}`);
            }

            const result = await response.json();
            console.log("AI Response (full):", JSON.stringify(result, null, 2));
            console.log("AI Response text:", result.response);
            console.log("Response length:", result.response?.length || 0);

            let responseText = result.response || "";

            // If response is empty or just whitespace, provide a helpful message
            if (!responseText.trim()) {
                responseText = "ይቅርታ፣ AI ሞዴሉ በአማርኛ ምላሽ መስጠት አልቻለም። እባክዎን በእንግሊዝኛ ይሞክሩ ወይም ሌላ ጥያቄ ይጠይቁ።\n\n(Sorry, the AI model couldn't respond in Amharic. Please try in English or ask another question.)";
            }

            const aiResponse = {
                id: (Date.now() + 1).toString(),
                text: responseText,
                sender: "ai"
            };

            setMessages((prev) => [...prev, aiResponse]);
        } catch (err) {
            console.error("AI Analysis failed:", err);
            console.error("Error details:", err.message);
            const errorMessage = {
                id: Date.now().toString(),
                text: `${AMHARIC_ERROR}\n\nDebug: ${err.message}`,
                sender: "ai",
                isError: true
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setLoading(false);
        }
    };

    const renderMessage = ({ item }) => (
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
        </View>
    );

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

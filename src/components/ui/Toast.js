import React from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { colors, spacing, radius, typography, shadow } from "../../theme/tokens";

const Toast = ({ message, type = "success", onHide }) => {
    const opacity = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        Animated.sequence([
            Animated.timing(opacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.delay(2500),
            Animated.timing(opacity, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start(() => {
            if (onHide) onHide();
        });
    }, [message]);

    return (
        <Animated.View
            style={[
                styles.container,
                type === "error" && styles.error,
                { opacity },
            ]}
        >
            <Text style={styles.text}>{message}</Text>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        bottom: 100,
        left: spacing.lg,
        right: spacing.lg,
        backgroundColor: colors.ink,
        padding: spacing.md,
        borderRadius: radius.md,
        ...shadow.card,
        zIndex: 9999,
    },
    error: {
        backgroundColor: colors.danger,
    },
    text: {
        ...typography.caption,
        color: "#FFF",
        textAlign: "center",
        fontWeight: "600",
    },
});

export default Toast;

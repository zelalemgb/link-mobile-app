import React from "react";
import { SafeAreaView, View, Text, StyleSheet } from "react-native";

const ProfileScreen = () => {
  return (
    <SafeAreaView style={styles.container} testID="profile-screen">
      <View style={styles.content}>
        <Text style={styles.title}>My Profile</Text>
        <Text style={styles.subtitle}>
          Keep your health preferences and contact details up to date.
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ecfdf3",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#065f46",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: "#047857",
    textAlign: "center",
  },
});

export default ProfileScreen;

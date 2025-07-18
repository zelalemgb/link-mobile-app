import React from 'react';
import { SafeAreaView, View, Text, StyleSheet } from 'react-native';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <View>
        <Text style={styles.title}>Welcome to Link Mobile App</Text>
        <Text style={styles.subtitle}>Your digital health companion</Text>
        <Text style={styles.note}>This is the initial scaffolding of the application. Implementations of the symptom checker, facility recommendations, health feed and other modules will be added here.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8fafc',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 16,
  },
  note: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    maxWidth: 300,
  },
});

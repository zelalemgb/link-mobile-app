/**
 * ConsultStepHeader — progress bar + step label shown at the top of every visit screen
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../../theme/tokens';

const TEAL = '#0f766e';

export default function ConsultStepHeader({ step, total, title }) {
  const pct = (step / total) * 100;
  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.counter}>{step} / {total}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:    { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  top:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title:   { fontSize: 15, fontWeight: '700', color: '#111' },
  counter: { fontSize: 12, color: colors.muted },
  track:   { height: 4, backgroundColor: '#e5e7eb', borderRadius: 2 },
  fill:    { height: 4, backgroundColor: TEAL, borderRadius: 2 },
});

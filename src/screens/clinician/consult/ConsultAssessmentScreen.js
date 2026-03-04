/**
 * ConsultAssessmentScreen — Step 3 of 6
 * SOAP: History / Examination / Assessment / Plan
 */

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useConsult } from '../../../context/ConsultContext';
import { colors } from '../../../theme/tokens';
import ConsultStepHeader from './ConsultStepHeader';

const TEAL = '#0f766e';

function SOAPField({ label, letter, value, onChangeText, placeholder }) {
  return (
    <View style={styles.soapField}>
      <View style={styles.soapLabelRow}>
        <View style={styles.soapBadge}>
          <Text style={styles.soapBadgeText}>{letter}</Text>
        </View>
        <Text style={styles.soapLabel}>{label}</Text>
      </View>
      <TextInput
        style={styles.textarea}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
      />
    </View>
  );
}

export default function ConsultAssessmentScreen({ navigation }) {
  const { draft, updateAssessment, updateVisitData } = useConsult();
  const saved = draft.assessment ?? {};

  const [history, setHistory]   = useState(saved.history_text     ?? '');
  const [exam,    setExam]      = useState(saved.examination_text  ?? '');
  const [assess,  setAssess]    = useState(saved.assessment_text   ?? '');
  const [plan,    setPlan]      = useState(saved.plan_text         ?? '');
  const [notes,   setNotes]     = useState(draft.visitData.notes   ?? '');

  const handleNext = () => {
    updateAssessment({
      history_text:     history.trim() || null,
      examination_text: exam.trim()    || null,
      assessment_text:  assess.trim()  || null,
      plan_text:        plan.trim()    || null,
    });
    updateVisitData({ notes: notes.trim() || null });
    navigation.navigate('Diagnosis');
  };

  return (
    <View style={styles.container}>
      <ConsultStepHeader step={3} total={6} title="Assessment (SOAP)" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        <SOAPField
          letter="S" label="Subjective — History"
          value={history} onChangeText={setHistory}
          placeholder="Patient's history, symptoms, duration…"
        />
        <SOAPField
          letter="O" label="Objective — Examination"
          value={exam} onChangeText={setExam}
          placeholder="Physical examination findings…"
        />
        <SOAPField
          letter="A" label="Assessment — Summary"
          value={assess} onChangeText={setAssess}
          placeholder="Clinical impression and reasoning…"
        />
        <SOAPField
          letter="P" label="Plan"
          value={plan} onChangeText={setPlan}
          placeholder="Management plan, investigations ordered…"
        />

        <View style={styles.soapField}>
          <Text style={[styles.soapLabel, { marginBottom: 8 }]}>Additional notes</Text>
          <TextInput
            style={styles.textarea}
            value={notes}
            onChangeText={setNotes}
            placeholder="Any other notes…"
            placeholderTextColor={colors.muted}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
          />
        </View>

      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.skipBtn} onPress={() => { updateAssessment(null); navigation.navigate('Diagnosis'); }}>
          <Text style={styles.skipBtnText}>Skip</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
          <Text style={styles.nextBtnText}>Next: Diagnosis</Text>
          <Feather name="arrow-right" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: colors.background },
  scroll:         { padding: 16, paddingBottom: 20, gap: 14 },
  soapField:      { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, padding: 14 },
  soapLabelRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  soapBadge:      { width: 24, height: 24, borderRadius: 12, backgroundColor: '#0f766e', alignItems: 'center', justifyContent: 'center' },
  soapBadgeText:  { color: '#fff', fontWeight: '800', fontSize: 12 },
  soapLabel:      { fontSize: 13, fontWeight: '600', color: colors.ink },
  textarea:       { fontSize: 13, color: colors.ink, lineHeight: 20, minHeight: 68 },
  footer:         { flexDirection: 'row', padding: 16, gap: 10, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
  skipBtn:        { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, backgroundColor: '#fff' },
  skipBtnText:    { fontWeight: '600', color: colors.muted },
  nextBtn:        { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: TEAL, borderRadius: 14, paddingVertical: 15 },
  nextBtnText:    { color: '#fff', fontWeight: '700', fontSize: 15 },
});

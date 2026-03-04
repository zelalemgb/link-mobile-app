/**
 * ConsultChiefComplaintScreen — Step 1 of 6
 * Symptom chips + free-text entry
 *
 * Pre-population: if draft.preVisitContext is set (from Africa's Talking SMS
 * intake or HEW community notes), the suggestedChips list is used to
 * auto-select matching chips on first render. The clinician can freely add or
 * remove any selection before proceeding.
 */

import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useConsult } from '../../../context/ConsultContext';
import { colors } from '../../../theme/tokens';
import ConsultStepHeader from './ConsultStepHeader';

const TEAL   = '#0f766e';
const AMBER  = '#b45309';
const PURPLE = '#7c3aed';

const COMMON_COMPLAINTS = [
  'Fever', 'Headache', 'Cough', 'Difficulty breathing', 'Chest pain',
  'Abdominal pain', 'Diarrhoea', 'Vomiting', 'Body aches', 'Weakness / fatigue',
  'Rash', 'Swelling', 'Painful urination', 'Eye problem', 'Ear pain',
  'Sore throat', 'Convulsions', 'Loss of consciousness', 'Bleeding',
  'Antenatal visit', 'Postnatal visit', 'Child well-visit', 'Wound / injury',
];

export default function ConsultChiefComplaintScreen({ navigation }) {
  const { draft, updateVisitData } = useConsult();
  const savedCC = draft.visitData.chief_complaint ?? '';

  // Derive which chips the pre-visit context suggests (from AT symptoms + HEW flags)
  const suggestedChips = draft.preVisitContext?.suggestedChips ?? [];

  // On first render: merge saved CC chips with pre-visit suggestions.
  // If the clinician already made a selection (savedCC != ''), respect it.
  // Otherwise seed from preVisitContext.
  const [selected, setSelected] = useState(() => {
    const fromSaved = savedCC
      ? savedCC.split(', ').filter((c) => COMMON_COMPLAINTS.includes(c))
      : [];
    if (fromSaved.length > 0) return fromSaved;
    // First open: pre-select suggested chips that match COMMON_COMPLAINTS
    return suggestedChips.filter((c) => COMMON_COMPLAINTS.includes(c));
  });

  const [freeText, setFreeText] = useState(() =>
    savedCC ? savedCC.split(', ').filter((c) => !COMMON_COMPLAINTS.includes(c)).join(', ') : ''
  );
  const [visitType, setVisitType] = useState(draft.visitData.visit_type ?? 'outpatient');

  const VISIT_TYPES = [
    { label: 'Outpatient',   value: 'outpatient'   },
    { label: 'Emergency',    value: 'emergency'    },
    { label: 'Antenatal',    value: 'antenatal'    },
    { label: 'Postnatal',    value: 'postnatal'    },
    { label: 'Immunisation', value: 'immunisation' },
  ];

  const toggleChip = (chip) => {
    setSelected((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]
    );
  };

  const handleNext = () => {
    const allComplaints = [
      ...selected,
      ...freeText.split(',').map((s) => s.trim()).filter(Boolean),
    ];
    updateVisitData({
      chief_complaint: allComplaints.join(', ') || null,
      visit_type: visitType,
    });
    navigation.navigate('Vitals');
  };

  // Source badge: tell the clinician where the pre-selection came from
  const sourceLabel = useMemo(() => {
    const parts = [];
    if (draft.preVisitContext?.preTriage) parts.push('SMS pre-triage');
    if (draft.preVisitContext?.communityNotes?.length > 0) parts.push('HEW notes');
    return parts.length > 0 ? parts.join(' · ') : null;
  }, [draft.preVisitContext]);

  const hasPreFill = suggestedChips.length > 0 && !savedCC;

  return (
    <View style={styles.container}>
      <ConsultStepHeader step={1} total={6} title="Chief complaint" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Pre-fill source banner */}
        {hasPreFill && sourceLabel ? (
          <View style={styles.preFillBanner}>
            <Feather name="zap" size={13} color={TEAL} />
            <Text style={styles.preFillText}>
              Pre-filled from {sourceLabel}. Review and adjust as needed.
            </Text>
          </View>
        ) : null}

        {/* AT urgency hint */}
        {draft.preVisitContext?.preTriage?.recommended_urgency &&
         draft.preVisitContext.preTriage.recommended_urgency !== 'routine' ? (
          <View style={[
            styles.urgencyHint,
            draft.preVisitContext.preTriage.recommended_urgency === 'emergency'
              ? styles.urgencyHintEmerg
              : styles.urgencyHintUrgent,
          ]}>
            <Feather name="alert-triangle" size={13}
              color={draft.preVisitContext.preTriage.recommended_urgency === 'emergency' ? '#b91c1c' : AMBER} />
            <Text style={[
              styles.urgencyHintText,
              { color: draft.preVisitContext.preTriage.recommended_urgency === 'emergency' ? '#b91c1c' : AMBER },
            ]}>
              AT pre-triage flagged {draft.preVisitContext.preTriage.recommended_urgency.toUpperCase()}
            </Text>
          </View>
        ) : null}

        {/* Visit type */}
        <Text style={styles.label}>Visit type</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll}>
          {VISIT_TYPES.map((vt) => (
            <TouchableOpacity
              key={vt.value}
              style={[styles.typeChip, visitType === vt.value && styles.typeChipActive]}
              onPress={() => setVisitType(vt.value)}
            >
              <Text style={[styles.typeChipText, visitType === vt.value && styles.typeChipTextActive]}>
                {vt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Symptom chips */}
        <Text style={[styles.label, { marginTop: 18 }]}>Presenting complaint</Text>
        <Text style={styles.hint}>Select all that apply</Text>
        <View style={styles.chips}>
          {COMMON_COMPLAINTS.map((c) => {
            const isSelected  = selected.includes(c);
            const isSuggested = suggestedChips.includes(c) && !savedCC;
            return (
              <TouchableOpacity
                key={c}
                style={[
                  styles.chip,
                  isSelected  && styles.chipActive,
                  isSuggested && !isSelected && styles.chipSuggested,
                ]}
                onPress={() => toggleChip(c)}
                activeOpacity={0.75}
              >
                {isSelected && <Feather name="check" size={11} color="#fff" style={{ marginRight: 3 }} />}
                {isSuggested && !isSelected && (
                  <Feather name="zap" size={11} color={TEAL} style={{ marginRight: 3 }} />
                )}
                <Text style={[
                  styles.chipText,
                  isSelected  && styles.chipTextActive,
                  isSuggested && !isSelected && styles.chipTextSuggested,
                ]}>
                  {c}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* HEW summary if available */}
        {draft.preVisitContext?.communityNotes?.length > 0 ? (
          <View style={styles.hewSummary}>
            <Feather name="users" size={13} color={PURPLE} />
            <Text style={styles.hewSummaryText}>
              {draft.preVisitContext.communityNotes.length} HEW note{draft.preVisitContext.communityNotes.length > 1 ? 's' : ''}
              {' '}available — see patient detail for full context.
            </Text>
          </View>
        ) : null}

        {/* Free text */}
        <Text style={[styles.label, { marginTop: 18 }]}>Additional details</Text>
        <TextInput
          style={styles.textarea}
          value={freeText}
          onChangeText={setFreeText}
          placeholder="Add any other complaints or history…"
          placeholderTextColor={colors.muted}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
          <Text style={styles.nextBtnText}>Next: Vitals</Text>
          <Feather name="arrow-right" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: colors.background },
  scroll:              { padding: 16, paddingBottom: 20 },
  label:               { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8 },
  hint:                { fontSize: 12, color: colors.muted, marginBottom: 10, marginTop: -4 },
  hScroll:             { marginBottom: 4 },

  // Pre-fill banner
  preFillBanner:       { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#f0fdf4', borderRadius: 10, borderWidth: 1, borderColor: '#6ee7b7', padding: 10, marginBottom: 14 },
  preFillText:         { fontSize: 12, color: TEAL, flex: 1 },

  // Urgency hint
  urgencyHint:         { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 10, borderWidth: 1, padding: 10, marginBottom: 14 },
  urgencyHintEmerg:    { backgroundColor: '#fee2e2', borderColor: '#fca5a5' },
  urgencyHintUrgent:   { backgroundColor: '#fef3c7', borderColor: '#fcd34d' },
  urgencyHintText:     { fontSize: 12, fontWeight: '600', flex: 1 },

  typeChip:            { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, backgroundColor: '#fff', marginRight: 8 },
  typeChipActive:      { backgroundColor: TEAL, borderColor: TEAL },
  typeChipText:        { fontSize: 13, fontWeight: '600', color: colors.muted },
  typeChipTextActive:  { color: '#fff' },

  chips:               { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:                { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, backgroundColor: '#fff' },
  chipActive:          { backgroundColor: TEAL, borderColor: TEAL },
  chipSuggested:       { borderColor: TEAL, backgroundColor: '#f0fdf4' },
  chipText:            { fontSize: 13, color: colors.muted },
  chipTextActive:      { color: '#fff', fontWeight: '600' },
  chipTextSuggested:   { color: TEAL, fontWeight: '600' },

  // HEW summary
  hewSummary:          { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#f5f3ff', borderRadius: 10, borderWidth: 1, borderColor: '#ddd6fe', padding: 10, marginTop: 14 },
  hewSummaryText:      { fontSize: 12, color: PURPLE, flex: 1 },

  textarea:            { backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, padding: 12, fontSize: 14, color: colors.ink, minHeight: 80, marginTop: 8 },
  footer:              { padding: 16, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
  nextBtn:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: TEAL, borderRadius: 14, paddingVertical: 15 },
  nextBtnText:         { color: '#fff', fontWeight: '700', fontSize: 15 },
});

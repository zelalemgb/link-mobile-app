/**
 * ConsultVitalsScreen — Step 2 of 6
 * BP, temp, weight, height, SpO2, RR, MUAC
 * All fields optional — clinician skips if not measured.
 *
 * Pre-population: if draft.preVisitContext.lastTriageVitals is set (from the
 * most recent nurse triage session stored in local SQLite), all 9 vital fields
 * are seeded from that record on first render. A banner informs the clinician
 * so they can verify or update before proceeding.
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

function VitalInput({ label, unit, value, onChangeText, keyboardType = 'numeric', hint }) {
  return (
    <View style={styles.vitalField}>
      <Text style={styles.vLabel}>{label}</Text>
      <View style={styles.vInputWrap}>
        <TextInput
          style={styles.vInput}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          placeholder="—"
          placeholderTextColor={colors.muted}
        />
        {unit ? <Text style={styles.vUnit}>{unit}</Text> : null}
      </View>
      {hint ? <Text style={styles.vHint}>{hint}</Text> : null}
    </View>
  );
}

export default function ConsultVitalsScreen({ navigation }) {
  const { draft, updateVitals } = useConsult();

  // Pre-visit triage vitals take precedence over saved draft vitals for first open.
  // If draft.vitals already has values the clinician set in a previous wizard pass,
  // respect those instead.
  const triageVitals = draft.preVisitContext?.lastTriageVitals ?? null;
  const seed = draft.vitals ?? triageVitals ?? {};
  const isPreFilled = !draft.vitals && !!triageVitals;

  const [bpSys,  setBpSys]  = useState(seed.bp_systolic?.toString()      ?? '');
  const [bpDia,  setBpDia]  = useState(seed.bp_diastolic?.toString()     ?? '');
  const [hr,     setHr]     = useState(seed.heart_rate?.toString()       ?? '');
  const [temp,   setTemp]   = useState(seed.temperature?.toString()      ?? '');
  const [weight, setWeight] = useState(seed.weight_kg?.toString()        ?? '');
  const [height, setHeight] = useState(seed.height_cm?.toString()        ?? '');
  const [spo2,   setSpo2]   = useState(seed.spo2_pct?.toString()         ?? '');
  const [rr,     setRr]     = useState(seed.respiratory_rate?.toString() ?? '');
  const [muac,   setMuac]   = useState(seed.muac_mm?.toString()          ?? '');

  const num = (s) => (s.trim() ? parseFloat(s)  : null);
  const int = (s) => (s.trim() ? parseInt(s, 10) : null);

  const handleNext = () => {
    const vitals = {
      bp_systolic:      int(bpSys),
      bp_diastolic:     int(bpDia),
      heart_rate:       int(hr),
      temperature:      num(temp),
      weight_kg:        num(weight),
      height_cm:        num(height),
      spo2_pct:         int(spo2),
      respiratory_rate: int(rr),
      muac_mm:          int(muac),
    };
    const hasAny = Object.values(vitals).some((v) => v !== null);
    updateVitals(hasAny ? vitals : null);
    navigation.navigate('Assessment');
  };

  const bmi = (num(weight) && num(height))
    ? (num(weight) / Math.pow(num(height) / 100, 2)).toFixed(1)
    : null;

  return (
    <View style={styles.container}>
      <ConsultStepHeader step={2} total={6} title="Vitals" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Pre-fill banner from last nurse triage */}
        {isPreFilled ? (
          <View style={styles.preFillBanner}>
            <Feather name="clipboard" size={13} color={TEAL} />
            <Text style={styles.preFillText}>
              Pre-filled from last nurse triage. Verify and update before saving.
            </Text>
          </View>
        ) : null}

        {/* BP */}
        <Text style={styles.groupLabel}>Blood pressure</Text>
        <View style={styles.bpRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.vLabel}>Systolic</Text>
            <View style={styles.vInputWrap}>
              <TextInput style={styles.vInput} value={bpSys} onChangeText={setBpSys} keyboardType="numeric" placeholder="—" placeholderTextColor={colors.muted} />
              <Text style={styles.vUnit}>mmHg</Text>
            </View>
          </View>
          <Text style={styles.bpSlash}>/</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.vLabel}>Diastolic</Text>
            <View style={styles.vInputWrap}>
              <TextInput style={styles.vInput} value={bpDia} onChangeText={setBpDia} keyboardType="numeric" placeholder="—" placeholderTextColor={colors.muted} />
              <Text style={styles.vUnit}>mmHg</Text>
            </View>
          </View>
        </View>

        <View style={styles.grid}>
          <VitalInput label="Temperature"  unit="°C"   value={temp}   onChangeText={setTemp}   keyboardType="decimal-pad" />
          <VitalInput label="Heart rate"   unit="bpm"  value={hr}     onChangeText={setHr} />
          <VitalInput label="SpO₂"         unit="%"    value={spo2}   onChangeText={setSpo2}   hint="Oxygen saturation" />
          <VitalInput label="Resp. rate"   unit="/min" value={rr}     onChangeText={setRr} />
          <VitalInput label="Weight"       unit="kg"   value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
          <VitalInput label="Height"       unit="cm"   value={height} onChangeText={setHeight} keyboardType="decimal-pad"
            hint={bmi ? `BMI: ${bmi}` : null} />
          <VitalInput label="MUAC"         unit="mm"   value={muac}   onChangeText={setMuac}   hint="Mid-upper arm circ." />
        </View>

        {/* Clinical alerts */}
        {(int(bpSys) >= 140 || int(bpDia) >= 90) && (
          <View style={styles.alert}>
            <Feather name="alert-triangle" size={14} color="#b45309" />
            <Text style={styles.alertText}>BP ≥ 140/90 — consider hypertension management</Text>
          </View>
        )}
        {int(spo2) && int(spo2) < 95 && (
          <View style={[styles.alert, styles.alertRed]}>
            <Feather name="alert-circle" size={14} color="#b91c1c" />
            <Text style={[styles.alertText, { color: '#b91c1c' }]}>SpO₂ &lt; 95% — assess for respiratory distress</Text>
          </View>
        )}

      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.skipBtn} onPress={() => { updateVitals(null); navigation.navigate('Assessment'); }}>
          <Text style={styles.skipBtnText}>Skip</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
          <Text style={styles.nextBtnText}>Next: Assessment</Text>
          <Feather name="arrow-right" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.background },
  scroll:      { padding: 16, paddingBottom: 20, gap: 2 },

  // Pre-fill banner
  preFillBanner: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#f0fdf4', borderRadius: 10, borderWidth: 1, borderColor: '#6ee7b7', padding: 10, marginBottom: 14 },
  preFillText:   { fontSize: 12, color: TEAL, flex: 1 },

  groupLabel:  { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10 },
  bpRow:       { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 16 },
  bpSlash:     { fontSize: 28, color: colors.muted, paddingBottom: 8 },
  grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  vitalField:  { width: '47%', marginBottom: 4 },
  vLabel:      { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 },
  vInputWrap:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  vInput:      { flex: 1, fontSize: 15, fontWeight: '600', color: colors.ink },
  vUnit:       { fontSize: 11, color: colors.muted, marginLeft: 4 },
  vHint:       { fontSize: 10, color: TEAL, marginTop: 3 },
  alert:       { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fef3c7', borderRadius: 10, padding: 10, marginTop: 12, borderWidth: 1, borderColor: '#fcd34d' },
  alertRed:    { backgroundColor: '#fee2e2', borderColor: '#fca5a5' },
  alertText:   { fontSize: 12, color: '#92400e', flex: 1 },
  footer:      { flexDirection: 'row', padding: 16, gap: 10, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
  skipBtn:     { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, backgroundColor: '#fff' },
  skipBtnText: { fontWeight: '600', color: colors.muted },
  nextBtn:     { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: TEAL, borderRadius: 14, paddingVertical: 15 },
  nextBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

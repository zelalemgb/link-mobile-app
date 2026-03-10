/**
 * NurseTriageScreen — Standalone nurse vitals + triage entry
 *
 * Allows a nurse (or any clinician) to record vitals and a chief complaint
 * for a patient independently of the doctor consult wizard.
 *
 * Saves as a visit_type='triage' record with status='triage_complete',
 * enqueues for sync, then navigates back to PatientDetail.
 *
 * The saved triage visit appears in the patient's visit history so a doctor
 * opening a full consult can see the nurse's readings.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { patientRepo } from '../../repositories/patientRepo';
import { visitRepo   } from '../../repositories/visitRepo';
import { useAuth     } from '../../context/AuthContext';
import { colors      } from '../../theme/tokens';

const TEAL   = '#0f766e';
const AMBER  = '#b45309';
const RED    = '#b91c1c';

const URGENCIES = [
  { value: 'routine',   label: 'Routine',   color: TEAL  },
  { value: 'urgent',    label: 'Urgent',    color: AMBER },
  { value: 'emergency', label: 'Emergency', color: RED   },
];

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function VitalField({ label, unit, value, onChangeText, keyboardType = 'numeric', hint, alert }) {
  return (
    <View style={styles.vitalField}>
      <Text style={styles.vLabel}>{label}</Text>
      <View style={[styles.vInputWrap, alert && styles.vInputWrapAlert]}>
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

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function NurseTriageScreen({ route, navigation }) {
  const { patientId } = route.params;
  const { user }      = useAuth();

  const [patient,  setPatient]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  // Chief complaint + triage urgency
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [urgency,        setUrgency]        = useState('routine');
  const [triageNotes,    setTriageNotes]    = useState('');

  // Vitals (all optional)
  const [bpSys,  setBpSys]  = useState('');
  const [bpDia,  setBpDia]  = useState('');
  const [hr,     setHr]     = useState('');
  const [temp,   setTemp]   = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [spo2,   setSpo2]   = useState('');
  const [rr,     setRr]     = useState('');
  const [muac,   setMuac]   = useState('');

  // Load patient
  useEffect(() => {
    let active = true;
    patientRepo.getById(patientId).then((p) => {
      if (active) { setPatient(p); setLoading(false); }
    });
    return () => { active = false; };
  }, [patientId]);

  const num = (s) => (s.trim() ? parseFloat(s) : null);
  const int = (s) => (s.trim() ? parseInt(s, 10) : null);

  // Derived flags for clinical alerts
  const bpAlert  = (int(bpSys) >= 140 || int(bpDia) >= 90);
  const spo2Alert = (int(spo2) && int(spo2) < 95);
  const bmi = (num(weight) && num(height))
    ? (num(weight) / Math.pow(num(height) / 100, 2)).toFixed(1)
    : null;

  const handleSave = useCallback(async () => {
    if (!patient) return;

    if (!chiefComplaint.trim()) {
      Alert.alert('Chief complaint required', 'Please enter at least a brief chief complaint before saving the triage record.');
      return;
    }

    setSaving(true);
    try {
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
      const hasVitals = Object.values(vitals).some((v) => v !== null);

      const visitData = {
        patient_id:    patient.id,
        facility_id:   patient.facility_id,
        tenant_id:     patient.tenant_id,
        visit_type:    'triage',
        visit_date:    new Date().toISOString(),
        chief_complaint: chiefComplaint.trim(),
        status:        'triage_complete',
        notes: [
          urgency !== 'routine' ? `Triage urgency: ${urgency}` : null,
          triageNotes.trim() || null,
        ].filter(Boolean).join('\n') || null,
      };

      await visitRepo.save({
        visitData,
        vitals:      hasVitals ? vitals : null,
        actorUserId: user?.id ?? 'unknown',
      });

      Alert.alert(
        'Triage recorded',
        'Vitals and chief complaint have been saved and queued for sync.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      Alert.alert('Save failed', err?.message ?? 'Could not save triage record. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [bpDia, bpSys, chiefComplaint, height, hr, muac, navigation, patient, rr, spo2, temp, triageNotes, urgency, user?.id, weight]);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={TEAL} />
      </View>
    );
  }

  if (!patient) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: colors.muted }}>Patient not found.</Text>
      </View>
    );
  }

  const age = patient.date_of_birth
    ? `${Math.floor((Date.now() - new Date(patient.date_of_birth)) / 3.156e10)} yrs`
    : null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* Patient banner */}
      <View style={styles.patientBanner}>
        <Feather name="user" size={16} color={TEAL} />
        <Text style={styles.patientBannerName}>{patient.full_name}</Text>
        {age || patient.sex ? (
          <Text style={styles.patientBannerMeta}>
            {[age, patient.sex].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* ── Chief complaint ─────────────────────────────────────────────── */}
        <View style={styles.card}>
          <SectionLabel>Chief complaint *</SectionLabel>
          <TextInput
            style={[styles.input, styles.inputCC]}
            value={chiefComplaint}
            onChangeText={setChiefComplaint}
            placeholder="Main reason for visit…"
            placeholderTextColor={colors.muted}
            multiline
          />
        </View>

        {/* ── Triage urgency ──────────────────────────────────────────────── */}
        <View style={styles.card}>
          <SectionLabel>Triage urgency</SectionLabel>
          <View style={styles.urgencyRow}>
            {URGENCIES.map((u) => {
              const active = urgency === u.value;
              return (
                <TouchableOpacity
                  key={u.value}
                  style={[
                    styles.urgencyChip,
                    active && { backgroundColor: u.color, borderColor: u.color },
                  ]}
                  onPress={() => setUrgency(u.value)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.urgencyLabel, active && styles.urgencyLabelActive]}>
                    {u.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Vitals ──────────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <SectionLabel>Vitals (all optional)</SectionLabel>

          {/* BP side-by-side */}
          <Text style={styles.vitalsGroupLabel}>Blood pressure</Text>
          <View style={styles.bpRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.vLabel}>Systolic</Text>
              <View style={[styles.vInputWrap, bpAlert && styles.vInputWrapAlert]}>
                <TextInput style={styles.vInput} value={bpSys} onChangeText={setBpSys}
                  keyboardType="numeric" placeholder="—" placeholderTextColor={colors.muted} />
                <Text style={styles.vUnit}>mmHg</Text>
              </View>
            </View>
            <Text style={styles.bpSlash}>/</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.vLabel}>Diastolic</Text>
              <View style={[styles.vInputWrap, bpAlert && styles.vInputWrapAlert]}>
                <TextInput style={styles.vInput} value={bpDia} onChangeText={setBpDia}
                  keyboardType="numeric" placeholder="—" placeholderTextColor={colors.muted} />
                <Text style={styles.vUnit}>mmHg</Text>
              </View>
            </View>
          </View>

          {/* 2-column vitals grid */}
          <View style={styles.vGrid}>
            <VitalField label="Temperature"  unit="°C"   value={temp}   onChangeText={setTemp}   keyboardType="decimal-pad" />
            <VitalField label="Heart rate"   unit="bpm"  value={hr}     onChangeText={setHr} />
            <VitalField label="SpO₂"         unit="%"    value={spo2}   onChangeText={setSpo2}   alert={spo2Alert} hint={spo2Alert ? 'Low — assess resp.' : null} />
            <VitalField label="Resp. rate"   unit="/min" value={rr}     onChangeText={setRr} />
            <VitalField label="Weight"       unit="kg"   value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
            <VitalField label="Height"       unit="cm"   value={height} onChangeText={setHeight} keyboardType="decimal-pad" hint={bmi ? `BMI: ${bmi}` : null} />
            <VitalField label="MUAC"         unit="mm"   value={muac}   onChangeText={setMuac}   hint="Mid-upper arm circ." />
          </View>

          {/* Clinical alerts */}
          {bpAlert && (
            <View style={styles.clinicalAlert}>
              <Feather name="alert-triangle" size={14} color={AMBER} />
              <Text style={[styles.clinicalAlertText, { color: AMBER }]}>
                BP ≥ 140/90 — flag for clinician
              </Text>
            </View>
          )}
          {spo2Alert && (
            <View style={[styles.clinicalAlert, styles.clinicalAlertRed]}>
              <Feather name="alert-circle" size={14} color={RED} />
              <Text style={[styles.clinicalAlertText, { color: RED }]}>
                SpO₂ &lt; 95% — urgent clinician review
              </Text>
            </View>
          )}
        </View>

        {/* ── Triage notes ────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <SectionLabel>Triage notes (optional)</SectionLabel>
          <TextInput
            style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
            value={triageNotes}
            onChangeText={setTriageNotes}
            placeholder="Additional observations, context, or concerns…"
            placeholderTextColor={colors.muted}
            multiline
          />
        </View>

      </ScrollView>

      {/* ── Footer save ───────────────────────────────────────────────────── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : (
              <>
                <Feather name="clipboard" size={18} color="#fff" />
                <Text style={styles.saveBtnText}>Save triage record</Text>
              </>
            )
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.background },
  centered:    { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Patient banner
  patientBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#f0fdf4', borderBottomWidth: 1, borderBottomColor: '#6ee7b7',
  },
  patientBannerName: { fontSize: 14, fontWeight: '700', color: colors.ink, flex: 1 },
  patientBannerMeta: { fontSize: 12, color: colors.muted, textTransform: 'capitalize' },

  scroll: { padding: 16, paddingBottom: 24, gap: 12 },

  card: {
    backgroundColor: '#fff', borderRadius: 16,
    borderWidth: 1.5, borderColor: colors.border,
    padding: 14, gap: 4,
  },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: colors.muted,
    textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8,
  },

  // Chief complaint
  input: {
    backgroundColor: colors.background, borderRadius: 12,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: colors.ink,
  },
  inputCC: { minHeight: 56, textAlignVertical: 'top' },

  // Urgency
  urgencyRow: { flexDirection: 'row', gap: 8 },
  urgencyChip: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderRadius: 12, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.background,
  },
  urgencyLabel: { fontSize: 12, fontWeight: '600', color: colors.muted },
  urgencyLabelActive: { color: '#fff' },

  // Vitals
  vitalsGroupLabel: {
    fontSize: 11, fontWeight: '700', color: colors.muted,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: 4, marginBottom: 8,
  },
  bpRow:   { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 14 },
  bpSlash: { fontSize: 26, color: colors.muted, paddingBottom: 6 },
  vGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  vitalField:   { width: '47%', marginBottom: 4 },
  vLabel:       { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 },
  vInputWrap:   { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  vInputWrapAlert: { borderColor: '#fca5a5', backgroundColor: '#fff1f2' },
  vInput:       { flex: 1, fontSize: 15, fontWeight: '600', color: colors.ink },
  vUnit:        { fontSize: 11, color: colors.muted, marginLeft: 4 },
  vHint:        { fontSize: 10, color: TEAL, marginTop: 3 },

  // Clinical alerts
  clinicalAlert: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fef3c7', borderRadius: 10, padding: 10,
    marginTop: 10, borderWidth: 1, borderColor: '#fcd34d',
  },
  clinicalAlertRed: { backgroundColor: '#fee2e2', borderColor: '#fca5a5' },
  clinicalAlertText: { fontSize: 12, flex: 1 },

  // Footer
  footer: {
    padding: 16, borderTopWidth: 1,
    borderTopColor: colors.border, backgroundColor: colors.background,
  },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: TEAL, borderRadius: 14, paddingVertical: 15,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

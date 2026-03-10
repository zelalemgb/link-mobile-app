/**
 * PatientRegistrationScreen (W2-MOB-010)
 *
 * Minimal required fields only:
 *   full_name*, date_of_birth, sex*, phone, village, kebele
 *
 * Saves locally via patientRepo.create() → enqueued for sync.
 * Navigates back to PatientDetail on success.
 */

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { patientRepo } from '../../repositories/patientRepo';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing } from '../../theme/tokens';
import { newId } from '../../lib/db/database';

const TEAL = '#0f766e';
const SEX_OPTIONS = [
  { label: 'Female', value: 'female' },
  { label: 'Male',   value: 'male'   },
  { label: 'Other',  value: 'other'  },
];

// ─── Field helpers ────────────────────────────────────────────────────────────

function Field({ label, required, children }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}{required ? <Text style={{ color: '#b91c1c' }}> *</Text> : null}</Text>
      {children}
    </View>
  );
}

function TextRow({ value, onChangeText, placeholder, keyboardType, autoCapitalize = 'words' }) {
  return (
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
    />
  );
}

function SegmentedPicker({ options, value, onChange }) {
  return (
    <View style={styles.segmented}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={[styles.segment, value === opt.value && styles.segmentActive]}
          onPress={() => onChange(opt.value)}
          activeOpacity={0.8}
        >
          <Text style={[styles.segmentText, value === opt.value && styles.segmentTextActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function PatientRegistrationScreen({ navigation }) {
  const { user } = useAuth();

  const [fullName,  setFullName]  = useState('');
  const [dob,       setDob]       = useState('');       // YYYY-MM-DD
  const [sex,       setSex]       = useState('female');
  const [phone,     setPhone]     = useState('');
  const [village,   setVillage]   = useState('');
  const [kebele,    setKebele]    = useState('');
  const [woreda,    setWoreda]    = useState('');
  const [saving,    setSaving]    = useState(false);
  const [errors,    setErrors]    = useState({});

  const validate = () => {
    const e = {};
    if (!fullName.trim()) e.fullName = 'Full name is required';
    if (!sex)             e.sex = 'Sex is required';
    if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) e.dob = 'Use YYYY-MM-DD format';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const patient = await patientRepo.create({
        data: {
          id:          newId(),
          facility_id: user?.facility_id ?? 'unknown',
          tenant_id:   user?.tenant_id   ?? 'unknown',
          full_name:   fullName.trim(),
          date_of_birth: dob || null,
          sex,
          phone:   phone.trim()   || null,
          village: village.trim() || null,
          kebele:  kebele.trim()  || null,
          woreda:  woreda.trim()  || null,
          language: 'am',
          hew_user_id: null,
        },
        actorUserId: user?.id ?? 'unknown',
      });
      navigation.replace('PatientDetail', { patientId: patient.id });
    } catch (err) {
      Alert.alert('Save failed', err?.message ?? 'Could not save patient.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

      <Field label="Full name" required>
        <TextRow value={fullName} onChangeText={setFullName} placeholder="e.g. Tigist Haile" />
        {errors.fullName ? <Text style={styles.error}>{errors.fullName}</Text> : null}
      </Field>

      <Field label="Sex" required>
        <SegmentedPicker options={SEX_OPTIONS} value={sex} onChange={setSex} />
        {errors.sex ? <Text style={styles.error}>{errors.sex}</Text> : null}
      </Field>

      <Field label="Date of birth">
        <TextRow
          value={dob} onChangeText={setDob}
          placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation"
          autoCapitalize="none"
        />
        {errors.dob ? <Text style={styles.error}>{errors.dob}</Text> : null}
      </Field>

      <Field label="Phone">
        <TextRow value={phone} onChangeText={setPhone} placeholder="+251 9…" keyboardType="phone-pad" autoCapitalize="none" />
      </Field>

      <Field label="Village / town">
        <TextRow value={village} onChangeText={setVillage} placeholder="Village or town" />
      </Field>

      <View style={styles.row}>
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>Kebele</Text>
          <TextInput style={styles.input} value={kebele} onChangeText={setKebele} placeholder="Kebele" placeholderTextColor={colors.muted} />
        </View>
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>Woreda</Text>
          <TextInput style={styles.input} value={woreda} onChangeText={setWoreda} placeholder="Woreda" placeholderTextColor={colors.muted} />
        </View>
      </View>

      <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
        {saving
          ? <ActivityIndicator size="small" color="#fff" />
          : <><Feather name="user-check" size={18} color="#fff" /><Text style={styles.saveBtnText}>Register patient</Text></>
        }
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: colors.background },
  content:          { padding: 16, paddingBottom: 40, gap: 2 },
  field:            { marginBottom: 14 },
  row:              { flexDirection: 'row', gap: 10 },
  label:            { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  input:            { backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, padding: 12, fontSize: 14, color: colors.ink },
  error:            { fontSize: 11, color: '#b91c1c', marginTop: 4 },
  segmented:        { flexDirection: 'row', borderRadius: 12, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.border },
  segment:          { flex: 1, paddingVertical: 11, alignItems: 'center', backgroundColor: '#fff' },
  segmentActive:    { backgroundColor: TEAL },
  segmentText:      { fontSize: 13, fontWeight: '600', color: colors.muted },
  segmentTextActive:{ color: '#fff' },
  saveBtn:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: TEAL, borderRadius: 14, paddingVertical: 15, marginTop: 10 },
  saveBtnText:      { color: '#fff', fontWeight: '700', fontSize: 15 },
});

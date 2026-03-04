/**
 * HEWRecordNoteScreen — Log a field visit note for a patient
 *
 * Features:
 *  - Visit type picker (matches community_note_type DB enum)
 *  - Free-text field notes
 *  - Voice recording via expo-av (records .m4a, stores URI)
 *  - Location + follow-up date inputs
 *  - Flag chips
 *  - Online: POST directly to backend
 *  - Offline: enqueue to AsyncStorage queue
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { submitNote, submitVoiceNote } from '../../services/hewService';
import { enqueue } from '../../lib/offlineQueue';
import { tokens } from '../../theme/tokens';

// ─── Constants ────────────────────────────────────────────────────────────

const NOTE_TYPES = [
  { value: 'household_visit',     label: 'Household visit' },
  { value: 'maternal_followup',   label: 'Maternal follow-up' },
  { value: 'child_growth',        label: 'Child growth' },
  { value: 'vaccination',         label: 'Vaccination' },
  { value: 'referral_followup',   label: 'Referral follow-up' },
  { value: 'nutrition',           label: 'Nutrition' },
  { value: 'medication_adherence',label: 'Medication adherence' },
  { value: 'general',             label: 'General' },
];

const FLAGS = [
  { value: 'danger_sign',      label: 'Danger sign',       color: '#fee2e2', text: '#b91c1c' },
  { value: 'missed_dose',      label: 'Missed dose',       color: '#fef3c7', text: '#b45309' },
  { value: 'defaulted',        label: 'Defaulted',         color: '#fee2e2', text: '#b91c1c' },
  { value: 'lost_to_followup', label: 'Lost to follow-up', color: '#ffedd5', text: '#c2410c' },
  { value: 'improving',        label: 'Improving',         color: '#d1fae5', text: '#065f46' },
  { value: 'referred',         label: 'Referred',          color: '#dbeafe', text: '#1d4ed8' },
];

// ─── Voice recorder hook ──────────────────────────────────────────────────

function useVoiceRecorder() {
  const recordingRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioUri, setAudioUri] = useState(null);
  const [duration, setDuration] = useState(0);
  const timerRef = useRef(null);

  const start = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission needed', 'Microphone access is required to record voice notes.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
      setAudioUri(null);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch (err) {
      Alert.alert('Recording error', err.message);
    }
  };

  const stop = async () => {
    if (!recordingRef.current) return;
    clearInterval(timerRef.current);
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      setAudioUri(uri);
    } catch (err) {
      Alert.alert('Recording error', err.message);
    } finally {
      recordingRef.current = null;
      setIsRecording(false);
    }
  };

  const clear = () => {
    setAudioUri(null);
    setDuration(0);
  };

  return { isRecording, audioUri, duration, start, stop, clear };
}

function formatSeconds(s) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

// ─── Main screen ──────────────────────────────────────────────────────────

export default function HEWRecordNoteScreen({ route, navigation }) {
  const { patient } = route.params;

  const [noteType, setNoteType] = useState('household_visit');
  const [noteText, setNoteText] = useState('');
  const [location, setLocation] = useState('');
  const [followUpDue, setFollowUpDue] = useState('');
  const [selectedFlags, setSelectedFlags] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);

  const voice = useVoiceRecorder();

  const toggleFlag = (val) =>
    setSelectedFlags((prev) =>
      prev.includes(val) ? prev.filter((f) => f !== val) : [...prev, val]
    );

  const selectedTypeLabel =
    NOTE_TYPES.find((t) => t.value === noteType)?.label ?? noteType;

  const handleSave = async (mode = 'online') => {
    if (!noteText.trim() && !voice.audioUri) {
      Alert.alert('Required', 'Please add field notes or a voice recording.');
      return;
    }

    const payload = {
      note_type: noteType,
      note_text: noteText.trim() || '(voice note)',
      location: location.trim() || undefined,
      follow_up_due: followUpDue || undefined,
      flags: selectedFlags,
      visit_date: new Date().toISOString().slice(0, 10),
    };

    setSaving(true);
    try {
      if (mode === 'offline') {
        await enqueue({ patientId: patient.id, payload, audioUri: voice.audioUri });
        Alert.alert(
          'Saved offline',
          'This note will be uploaded automatically when you reconnect.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        return;
      }

      if (voice.audioUri) {
        await submitVoiceNote(patient.id, payload, voice.audioUri);
      } else {
        await submitNote(patient.id, payload);
      }

      Alert.alert('Saved', 'Visit note saved successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      // If network error, offer to save offline
      Alert.alert(
        'Could not save',
        'No connection. Save offline instead?',
        [
          { text: 'Save offline', onPress: () => handleSave('offline') },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {/* Patient header */}
      <View style={styles.patientHeader}>
        <Feather name="user" size={16} color="#0f766e" />
        <Text style={styles.patientName}>{patient.full_name}</Text>
      </View>

      {/* Visit type */}
      <View style={styles.section}>
        <Text style={styles.label}>Visit type</Text>
        <TouchableOpacity
          style={styles.picker}
          onPress={() => setShowTypePicker((v) => !v)}
        >
          <Text style={styles.pickerText}>{selectedTypeLabel}</Text>
          <Feather name={showTypePicker ? 'chevron-up' : 'chevron-down'} size={16} color={tokens.colors.muted} />
        </TouchableOpacity>
        {showTypePicker && (
          <View style={styles.pickerDropdown}>
            {NOTE_TYPES.map((t) => (
              <TouchableOpacity
                key={t.value}
                style={[styles.pickerOption, noteType === t.value && styles.pickerOptionActive]}
                onPress={() => { setNoteType(t.value); setShowTypePicker(false); }}
              >
                <Text style={[styles.pickerOptionText, noteType === t.value && styles.pickerOptionTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Field notes */}
      <View style={styles.section}>
        <Text style={styles.label}>Field notes</Text>
        <TextInput
          style={styles.textarea}
          value={noteText}
          onChangeText={setNoteText}
          placeholder="Describe the household visit, patient condition, observations…"
          placeholderTextColor={tokens.colors.muted}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>

      {/* Voice recorder */}
      <View style={styles.section}>
        <Text style={styles.label}>Voice note (optional)</Text>
        <View style={styles.voiceRow}>
          {!voice.audioUri ? (
            <TouchableOpacity
              style={[styles.voiceBtn, voice.isRecording && styles.voiceBtnActive]}
              onPress={voice.isRecording ? voice.stop : voice.start}
            >
              <Feather
                name={voice.isRecording ? 'square' : 'mic'}
                size={18}
                color={voice.isRecording ? '#b91c1c' : '#0f766e'}
              />
              <Text style={[styles.voiceBtnText, voice.isRecording && { color: '#b91c1c' }]}>
                {voice.isRecording
                  ? `Recording… ${formatSeconds(voice.duration)}`
                  : 'Start recording'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.voiceRecorded}>
              <Feather name="check-circle" size={16} color="#065f46" />
              <Text style={styles.voiceRecordedText}>
                Voice note recorded ({formatSeconds(voice.duration)})
              </Text>
              <TouchableOpacity onPress={voice.clear} style={styles.voiceClearBtn}>
                <Feather name="x" size={14} color={tokens.colors.muted} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Location + follow-up */}
      <View style={styles.row}>
        <View style={[styles.section, { flex: 1 }]}>
          <Text style={styles.label}>
            <Feather name="map-pin" size={12} /> Location
          </Text>
          <TextInput
            style={styles.input}
            value={location}
            onChangeText={setLocation}
            placeholder="Kebele / village"
            placeholderTextColor={tokens.colors.muted}
          />
        </View>
        <View style={[styles.section, { flex: 1 }]}>
          <Text style={styles.label}>
            <Feather name="calendar" size={12} /> Follow-up due
          </Text>
          <TextInput
            style={styles.input}
            value={followUpDue}
            onChangeText={setFollowUpDue}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={tokens.colors.muted}
            keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
          />
        </View>
      </View>

      {/* Flags */}
      <View style={styles.section}>
        <Text style={styles.label}>Flags</Text>
        <View style={styles.flagsRow}>
          {FLAGS.map((flag) => {
            const active = selectedFlags.includes(flag.value);
            return (
              <TouchableOpacity
                key={flag.value}
                style={[
                  styles.flag,
                  active
                    ? { backgroundColor: flag.color, borderColor: flag.text }
                    : styles.flagInactive,
                ]}
                onPress={() => toggleFlag(flag.value)}
              >
                <Text style={[styles.flagText, active && { color: flag.text }]}>
                  {flag.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Save actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={() => handleSave('online')}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Feather name="check-circle" size={16} color="#fff" />
              <Text style={styles.saveBtnText}>Save note</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.offlineBtn}
          onPress={() => handleSave('offline')}
          disabled={saving}
        >
          <Feather name="wifi-off" size={14} color={tokens.colors.muted} />
          <Text style={styles.offlineBtnText}>Save offline</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: tokens.colors.background },

  patientHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, padding: 12, backgroundColor: '#ccfbf1', borderRadius: tokens.radii.md, borderWidth: 1, borderColor: '#99f6e4' },
  patientName:      { fontSize: 14, fontWeight: '700', color: '#134e4a' },

  section:          { marginHorizontal: 16, marginBottom: 14 },
  row:              { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 14 },
  label:            { fontSize: 12, fontWeight: '500', color: tokens.colors.muted, marginBottom: 6 },

  // Inputs
  input:            { borderWidth: 1, borderColor: tokens.colors.border, borderRadius: tokens.radii.sm, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: tokens.colors.ink, backgroundColor: '#fff' },
  textarea:         { borderWidth: 1, borderColor: tokens.colors.border, borderRadius: tokens.radii.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: tokens.colors.ink, backgroundColor: '#fff', minHeight: 90 },

  // Picker
  picker:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: tokens.colors.border, borderRadius: tokens.radii.sm, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff' },
  pickerText:       { fontSize: 14, color: tokens.colors.ink },
  pickerDropdown:   { borderWidth: 1, borderColor: tokens.colors.border, borderRadius: tokens.radii.sm, backgroundColor: '#fff', overflow: 'hidden', marginTop: 4 },
  pickerOption:     { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  pickerOptionActive: { backgroundColor: '#f0fdfa' },
  pickerOptionText: { fontSize: 14, color: tokens.colors.ink },
  pickerOptionTextActive: { color: '#0f766e', fontWeight: '600' },

  // Voice
  voiceRow:         { },
  voiceBtn:         { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: '#0f766e', borderRadius: tokens.radii.sm, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: '#f0fdfa' },
  voiceBtnActive:   { borderColor: '#b91c1c', backgroundColor: '#fff1f2' },
  voiceBtnText:     { fontSize: 14, color: '#0f766e', fontWeight: '500' },
  voiceRecorded:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#d1fae5', borderRadius: tokens.radii.sm, padding: 10 },
  voiceRecordedText:{ fontSize: 13, color: '#065f46', flex: 1 },
  voiceClearBtn:    { padding: 4 },

  // Flags
  flagsRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  flag:             { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, borderWidth: 1 },
  flagInactive:     { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' },
  flagText:         { fontSize: 12, fontWeight: '500', color: tokens.colors.muted },

  // Save buttons
  actions:          { marginHorizontal: 16, gap: 10, marginTop: 4 },
  saveBtn:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#0f766e', paddingVertical: 13, borderRadius: tokens.radii.md },
  saveBtnDisabled:  { opacity: 0.6 },
  saveBtnText:      { color: '#fff', fontWeight: '700', fontSize: 15 },
  offlineBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: tokens.radii.md, borderWidth: 1, borderColor: tokens.colors.border, backgroundColor: '#fff' },
  offlineBtnText:   { color: tokens.colors.muted, fontSize: 14 },
});

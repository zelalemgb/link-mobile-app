/**
 * HEWRecordNoteScreen — Log a field visit note for a patient
 *
 * Features:
 *  - Visit type picker (matches community_note_type DB enum)
 *  - Guided protocol assessment (MVP)
 *  - Free-text field notes
 *  - Voice recording via expo-av (records .m4a, stores URI)
 *  - Location + follow-up date inputs
 *  - Flag chips
 *  - Online: POST directly to backend
 *  - Offline: enqueue to AsyncStorage queue
 */

import React, { useMemo, useRef, useState } from 'react';
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
import { useFeatureFlags } from '../../context/FeatureFlagsContext';
import { runHewDangerSignCheck, submitNote, submitVoiceNote } from '../../services/hewService';
import {
  getHewGuidedProtocols,
  summarizeHewGuidedAssessment,
} from '../../services/hewGuidedAssessmentService';
import { enqueue } from '../../lib/offlineQueue';
import { tokens } from '../../theme/tokens';

const NOTE_TYPES = [
  { value: 'household_visit', label: 'Household visit' },
  { value: 'maternal_followup', label: 'Maternal follow-up' },
  { value: 'child_growth', label: 'Child growth' },
  { value: 'vaccination', label: 'Vaccination' },
  { value: 'referral_followup', label: 'Referral follow-up' },
  { value: 'nutrition', label: 'Nutrition' },
  { value: 'medication_adherence', label: 'Medication adherence' },
  { value: 'general', label: 'General' },
];

const FLAGS = [
  { value: 'danger_sign', label: 'Danger sign', color: '#fee2e2', text: '#b91c1c' },
  { value: 'missed_dose', label: 'Missed dose', color: '#fef3c7', text: '#b45309' },
  { value: 'defaulted', label: 'Defaulted', color: '#fee2e2', text: '#b91c1c' },
  { value: 'lost_to_followup', label: 'Lost to follow-up', color: '#ffedd5', text: '#c2410c' },
  { value: 'improving', label: 'Improving', color: '#d1fae5', text: '#065f46' },
  { value: 'referred', label: 'Referred', color: '#dbeafe', text: '#1d4ed8' },
];

const HEW_PROTOCOLS = getHewGuidedProtocols();

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
      timerRef.current = setInterval(() => setDuration((value) => value + 1), 1000);
    } catch (err) {
      Alert.alert('Recording error', err.message);
    }
  };

  const stop = async () => {
    if (!recordingRef.current) return;
    clearInterval(timerRef.current);
    try {
      await recordingRef.current.stopAndUnloadAsync();
      setAudioUri(recordingRef.current.getURI());
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

const formatSeconds = (seconds) => {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainder = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
};

const buildGuidedReferralSummary = ({
  guidedAssessment,
  dangerCheckResult,
  noteText,
}) => {
  if (!guidedAssessment?.protocol) return null;
  const shouldRefer = Boolean(
    dangerCheckResult?.requiresReferral || guidedAssessment.shouldEscalate
  );
  if (!shouldRefer) return null;

  const urgency = String(dangerCheckResult?.urgency || guidedAssessment.escalationLevel || 'routine');
  const dangerLabels =
    dangerCheckResult?.dangerSigns?.length > 0
      ? dangerCheckResult.dangerSigns
      : guidedAssessment.dangerItems.map((item) => item.label);
  return {
    protocol_id: guidedAssessment.protocol.id,
    protocol_title: guidedAssessment.protocol.title,
    urgency,
    reason: dangerLabels.join('; ') || null,
    recommendation: urgency === 'emergency'
        ? 'Immediate facility escalation recommended.'
        : urgency === 'urgent'
          ? 'Same-day referral review recommended.'
          : 'Referral as needed based on follow-up status.',
    summary: String(noteText || '').trim() || guidedAssessment.summaryText || null,
  };
};

const GuidanceQuestionRow = ({ question, value, onChange }) => {
  const yes = value === true;
  const no = value === false;

  return (
    <View style={styles.guidedQuestionRow}>
      <Text style={styles.guidedQuestionLabel}>{question.label}</Text>
      <View style={styles.answerChips}>
        <TouchableOpacity
          style={[styles.answerChip, yes && styles.answerChipYesActive]}
          onPress={() => onChange(question.id, yes ? undefined : true)}
        >
          <Text style={[styles.answerChipText, yes && styles.answerChipTextActive]}>Yes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.answerChip, no && styles.answerChipNoActive]}
          onPress={() => onChange(question.id, no ? undefined : false)}
        >
          <Text style={[styles.answerChipText, no && styles.answerChipTextActive]}>No</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function HEWRecordNoteScreen({ route, navigation }) {
  const { patient, protocolId: routeProtocolId = null } = route.params;
  const { hewGuidedAssessments, linkAgentMvp } = useFeatureFlags();
  const enableGuidedFlow = hewGuidedAssessments || linkAgentMvp;

  const [noteType, setNoteType] = useState('household_visit');
  const [noteText, setNoteText] = useState('');
  const [location, setLocation] = useState('');
  const [followUpDue, setFollowUpDue] = useState('');
  const [selectedFlags, setSelectedFlags] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [selectedProtocolId, setSelectedProtocolId] = useState(routeProtocolId);
  const [guidedAnswers, setGuidedAnswers] = useState({});
  const [dangerCheckResult, setDangerCheckResult] = useState(null);
  const [checkingDanger, setCheckingDanger] = useState(false);

  const voice = useVoiceRecorder();

  const selectedProtocol = useMemo(
    () => HEW_PROTOCOLS.find((item) => item.id === selectedProtocolId) || null,
    [selectedProtocolId]
  );

  const guidedAssessment = useMemo(
    () =>
      summarizeHewGuidedAssessment({
        protocolId: selectedProtocolId,
        answers: guidedAnswers,
        freeText: noteText,
      }),
    [guidedAnswers, noteText, selectedProtocolId]
  );

  const selectedTypeLabel = NOTE_TYPES.find((type) => type.value === noteType)?.label ?? noteType;

  const setGuidedAnswer = (questionId, value) => {
    setDangerCheckResult(null);
    setGuidedAnswers((prev) => {
      const next = { ...prev };
      if (value === undefined) {
        delete next[questionId];
      } else {
        next[questionId] = value;
      }
      return next;
    });
  };

  const toggleFlag = (value) => {
    setSelectedFlags((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const handleProtocolSelect = (protocol) => {
    setSelectedProtocolId(protocol.id);
    setGuidedAnswers({});
    setDangerCheckResult(null);
    setNoteType(protocol.noteType || 'household_visit');
  };

  const handleDangerCheck = async () => {
    if (!selectedProtocol) return;
    setCheckingDanger(true);
    try {
      const result = await runHewDangerSignCheck({
        protocolId: selectedProtocol.id,
        answers: guidedAnswers,
        noteText,
      });
      setDangerCheckResult(result);
      if (result?.requiresReferral) {
        setSelectedFlags((prev) => [...new Set([...prev, 'danger_sign', 'referred'])]);
      } else if (result?.dangerSigns?.length > 0) {
        setSelectedFlags((prev) => [...new Set([...prev, 'danger_sign'])]);
      }
    } finally {
      setCheckingDanger(false);
    }
  };

  const buildPayload = () => {
    const mergedFlags = [...new Set([...(selectedFlags || []), ...(guidedAssessment.recommendedFlags || [])])];
    const guidedSummary = guidedAssessment.summaryText?.trim();
    const fallbackText =
      voice.audioUri && !noteText.trim()
        ? '(voice note)'
        : guidedSummary || noteText.trim() || '(guided assessment)';

    return {
      note_type: noteType,
      note_text: noteText.trim() || fallbackText,
      location: location.trim() || undefined,
      follow_up_due: followUpDue || undefined,
      flags: mergedFlags,
      visit_date: new Date().toISOString().slice(0, 10),
      guided_protocol: selectedProtocol
        ? {
            id: selectedProtocol.id,
            title: selectedProtocol.title,
          }
        : undefined,
      guided_answers: selectedProtocol ? guidedAnswers : undefined,
      danger_signs:
        selectedProtocol && Object.keys(guidedAssessment.dangerSigns || {}).length > 0
          ? guidedAssessment.dangerSigns
          : undefined,
      referral_summary: buildGuidedReferralSummary({
        guidedAssessment,
        dangerCheckResult,
        noteText,
      }),
      agent_guidance: dangerCheckResult
        ? {
            source: dangerCheckResult.source,
            status: dangerCheckResult.agentStatus,
            urgency: dangerCheckResult.urgency,
            dangerSigns: dangerCheckResult.dangerSigns,
            nextSteps: dangerCheckResult.nextSteps,
            escalationPrompt: dangerCheckResult.escalationPrompt,
            referralRecommendation: dangerCheckResult.referralRecommendation,
          }
        : undefined,
    };
  };

  const handleSave = async (mode = 'online') => {
    const hasGuidedContent = Boolean(
      selectedProtocol && guidedAssessment.positiveAnswers && guidedAssessment.positiveAnswers.length > 0
    );

    if (!noteText.trim() && !voice.audioUri && !hasGuidedContent) {
      Alert.alert('Required', 'Please add notes, answer guided questions, or record a voice note.');
      return;
    }

    const payload = buildPayload();
    setSaving(true);

    try {
      if (mode === 'offline') {
        await enqueue({ patientId: patient.id, payload, audioUri: voice.audioUri });
        Alert.alert(
          'Saved offline',
          'This note will be uploaded automatically when connectivity returns.',
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
    } catch (_error) {
      Alert.alert('Could not save', 'No connection. Save offline instead?', [
        { text: 'Save offline', onPress: () => handleSave('offline') },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.patientHeader}>
        <Feather name="user" size={16} color="#0f766e" />
        <Text style={styles.patientName}>{patient.full_name}</Text>
      </View>

      {enableGuidedFlow && (
        <View style={styles.section}>
          <Text style={styles.label}>Guided assessment protocol</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.protocolChipsRow}>
            {HEW_PROTOCOLS.map((protocol) => {
              const active = selectedProtocolId === protocol.id;
              return (
                <TouchableOpacity
                  key={protocol.id}
                  style={[styles.protocolChip, active && styles.protocolChipActive]}
                  onPress={() => handleProtocolSelect(protocol)}
                >
                  <Text style={[styles.protocolChipText, active && styles.protocolChipTextActive]}>
                    {protocol.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {selectedProtocol && (
            <View style={styles.protocolCard}>
              <Text style={styles.protocolCardTitle}>{selectedProtocol.title}</Text>
              <Text style={styles.protocolCardSummary}>{selectedProtocol.summary}</Text>

              {selectedProtocol.questions.map((question) => (
                <GuidanceQuestionRow
                  key={question.id}
                  question={question}
                  value={guidedAnswers[question.id]}
                  onChange={setGuidedAnswer}
                />
              ))}

              <TouchableOpacity
                style={[styles.dangerCheckBtn, checkingDanger && styles.dangerCheckBtnDisabled]}
                onPress={handleDangerCheck}
                disabled={checkingDanger}
              >
                {checkingDanger ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Feather name="shield" size={14} color="#fff" />
                    <Text style={styles.dangerCheckBtnText}>Run danger-sign check</Text>
                  </>
                )}
              </TouchableOpacity>

              {dangerCheckResult && (
                <View
                  style={[
                    styles.dangerCheckResultCard,
                    dangerCheckResult.urgency === 'emergency'
                      ? styles.dangerCheckResultCardEmergency
                      : dangerCheckResult.urgency === 'urgent'
                        ? styles.dangerCheckResultCardUrgent
                        : styles.dangerCheckResultCardRoutine,
                  ]}
                >
                  <Text style={styles.dangerCheckResultTitle}>
                    {dangerCheckResult.urgency === 'emergency'
                      ? 'Emergency escalation required'
                      : dangerCheckResult.urgency === 'urgent'
                        ? 'Urgent escalation advised'
                        : 'No immediate danger signal detected'}
                  </Text>

                  {dangerCheckResult.dangerSigns?.length > 0 && (
                    <Text style={styles.dangerCheckResultText}>
                      Danger signs: {dangerCheckResult.dangerSigns.join('; ')}
                    </Text>
                  )}
                  {dangerCheckResult.escalationPrompt ? (
                    <Text style={styles.dangerCheckResultText}>
                      {dangerCheckResult.escalationPrompt}
                    </Text>
                  ) : null}
                  {dangerCheckResult.nextSteps?.length > 0 && (
                    <Text style={styles.dangerCheckResultText}>
                      Next: {dangerCheckResult.nextSteps.join(' ')}
                    </Text>
                  )}
                  <Text style={styles.dangerCheckSourceText}>
                    Source: {dangerCheckResult.source === 'link_agent_generated' ? 'Link Agent' : 'Offline CDSS'}
                  </Text>
                </View>
              )}

              {guidedAssessment.positiveAnswers.length > 0 && (
                <View
                  style={[
                    styles.guidedAssessmentBanner,
                    guidedAssessment.shouldEscalate
                      ? styles.guidedAssessmentBannerAlert
                      : styles.guidedAssessmentBannerNormal,
                  ]}
                >
                  <Feather
                    name={guidedAssessment.shouldEscalate ? 'alert-triangle' : 'check-circle'}
                    size={14}
                    color={guidedAssessment.shouldEscalate ? '#b91c1c' : '#065f46'}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.guidedAssessmentBannerTitle,
                        { color: guidedAssessment.shouldEscalate ? '#b91c1c' : '#065f46' },
                      ]}
                    >
                      {guidedAssessment.shouldEscalate
                        ? 'Escalation signals detected'
                        : 'Guided protocol summary ready'}
                    </Text>
                    <Text style={styles.guidedAssessmentBannerText} numberOfLines={3}>
                      {guidedAssessment.positiveAnswers.map((item) => item.label).join('; ')}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.label}>Visit type</Text>
        <TouchableOpacity style={styles.picker} onPress={() => setShowTypePicker((value) => !value)}>
          <Text style={styles.pickerText}>{selectedTypeLabel}</Text>
          <Feather
            name={showTypePicker ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={tokens.colors.muted}
          />
        </TouchableOpacity>
        {showTypePicker && (
          <View style={styles.pickerDropdown}>
            {NOTE_TYPES.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[styles.pickerOption, noteType === type.value && styles.pickerOptionActive]}
                onPress={() => {
                  setNoteType(type.value);
                  setShowTypePicker(false);
                }}
              >
                <Text style={[styles.pickerOptionText, noteType === type.value && styles.pickerOptionTextActive]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Field notes</Text>
        <TextInput
          style={styles.textarea}
          value={noteText}
          onChangeText={setNoteText}
          placeholder="Describe the household visit, observations, and care actions..."
          placeholderTextColor={tokens.colors.muted}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Voice note (optional)</Text>
        {!voice.audioUri ? (
          <TouchableOpacity
            style={[styles.voiceBtn, voice.isRecording && styles.voiceBtnActive]}
            onPress={voice.isRecording ? voice.stop : voice.start}
          >
            <Feather name={voice.isRecording ? 'square' : 'mic'} size={18} color={voice.isRecording ? '#b91c1c' : '#0f766e'} />
            <Text style={[styles.voiceBtnText, voice.isRecording && { color: '#b91c1c' }]}>
              {voice.isRecording ? `Recording ${formatSeconds(voice.duration)}` : 'Start recording'}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.voiceRecorded}>
            <Feather name="check-circle" size={16} color="#065f46" />
            <Text style={styles.voiceRecordedText}>Voice note recorded ({formatSeconds(voice.duration)})</Text>
            <TouchableOpacity onPress={voice.clear} style={styles.voiceClearBtn}>
              <Feather name="x" size={14} color={tokens.colors.muted} />
            </TouchableOpacity>
          </View>
        )}
      </View>

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

        <TouchableOpacity style={styles.offlineBtn} onPress={() => handleSave('offline')} disabled={saving}>
          <Feather name="wifi-off" size={14} color={tokens.colors.muted} />
          <Text style={styles.offlineBtnText}>Save offline</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 36 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.background },

  patientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 16,
    padding: 12,
    backgroundColor: '#ccfbf1',
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: '#99f6e4',
  },
  patientName: { fontSize: 14, fontWeight: '700', color: '#134e4a' },

  section: { marginHorizontal: 16, marginBottom: 14 },
  row: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '500', color: tokens.colors.muted, marginBottom: 6 },

  protocolChipsRow: { gap: 8, paddingRight: 8 },
  protocolChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  protocolChipActive: { borderColor: '#0f766e', backgroundColor: '#f0fdfa' },
  protocolChipText: { fontSize: 12, color: tokens.colors.muted, fontWeight: '600' },
  protocolChipTextActive: { color: '#0f766e' },
  protocolCard: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: tokens.radii.md,
    backgroundColor: '#f8fffc',
    padding: 12,
    gap: 10,
  },
  protocolCardTitle: { fontSize: 13, fontWeight: '700', color: '#0f766e' },
  protocolCardSummary: { fontSize: 12, color: tokens.colors.ink, lineHeight: 18 },
  guidedQuestionRow: { gap: 7 },
  guidedQuestionLabel: { fontSize: 12, color: tokens.colors.ink, lineHeight: 18 },
  answerChips: { flexDirection: 'row', gap: 8 },
  answerChip: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  answerChipYesActive: { borderColor: '#065f46', backgroundColor: '#d1fae5' },
  answerChipNoActive: { borderColor: '#9ca3af', backgroundColor: '#e5e7eb' },
  answerChipText: { fontSize: 12, fontWeight: '600', color: tokens.colors.muted },
  answerChipTextActive: { color: '#111827' },

  guidedAssessmentBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  guidedAssessmentBannerNormal: { borderColor: '#86efac', backgroundColor: '#ecfdf5' },
  guidedAssessmentBannerAlert: { borderColor: '#fca5a5', backgroundColor: '#fef2f2' },
  guidedAssessmentBannerTitle: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
  guidedAssessmentBannerText: { fontSize: 12, color: tokens.colors.ink, lineHeight: 17 },
  dangerCheckBtn: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0f766e',
    borderRadius: 10,
    paddingVertical: 10,
  },
  dangerCheckBtnDisabled: { opacity: 0.7 },
  dangerCheckBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  dangerCheckResultCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  dangerCheckResultCardEmergency: { borderColor: '#fca5a5', backgroundColor: '#fef2f2' },
  dangerCheckResultCardUrgent: { borderColor: '#fcd34d', backgroundColor: '#fffbeb' },
  dangerCheckResultCardRoutine: { borderColor: '#86efac', backgroundColor: '#ecfdf5' },
  dangerCheckResultTitle: { fontSize: 12, fontWeight: '700', color: '#1f2937' },
  dangerCheckResultText: { fontSize: 12, lineHeight: 17, color: '#1f2937' },
  dangerCheckSourceText: { fontSize: 11, color: tokens.colors.muted, marginTop: 2 },

  input: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: tokens.colors.ink,
    backgroundColor: '#fff',
  },
  textarea: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: tokens.colors.ink,
    backgroundColor: '#fff',
    minHeight: 90,
  },

  picker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  pickerText: { fontSize: 14, color: tokens.colors.ink },
  pickerDropdown: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radii.sm,
    backgroundColor: '#fff',
    overflow: 'hidden',
    marginTop: 4,
  },
  pickerOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  pickerOptionActive: { backgroundColor: '#f0fdfa' },
  pickerOptionText: { fontSize: 14, color: tokens.colors.ink },
  pickerOptionTextActive: { color: '#0f766e', fontWeight: '600' },

  voiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#0f766e',
    borderRadius: tokens.radii.sm,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#f0fdfa',
  },
  voiceBtnActive: { borderColor: '#b91c1c', backgroundColor: '#fff1f2' },
  voiceBtnText: { fontSize: 14, color: '#0f766e', fontWeight: '500' },
  voiceRecorded: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#d1fae5',
    borderRadius: tokens.radii.sm,
    padding: 10,
  },
  voiceRecordedText: { fontSize: 13, color: '#065f46', flex: 1 },
  voiceClearBtn: { padding: 4 },

  flagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  flag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, borderWidth: 1 },
  flagInactive: { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0' },
  flagText: { fontSize: 12, fontWeight: '500', color: tokens.colors.muted },

  actions: { marginHorizontal: 16, gap: 10, marginTop: 4 },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0f766e',
    paddingVertical: 13,
    borderRadius: tokens.radii.md,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  offlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: '#fff',
  },
  offlineBtnText: { color: tokens.colors.muted, fontSize: 14 },
});

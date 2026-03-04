/**
 * ConsultReferralOutcomeScreen — Step 6 of 6
 * Referral toggle + destination + urgency, then outcome + follow-up date.
 * Final step — saves the entire visit to SQLite and enqueues for sync.
 */

import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Switch,
  ScrollView, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useConsult } from '../../../context/ConsultContext';
import { useAuth    } from '../../../context/AuthContext';
import { visitRepo  } from '../../../repositories/visitRepo';
import { colors     } from '../../../theme/tokens';
import ConsultStepHeader from './ConsultStepHeader';
import CdssExplainabilityPanel from './CdssExplainabilityPanel';
import {
  evaluateOfflineCdss,
  summarizeCdssDecisions,
} from '../../../services/offlineCdssService';
import { linkPreVisitContextToVisit } from '../../../services/preVisitContextService';

const TEAL = '#0f766e';

const OUTCOMES = [
  { value: 'discharged',  label: 'Discharged',     icon: 'home'          },
  { value: 'follow_up',   label: 'Follow-up',       icon: 'calendar'      },
  { value: 'referred',    label: 'Referred',        icon: 'navigation'    },
  { value: 'admitted',    label: 'Admitted',        icon: 'activity'      },
  { value: 'deceased',    label: 'Deceased',        icon: 'alert-octagon' },
];

const URGENCIES = ['routine', 'urgent', 'emergency'];
const TRANSPORTS = ['self', 'community', 'ambulance'];

const FACILITY_LEVELS = [
  'Health post', 'Health centre', 'Primary hospital',
  'General hospital', 'Referral hospital', 'Other',
];

export default function ConsultReferralOutcomeScreen({ navigation }) {
  const {
    draft,
    updateReferral,
    updateVisitData,
    setCdssDecision,
    resetConsult,
  } = useConsult();
  const { user } = useAuth();

  const savedRef = draft.referral ?? {};
  const [referred,     setReferred]     = useState(savedRef.is_referred ?? false);
  const [destination,  setDestination]  = useState(savedRef.destination ?? '');
  const [urgency,      setUrgency]      = useState(savedRef.urgency ?? 'routine');
  const [transport,    setTransport]    = useState(savedRef.transport ?? null);
  const [refReason,    setRefReason]    = useState(savedRef.reason ?? '');

  const [outcome,      setOutcome]      = useState(draft.visitData.outcome ?? null);
  const [followUpDate, setFollowUpDate] = useState(draft.visitData.follow_up_date ?? '');
  const [saving,       setSaving]       = useState(false);

  const previewReferral = useMemo(
    () =>
      referred
        ? {
            is_referred: true,
            destination: destination.trim() || null,
            urgency,
            reason: refReason.trim() || null,
            transport: transport ?? null,
          }
        : null,
    [destination, refReason, referred, transport, urgency]
  );

  const previewDraft = useMemo(
    () => ({
      ...draft,
      visitData: {
        ...draft.visitData,
        outcome,
        follow_up_date: followUpDate.trim() || null,
      },
      referral: previewReferral,
    }),
    [draft, followUpDate, outcome, previewReferral]
  );

  const cdssResult = useMemo(
    () => evaluateOfflineCdss({ draft: previewDraft }),
    [previewDraft]
  );
  const cdssAlerts = cdssResult.alerts || [];
  const cdssDecisions = draft.cdssDecisions || {};

  const handleSave = async () => {
    if (!outcome) {
      Alert.alert('Missing outcome', 'Please select a visit outcome before saving.');
      return;
    }

    const unresolvedCritical = cdssAlerts.filter((alert) => {
      const severity = String(alert.severity || '').toLowerCase();
      if (severity !== 'critical' && severity !== 'high') return false;
      return !cdssDecisions?.[alert.ruleId]?.decision;
    });
    if (unresolvedCritical.length > 0) {
      Alert.alert(
        'Review safety checks',
        'Please accept or override each high-severity safety alert before saving.'
      );
      return;
    }

    setSaving(true);
    try {
      const referralData = previewReferral;

      const cdssSummary = summarizeCdssDecisions({
        alerts: cdssAlerts,
        decisions: cdssDecisions,
      });

      const mergedNotes = [
        draft.visitData.notes ? String(draft.visitData.notes).trim() : null,
        cdssSummary,
      ]
        .filter(Boolean)
        .join('\n\n');

      updateReferral(referralData);
      updateVisitData({
        outcome,
        follow_up_date: followUpDate.trim() || null,
        notes: mergedNotes || null,
        status: 'completed',
      });

      // Re-read the draft *after* state updates via a fresh ref
      const finalDraft = {
        ...draft,
        visitData: {
          ...draft.visitData,
          outcome,
          follow_up_date: followUpDate.trim() || null,
          notes: mergedNotes || null,
          status: 'completed',
        },
        referral: referralData,
      };

      // W2-MOB-013: use visitRepo.save() (perf-instrumented entry point)
      const savedVisit = await visitRepo.save({
        visitData:   finalDraft.visitData,
        vitals:      finalDraft.vitals,
        assessment:  finalDraft.assessment,
        diagnoses:   finalDraft.diagnoses,
        treatments:  finalDraft.treatments,
        referral:    finalDraft.referral,
        actorUserId: user?.id ?? 'unknown',
      });

      // Link pre-visit context records to the saved visit (fire-and-forget)
      // This marks pre_triage_requests as status='linked' and populates
      // community_notes.visit_id so HEW can see which clinic visit closed the loop.
      if (draft.preVisitContext && savedVisit?.id) {
        linkPreVisitContextToVisit(
          finalDraft.visitData.patient_id,
          savedVisit.id,
          draft.preVisitContext
        );
      }

      resetConsult();

      Alert.alert(
        'Visit saved',
        'The consultation has been recorded and queued for sync.',
        [{ text: 'OK', onPress: () => navigation.navigate('PatientList') }]
      );
    } catch (err) {
      Alert.alert('Save failed', err?.message ?? 'Could not save visit. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <ConsultStepHeader step={6} total={6} title="Outcome & referral" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Outcome */}
        <Text style={styles.sectionLabel}>Visit outcome</Text>
        <View style={styles.outcomeGrid}>
          {OUTCOMES.map((o) => (
            <TouchableOpacity
              key={o.value}
              style={[styles.outcomeCard, outcome === o.value && styles.outcomeCardActive]}
              onPress={() => setOutcome(o.value)}
              activeOpacity={0.75}
            >
              <Feather name={o.icon} size={20} color={outcome === o.value ? '#fff' : colors.muted} />
              <Text style={[styles.outcomeLabel, outcome === o.value && styles.outcomeLabelActive]}>
                {o.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Follow-up date */}
        {(outcome === 'follow_up' || outcome === 'discharged') && (
          <View style={styles.followUp}>
            <Text style={styles.sectionLabel}>Follow-up date</Text>
            <TextInput
              style={styles.input}
              value={followUpDate}
              onChangeText={setFollowUpDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.muted}
              keyboardType="numbers-and-punctuation"
            />
          </View>
        )}

        {/* Referral toggle */}
        <View style={styles.referralRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionLabel}>Refer patient?</Text>
            <Text style={styles.referralSub}>
              {referred ? 'Patient will be referred to a higher level.' : 'No referral required.'}
            </Text>
          </View>
          <Switch
            value={referred}
            onValueChange={setReferred}
            trackColor={{ false: colors.border, true: TEAL }}
            thumbColor="#fff"
          />
        </View>

        {referred && (
          <View style={styles.referralBlock}>
            <Text style={styles.sectionLabel}>Destination facility</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              {FACILITY_LEVELS.map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.levelChip, destination === f && styles.levelChipActive]}
                  onPress={() => setDestination(f)}
                >
                  <Text style={[styles.levelChipText, destination === f && styles.levelChipTextActive]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TextInput
              style={styles.input}
              value={destination}
              onChangeText={setDestination}
              placeholder="Facility name or level…"
              placeholderTextColor={colors.muted}
            />

            <Text style={[styles.sectionLabel, { marginTop: 14 }]}>Urgency</Text>
            <View style={styles.urgencyRow}>
              {URGENCIES.map((u) => (
                <TouchableOpacity
                  key={u}
                  style={[styles.urgencyChip,
                    urgency === u && (u === 'emergency' ? styles.urgencyEmerg : u === 'urgent' ? styles.urgencyUrgent : styles.urgencyRoutine)
                  ]}
                  onPress={() => setUrgency(u)}
                >
                  <Text style={[styles.urgencyText, urgency === u && styles.urgencyTextActive]}>
                    {u.charAt(0).toUpperCase() + u.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.sectionLabel, { marginTop: 14 }]}>Transport</Text>
            <View style={styles.urgencyRow}>
              {TRANSPORTS.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.urgencyChip, transport === t && styles.urgencyRoutine]}
                  onPress={() => setTransport(transport === t ? null : t)}
                >
                  <Text style={[styles.urgencyText, transport === t && styles.urgencyTextActive]}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.sectionLabel, { marginTop: 14 }]}>Referral reason</Text>
            <TextInput
              style={[styles.input, { minHeight: 64, textAlignVertical: 'top' }]}
              value={refReason}
              onChangeText={setRefReason}
              placeholder="Reason for referral…"
              placeholderTextColor={colors.muted}
              multiline
            />
          </View>
        )}

        <CdssExplainabilityPanel
          alerts={cdssAlerts}
          decisions={cdssDecisions}
          onDecision={setCdssDecision}
        />

      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <><Feather name="save" size={18} color="#fff" /><Text style={styles.saveBtnText}>Save visit</Text></>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:            { flex: 1, backgroundColor: colors.background },
  scroll:               { padding: 16, paddingBottom: 20, gap: 14 },
  sectionLabel:         { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10 },
  outcomeGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  outcomeCard:          { width: '30%', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, paddingVertical: 14, gap: 6 },
  outcomeCardActive:    { backgroundColor: TEAL, borderColor: TEAL },
  outcomeLabel:         { fontSize: 11, fontWeight: '600', color: colors.muted, textAlign: 'center' },
  outcomeLabelActive:   { color: '#fff' },
  followUp:             { gap: 2 },
  input:                { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, padding: 12, fontSize: 14, color: colors.ink },
  referralRow:          { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, padding: 14, gap: 10 },
  referralSub:          { fontSize: 12, color: colors.muted, marginTop: 2 },
  referralBlock:        { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5, borderColor: '#6ee7b7', padding: 14, gap: 4 },
  levelChip:            { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, backgroundColor: '#f9fafb', marginRight: 8 },
  levelChipActive:      { backgroundColor: TEAL, borderColor: TEAL },
  levelChipText:        { fontSize: 12, fontWeight: '600', color: colors.muted },
  levelChipTextActive:  { color: '#fff' },
  urgencyRow:           { flexDirection: 'row', gap: 8 },
  urgencyChip:          { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, backgroundColor: '#f9fafb' },
  urgencyEmerg:         { backgroundColor: '#b91c1c', borderColor: '#b91c1c' },
  urgencyUrgent:        { backgroundColor: '#b45309', borderColor: '#b45309' },
  urgencyRoutine:       { backgroundColor: TEAL,      borderColor: TEAL      },
  urgencyText:          { fontSize: 12, fontWeight: '600', color: colors.muted },
  urgencyTextActive:    { color: '#fff' },
  footer:               { padding: 16, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
  saveBtn:              { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: TEAL, borderRadius: 14, paddingVertical: 16 },
  saveBtnText:          { color: '#fff', fontWeight: '700', fontSize: 16 },
});

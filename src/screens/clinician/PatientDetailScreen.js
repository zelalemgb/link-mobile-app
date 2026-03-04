/**
 * PatientDetailScreen — Demographics + pre-visit context + visit history + CTAs
 *
 * ≤3-tap path: PatientList → (tap 1) → here → (tap 2) → ChiefComplaint ✓
 *
 * Pre-visit context panel: shows Africa's Talking SMS pre-triage summary and
 * HEW community notes BEFORE the consult starts, so the clinician has full
 * context and the wizard can be pre-populated.
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { patientRepo } from '../../repositories/patientRepo';
import { visitRepo   } from '../../repositories/visitRepo';
import { useAuth     } from '../../context/AuthContext';
import { useConsult  } from '../../context/ConsultContext';
import { colors      } from '../../theme/tokens';
import { loadPreVisitContext } from '../../services/preVisitContextService';

const TEAL   = '#0f766e';
const PURPLE = '#7c3aed';
const AMBER  = '#b45309';

// ─── Sub-components ──────────────────────────────────────────────────────────

function InfoRow({ icon, label, value }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Feather name={icon} size={14} color={colors.muted} style={styles.infoIcon} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function VisitRow({ visit }) {
  const statusColor = visit.status === 'completed' ? '#065f46' : visit.status === 'draft' ? '#92400e' : colors.muted;
  return (
    <View style={styles.visitRow}>
      <View style={styles.visitLeft}>
        <Text style={styles.visitDate}>{visit.visit_date?.slice(0, 10)}</Text>
        <Text style={styles.visitType}>{(visit.visit_type ?? 'visit').replace(/_/g, ' ')}</Text>
      </View>
      <View style={{ flex: 1 }}>
        {visit.chief_complaint ? (
          <Text style={styles.visitCC} numberOfLines={1}>{visit.chief_complaint}</Text>
        ) : null}
        {visit.diagnoses?.length > 0 ? (
          <Text style={styles.visitDx} numberOfLines={1}>
            {visit.diagnoses.map((d) => d.display_name).join(', ')}
          </Text>
        ) : null}
      </View>
      <View style={[styles.visitStatus, { borderColor: statusColor }]}>
        <Text style={[styles.visitStatusText, { color: statusColor }]}>{visit.status}</Text>
      </View>
    </View>
  );
}

/**
 * Pre-triage card: shows AT SMS urgency classification + parsed symptoms + ai_summary.
 */
function PreTriageCard({ preTriage }) {
  if (!preTriage) return null;
  const URGENCY_COLOR = {
    emergency: '#b91c1c',
    urgent:    AMBER,
    routine:   TEAL,
  };
  const urgency = preTriage.recommended_urgency ?? 'routine';
  const color = URGENCY_COLOR[urgency] ?? colors.muted;
  const symptoms = Array.isArray(preTriage.parsed_symptoms)
    ? preTriage.parsed_symptoms.join(', ')
    : null;

  return (
    <View style={[styles.preCard, { borderLeftColor: color }]}>
      <View style={styles.preCardHeader}>
        <Feather name="message-circle" size={14} color={color} />
        <Text style={[styles.preCardTitle, { color }]}>SMS Pre-triage</Text>
        <View style={[styles.urgencyBadge, { backgroundColor: color }]}>
          <Text style={styles.urgencyBadgeText}>{urgency.toUpperCase()}</Text>
        </View>
      </View>
      {preTriage.ai_summary ? (
        <Text style={styles.preCardBody}>{preTriage.ai_summary}</Text>
      ) : null}
      {symptoms ? (
        <Text style={styles.preCardSub}>Reported: {symptoms}</Text>
      ) : null}
      {preTriage.raw_text ? (
        <Text style={styles.preCardRaw} numberOfLines={2}>"{preTriage.raw_text}"</Text>
      ) : null}
      <Text style={styles.preCardDate}>{new Date(preTriage.created_at).toLocaleString()}</Text>
    </View>
  );
}

/**
 * Community notes list: HEW field visit observations for this patient.
 */
function CommunityNotesSection({ notes }) {
  if (!notes || notes.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        <Feather name="users" size={13} color={PURPLE} />{' '}HEW Community notes
      </Text>
      {notes.map((note) => {
        const dangerSigns = Object.entries(note.danger_signs ?? {})
          .filter(([, v]) => v)
          .map(([k]) => k.replace(/_/g, ' '));
        return (
          <View key={note.id} style={styles.noteRow}>
            <View style={styles.noteLeft}>
              <Text style={styles.noteDate}>{note.created_at?.slice(0, 10)}</Text>
              <Text style={styles.noteType}>{(note.visit_type ?? 'visit').replace(/_/g, ' ')}</Text>
            </View>
            <View style={{ flex: 1 }}>
              {note.text ? (
                <Text style={styles.noteText} numberOfLines={3}>{note.text}</Text>
              ) : null}
              {dangerSigns.length > 0 ? (
                <View style={styles.dangerRow}>
                  <Feather name="alert-triangle" size={11} color="#b91c1c" />
                  <Text style={styles.dangerText}>{dangerSigns.join(', ')}</Text>
                </View>
              ) : null}
              {note.follow_up_due ? (
                <Text style={styles.followUpText}>Follow-up due: {note.follow_up_due?.slice(0, 10)}</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function PatientDetailScreen({ route, navigation }) {
  const { patientId } = route.params;
  const { user }      = useAuth();
  const { startConsult } = useConsult();

  const [patient,        setPatient]        = useState(null);
  const [visits,         setVisits]         = useState([]);
  const [preVisitCtx,   setPreVisitCtx]    = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [ctxLoading,     setCtxLoading]     = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const load = async () => {
        setLoading(true);
        try {
          const [p, v] = await Promise.all([
            patientRepo.getById(patientId),
            visitRepo.getByPatient(patientId, { limit: 10 }),
          ]);
          if (active) { setPatient(p); setVisits(v); }

          // Load pre-visit context in the background (non-blocking)
          setCtxLoading(true);
          const ctx = await loadPreVisitContext(patientId);
          if (active) setPreVisitCtx(ctx);
        } finally {
          if (active) { setLoading(false); setCtxLoading(false); }
        }
      };
      load();
      return () => { active = false; };
    }, [patientId])
  );

  const handleStartConsult = () => {
    startConsult(patient, preVisitCtx);
    navigation.navigate('Consult', { screen: 'ChiefComplaint' });
  };

  const handleRecordTriage = () => {
    navigation.navigate('NurseTriage', { patientId: patient.id });
  };

  const isNurse = user?.role === 'nurse';

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={TEAL} /></View>;
  }

  if (!patient) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: colors.muted }}>Patient not found.</Text>
      </View>
    );
  }

  const age = patient.date_of_birth
    ? `${Math.floor((Date.now() - new Date(patient.date_of_birth)) / 3.156e10)} years`
    : null;

  const initials = patient.full_name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Demographics card */}
        <View style={styles.demoCard}>
          <View style={styles.demoHeader}>
            <View style={styles.bigAvatar}>
              <Text style={styles.bigAvatarText}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.patientName}>{patient.full_name}</Text>
              <Text style={styles.patientMeta}>
                {[age, patient.sex].filter(Boolean).map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' · ')}
              </Text>
            </View>
          </View>
          <View style={styles.infoGrid}>
            <InfoRow icon="phone"    label="Phone"   value={patient.phone} />
            <InfoRow icon="map-pin"  label="Village" value={patient.village} />
            <InfoRow icon="layers"   label="Kebele"  value={patient.kebele} />
            <InfoRow icon="map"      label="Woreda"  value={patient.woreda} />
          </View>
        </View>

        {/* Pre-visit context: SMS pre-triage */}
        {ctxLoading ? (
          <View style={styles.ctxLoading}>
            <ActivityIndicator size="small" color={TEAL} />
            <Text style={styles.ctxLoadingText}>Loading intake context…</Text>
          </View>
        ) : preVisitCtx?.preTriage ? (
          <PreTriageCard preTriage={preVisitCtx.preTriage} />
        ) : null}

        {/* Pre-visit context: HEW community notes */}
        {!ctxLoading && preVisitCtx?.communityNotes?.length > 0 ? (
          <CommunityNotesSection notes={preVisitCtx.communityNotes} />
        ) : null}

        {/* Pre-population hint for clinician */}
        {!ctxLoading && preVisitCtx && (preVisitCtx.preTriage || preVisitCtx.communityNotes?.length > 0 || preVisitCtx.lastTriageVitals) ? (
          <View style={styles.prePopHint}>
            <Feather name="zap" size={13} color={TEAL} />
            <Text style={styles.prePopHintText}>
              Consult wizard will be pre-filled from the above context
              {preVisitCtx.lastTriageVitals ? ' including triage vitals' : ''}.
            </Text>
          </View>
        ) : null}

        {/* Visit history */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Visit history</Text>
          {visits.length === 0 ? (
            <Text style={styles.noVisits}>No visits recorded yet.</Text>
          ) : (
            visits.map((v) => <VisitRow key={v.id} visit={v} />)
          )}
        </View>

      </ScrollView>

      {/* Footer CTAs — role-aware triage + consult */}
      <View style={styles.footer}>
        {isNurse ? (
          <>
            <TouchableOpacity style={styles.consultBtn} onPress={handleRecordTriage} activeOpacity={0.85}>
              <Feather name="clipboard" size={18} color="#fff" />
              <Text style={styles.consultBtnText}>Record triage</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.triageSecondaryBtn} onPress={handleStartConsult} activeOpacity={0.85}>
              <Feather name="activity" size={16} color={TEAL} />
              <Text style={styles.triageSecondaryBtnText}>Start consultation</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.consultBtn} onPress={handleStartConsult} activeOpacity={0.85}>
              <Feather name="activity" size={18} color="#fff" />
              <Text style={styles.consultBtnText}>Start consultation</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.triageSecondaryBtn} onPress={handleRecordTriage} activeOpacity={0.85}>
              <Feather name="clipboard" size={16} color={TEAL} />
              <Text style={styles.triageSecondaryBtnText}>Record triage</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: colors.background },
  centered:         { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:           { padding: 16, paddingBottom: 110, gap: 14 },

  // Demo card
  demoCard:         { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, padding: 16 },
  demoHeader:       { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  bigAvatar:        { width: 56, height: 56, borderRadius: 28, backgroundColor: '#d7c8f5', alignItems: 'center', justifyContent: 'center' },
  bigAvatarText:    { fontSize: 20, fontWeight: '700', color: '#4d2c91' },
  patientName:      { fontSize: 18, fontWeight: '700', color: colors.ink },
  patientMeta:      { fontSize: 13, color: colors.muted, marginTop: 2, textTransform: 'capitalize' },
  infoGrid:         { gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  infoRow:          { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoIcon:         {},
  infoLabel:        { fontSize: 12, color: colors.muted, width: 56 },
  infoValue:        { fontSize: 13, color: colors.ink, flex: 1 },

  // Context loading
  ctxLoading:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, paddingVertical: 6 },
  ctxLoadingText:   { fontSize: 12, color: colors.muted, fontStyle: 'italic' },

  // Pre-triage card
  preCard:          { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, borderLeftWidth: 4, padding: 14, gap: 6 },
  preCardHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  preCardTitle:     { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
  urgencyBadge:     { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  urgencyBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  preCardBody:      { fontSize: 13, color: colors.ink, lineHeight: 18 },
  preCardSub:       { fontSize: 12, color: colors.muted, fontStyle: 'italic' },
  preCardRaw:       { fontSize: 12, color: colors.muted, borderLeftWidth: 2, borderLeftColor: colors.border, paddingLeft: 8 },
  preCardDate:      { fontSize: 11, color: colors.muted, marginTop: 4 },

  // Pre-pop hint
  prePopHint:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f0fdf4', borderRadius: 10, borderWidth: 1, borderColor: '#6ee7b7', padding: 10 },
  prePopHintText:   { fontSize: 12, color: TEAL, flex: 1 },

  // Visit history / community notes
  section:          { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, padding: 16, gap: 2 },
  sectionTitle:     { fontSize: 13, fontWeight: '700', color: colors.ink, marginBottom: 10 },
  noVisits:         { fontSize: 13, color: colors.muted, fontStyle: 'italic' },
  visitRow:         { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border },
  visitLeft:        { width: 72 },
  visitDate:        { fontSize: 12, fontWeight: '600', color: colors.ink },
  visitType:        { fontSize: 10, color: colors.muted, textTransform: 'capitalize', marginTop: 2 },
  visitCC:          { fontSize: 12, color: colors.ink },
  visitDx:          { fontSize: 11, color: colors.muted, marginTop: 2, fontStyle: 'italic' },
  visitStatus:      { borderWidth: 1, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, alignSelf: 'flex-start' },
  visitStatusText:  { fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },

  // Community notes
  noteRow:          { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border },
  noteLeft:         { width: 72 },
  noteDate:         { fontSize: 12, fontWeight: '600', color: colors.ink },
  noteType:         { fontSize: 10, color: PURPLE, textTransform: 'capitalize', marginTop: 2 },
  noteText:         { fontSize: 12, color: colors.ink, lineHeight: 17 },
  dangerRow:        { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  dangerText:       { fontSize: 11, color: '#b91c1c', textTransform: 'capitalize', flex: 1 },
  followUpText:     { fontSize: 11, color: AMBER, marginTop: 4 },

  // Footer CTAs
  footer:                 { padding: 16, gap: 10, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border },
  consultBtn:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: TEAL, borderRadius: 14, paddingVertical: 15 },
  consultBtnText:         { color: '#fff', fontWeight: '700', fontSize: 16 },
  triageSecondaryBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: TEAL, borderRadius: 14, paddingVertical: 12, backgroundColor: '#f0fdf4' },
  triageSecondaryBtnText: { color: TEAL, fontWeight: '600', fontSize: 14 },
});

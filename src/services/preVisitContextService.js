/**
 * preVisitContextService.js
 *
 * Loads and links the pre-visit context for a patient before consultation.
 * Converges three upstream data streams into a single object that pre-populates
 * the 6-step clinician consult wizard:
 *
 *   1. Africa's Talking SMS intake  → parsed symptoms, urgency, raw text
 *   2. HEW community visit notes    → danger signs, follow-up flags, field observations
 *   3. Local SQLite triage visit    → most recent nurse-recorded vitals
 *
 * Usage:
 *   const ctx = await loadPreVisitContext(patientId);
 *   // ctx = { preTriage, communityNotes, lastTriageVitals, suggestedChips }
 *
 *   // After save:
 *   await linkPreVisitContextToVisit(patientId, savedVisitId, ctx);
 */

import { api } from '../lib/api';
import { visitRepo } from '../repositories/visitRepo';

// ---------------------------------------------------------------------------
// Chip mappings
// ---------------------------------------------------------------------------

/**
 * Africa's Talking parsed_symptoms keywords  → COMMON_COMPLAINTS chip labels.
 * Keywords are lowercase strings stored in the `parsed_symptoms` JSONB array
 * by the AT inbound SMS handler (link-be/server/routes/sms.ts).
 */
const SYMPTOM_TO_CHIP = {
  fever:                 'Fever',
  headache:              'Headache',
  cough:                 'Cough',
  breathing:             'Difficulty breathing',
  'difficulty breathing':'Difficulty breathing',
  chest:                 'Chest pain',
  'chest pain':          'Chest pain',
  abdominal:             'Abdominal pain',
  'stomach pain':        'Abdominal pain',
  diarrhoea:             'Diarrhoea',
  diarrhea:              'Diarrhoea',
  vomiting:              'Vomiting',
  weakness:              'Weakness / fatigue',
  fatigue:               'Weakness / fatigue',
  rash:                  'Rash',
  swelling:              'Swelling',
  urination:             'Painful urination',
  'painful urination':   'Painful urination',
  convulsion:            'Convulsions',
  convulsions:           'Convulsions',
  bleeding:              'Bleeding',
  unconscious:           'Loss of consciousness',
  'body aches':          'Body aches',
  aches:                 'Body aches',
};

/**
 * HEW community_notes danger_signs keys → COMMON_COMPLAINTS chip labels.
 * Keys correspond to boolean flag names set in HEWRecordNoteScreen.js.
 */
const DANGER_SIGN_TO_CHIP = {
  fever:             'Fever',
  breathing_problem: 'Difficulty breathing',
  convulsion:        'Convulsions',
  severe_vomiting:   'Vomiting',
  severe_diarrhoea:  'Diarrhoea',
  bleeding:          'Bleeding',
  unconscious:       'Loss of consciousness',
  chest_pain:        'Chest pain',
  rash:              'Rash',
};

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * Derive symptom chips that should be pre-selected in ConsultChiefComplaintScreen
 * from the AT pre-triage and HEW community note data.
 *
 * @param {object|null} preTriage       - pre_triage_requests row
 * @param {Array}       communityNotes  - community_notes rows
 * @returns {string[]} chip labels matching COMMON_COMPLAINTS entries
 */
export const deriveChipsFromContext = (preTriage, communityNotes = []) => {
  const chips = new Set();

  // AT parsed_symptoms: array of keyword strings
  const symptoms = Array.isArray(preTriage?.parsed_symptoms)
    ? preTriage.parsed_symptoms
    : [];
  for (const kw of symptoms) {
    const chip = SYMPTOM_TO_CHIP[String(kw).toLowerCase().trim()];
    if (chip) chips.add(chip);
  }

  // HEW danger signs: { fever: true, breathing_problem: false, … }
  for (const note of communityNotes) {
    const dangerSigns = note.danger_signs ?? {};
    for (const [key, active] of Object.entries(dangerSigns)) {
      if (active) {
        const chip = DANGER_SIGN_TO_CHIP[key];
        if (chip) chips.add(chip);
      }
    }
  }

  return [...chips];
};

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Load pre-visit context for a patient.
 * Combines backend API data (AT + HEW) with local SQLite triage vitals.
 * Returns null on network error so callers can degrade gracefully.
 *
 * @param {string} patientId  UUID of the patient
 * @returns {Promise<{
 *   preTriage: object|null,
 *   communityNotes: object[],
 *   lastTriageVitals: object|null,
 *   suggestedChips: string[],
 * }|null>}
 */
export const loadPreVisitContext = async (patientId) => {
  try {
    // 1. Fetch remote context: pre-triage (AT SMS) + community notes (HEW)
    const remoteCtx = await api.get(`/patients/${patientId}/pre-visit-context`);

    // 2. Fetch last triage vitals from local SQLite — offline-first
    let lastTriageVitals = null;
    try {
      const recentVisits = await visitRepo.getByPatient(patientId, { limit: 15 });
      const lastTriage = recentVisits.find(
        (v) => v.visit_type === 'triage' && v.vitals
      );
      if (lastTriage?.vitals) {
        lastTriageVitals = lastTriage.vitals;
      }
    } catch (_sqliteErr) {
      // SQLite unavailable — vitals pre-fill degrades gracefully
    }

    const preTriage     = remoteCtx.preTriage      ?? null;
    const communityNotes= remoteCtx.communityNotes ?? [];

    return {
      preTriage,
      communityNotes,
      lastTriageVitals,
      suggestedChips: deriveChipsFromContext(preTriage, communityNotes),
    };
  } catch (_networkErr) {
    // Offline or server error — consultation still works, just no pre-fill
    return null;
  }
};

/**
 * Link pre-triage records and HEW community notes to a saved visit.
 * Called after visitRepo.save() completes successfully.
 * Fire-and-forget — failures are non-critical and do NOT block the save flow.
 *
 * @param {string} patientId        UUID of the patient
 * @param {string} visitId          UUID of the newly saved visit
 * @param {object} preVisitContext  The context object returned by loadPreVisitContext
 */
export const linkPreVisitContextToVisit = async (patientId, visitId, preVisitContext) => {
  if (!preVisitContext || !visitId || !patientId) return;

  const preTiageIds     = preVisitContext.preTriage?.id
    ? [preVisitContext.preTriage.id]
    : [];
  const communityNoteIds = (preVisitContext.communityNotes ?? []).map((n) => n.id);

  if (preTiageIds.length === 0 && communityNoteIds.length === 0) return;

  try {
    await api.patch(`/patients/${patientId}/pre-visit-context/link`, {
      visitId,
      preTiageIds,
      communityNoteIds,
    });
  } catch (_err) {
    // Non-critical: link records asynchronously, won't block clinician flow
    console.warn('[pre-visit] linkPreVisitContextToVisit failed silently', _err?.message);
  }
};

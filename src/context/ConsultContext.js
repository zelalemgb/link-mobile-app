/**
 * ConsultContext.js — Shared draft state for the multi-step consult wizard
 *
 * Each consult screen reads from / writes to this context.
 * On final save, visitRepo.save() commits everything to SQLite in one
 * transaction and enqueues for sync.
 *
 * Shape of draftVisit:
 *   { visitData, vitals, assessment, diagnoses[], treatments[], referral, cdssDecisions }
 *
 * preVisitContext carries upstream intake data loaded before the wizard opens:
 *   { preTriage, communityNotes, lastTriageVitals, suggestedChips }
 * — sourced from loadPreVisitContext() in preVisitContextService.js.
 * Screens may read it for pre-population but MUST NOT mutate it.
 */

import React from 'react';

const ConsultContext = React.createContext(null);

const EMPTY_DRAFT = {
  visitData:       {}, // patient_id, facility_id, tenant_id, visit_type, chief_complaint, notes
  vitals:          null,
  assessment:      null,
  diagnoses:       [],
  treatments:      [],
  referral:        null,
  cdssDecisions:   {},
  preVisitContext: null, // { preTriage, communityNotes, lastTriageVitals, suggestedChips }
};

const deriveAgeYears = (dateOfBirth) => {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const ageMs = Date.now() - dob.getTime();
  if (ageMs <= 0) return null;
  return Math.floor(ageMs / 3.156e10);
};

export const ConsultProvider = ({ children }) => {
  const [draft, setDraft] = React.useState(EMPTY_DRAFT);
  const [patientId, setPatientId] = React.useState(null);

  /**
   * startConsult — initialise the wizard for a patient.
   * @param {object} patient         — patient row (id, facility_id, tenant_id, …)
   * @param {object} [preVisitContext] — optional context from preVisitContextService
   */
  const startConsult = (patient, preVisitContext = null) => {
    setPatientId(patient.id);
    setDraft({
      ...EMPTY_DRAFT,
      visitData: {
        patient_id:        patient.id,
        facility_id:       patient.facility_id,
        tenant_id:         patient.tenant_id,
        visit_type:        'outpatient',
        visit_date:        new Date().toISOString(),
        patient_age_years: deriveAgeYears(patient.date_of_birth),
        patient_sex:       patient.sex ?? null,
      },
      preVisitContext: preVisitContext ?? null,
    });
  };

  const updateVisitData   = (updates) => setDraft((d) => ({ ...d, visitData:  { ...d.visitData,  ...updates } }));
  const updateVitals      = (v)       => setDraft((d) => ({ ...d, vitals:     v }));
  const updateAssessment  = (a)       => setDraft((d) => ({ ...d, assessment: a }));
  const setDiagnoses      = (list)    => setDraft((d) => ({ ...d, diagnoses:  list }));
  const setTreatments     = (list)    => setDraft((d) => ({ ...d, treatments: list }));
  const updateReferral    = (r)       => setDraft((d) => ({ ...d, referral:   r }));
  const setCdssDecision   = (ruleId, decision) =>
    setDraft((d) => ({
      ...d,
      cdssDecisions: {
        ...(d.cdssDecisions || {}),
        [ruleId]: {
          decision,
          at: new Date().toISOString(),
        },
      },
    }));
  const resetConsult      = ()        => { setDraft(EMPTY_DRAFT); setPatientId(null); };

  return (
    <ConsultContext.Provider value={{
      draft, patientId,
      startConsult, updateVisitData, updateVitals,
      updateAssessment, setDiagnoses, setTreatments,
      updateReferral, setCdssDecision, resetConsult,
    }}>
      {children}
    </ConsultContext.Provider>
  );
};

export const useConsult = () => {
  const ctx = React.useContext(ConsultContext);
  if (!ctx) throw new Error('useConsult must be used inside ConsultProvider');
  return ctx;
};

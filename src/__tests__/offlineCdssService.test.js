import {
  cdssEngineVersion,
  evaluateOfflineCdss,
  summarizeCdssDecisions,
  top20StgProtocolMatrix,
} from "../services/offlineCdssService";

const baseDraft = {
  visitData: {
    visit_type: "outpatient",
    patient_age_years: 30,
    patient_sex: "female",
    chief_complaint: "",
    notes: "",
  },
  vitals: null,
  assessment: null,
  diagnoses: [],
  treatments: [],
  referral: null,
  cdssDecisions: {},
};

describe("offlineCdssService", () => {
  it("publishes a top-20 STG matrix for deterministic QA sign-off", () => {
    expect(cdssEngineVersion).toBe("W2-CDSS-v2");
    expect(Array.isArray(top20StgProtocolMatrix)).toBe(true);
    expect(top20StgProtocolMatrix).toHaveLength(20);
    expect(
      new Set(top20StgProtocolMatrix.map((row) => row.diagnosisCode)).size
    ).toBe(20);
  });

  it("flags pediatric fever with neck stiffness as critical referral", () => {
    const draft = {
      ...baseDraft,
      visitData: {
        ...baseDraft.visitData,
        patient_age_years: 4,
        patient_sex: "male",
        chief_complaint: "high fever and neck stiffness",
      },
      vitals: { temperature: 39.1 },
    };

    const result = evaluateOfflineCdss({ draft });
    const ruleIds = result.alerts.map((a) => a.ruleId);
    expect(ruleIds).toContain("CDS-PED-001");
  });

  it("flags maternal severe hypertension with headache as critical", () => {
    const draft = {
      ...baseDraft,
      visitData: {
        ...baseDraft.visitData,
        visit_type: "antenatal",
        patient_age_years: 26,
        patient_sex: "female",
        chief_complaint: "severe headache and blurred vision",
      },
      vitals: { bp_systolic: 170, bp_diastolic: 112 },
    };

    const result = evaluateOfflineCdss({ draft });
    const rule = result.alerts.find((a) => a.ruleId === "CDS-MAT-001");
    expect(rule).toBeTruthy();
    expect(rule.severity).toBe("critical");
  });

  it("flags pediatric severe malnutrition when MUAC is below 115mm", () => {
    const draft = {
      ...baseDraft,
      visitData: {
        ...baseDraft.visitData,
        patient_age_years: 3,
        patient_sex: "female",
      },
      vitals: { muac_mm: 109, weight_kg: 10.5 },
      diagnoses: [{ icd_code: "E46", display_name: "Protein-energy malnutrition" }],
    };
    const result = evaluateOfflineCdss({ draft });
    const malnutritionRule = result.alerts.find((a) => a.ruleId === "CDS-PED-NUT-001");
    expect(malnutritionRule).toBeTruthy();
    expect(malnutritionRule.severity).toBe("critical");
  });

  it("flags severe malaria danger pattern using diagnosis + danger symptoms", () => {
    const draft = {
      ...baseDraft,
      visitData: {
        ...baseDraft.visitData,
        patient_age_years: 19,
        patient_sex: "male",
        chief_complaint: "high fever with persistent vomiting and confusion",
      },
      vitals: { temperature: 39.4, spo2_pct: 93 },
      diagnoses: [{ icd_code: "B50", display_name: "Malaria (P. falciparum)" }],
    };

    const result = evaluateOfflineCdss({ draft });
    const malariaRule = result.alerts.find((a) => a.ruleId === "CDS-INF-001");
    expect(malariaRule).toBeTruthy();
    expect(malariaRule.severity).toBe("critical");
  });

  it("adds top-20 protocol advisory alerts for matching diagnosis codes", () => {
    const draft = {
      ...baseDraft,
      diagnoses: [
        { icd_code: "J18", display_name: "Pneumonia" },
        { icd_code: "I10", display_name: "Essential hypertension" },
      ],
    };

    const result = evaluateOfflineCdss({ draft });
    const advisoryIds = result.alerts.map((a) => a.ruleId);
    expect(advisoryIds).toContain("CDS-PROTO-I10");
    expect(advisoryIds).toContain("CDS-PROTO-J18");
  });

  it("provides pediatric paracetamol dose guidance when treatment and weight are present", () => {
    const draft = {
      ...baseDraft,
      visitData: {
        ...baseDraft.visitData,
        patient_age_years: 8,
        patient_sex: "female",
      },
      vitals: { weight_kg: 20 },
      treatments: [{ drug_name: "Paracetamol", dose: "500 mg" }],
    };

    const result = evaluateOfflineCdss({ draft });
    const doseRule = result.alerts.find((a) => a.ruleId === "CDS-PED-DOSE-001");
    expect(doseRule).toBeTruthy();
    expect(doseRule.recommendedAction).toContain("200-300 mg");
  });

  it("warns when maternal context includes ibuprofen treatment", () => {
    const draft = {
      ...baseDraft,
      visitData: {
        ...baseDraft.visitData,
        visit_type: "antenatal",
        patient_age_years: 24,
        patient_sex: "female",
      },
      treatments: [{ drug_name: "Ibuprofen", dose: "400 mg" }],
    };

    const result = evaluateOfflineCdss({ draft });
    const contraindicationRule = result.alerts.find(
      (a) => a.ruleId === "CDS-MAT-CONTRA-001"
    );
    expect(contraindicationRule).toBeTruthy();
    expect(contraindicationRule.severity).toBe("high");
  });

  it("serializes clinician decisions for visit notes", () => {
    const alerts = [
      {
        ruleId: "CDS-GEN-001",
        ruleName: "Respiratory compromise danger sign",
        confidence: 0.96,
      },
    ];
    const decisions = {
      "CDS-GEN-001": { decision: "accepted" },
    };
    const summary = summarizeCdssDecisions({ alerts, decisions });
    expect(summary).toContain("CDS-GEN-001 [accepted]");
    expect(summary).toContain("confidence 96%");
  });
});

/**
 * offlineCdssService.js
 *
 * W2-MOB-030/031 offline rules engine + Top-20 STG protocol coverage matrix:
 * - deterministic rule evaluation from local consult draft state
 * - explainability metadata for UI (trigger inputs + recommendation + confidence)
 * - clinician decision summary serializer for visit notes
 */

const ENGINE_VERSION = "W2-CDSS-v2";

// Matrix used for QA signoff tracking (W2-QA-030 expansion).
const TOP20_STG_PROTOCOL_MATRIX = Object.freeze([
  { diagnosisCode: "A09", protocolId: "STG-INF-001", condition: "Acute diarrhoea", cohort: "general", baselineAction: "Start ORS/Zinc pathway and check dehydration danger signs every visit." },
  { diagnosisCode: "A15", protocolId: "STG-INF-002", condition: "Pulmonary tuberculosis", cohort: "general", baselineAction: "Assess TB danger signs, isolate if needed, and expedite TB program linkage/referral." },
  { diagnosisCode: "B50", protocolId: "STG-INF-003", condition: "Malaria (falciparum)", cohort: "general", baselineAction: "Start malaria pathway and screen for severe-malaria red flags before outpatient plan." },
  { diagnosisCode: "B54", protocolId: "STG-INF-004", condition: "Malaria (unspecified)", cohort: "general", baselineAction: "Treat as malaria syndrome until confirmed and reassess for referral danger signs." },
  { diagnosisCode: "J06", protocolId: "STG-RESP-001", condition: "URTI", cohort: "general", baselineAction: "Use symptom-supportive pathway and escalate if respiratory distress or hypoxia emerges." },
  { diagnosisCode: "J18", protocolId: "STG-RESP-002", condition: "Pneumonia", cohort: "general", baselineAction: "Apply pneumonia pathway and urgent referral if hypoxia/tachypnea danger signs are present." },
  { diagnosisCode: "J45", protocolId: "STG-RESP-003", condition: "Asthma", cohort: "general", baselineAction: "Apply asthma pathway, bronchodilator response check, and refer for severe attack criteria." },
  { diagnosisCode: "O14", protocolId: "STG-MAT-001", condition: "Gestational hypertension / pre-eclampsia", cohort: "maternal", baselineAction: "Apply maternal hypertension protocol with urgent referral for severe-range BP or danger symptoms." },
  { diagnosisCode: "O20", protocolId: "STG-MAT-002", condition: "Antepartum haemorrhage", cohort: "maternal", baselineAction: "Treat as maternal emergency with stabilization and immediate referral pathway." },
  { diagnosisCode: "O80", protocolId: "STG-MAT-003", condition: "Normal delivery / postpartum", cohort: "maternal", baselineAction: "Perform postpartum danger-sign screening and document maternal safety checks." },
  { diagnosisCode: "E40", protocolId: "STG-PED-001", condition: "Kwashiorkor", cohort: "pediatric", baselineAction: "Treat as severe acute malnutrition and refer/monitor per nutrition stabilization protocol." },
  { diagnosisCode: "E41", protocolId: "STG-PED-002", condition: "Nutritional marasmus", cohort: "pediatric", baselineAction: "Apply severe malnutrition pathway with urgent nutrition referral and follow-up." },
  { diagnosisCode: "E46", protocolId: "STG-PED-003", condition: "Protein-energy malnutrition", cohort: "pediatric", baselineAction: "Assess MUAC/edema and stratify to outpatient nutrition follow-up vs urgent referral." },
  { diagnosisCode: "P07", protocolId: "STG-PED-004", condition: "Low birthweight / prematurity", cohort: "pediatric", baselineAction: "Apply newborn danger-sign checks and early referral protocol for instability." },
  { diagnosisCode: "I10", protocolId: "STG-CV-001", condition: "Essential hypertension", cohort: "adult", baselineAction: "Use BP-risk pathway and escalate for hypertensive emergency thresholds or neurologic signs." },
  { diagnosisCode: "I50", protocolId: "STG-CV-002", condition: "Heart failure", cohort: "adult", baselineAction: "Assess respiratory/perfusion red flags and refer urgently for decompensated heart failure signs." },
  { diagnosisCode: "E11", protocolId: "STG-MET-001", condition: "Type 2 diabetes mellitus", cohort: "adult", baselineAction: "Apply glycemic-risk pathway and screen for dehydration, sepsis, and emergency symptoms." },
  { diagnosisCode: "F32", protocolId: "STG-MH-001", condition: "Depressive episode", cohort: "adult", baselineAction: "Use mental-health safety pathway and escalate immediately for self-harm risk features." },
  { diagnosisCode: "R50", protocolId: "STG-SYM-001", condition: "Fever of unknown origin", cohort: "general", baselineAction: "Use fever workup pathway and escalate when danger signs or instability are present." },
  { diagnosisCode: "R10", protocolId: "STG-SYM-002", condition: "Abdominal pain", cohort: "general", baselineAction: "Apply abdominal pain triage and refer for peritonitis/shock/bleeding red flags." },
]);

const TOP20_PROTOCOL_BY_CODE = new Map(
  TOP20_STG_PROTOCOL_MATRIX.map((item) => [item.diagnosisCode, item])
);

const KEYWORDS = {
  fever: ["fever", "febrile", "high temperature", "hot body"],
  neckStiffness: ["neck stiffness", "stiff neck", "photophobia", "convulsion", "seizure"],
  maternal: [
    "pregnant",
    "pregnancy",
    "antenatal",
    "postnatal",
    "postpartum",
    "labour",
    "maternal",
  ],
  severeHeadache: ["severe headache", "headache", "visual disturbance", "blurred vision", "epigastric"],
  hypertensiveDanger: ["severe headache", "blurred vision", "vision loss", "chest pain", "confusion"],
  bleeding: ["bleeding", "hemorrhage", "haemorrhage", "postpartum bleeding", "vaginal bleeding"],
  respiratoryDistress: ["difficulty breathing", "shortness of breath", "respiratory distress", "chest indrawing", "unable to speak"],
  pneumonia: ["pneumonia", "productive cough", "fast breathing", "chest pain"],
  asthma: ["asthma", "wheezing", "chest tightness", "unable to complete sentences"],
  malaria: ["malaria", "rigor", "chills"],
  malariaDanger: ["confusion", "convulsion", "unable to drink", "persistent vomiting", "jaundice"],
  diarrhea: ["diarrhoea", "diarrhea", "loose stool", "watery stool"],
  dehydration: ["sunken eyes", "poor skin turgor", "unable to drink", "lethargy", "dry mouth"],
  maternalInfection: ["foul lochia", "uterine tenderness", "postpartum fever", "offensive discharge"],
};

const toNumber = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeText = (...parts) =>
  parts
    .flat()
    .filter(Boolean)
    .map((part) => String(part).toLowerCase())
    .join(" ");

const containsAny = (text, terms) => terms.some((term) => text.includes(term));

const toAlert = ({
  ruleId,
  ruleName,
  severity,
  confidence,
  triggeringInputs,
  recommendedAction,
  cohort,
}) => ({
  ruleId,
  ruleName,
  severity,
  confidence,
  triggeringInputs: triggeringInputs.filter(Boolean),
  recommendedAction,
  cohort,
});

const getPatientAge = (draft) => toNumber(draft?.visitData?.patient_age_years);

const isPediatric = (draft) => {
  const ageYears = getPatientAge(draft);
  return ageYears !== null && ageYears < 15;
};

const isMaternal = (draft, textBlob) => {
  const sex = String(draft?.visitData?.patient_sex || "").toLowerCase();
  const visitType = String(draft?.visitData?.visit_type || "").toLowerCase();
  const age = getPatientAge(draft);

  const likelyFemaleAdult = sex === "female" && (age === null || (age >= 12 && age <= 55));
  const maternalVisitType = visitType === "antenatal" || visitType === "postnatal";
  const maternalLanguage = containsAny(textBlob, KEYWORDS.maternal);
  return likelyFemaleAdult && (maternalVisitType || maternalLanguage);
};

const getDiagnosisCodeSet = (diagnoses = []) =>
  new Set(
    diagnoses
      .map((item) => String(item?.icd_code || "").trim().toUpperCase())
      .filter(Boolean)
  );

const hasAnyDiagnosisCode = (set, codes = []) => codes.some((code) => set.has(String(code).toUpperCase()));

const findTreatmentByName = (treatments = [], names = []) => {
  const lowered = names.map((name) => String(name).toLowerCase());
  return treatments.find((tx) => {
    const drugName = String(tx?.drug_name || "").toLowerCase();
    return lowered.some((needle) => drugName.includes(needle));
  });
};

const buildTop20ProtocolAlerts = (diagnosisCodeSet) => {
  const alerts = [];
  for (const code of [...diagnosisCodeSet].sort()) {
    const protocol = TOP20_PROTOCOL_BY_CODE.get(code);
    if (!protocol) continue;
    alerts.push(
      toAlert({
        ruleId: `CDS-PROTO-${code}`,
        ruleName: `${protocol.protocolId} ${protocol.condition}`,
        severity: "medium",
        confidence: 0.84,
        triggeringInputs: [`diagnosis=${code}`],
        recommendedAction: protocol.baselineAction,
        cohort: protocol.cohort,
      })
    );
  }
  return alerts;
};

const SYMPTOM_DANGER_RULES = Object.freeze([
  {
    id: "respiratory-danger",
    label: "Breathing difficulty or severe chest symptoms",
    urgency: "emergency",
    terms: [
      "difficulty breathing",
      "shortness of breath",
      "unable to breathe",
      "cannot breathe",
      "chest pain",
      "chest tightness",
      "wheezing severe",
    ],
    action: "Seek emergency care now at the nearest Link-affiliated clinic or hospital.",
  },
  {
    id: "neurologic-danger",
    label: "Confusion, seizure, or loss of consciousness",
    urgency: "emergency",
    terms: [
      "confusion",
      "disoriented",
      "seizure",
      "convulsion",
      "fainting",
      "unconscious",
    ],
    action: "Do not wait at home. Arrange immediate emergency transfer.",
  },
  {
    id: "bleeding-danger",
    label: "Heavy bleeding",
    urgency: "emergency",
    terms: [
      "heavy bleeding",
      "bleeding heavily",
      "vomiting blood",
      "blood in stool",
      "bleeding in pregnancy",
      "postpartum bleeding",
    ],
    action: "Treat as urgent emergency and seek immediate in-person care.",
  },
  {
    id: "persistent-fever",
    label: "Persistent fever or suspected infection",
    urgency: "clinic_soon",
    terms: [
      "high fever",
      "persistent fever",
      "fever for",
      "chills",
      "rigor",
      "possible infection",
    ],
    action: "Book clinic review soon for vitals check and focused examination.",
  },
  {
    id: "dehydration-pattern",
    label: "Possible dehydration pattern",
    urgency: "clinic_soon",
    terms: [
      "unable to drink",
      "very thirsty",
      "dry mouth",
      "sunken eyes",
      "repeated vomiting",
      "watery diarrhea",
      "watery diarrhoea",
    ],
    action: "Increase fluids now and seek same-day clinic assessment if symptoms persist.",
  },
]);

const dedupeTextList = (items = []) =>
  [...new Set(items.map((item) => String(item || "").trim()).filter(Boolean))];

const isEmergencyUrgency = (value) => value === "emergency";

const HEW_PROTOCOL_DANGER_CATALOG = Object.freeze({
  fever: [
    {
      id: "stiff_neck_or_convulsion",
      label: "Stiff neck or convulsion",
      urgency: "emergency",
      action: "Treat as emergency danger pattern and arrange immediate transfer.",
    },
    {
      id: "very_sleepy_or_unconscious",
      label: "Very sleepy or unconscious",
      urgency: "emergency",
      action: "Protect airway and transfer urgently to the nearest capable facility.",
    },
    {
      id: "cannot_drink_or_vomit_everything",
      label: "Unable to drink or persistent vomiting",
      urgency: "urgent",
      action: "Escalate for dehydration/infection review at facility level today.",
    },
    {
      id: "fever_very_high",
      label: "Very high fever with chills",
      urgency: "urgent",
      action: "Same-day facility review for focused infection management.",
    },
  ],
  respiratory: [
    {
      id: "chest_indrawing",
      label: "Chest indrawing",
      urgency: "emergency",
      action: "Escalate immediately for severe respiratory compromise.",
    },
    {
      id: "blue_lips_or_cannot_speak",
      label: "Blue lips or cannot speak",
      urgency: "emergency",
      action: "Arrange emergency transfer with airway/oxygen prioritization.",
    },
    {
      id: "fast_breathing",
      label: "Fast breathing",
      urgency: "urgent",
      action: "Refer for same-day respiratory assessment.",
    },
    {
      id: "chest_pain",
      label: "Chest pain with respiratory symptoms",
      urgency: "urgent",
      action: "Escalate to facility for immediate clinical review.",
    },
  ],
  maternal_followup: [
    {
      id: "bleeding_now",
      label: "Maternal bleeding",
      urgency: "emergency",
      action: "Treat as obstetric emergency and transfer immediately.",
    },
    {
      id: "severe_headache_or_blur",
      label: "Severe headache or blurred vision",
      urgency: "emergency",
      action: "Escalate as hypertensive maternal danger pattern.",
    },
    {
      id: "fever_after_delivery",
      label: "Fever after delivery",
      urgency: "urgent",
      action: "Same-day maternal sepsis-focused review is required.",
    },
    {
      id: "reduced_fetal_movement",
      label: "Reduced fetal movement",
      urgency: "urgent",
      action: "Refer for urgent fetal and maternal assessment.",
    },
  ],
  child_danger_signs: [
    {
      id: "convulsion",
      label: "Child convulsion",
      urgency: "emergency",
      action: "Stabilize and transfer immediately for pediatric emergency care.",
    },
    {
      id: "lethargic_or_unconscious",
      label: "Child lethargic or unconscious",
      urgency: "emergency",
      action: "Treat as emergency and arrange urgent transport.",
    },
    {
      id: "unable_to_feed",
      label: "Child unable to feed/drink",
      urgency: "urgent",
      action: "Same-day escalation for dehydration/sepsis danger screening.",
    },
    {
      id: "fast_breathing_or_indrawing",
      label: "Child fast breathing or chest indrawing",
      urgency: "emergency",
      action: "Escalate urgently for severe pneumonia danger.",
    },
  ],
  adherence_followup: [
    {
      id: "stopped_treatment",
      label: "Stopped treatment completely",
      urgency: "urgent",
      action: "Escalate for clinician adherence rescue plan and refill.",
    },
    {
      id: "symptoms_worsening",
      label: "Symptoms worsening",
      urgency: "urgent",
      action: "Refer for same-day review to prevent deterioration.",
    },
  ],
  referral_followup: [
    {
      id: "new_bleeding_or_breathing_issue",
      label: "New bleeding or breathing issue after referral",
      urgency: "emergency",
      action: "Escalate immediately to receiving emergency-capable facility.",
    },
    {
      id: "symptoms_worse_after_referral",
      label: "Symptoms worsened after referral",
      urgency: "urgent",
      action: "Initiate repeat referral with high-priority handoff.",
    },
    {
      id: "needs_repeat_referral",
      label: "Needs repeat referral today",
      urgency: "urgent",
      action: "Prepare referral summary and activate transport support now.",
    },
  ],
});

const isAffirmativeAnswer = (value) => value === true || value === "yes" || value === 1;

export const evaluateOfflineCdss = ({ draft } = {}) => {
  const safeDraft = draft && typeof draft === "object" ? draft : {};
  const vitals = safeDraft.vitals || {};
  const assessment = safeDraft.assessment || {};
  const visitData = safeDraft.visitData || {};
  const diagnoses = Array.isArray(safeDraft.diagnoses) ? safeDraft.diagnoses : [];
  const treatments = Array.isArray(safeDraft.treatments) ? safeDraft.treatments : [];

  const temp = toNumber(vitals.temperature);
  const spo2 = toNumber(vitals.spo2_pct);
  const sbp = toNumber(vitals.bp_systolic);
  const dbp = toNumber(vitals.bp_diastolic);
  const heartRate = toNumber(vitals.heart_rate);
  const respiratoryRate = toNumber(vitals.respiratory_rate);
  const weightKg = toNumber(vitals.weight_kg);
  const muacMm = toNumber(vitals.muac_mm);

  const textBlob = normalizeText(
    visitData.chief_complaint,
    visitData.notes,
    assessment.history_text,
    assessment.examination_text,
    assessment.assessment_text,
    assessment.plan_text,
    diagnoses.map((d) => d?.display_name),
    diagnoses.map((d) => d?.icd_code),
    treatments.map((t) => t?.drug_name)
  );
  const diagnosisCodeSet = getDiagnosisCodeSet(diagnoses);

  const pediatric = isPediatric(safeDraft);
  const maternal = isMaternal(safeDraft, textBlob);
  const alerts = [];

  // Pediatric danger signs: fever + neck stiffness / convulsion.
  if (pediatric && (temp !== null ? temp >= 38 : containsAny(textBlob, KEYWORDS.fever)) && containsAny(textBlob, KEYWORDS.neckStiffness)) {
    alerts.push(
      toAlert({
        ruleId: "CDS-PED-001",
        ruleName: "Pediatric fever with meningeal danger signs",
        severity: "critical",
        confidence: 0.97,
        triggeringInputs: [
          pediatric ? "age<15y" : null,
          temp !== null ? `temperature=${temp}C` : "fever symptom documented",
          "neck stiffness / convulsion signal documented",
        ],
        recommendedAction:
          "Treat as emergency, stabilize airway/breathing, and refer urgently for meningitis/sepsis workup.",
        cohort: "pediatric",
      })
    );
  }

  // Maternal severe hypertension + danger symptoms.
  if (maternal && ((sbp !== null && sbp >= 160) || (dbp !== null && dbp >= 110)) && containsAny(textBlob, KEYWORDS.severeHeadache)) {
    alerts.push(
      toAlert({
        ruleId: "CDS-MAT-001",
        ruleName: "Maternal severe hypertension with danger symptoms",
        severity: "critical",
        confidence: 0.98,
        triggeringInputs: [
          maternal ? "maternal context detected" : null,
          sbp !== null ? `systolic=${sbp}` : null,
          dbp !== null ? `diastolic=${dbp}` : null,
          "severe headache/visual danger symptom documented",
        ],
        recommendedAction:
          "Initiate emergency maternal protocol and urgent referral; consider MgSO4 and antihypertensive per local guideline.",
        cohort: "maternal",
      })
    );
  }

  // Maternal bleeding danger.
  if (maternal && containsAny(textBlob, KEYWORDS.bleeding)) {
    alerts.push(
      toAlert({
        ruleId: "CDS-MAT-002",
        ruleName: "Maternal bleeding danger flag",
        severity: "critical",
        confidence: 0.95,
        triggeringInputs: [
          maternal ? "maternal context detected" : null,
          "bleeding/hemorrhage term documented",
        ],
        recommendedAction:
          "Treat as obstetric emergency and refer immediately with stabilization and transport coordination.",
        cohort: "maternal",
      })
    );
  }

  // Maternal postpartum infection danger.
  if (maternal && (temp !== null ? temp >= 38 : containsAny(textBlob, KEYWORDS.fever)) && containsAny(textBlob, KEYWORDS.maternalInfection)) {
    alerts.push(
      toAlert({
        ruleId: "CDS-MAT-003",
        ruleName: "Maternal postpartum infection danger signs",
        severity: "high",
        confidence: 0.92,
        triggeringInputs: [
          temp !== null ? `temperature=${temp}C` : "fever symptom documented",
          "maternal infection symptom documented",
        ],
        recommendedAction:
          "Escalate for sepsis-focused maternal assessment and urgent referral if unstable.",
        cohort: "maternal",
      })
    );
  }

  // General respiratory danger.
  if ((spo2 !== null && spo2 < 92) || ((spo2 !== null && spo2 < 95) && containsAny(textBlob, KEYWORDS.respiratoryDistress))) {
    alerts.push(
      toAlert({
        ruleId: "CDS-GEN-001",
        ruleName: "Respiratory compromise danger sign",
        severity: spo2 !== null && spo2 < 92 ? "critical" : "high",
        confidence: 0.96,
        triggeringInputs: [
          spo2 !== null ? `spo2=${spo2}%` : null,
          containsAny(textBlob, KEYWORDS.respiratoryDistress) ? "respiratory distress symptoms" : null,
        ],
        recommendedAction:
          "Prioritize oxygen/airway support and urgent escalation or referral based on response.",
        cohort: "general",
      })
    );
  }

  // Hypertensive crisis red flag (non-maternal).
  if (!maternal && ((sbp !== null && sbp >= 180) || (dbp !== null && dbp >= 120)) && containsAny(textBlob, KEYWORDS.hypertensiveDanger)) {
    alerts.push(
      toAlert({
        ruleId: "CDS-GEN-HTN-001",
        ruleName: "Hypertensive emergency danger pattern",
        severity: "critical",
        confidence: 0.94,
        triggeringInputs: [
          sbp !== null ? `systolic=${sbp}` : null,
          dbp !== null ? `diastolic=${dbp}` : null,
          "neurologic/cardiac danger symptom documented",
        ],
        recommendedAction:
          "Treat as hypertensive emergency and refer urgently for higher-level management.",
        cohort: "adult",
      })
    );
  }

  // Pneumonia severe pattern.
  const rapidRespThreshold = pediatric ? 40 : 30;
  if (
    (hasAnyDiagnosisCode(diagnosisCodeSet, ["J18"]) || containsAny(textBlob, KEYWORDS.pneumonia)) &&
    ((spo2 !== null && spo2 < 94) || (respiratoryRate !== null && respiratoryRate >= rapidRespThreshold))
  ) {
    alerts.push(
      toAlert({
        ruleId: "CDS-RESP-002",
        ruleName: "Pneumonia with respiratory danger signs",
        severity: spo2 !== null && spo2 < 90 ? "critical" : "high",
        confidence: 0.93,
        triggeringInputs: [
          hasAnyDiagnosisCode(diagnosisCodeSet, ["J18"]) ? "diagnosis=J18" : "pneumonia symptom cluster",
          spo2 !== null ? `spo2=${spo2}%` : null,
          respiratoryRate !== null ? `respiratory_rate=${respiratoryRate}/min` : null,
        ],
        recommendedAction:
          "Start pneumonia protocol and refer urgently when oxygenation or breathing work is compromised.",
        cohort: pediatric ? "pediatric" : "adult",
      })
    );
  }

  // Asthma severe attack pattern.
  if (
    (hasAnyDiagnosisCode(diagnosisCodeSet, ["J45"]) || containsAny(textBlob, KEYWORDS.asthma)) &&
    ((spo2 !== null && spo2 < 94) || containsAny(textBlob, KEYWORDS.respiratoryDistress))
  ) {
    alerts.push(
      toAlert({
        ruleId: "CDS-RESP-003",
        ruleName: "Asthma severe attack danger pattern",
        severity: spo2 !== null && spo2 < 90 ? "critical" : "high",
        confidence: 0.92,
        triggeringInputs: [
          hasAnyDiagnosisCode(diagnosisCodeSet, ["J45"]) ? "diagnosis=J45" : "asthma symptom cluster",
          spo2 !== null ? `spo2=${spo2}%` : null,
          "respiratory distress signs",
        ],
        recommendedAction:
          "Provide immediate bronchodilator/oxygen support and escalate urgently if poor response.",
        cohort: pediatric ? "pediatric" : "adult",
      })
    );
  }

  // Malaria severe pattern.
  if (
    (hasAnyDiagnosisCode(diagnosisCodeSet, ["B50", "B54"]) || containsAny(textBlob, KEYWORDS.malaria)) &&
    (temp !== null ? temp >= 38 : containsAny(textBlob, KEYWORDS.fever)) &&
    (containsAny(textBlob, KEYWORDS.malariaDanger) || (spo2 !== null && spo2 < 94))
  ) {
    alerts.push(
      toAlert({
        ruleId: "CDS-INF-001",
        ruleName: "Malaria with severe danger signs",
        severity: "critical",
        confidence: 0.95,
        triggeringInputs: [
          temp !== null ? `temperature=${temp}C` : "fever symptom documented",
          hasAnyDiagnosisCode(diagnosisCodeSet, ["B50", "B54"]) ? "malaria diagnosis code present" : "malaria symptoms documented",
          "severe-malaria danger symptom documented",
        ],
        recommendedAction:
          "Treat as severe malaria risk and refer urgently after stabilization and antimalarial initiation per protocol.",
        cohort: pediatric ? "pediatric" : "general",
      })
    );
  }

  // Acute diarrhoea with dehydration/shock pattern.
  if (
    (hasAnyDiagnosisCode(diagnosisCodeSet, ["A09"]) || containsAny(textBlob, KEYWORDS.diarrhea)) &&
    (containsAny(textBlob, KEYWORDS.dehydration) || (sbp !== null && sbp < 90) || (heartRate !== null && heartRate >= 110))
  ) {
    alerts.push(
      toAlert({
        ruleId: "CDS-GI-001",
        ruleName: "Acute diarrhoea with dehydration danger signs",
        severity: "high",
        confidence: 0.91,
        triggeringInputs: [
          hasAnyDiagnosisCode(diagnosisCodeSet, ["A09"]) ? "diagnosis=A09" : "diarrhoea symptom cluster",
          sbp !== null && sbp < 90 ? `systolic=${sbp}` : null,
          heartRate !== null && heartRate >= 110 ? `heart_rate=${heartRate}` : null,
          containsAny(textBlob, KEYWORDS.dehydration) ? "dehydration signs documented" : null,
        ],
        recommendedAction:
          "Initiate dehydration protocol (ORS/IV as indicated) and refer urgently if shock/severe dehydration persists.",
        cohort: pediatric ? "pediatric" : "general",
      })
    );
  }

  // Pediatric severe and moderate malnutrition signals (MUAC + diagnosis).
  if (pediatric && ((muacMm !== null && muacMm < 115) || hasAnyDiagnosisCode(diagnosisCodeSet, ["E40", "E41", "E46"]))) {
    alerts.push(
      toAlert({
        ruleId: "CDS-PED-NUT-001",
        ruleName: "Pediatric severe malnutrition danger flag",
        severity: "critical",
        confidence: 0.96,
        triggeringInputs: [
          muacMm !== null ? `muac=${muacMm}mm` : null,
          hasAnyDiagnosisCode(diagnosisCodeSet, ["E40", "E41", "E46"]) ? "malnutrition diagnosis code present" : null,
        ],
        recommendedAction:
          "Treat as severe acute malnutrition and refer or admit per stabilization protocol.",
        cohort: "pediatric",
      })
    );
  } else if (pediatric && muacMm !== null && muacMm >= 115 && muacMm < 125) {
    alerts.push(
      toAlert({
        ruleId: "CDS-PED-NUT-002",
        ruleName: "Pediatric moderate malnutrition alert",
        severity: "high",
        confidence: 0.9,
        triggeringInputs: [`muac=${muacMm}mm`],
        recommendedAction:
          "Enroll in nutrition follow-up pathway and reassess MUAC/weight closely.",
        cohort: "pediatric",
      })
    );
  }

  // Pediatric paracetamol dosing support.
  const paracetamolTx = findTreatmentByName(treatments, ["paracetamol", "acetaminophen"]);
  if (pediatric && weightKg !== null && weightKg > 0 && paracetamolTx) {
    const minDose = Math.round(weightKg * 10);
    const maxDose = Math.round(weightKg * 15);
    alerts.push(
      toAlert({
        ruleId: "CDS-PED-DOSE-001",
        ruleName: "Pediatric paracetamol dose check",
        severity: "medium",
        confidence: 0.9,
        triggeringInputs: [
          "age<15y",
          `weight=${weightKg}kg`,
          `treatment=${paracetamolTx.drug_name}`,
        ],
        recommendedAction:
          `Recommended per-dose range: ${minDose}-${maxDose} mg every 6 hours (max 60 mg/kg/day).`,
        cohort: "pediatric",
      })
    );
  }

  // Pediatric amoxicillin dose guidance.
  const amoxicillinTx = findTreatmentByName(treatments, ["amoxicillin"]);
  if (pediatric && weightKg !== null && weightKg > 0 && amoxicillinTx) {
    const dailyMin = Math.round(weightKg * 40);
    const dailyMax = Math.round(weightKg * 90);
    alerts.push(
      toAlert({
        ruleId: "CDS-PED-DOSE-002",
        ruleName: "Pediatric amoxicillin dose range reminder",
        severity: "medium",
        confidence: 0.86,
        triggeringInputs: [
          "age<15y",
          `weight=${weightKg}kg`,
          `treatment=${amoxicillinTx.drug_name}`,
        ],
        recommendedAction:
          `Typical total daily range: ${dailyMin}-${dailyMax} mg/day (divide per local protocol and severity).`,
        cohort: "pediatric",
      })
    );
  }

  // Contraindication warnings.
  const aspirinTx = findTreatmentByName(treatments, ["aspirin", "acetylsalicylic"]);
  if (pediatric && aspirinTx) {
    alerts.push(
      toAlert({
        ruleId: "CDS-PED-CONTRA-001",
        ruleName: "Pediatric aspirin contraindication alert",
        severity: "critical",
        confidence: 0.99,
        triggeringInputs: ["age<15y", `treatment=${aspirinTx.drug_name}`],
        recommendedAction:
          "Avoid aspirin in pediatric febrile illness (Reye syndrome risk); select safer alternative.",
        cohort: "pediatric",
      })
    );
  }

  const ibuprofenTx = findTreatmentByName(treatments, ["ibuprofen"]);
  if (maternal && ibuprofenTx) {
    alerts.push(
      toAlert({
        ruleId: "CDS-MAT-CONTRA-001",
        ruleName: "Maternal ibuprofen caution alert",
        severity: "high",
        confidence: 0.9,
        triggeringInputs: ["maternal context detected", `treatment=${ibuprofenTx.drug_name}`],
        recommendedAction:
          "Review gestational age and avoid NSAIDs in late pregnancy unless guideline-supported.",
        cohort: "maternal",
      })
    );
  }

  // Add STG protocol reminders for Top-20 diagnosis coverage.
  alerts.push(...buildTop20ProtocolAlerts(diagnosisCodeSet));

  return {
    engineVersion: ENGINE_VERSION,
    generatedAt: new Date().toISOString(),
    alerts,
  };
};

export const evaluateOfflineSymptomGuidance = ({ message = "", conversation = [] } = {}) => {
  const conversationText = Array.isArray(conversation)
    ? conversation
        .map((turn) => turn?.message || turn?.text || "")
        .join(" ")
    : "";
  const textBlob = normalizeText(message, conversationText);

  const matchedRules = SYMPTOM_DANGER_RULES.filter((rule) =>
    containsAny(textBlob, rule.terms)
  );
  const hasEmergency = matchedRules.some((rule) => isEmergencyUrgency(rule.urgency));

  const urgency = hasEmergency
    ? "emergency"
    : matchedRules.length > 0
      ? "clinic_soon"
      : "self_care";

  const redFlags = dedupeTextList(matchedRules.map((rule) => rule.label));
  const nextSteps = dedupeTextList([
    ...matchedRules.map((rule) => rule.action),
    urgency === "self_care"
      ? "Monitor symptoms closely and continue hydration, rest, and basic supportive care."
      : "Share this symptom summary at the clinic for faster triage.",
    "If symptoms worsen, escalate care immediately.",
  ]);

  const safetyNotes = dedupeTextList([
    "This guidance is supportive and does not replace clinician assessment.",
    hasEmergency
      ? "Emergency danger signs detected from symptom text."
      : "If danger signs appear later, seek urgent care immediately.",
  ]);

  const referralRecommendation = hasEmergency
    ? "Immediate emergency referral advised."
    : urgency === "clinic_soon"
      ? "Same-day clinic review recommended."
      : "Home monitoring is reasonable if symptoms remain mild.";

  return {
    engineVersion: ENGINE_VERSION,
    mode: "offline_symptom_guidance_v1",
    generatedAt: new Date().toISOString(),
    urgency,
    redFlags,
    nextSteps,
    safetyNotes,
    referralRecommendation,
    requiresClinicReview: urgency !== "self_care",
  };
};

export const evaluateOfflineHewDangerAssessment = ({
  protocolId = "",
  answers = {},
  message = "",
  noteText = "",
} = {}) => {
  const protocolKey = String(protocolId || "").trim().toLowerCase();
  const catalog = HEW_PROTOCOL_DANGER_CATALOG[protocolKey] || [];

  const matchedProtocolDangers = catalog.filter((rule) =>
    isAffirmativeAnswer(answers?.[rule.id])
  );

  const positiveAnswerText = Object.entries(answers || {})
    .filter(([, value]) => isAffirmativeAnswer(value))
    .map(([key]) => key.replace(/_/g, " "));

  const narrative = dedupeTextList([message, noteText, ...positiveAnswerText]).join(" ");
  const symptomGuidance = evaluateOfflineSymptomGuidance({ message: narrative });

  const protocolEmergency = matchedProtocolDangers.some((rule) =>
    isEmergencyUrgency(rule.urgency)
  );
  const symptomEmergency = isEmergencyUrgency(symptomGuidance.urgency);

  const urgency = protocolEmergency || symptomEmergency
    ? "emergency"
    : matchedProtocolDangers.length > 0 || symptomGuidance.urgency === "clinic_soon"
      ? "urgent"
      : "routine";

  const dangerSigns = dedupeTextList([
    ...matchedProtocolDangers.map((rule) => rule.label),
    ...(symptomGuidance.redFlags || []),
  ]);

  const nextSteps = dedupeTextList([
    ...matchedProtocolDangers.map((rule) => rule.action),
    ...(symptomGuidance.nextSteps || []),
    urgency === "routine"
      ? "Continue protocol follow-up and reinforce return precautions."
      : "Document escalation reason and communicate referral urgency clearly.",
  ]);

  const escalationPrompt = urgency === "emergency"
    ? "Emergency danger signs detected. Arrange immediate transfer."
    : urgency === "urgent"
      ? "Urgent danger indicators detected. Same-day escalation is advised."
      : "No immediate danger sign detected from current answers.";

  return {
    engineVersion: ENGINE_VERSION,
    mode: "offline_hew_danger_check_v1",
    generatedAt: new Date().toISOString(),
    protocolId: protocolKey || null,
    urgency,
    dangerSigns,
    nextSteps,
    escalationPrompt,
    referralRecommendation:
      urgency === "emergency"
        ? "Immediate emergency referral advised."
        : urgency === "urgent"
          ? "Same-day referral advised."
          : "Routine follow-up is acceptable if the patient remains stable.",
    requiresEmergency: urgency === "emergency",
    requiresReferral: urgency !== "routine",
    source: "offline_cdss",
  };
};

export const summarizeCdssDecisions = ({ alerts = [], decisions = {} } = {}) => {
  if (!Array.isArray(alerts) || alerts.length === 0) return null;
  const rows = alerts.map((alert) => {
    const decision = decisions?.[alert.ruleId]?.decision || "not_reviewed";
    return `- ${alert.ruleId} [${decision}] ${alert.ruleName} (confidence ${Math.round(
      Number(alert.confidence || 0) * 100
    )}%)`;
  });
  return [`[${ENGINE_VERSION}] Clinician CDSS review`, ...rows].join("\n");
};

export const top20StgProtocolMatrix = TOP20_STG_PROTOCOL_MATRIX;
export const getTop20StgCoverage = () => TOP20_STG_PROTOCOL_MATRIX;
export const cdssEngineVersion = ENGINE_VERSION;

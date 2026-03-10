/**
 * hewGuidedAssessmentService.js
 *
 * Guided protocol definitions for HEW Lite MVP and helper functions that
 * convert question answers into structured, consumable assessment summaries.
 */

const HEW_GUIDED_PROTOCOLS = Object.freeze([
  {
    id: 'fever',
    title: 'Fever follow-up',
    summary: 'Focused fever assessment with infection danger checks.',
    noteType: 'household_visit',
    questions: [
      { id: 'fever_more_than_2_days', label: 'Fever for more than 2 days' },
      { id: 'fever_very_high', label: 'Very high fever or persistent chills', dangerLevel: 'high', chipKey: 'fever' },
      { id: 'stiff_neck_or_convulsion', label: 'Stiff neck or convulsion', dangerLevel: 'critical', chipKey: 'convulsion' },
      { id: 'cannot_drink_or_vomit_everything', label: 'Cannot drink or vomiting everything', dangerLevel: 'high', chipKey: 'severe_vomiting' },
      { id: 'very_sleepy_or_unconscious', label: 'Very sleepy or unconscious', dangerLevel: 'critical', chipKey: 'unconscious' },
      { id: 'rash_with_fever', label: 'Rash with fever', dangerLevel: 'high', chipKey: 'rash' },
    ],
  },
  {
    id: 'respiratory',
    title: 'Respiratory symptoms',
    summary: 'Breathing-focused checks for rapid escalation risk.',
    noteType: 'household_visit',
    questions: [
      { id: 'cough_or_breathing_complaint', label: 'Cough or breathing complaint present' },
      { id: 'fast_breathing', label: 'Fast breathing', dangerLevel: 'high', chipKey: 'breathing_problem' },
      { id: 'chest_indrawing', label: 'Chest indrawing', dangerLevel: 'critical', chipKey: 'breathing_problem' },
      { id: 'blue_lips_or_cannot_speak', label: 'Blue lips or cannot speak full sentence', dangerLevel: 'critical', chipKey: 'breathing_problem' },
      { id: 'chest_pain', label: 'Chest pain with breathing problem', dangerLevel: 'high', chipKey: 'chest_pain' },
    ],
  },
  {
    id: 'maternal_followup',
    title: 'Maternal follow-up',
    summary: 'Postnatal/antenatal safety checks and urgent maternal red flags.',
    noteType: 'maternal_followup',
    questions: [
      { id: 'postpartum_or_pregnant', label: 'Pregnant or postpartum context confirmed' },
      { id: 'severe_headache_or_blur', label: 'Severe headache or blurred vision', dangerLevel: 'critical' },
      { id: 'bleeding_now', label: 'Current vaginal/postpartum bleeding', dangerLevel: 'critical', chipKey: 'bleeding' },
      { id: 'face_or_hand_swelling', label: 'Face or hand swelling', dangerLevel: 'high' },
      { id: 'fever_after_delivery', label: 'Fever after delivery', dangerLevel: 'high', chipKey: 'fever' },
      { id: 'reduced_fetal_movement', label: 'Reduced fetal movement', dangerLevel: 'high' },
    ],
  },
  {
    id: 'child_danger_signs',
    title: 'Child danger signs',
    summary: 'Rapid checks for severe child danger patterns.',
    noteType: 'child_growth',
    questions: [
      { id: 'under_five_or_child_case', label: 'Child case (under 15 years)' },
      { id: 'unable_to_feed', label: 'Unable to feed or drink', dangerLevel: 'critical' },
      { id: 'vomits_everything', label: 'Vomits everything', dangerLevel: 'high', chipKey: 'severe_vomiting' },
      { id: 'convulsion', label: 'Convulsion', dangerLevel: 'critical', chipKey: 'convulsion' },
      { id: 'lethargic_or_unconscious', label: 'Lethargic or unconscious', dangerLevel: 'critical', chipKey: 'unconscious' },
      { id: 'fast_breathing_or_indrawing', label: 'Fast breathing or chest indrawing', dangerLevel: 'critical', chipKey: 'breathing_problem' },
      { id: 'bloody_or_watery_diarrhea', label: 'Bloody/watery diarrhea with weakness', dangerLevel: 'high', chipKey: 'severe_diarrhoea' },
    ],
  },
  {
    id: 'adherence_followup',
    title: 'Adherence follow-up',
    summary: 'Medication adherence and treatment continuity checks.',
    noteType: 'medication_adherence',
    questions: [
      { id: 'missed_doses', label: 'Missed doses in the last 7 days' },
      { id: 'stopped_treatment', label: 'Stopped treatment entirely', dangerLevel: 'high' },
      { id: 'symptoms_worsening', label: 'Symptoms are worsening', dangerLevel: 'high' },
      { id: 'side_effects_blocking_use', label: 'Side effects are blocking medicine use' },
      { id: 'no_supply_available', label: 'Medicine stock/supply issue at home' },
      { id: 'adherence_improving', label: 'Adherence improved since last follow-up' },
    ],
  },
  {
    id: 'referral_followup',
    title: 'Referral follow-up',
    summary: 'Tracks whether referral was completed and if escalation is needed.',
    noteType: 'referral_followup',
    questions: [
      { id: 'referral_completed', label: 'Patient completed previous referral' },
      { id: 'symptoms_worse_after_referral', label: 'Symptoms worsened after referral', dangerLevel: 'high' },
      { id: 'new_bleeding_or_breathing_issue', label: 'New bleeding or breathing issue', dangerLevel: 'critical', chipKey: 'bleeding' },
      { id: 'transport_or_cost_barrier', label: 'Transport/cost barrier blocked referral completion' },
      { id: 'needs_repeat_referral', label: 'Needs repeat referral today', dangerLevel: 'high' },
    ],
  },
]);

const PROTOCOL_BY_ID = new Map(HEW_GUIDED_PROTOCOLS.map((protocol) => [protocol.id, protocol]));

const NOTE_FLAG_RULES = Object.freeze({
  missed_dose: ['missed_doses'],
  defaulted: ['stopped_treatment'],
  lost_to_followup: ['transport_or_cost_barrier'],
  improving: ['adherence_improving'],
  referred: ['referral_completed', 'needs_repeat_referral'],
});

const toBoolean = (value) => value === true;

export const getHewGuidedProtocolById = (protocolId) =>
  protocolId ? PROTOCOL_BY_ID.get(String(protocolId)) || null : null;

export const getHewGuidedProtocols = () => HEW_GUIDED_PROTOCOLS;

export const buildDangerSignMapFromAnswers = (protocolId, answers = {}) => {
  const protocol = getHewGuidedProtocolById(protocolId);
  const map = {};
  if (!protocol) return map;

  for (const question of protocol.questions) {
    if (!question.chipKey) continue;
    if (!toBoolean(answers[question.id])) continue;
    map[question.chipKey] = true;
  }

  return map;
};

export const summarizeHewGuidedAssessment = ({
  protocolId,
  answers = {},
  freeText = '',
} = {}) => {
  const protocol = getHewGuidedProtocolById(protocolId);
  if (!protocol) {
    return {
      protocol: null,
      positiveAnswers: [],
      dangerItems: [],
      recommendedFlags: [],
      dangerSigns: {},
      summaryText: String(freeText || '').trim() || '',
      shouldEscalate: false,
      escalationLevel: 'routine',
    };
  }

  const positiveAnswers = protocol.questions
    .filter((question) => toBoolean(answers[question.id]))
    .map((question) => ({
      id: question.id,
      label: question.label,
      dangerLevel: question.dangerLevel || null,
      chipKey: question.chipKey || null,
    }));

  const dangerItems = positiveAnswers.filter((item) => item.dangerLevel);
  const hasCritical = dangerItems.some((item) => item.dangerLevel === 'critical');
  const hasHigh = dangerItems.some((item) => item.dangerLevel === 'high');

  const recommendedFlags = [];
  if (dangerItems.length > 0) {
    recommendedFlags.push('danger_sign');
  }

  for (const [flag, questionIds] of Object.entries(NOTE_FLAG_RULES)) {
    if (questionIds.some((questionId) => toBoolean(answers[questionId]))) {
      recommendedFlags.push(flag);
    }
  }

  const uniqueFlags = [...new Set(recommendedFlags)];
  const dangerSigns = buildDangerSignMapFromAnswers(protocolId, answers);
  const summaryParts = [
    `Guided protocol: ${protocol.title}`,
    positiveAnswers.length > 0
      ? `Positive responses: ${positiveAnswers.map((item) => item.label).join('; ')}`
      : null,
    String(freeText || '').trim() || null,
  ].filter(Boolean);

  return {
    protocol,
    positiveAnswers,
    dangerItems,
    recommendedFlags: uniqueFlags,
    dangerSigns,
    summaryText: summaryParts.join('\n'),
    shouldEscalate: hasCritical || hasHigh,
    escalationLevel: hasCritical ? 'emergency' : hasHigh ? 'urgent' : 'routine',
  };
};

/**
 * hewService.js — HEW API service
 *
 * Wraps all API calls needed by the HEW mobile app:
 *  - Patient search
 *  - Community note submission (text + optional audio)
 *  - Caseload (patients with upcoming follow-ups)
 *  - Flush the offline queue when connectivity returns
 */

import { api } from '../lib/api';
import { getQueue, removeFromQueue, incrementAttempts } from '../lib/offlineQueue';
import { requestLinkAgentInteraction } from './linkAgentService';
import { evaluateOfflineHewDangerAssessment } from './offlineCdssService';

// ─── Patient search ─────────────────────────────────────────────────────────

/**
 * Search patients by name or phone.
 * @param {string} query
 * @returns {Promise<Array>}
 */
export async function searchPatients(query) {
  if (!query || query.trim().length < 2) return [];
  const res = await api.get(
    `/patients/search?q=${encodeURIComponent(query.trim())}&limit=8`
  );
  return res?.patients ?? [];
}

/**
 * Fetch all patients registered at the HEW's facility.
 * Used to show the full patient list when no search query is active.
 * @returns {Promise<Array>}
 */
export async function getFacilityPatients() {
  const res = await api.get('/hew/facility-patients');
  return res?.patients ?? [];
}

// ─── Community notes ────────────────────────────────────────────────────────

/**
 * Submit a text community note for a patient.
 * @param {string} patientId
 * @param {object} payload  { note_type, note_text, location, follow_up_due, flags, visit_date }
 * @returns {Promise<object>}
 */
export async function submitNote(patientId, payload) {
  return api.post(`/hew/patients/${patientId}/notes`, payload);
}

/**
 * Submit a voice note for a patient.
 * Sends the audio file as multipart/form-data plus note metadata.
 * @param {string} patientId
 * @param {object} payload
 * @param {string} audioUri  local file:// URI from expo-av recording
 * @returns {Promise<object>}
 */
export async function submitVoiceNote(patientId, payload, audioUri) {
  const formData = new FormData();
  formData.append('audio', {
    uri: audioUri,
    type: 'audio/m4a',
    name: 'voice_note.m4a',
  });
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      formData.append(key, Array.isArray(value) ? JSON.stringify(value) : String(value));
    }
  });
  return api.post(`/hew/patients/${patientId}/notes/voice`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

// ─── Caseload ───────────────────────────────────────────────────────────────

/**
 * Fetch patients with upcoming follow-up dates authored by the current HEW.
 * @returns {Promise<Array>}
 */
export async function getCaseload() {
  const res = await api.get('/hew/caseload');
  return res?.patients ?? [];
}

// ─── Offline queue flush ────────────────────────────────────────────────────

/**
 * Flush all queued offline notes to the backend.
 * Returns { flushed, failed } counts.
 */
export async function flushOfflineQueue() {
  const queue = await getQueue();
  if (!queue.length) return { flushed: 0, failed: 0 };

  let flushed = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      if (item.audioUri) {
        await submitVoiceNote(item.patientId, item.payload, item.audioUri);
      } else {
        await submitNote(item.patientId, item.payload);
      }
      await removeFromQueue(item.id);
      flushed++;
    } catch (err) {
      await incrementAttempts(item.id);
      failed++;
      console.warn('[HEW] Failed to flush queue item', item.id, err?.message);
    }
  }

  return { flushed, failed };
}

// ─── Notes for a patient (preview in patient card) ─────────────────────────

/**
 * Fetch recent community notes for a patient.
 * @param {string} patientId
 * @param {number} limit
 */
export async function getPatientNotes(patientId, limit = 3) {
  const res = await api.get(
    `/hew/patients/${patientId}/notes?limit=${limit}`
  );
  return res?.notes ?? [];
}

const normalizeUrgency = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'emergency') return 'emergency';
  if (normalized === 'urgent' || normalized === 'clinic_soon' || normalized === 'review') return 'urgent';
  return 'routine';
};

const normalizeList = (value) => {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
};

/**
 * Run HEW danger-sign check with Link Agent first and offline CDSS fallback.
 * Returns a normalized object that can be rendered consistently by HEW UI.
 */
export async function runHewDangerSignCheck({
  protocolId,
  answers = {},
  noteText = '',
  locale = 'am',
} = {}) {
  const offline = evaluateOfflineHewDangerAssessment({
    protocolId,
    answers,
    noteText,
    message: noteText,
  });

  try {
    const response = await requestLinkAgentInteraction(
      {
        surface: 'hew',
        intent: 'hew_guidance',
        payload: {
          protocolId,
          answers,
          noteText,
          offlineFallback: offline,
        },
        conversation: [],
        locale,
        safeMode: true,
      },
      { includeAuth: true }
    );

    const agentStatus = String(response?.agent?.status || 'generated').toLowerCase();
    const content = response?.content && typeof response.content === 'object'
      ? response.content
      : {};

    const urgency = normalizeUrgency(content.urgency || offline.urgency);
    const dangerSigns = normalizeList(content.dangerSigns || content.redFlags || offline.dangerSigns);
    const nextSteps = normalizeList(content.nextSteps || content.guidance || offline.nextSteps);
    const escalationPrompt = String(
      content.escalationPrompt ||
      content.message ||
      offline.escalationPrompt
    );

    return {
      ...offline,
      urgency,
      dangerSigns,
      nextSteps: nextSteps.length > 0 ? nextSteps : offline.nextSteps,
      escalationPrompt,
      referralRecommendation: String(
        content.referralRecommendation || offline.referralRecommendation
      ),
      requiresEmergency: urgency === 'emergency',
      requiresReferral: urgency !== 'routine',
      source: agentStatus === 'generated' ? 'link_agent_generated' : 'link_agent_fallback',
      agentStatus,
      agentMessage: String(response?.message || ''),
      agentModel: String(response?.agent?.model || 'link_agent_v1'),
    };
  } catch (_error) {
    return {
      ...offline,
      source: 'offline_fallback',
      agentStatus: 'fallback',
      agentMessage: 'Link Agent unavailable. Using offline danger-sign rules.',
      agentModel: 'offline_cdss',
    };
  }
}

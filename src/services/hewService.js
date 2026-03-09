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

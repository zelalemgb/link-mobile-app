/**
 * offlineQueue.js — Offline note queue for HEW field use
 *
 * When a HEW saves a note without connectivity the note is stored here.
 * On next sync (manual or background) all queued items are flushed to
 * the backend and removed from the queue on success.
 *
 * Storage: AsyncStorage key "hew_offline_queue"
 * Each item: { id, patientId, payload, audioUri, queuedAt, attempts }
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'hew_offline_queue';

// ─── Read ──────────────────────────────────────────────────────────────────

export async function getQueue() {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ─── Write ─────────────────────────────────────────────────────────────────

export async function enqueue({ patientId, payload, audioUri = null }) {
  const queue = await getQueue();
  const item = {
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    patientId,
    payload,          // note fields: note_type, note_text, location, follow_up_due, flags, visit_date
    audioUri,         // local file URI for voice note, null if text-only
    queuedAt: new Date().toISOString(),
    attempts: 0,
  };
  queue.push(item);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  return item;
}

export async function removeFromQueue(id) {
  const queue = await getQueue();
  const updated = queue.filter((item) => item.id !== id);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
}

export async function incrementAttempts(id) {
  const queue = await getQueue();
  const updated = queue.map((item) =>
    item.id === id ? { ...item, attempts: item.attempts + 1 } : item
  );
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
}

export async function clearQueue() {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

// ─── Count ─────────────────────────────────────────────────────────────────

export async function getQueueCount() {
  const queue = await getQueue();
  return queue.length;
}

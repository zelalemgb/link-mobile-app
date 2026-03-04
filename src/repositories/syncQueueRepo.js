/**
 * syncQueueRepo.js — Outbox for offline sync operations
 *
 * Mirrors the server-side sync_op_ledger contract:
 *   entityType  — table name ('patients', 'visits', etc.)
 *   entityId    — record UUID
 *   opType      — 'upsert' | 'delete'
 *   payload     — full JSON snapshot of the record
 *
 * Flush strategy (called by the sync engine):
 *   1. Fetch all rows ordered by attempts ASC, created_at ASC
 *   2. Push each batch to POST /api/sync/push
 *   3. On success: delete the row
 *   4. On failure: increment attempts + set last_error
 *   5. Items with attempts >= MAX_ATTEMPTS are considered "stuck" and
 *      surfaced in the Sync screen for manual review.
 */

import { getDb, newId, now } from '../lib/db/database';

const MAX_ATTEMPTS = 5;
const BATCH_SIZE   = 50;

/**
 * Enqueue a single operation.
 * If an op for the same entity already exists in the queue, replace it with a
 * fresh opId + latest payload snapshot (latest-write-wins in outbox).
 */
export const enqueue = async ({ entityType, entityId, opType, payload }) => {
  const db = getDb();
  const ts = now();
  const opId = newId();
  const serializedPayload = JSON.stringify(payload);

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `DELETE FROM sync_queue
       WHERE entity_type = ? AND entity_id = ?`,
      [entityType, entityId]
    );

    await db.runAsync(
      `INSERT INTO sync_queue (op_id, entity_type, entity_id, op_type, payload, attempts, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
      [opId, entityType, entityId, opType, serializedPayload, ts, ts]
    );
  });
};

/**
 * Replace any existing queue entry for (entityType, entityId) with fresh data.
 * Use this when updating a record that was already queued.
 */
export const upsertQueueEntry = async ({ entityType, entityId, opType, payload }) => {
  return enqueue({ entityType, entityId, opType, payload });
};

/**
 * Return the next batch of operations to flush.
 * Ordered by attempts then creation time so newer stuck items don't block fresh ones.
 */
export const getNextBatch = async ({ limit = BATCH_SIZE } = {}) => {
  const db = getDb();
  const rows = await db.getAllAsync(
    `SELECT * FROM sync_queue
     WHERE attempts < ?
     ORDER BY attempts ASC, created_at ASC
     LIMIT ?`,
    [MAX_ATTEMPTS, limit]
  );
  return rows.map((r) => ({
    ...r,
    payload:
      typeof r.payload === 'string'
        ? (() => {
            try {
              return JSON.parse(r.payload);
            } catch {
              return null;
            }
          })()
        : r.payload,
  }));
};

/**
 * Mark an op as successfully synced — remove it from the queue.
 */
export const markSynced = async (opId) => {
  const db = getDb();
  await db.runAsync(`DELETE FROM sync_queue WHERE op_id = ?`, [opId]);
};

/**
 * Record a failed attempt.
 */
export const markFailed = async (opId, errorMessage) => {
  const db = getDb();
  await db.runAsync(
    `UPDATE sync_queue
     SET attempts = attempts + 1, last_error = ?, updated_at = ?
     WHERE op_id = ?`,
    [errorMessage ?? 'unknown error', now(), opId]
  );
};

/**
 * Count of ops currently in the queue (excluding stuck).
 */
export const getPendingCount = async () => {
  const db = getDb();
  const row = await db.getFirstAsync(
    `SELECT COUNT(*) AS cnt FROM sync_queue WHERE attempts < ?`,
    [MAX_ATTEMPTS]
  );
  return row?.cnt ?? 0;
};

/**
 * Count of ops that have exceeded MAX_ATTEMPTS (stuck).
 */
export const getStuckCount = async () => {
  const db = getDb();
  const row = await db.getFirstAsync(
    `SELECT COUNT(*) AS cnt FROM sync_queue WHERE attempts >= ?`,
    [MAX_ATTEMPTS]
  );
  return row?.cnt ?? 0;
};

/**
 * Get all ops (including stuck) for display in the Sync screen.
 */
export const getAllQueued = async () => {
  const db = getDb();
  const rows = await db.getAllAsync(
    `SELECT * FROM sync_queue ORDER BY attempts ASC, created_at ASC`
  );
  return rows.map((r) => ({
    ...r,
    payload:
      typeof r.payload === 'string'
        ? (() => {
            try {
              return JSON.parse(r.payload);
            } catch {
              return null;
            }
          })()
        : r.payload,
    isStuck: r.attempts >= MAX_ATTEMPTS,
  }));
};

/**
 * Clear stuck items (manual user action from the Sync screen).
 */
export const clearStuck = async () => {
  const db = getDb();
  await db.runAsync(`DELETE FROM sync_queue WHERE attempts >= ?`, [MAX_ATTEMPTS]);
};

/**
 * Get/set cursor bookmark per entity type (for pull sync).
 */
export const getPullCursor = async (entityType) => {
  const db = getDb();
  const row = await db.getFirstAsync(
    `SELECT pull_cursor FROM sync_state WHERE entity_type = ?`, [entityType]
  );
  return row?.pull_cursor ?? null;
};

export const setPullCursor = async (entityType, cursor) => {
  const db = getDb();
  const ts = now();
  await db.runAsync(
    `INSERT INTO sync_state (entity_type, pull_cursor, last_pulled_at, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(entity_type) DO UPDATE SET
       pull_cursor=excluded.pull_cursor, last_pulled_at=excluded.last_pulled_at,
       updated_at=excluded.updated_at`,
    [entityType, cursor, ts, ts]
  );
};

export const setLastPushedAt = async (entityType) => {
  const db = getDb();
  const ts = now();
  await db.runAsync(
    `INSERT INTO sync_state (entity_type, last_pushed_at, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(entity_type) DO UPDATE SET last_pushed_at=excluded.last_pushed_at, updated_at=excluded.updated_at`,
    [entityType, ts, ts]
  );
};

export const syncQueueRepo = {
  enqueue,
  upsertQueueEntry,
  getNextBatch,
  markSynced,
  markFailed,
  getPendingCount,
  getStuckCount,
  getAllQueued,
  clearStuck,
  getPullCursor,
  setPullCursor,
  setLastPushedAt,
  MAX_ATTEMPTS,
  BATCH_SIZE,
};

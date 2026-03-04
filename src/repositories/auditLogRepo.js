/**
 * auditLogRepo.js — Append-only local audit log (W2-MOB-003)
 *
 * Records every write operation: who did what, to which entity, old/new state.
 * Never deletes rows — the log is read by the sync engine and eventually
 * shipped to the server's audit trail.
 *
 * W2-SEC-003: This table is the local leg of the "immutable audit" requirement.
 */

import { getDb, now } from '../lib/db/database';

/**
 * Append one audit entry.  Always called inside the same transaction as the
 * write that triggered it (via withTransactionAsync in the repo layer).
 *
 * @param {object}  opts
 * @param {string}  opts.userId       — authenticated user performing the action
 * @param {string}  opts.action       — e.g. 'create_visit', 'update_patient'
 * @param {string}  opts.entityType   — table name
 * @param {string}  opts.entityId     — record ID
 * @param {object}  [opts.oldValue]   — snapshot before (undefined for creates)
 * @param {object}  [opts.newValue]   — snapshot after  (undefined for deletes)
 * @param {string}  [opts.deviceId]   — optional device identifier
 */
const log = async ({
  userId, action, entityType, entityId,
  oldValue, newValue, deviceId,
}) => {
  const db = getDb();
  await db.runAsync(
    `INSERT INTO local_audit_log
       (user_id, action, entity_type, entity_id, old_value, new_value, device_id, occurred_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      action,
      entityType,
      entityId,
      oldValue  != null ? JSON.stringify(oldValue)  : null,
      newValue  != null ? JSON.stringify(newValue)  : null,
      deviceId  ?? null,
      now(),
    ]
  );
};

/**
 * Read recent audit entries for a specific entity (for the UI audit view).
 */
const getForEntity = async (entityType, entityId, { limit = 50 } = {}) => {
  const db = getDb();
  const rows = await db.getAllAsync(
    `SELECT * FROM local_audit_log
     WHERE entity_type = ? AND entity_id = ?
     ORDER BY occurred_at DESC
     LIMIT ?`,
    [entityType, entityId, limit]
  );
  return rows.map((r) => ({
    ...r,
    oldValue: r.old_value ? JSON.parse(r.old_value) : null,
    newValue: r.new_value ? JSON.parse(r.new_value) : null,
  }));
};

/**
 * Read recent audit entries for a specific user.
 */
const getForUser = async (userId, { limit = 100 } = {}) => {
  const db = getDb();
  const rows = await db.getAllAsync(
    `SELECT * FROM local_audit_log
     WHERE user_id = ?
     ORDER BY occurred_at DESC
     LIMIT ?`,
    [userId, limit]
  );
  return rows.map((r) => ({
    ...r,
    oldValue: r.old_value ? JSON.parse(r.old_value) : null,
    newValue: r.new_value ? JSON.parse(r.new_value) : null,
  }));
};

/**
 * Count unsynced audit entries (all of them, since we never delete from this table).
 */
const getCount = async () => {
  const db = getDb();
  const row = await db.getFirstAsync(`SELECT COUNT(*) AS cnt FROM local_audit_log`);
  return row?.cnt ?? 0;
};

export const auditLogRepo = {
  log,
  getForEntity,
  getForUser,
  getCount,
};

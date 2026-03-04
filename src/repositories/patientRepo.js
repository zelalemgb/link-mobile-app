/**
 * patientRepo.js — Local CRUD for patients
 *
 * All writes append an entry to local_audit_log and enqueue a sync op.
 * Soft-deletes set deleted_at; hard data is never removed locally.
 */

import { getDb, newId, now } from '../lib/db/database';
import { auditLogRepo } from './auditLogRepo';
import { syncQueueRepo } from './syncQueueRepo';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mapRow = (row) => {
  if (!row) return null;
  return {
    ...row,
    // Booleans stored as integers in SQLite
    isDeleted: Boolean(row.deleted_at),
  };
};

/**
 * Build an FTS5 prefix-match query from a free-text string.
 * Each whitespace-separated token becomes a quoted prefix term.
 * e.g. "alem tes" → '"alem"* "tes"*'
 * Quotes prevent FTS5 from treating the token as a column filter.
 */
const buildFtsQuery = (raw) =>
  raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => `"${t.replace(/"/g, '""')}"*`)
    .join(' ');

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Search patients using FTS5 (non-empty query) or full table scan (empty).
 *
 * FTS path   : patients_fts MATCH '<prefix>*' — ranked, fast, typo-tolerant prefix
 * Fallback   : full table scan ordered by full_name (list all / empty query)
 *
 * Excludes soft-deleted rows in both paths.
 */
export const searchPatients = async ({ query = '', facilityId, limit = 30 } = {}) => {
  const db = getDb();
  const q = query.trim();

  let rows;

  if (q.length > 0) {
    // ── FTS5 path ────────────────────────────────────────────────────────────
    // JOIN back to patients to get full row + apply deleted_at / facility filter.
    // patients_fts.rank is negative (lower = better), ORDER BY rank ASC.
    const ftsQuery = buildFtsQuery(q);
    rows = await db.getAllAsync(
      `SELECT p.*
       FROM patients p
       INNER JOIN patients_fts ON patients_fts.rowid = p.rowid
       WHERE patients_fts MATCH ?
         AND p.deleted_at IS NULL
         AND (? IS NULL OR p.facility_id = ?)
       ORDER BY patients_fts.rank
       LIMIT ?`,
      [ftsQuery, facilityId ?? null, facilityId ?? null, limit]
    );
  } else {
    // ── No query: list all patients, alphabetical ─────────────────────────
    rows = await db.getAllAsync(
      `SELECT * FROM patients
       WHERE deleted_at IS NULL
         AND (? IS NULL OR facility_id = ?)
       ORDER BY full_name COLLATE NOCASE
       LIMIT ?`,
      [facilityId ?? null, facilityId ?? null, limit]
    );
  }

  return rows.map(mapRow);
};

/**
 * Get a single patient by ID.
 */
export const getPatientById = async (id) => {
  const db = getDb();
  const row = await db.getFirstAsync(
    `SELECT * FROM patients WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
  return mapRow(row);
};

/**
 * List all patients for a given HEW (caseload).
 */
export const getHewCaseload = async ({ hewUserId, facilityId, limit = 100 } = {}) => {
  const db = getDb();
  const rows = await db.getAllAsync(
    `SELECT p.*,
            (SELECT MAX(v.visit_date) FROM visits v WHERE v.patient_id = p.id AND v.deleted_at IS NULL) AS last_visit_date
     FROM patients p
     WHERE p.deleted_at IS NULL
       AND p.hew_user_id = ?
       AND (? IS NULL OR p.facility_id = ?)
     ORDER BY last_visit_date ASC NULLS FIRST, p.full_name COLLATE NOCASE
     LIMIT ?`,
    [hewUserId, facilityId ?? null, facilityId ?? null, limit]
  );
  return rows.map(mapRow);
};

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Create a new patient locally and enqueue for sync.
 */
export const createPatient = async ({ data, actorUserId }) => {
  const db = getDb();
  const id = data.id ?? newId();
  const ts = now();

  const patient = {
    id,
    facility_id:   data.facility_id,
    tenant_id:     data.tenant_id,
    full_name:     data.full_name,
    date_of_birth: data.date_of_birth ?? null,
    sex:           data.sex ?? null,
    phone:         data.phone ?? null,
    village:       data.village ?? null,
    kebele:        data.kebele ?? null,
    woreda:        data.woreda ?? null,
    language:      data.language ?? 'am',
    hew_user_id:   data.hew_user_id ?? null,
    synced_at:     null,
    deleted_at:    null,
    created_at:    ts,
    updated_at:    ts,
  };

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO patients (id, facility_id, tenant_id, full_name, date_of_birth, sex, phone,
         village, kebele, woreda, language, hew_user_id, synced_at, deleted_at, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [patient.id, patient.facility_id, patient.tenant_id, patient.full_name, patient.date_of_birth,
       patient.sex, patient.phone, patient.village, patient.kebele, patient.woreda,
       patient.language, patient.hew_user_id, null, null, ts, ts]
    );

    await auditLogRepo.log({
      userId: actorUserId, action: 'create_patient',
      entityType: 'patients', entityId: id,
      newValue: patient,
    });

    await syncQueueRepo.enqueue({
      entityType: 'patients', entityId: id,
      opType: 'upsert', payload: patient,
    });
  });

  return patient;
};

/**
 * Update patient fields locally and enqueue for sync.
 */
export const updatePatient = async ({ id, updates, actorUserId }) => {
  const db = getDb();
  const ts = now();
  const existing = await getPatientById(id);
  if (!existing) throw new Error(`Patient ${id} not found`);

  const updated = { ...existing, ...updates, id, updated_at: ts };
  delete updated.isDeleted;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE patients SET full_name=?, date_of_birth=?, sex=?, phone=?,
         village=?, kebele=?, woreda=?, language=?, hew_user_id=?, updated_at=?
       WHERE id=?`,
      [updated.full_name, updated.date_of_birth, updated.sex, updated.phone,
       updated.village, updated.kebele, updated.woreda, updated.language,
       updated.hew_user_id, ts, id]
    );

    await auditLogRepo.log({
      userId: actorUserId, action: 'update_patient',
      entityType: 'patients', entityId: id,
      oldValue: existing, newValue: updated,
    });

    await syncQueueRepo.enqueue({
      entityType: 'patients', entityId: id,
      opType: 'upsert', payload: updated,
    });
  });

  return updated;
};

/**
 * Soft-delete a patient.
 */
export const deletePatient = async ({ id, actorUserId }) => {
  const db = getDb();
  const ts = now();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE patients SET deleted_at=?, updated_at=? WHERE id=?`,
      [ts, ts, id]
    );

    await auditLogRepo.log({
      userId: actorUserId, action: 'delete_patient',
      entityType: 'patients', entityId: id,
    });

    await syncQueueRepo.enqueue({
      entityType: 'patients', entityId: id,
      opType: 'delete', payload: { id, deleted_at: ts },
    });
  });
};

/**
 * Upsert a patient row received from the server during sync pull.
 * Does NOT enqueue for sync (already from server).
 */
export const upsertFromServer = async (serverPatient) => {
  const db = getDb();
  const ts = now();
  await db.runAsync(
    `INSERT INTO patients (id, facility_id, tenant_id, full_name, date_of_birth, sex, phone,
       village, kebele, woreda, language, hew_user_id, synced_at, deleted_at, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       full_name=excluded.full_name, date_of_birth=excluded.date_of_birth,
       sex=excluded.sex, phone=excluded.phone, village=excluded.village,
       kebele=excluded.kebele, woreda=excluded.woreda, language=excluded.language,
       hew_user_id=excluded.hew_user_id, deleted_at=excluded.deleted_at,
       synced_at=?, updated_at=excluded.updated_at`,
    [serverPatient.id, serverPatient.facility_id, serverPatient.tenant_id,
     serverPatient.full_name, serverPatient.date_of_birth ?? null, serverPatient.sex ?? null,
     serverPatient.phone ?? null, serverPatient.village ?? null, serverPatient.kebele ?? null,
     serverPatient.woreda ?? null, serverPatient.language ?? 'am', serverPatient.hew_user_id ?? null,
     ts, serverPatient.deleted_at ?? null,
     serverPatient.created_at ?? ts, serverPatient.updated_at ?? ts,
     ts]
  );
};

export const patientRepo = {
  search: searchPatients,
  getById: getPatientById,
  getCaseload: getHewCaseload,
  create: createPatient,
  update: updatePatient,
  delete: deletePatient,
  upsertFromServer,
};

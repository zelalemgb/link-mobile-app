/**
 * schema.js — Local SQLite schema for the offline-first clinician app
 *
 * Tables (W2-MOB-003):
 *   patients           — demographics, facility-scoped
 *   visits             — consultation header
 *   visit_vitals       — BP, temp, weight, SpO2, etc.
 *   visit_assessment   — chief complaint + SOAP summary
 *   visit_diagnosis    — ICD-lite coded diagnoses
 *   visit_treatment    — drug / dose / duration
 *   visit_referral     — referral flag + destination
 *   local_audit_log    — immutable who/when/what log
 *   sync_queue         — outbox for ops awaiting push to server
 *   sync_state         — per-entity-type cursor bookmarks for pull
 *
 * Versioning: bump SCHEMA_VERSION and add a migration in migrations.js
 * whenever you change any table definition.
 */

export const SCHEMA_VERSION = 2;

// ─── DDL statements ───────────────────────────────────────────────────────────

export const CREATE_PATIENTS = `
  CREATE TABLE IF NOT EXISTS patients (
    id              TEXT    PRIMARY KEY,            -- server UUID (or local tmp UUID)
    facility_id     TEXT    NOT NULL,
    tenant_id       TEXT    NOT NULL,
    full_name       TEXT    NOT NULL,
    date_of_birth   TEXT,                           -- ISO 8601 YYYY-MM-DD
    sex             TEXT    CHECK (sex IN ('male','female','other','unknown')),
    phone           TEXT,
    village         TEXT,
    kebele          TEXT,
    woreda          TEXT,
    language        TEXT    DEFAULT 'am',           -- 'am' | 'om' | 'en'
    hew_user_id     TEXT,                           -- assigned HEW (users.id)
    synced_at       TEXT,                           -- last successful sync timestamp
    deleted_at      TEXT,                           -- soft-delete (tombstone)
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )
`;

export const CREATE_VISITS = `
  CREATE TABLE IF NOT EXISTS visits (
    id              TEXT    PRIMARY KEY,
    patient_id      TEXT    NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    facility_id     TEXT    NOT NULL,
    tenant_id       TEXT    NOT NULL,
    clinician_id    TEXT    NOT NULL,               -- users.id
    visit_date      TEXT    NOT NULL,               -- ISO 8601
    visit_type      TEXT    DEFAULT 'outpatient'
                            CHECK (visit_type IN ('outpatient','inpatient','emergency','antenatal','postnatal','immunisation','other')),
    status          TEXT    NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft','completed','cancelled')),
    chief_complaint TEXT,
    outcome         TEXT    CHECK (outcome IN ('discharged','admitted','referred','follow_up','deceased',NULL)),
    follow_up_date  TEXT,
    notes           TEXT,
    synced_at       TEXT,
    deleted_at      TEXT,
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )
`;

export const CREATE_VISIT_VITALS = `
  CREATE TABLE IF NOT EXISTS visit_vitals (
    id              TEXT    PRIMARY KEY,
    visit_id        TEXT    NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    bp_systolic     INTEGER,                        -- mmHg
    bp_diastolic    INTEGER,                        -- mmHg
    heart_rate      INTEGER,                        -- bpm
    temperature     REAL,                           -- °C
    weight_kg       REAL,
    height_cm       REAL,
    spo2_pct        INTEGER,                        -- 0-100
    respiratory_rate INTEGER,                       -- breaths/min
    muac_mm         INTEGER,                        -- mid-upper arm circumference
    recorded_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )
`;

export const CREATE_VISIT_ASSESSMENT = `
  CREATE TABLE IF NOT EXISTS visit_assessment (
    id              TEXT    PRIMARY KEY,
    visit_id        TEXT    NOT NULL UNIQUE REFERENCES visits(id) ON DELETE CASCADE,
    history_text    TEXT,                           -- HPI free text
    examination_text TEXT,                          -- O: findings
    assessment_text TEXT,                           -- A: summary
    plan_text       TEXT,                           -- P: management plan
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )
`;

export const CREATE_VISIT_DIAGNOSIS = `
  CREATE TABLE IF NOT EXISTS visit_diagnosis (
    id              TEXT    PRIMARY KEY,
    visit_id        TEXT    NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    icd_code        TEXT,                           -- ICD-10 / local code
    display_name    TEXT    NOT NULL,
    diagnosis_type  TEXT    DEFAULT 'primary'
                            CHECK (diagnosis_type IN ('primary','secondary','complication','differential')),
    certainty       TEXT    DEFAULT 'confirmed'
                            CHECK (certainty IN ('confirmed','suspected','ruled_out')),
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )
`;

export const CREATE_VISIT_TREATMENT = `
  CREATE TABLE IF NOT EXISTS visit_treatment (
    id              TEXT    PRIMARY KEY,
    visit_id        TEXT    NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    drug_name       TEXT    NOT NULL,
    dose            TEXT    NOT NULL,               -- e.g. "500 mg"
    route           TEXT    DEFAULT 'oral'
                            CHECK (route IN ('oral','im','iv','topical','inhaled','sublingual','other')),
    frequency       TEXT,                           -- e.g. "TID", "BD"
    duration_days   INTEGER,
    quantity        INTEGER,                        -- dispensed units
    instructions    TEXT,
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )
`;

export const CREATE_VISIT_REFERRAL = `
  CREATE TABLE IF NOT EXISTS visit_referral (
    id              TEXT    PRIMARY KEY,
    visit_id        TEXT    NOT NULL UNIQUE REFERENCES visits(id) ON DELETE CASCADE,
    is_referred     INTEGER NOT NULL DEFAULT 0,     -- 0 = false, 1 = true
    destination     TEXT,                           -- facility name or level
    destination_id  TEXT,                           -- facility UUID if known
    urgency         TEXT    DEFAULT 'routine'
                            CHECK (urgency IN ('emergency','urgent','routine')),
    reason          TEXT,
    transport       TEXT    CHECK (transport IN ('ambulance','self','community',NULL)),
    status          TEXT    DEFAULT 'pending'
                            CHECK (status IN ('pending','received','completed','cancelled')),
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )
`;

export const CREATE_LOCAL_AUDIT_LOG = `
  CREATE TABLE IF NOT EXISTS local_audit_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         TEXT    NOT NULL,
    action          TEXT    NOT NULL,               -- e.g. 'create_visit', 'update_patient'
    entity_type     TEXT    NOT NULL,               -- table name
    entity_id       TEXT    NOT NULL,
    old_value       TEXT,                           -- JSON snapshot before
    new_value       TEXT,                           -- JSON snapshot after
    device_id       TEXT,
    occurred_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )
`;

export const CREATE_SYNC_QUEUE = `
  CREATE TABLE IF NOT EXISTS sync_queue (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    op_id           TEXT    NOT NULL UNIQUE,        -- client UUID, idempotency key
    entity_type     TEXT    NOT NULL,
    entity_id       TEXT    NOT NULL,
    op_type         TEXT    NOT NULL CHECK (op_type IN ('upsert','delete')),
    payload         TEXT    NOT NULL,               -- JSON string
    attempts        INTEGER NOT NULL DEFAULT 0,
    last_error      TEXT,
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )
`;

export const CREATE_SYNC_STATE = `
  CREATE TABLE IF NOT EXISTS sync_state (
    entity_type     TEXT    PRIMARY KEY,            -- e.g. 'patients', 'visits'
    pull_cursor     TEXT,                           -- last seq received from server
    last_pushed_at  TEXT,
    last_pulled_at  TEXT,
    updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )
`;

// ─── Indexes ──────────────────────────────────────────────────────────────────

export const CREATE_INDEXES = [
  // patients
  `CREATE INDEX IF NOT EXISTS idx_patients_facility   ON patients(facility_id, updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_patients_hew        ON patients(hew_user_id, updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_patients_name       ON patients(full_name COLLATE NOCASE)`,
  `CREATE INDEX IF NOT EXISTS idx_patients_deleted    ON patients(deleted_at) WHERE deleted_at IS NULL`,

  // visits
  `CREATE INDEX IF NOT EXISTS idx_visits_patient      ON visits(patient_id, visit_date DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_visits_clinician    ON visits(clinician_id, visit_date DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_visits_facility     ON visits(facility_id, visit_date DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_visits_status       ON visits(status, updated_at DESC)`,

  // sync_queue — most critical for flush performance
  `CREATE INDEX IF NOT EXISTS idx_sync_queue_entity   ON sync_queue(entity_type, entity_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sync_queue_attempts ON sync_queue(attempts ASC, created_at ASC)`,

  // audit log
  `CREATE INDEX IF NOT EXISTS idx_audit_entity        ON local_audit_log(entity_type, entity_id)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_user          ON local_audit_log(user_id, occurred_at DESC)`,
];

// ─── FTS5 virtual table + sync triggers (W2-MOB-004) ─────────────────────────
// Content table approach: FTS5 mirrors the patients table.
// Triggers keep the index in sync on INSERT / UPDATE / DELETE.
// Supports prefix queries: "Alem*" matches "Alemitu", "Alem Bek" matches both tokens.

export const CREATE_PATIENTS_FTS = `
  CREATE VIRTUAL TABLE IF NOT EXISTS patients_fts USING fts5(
    full_name,
    phone,
    village,
    kebele,
    woreda,
    content='patients',
    content_rowid='rowid'
  )
`;

// After INSERT: add new row to FTS index
export const CREATE_FTS_TRIGGER_INSERT = `
  CREATE TRIGGER IF NOT EXISTS patients_fts_ai
  AFTER INSERT ON patients BEGIN
    INSERT INTO patients_fts(rowid, full_name, phone, village, kebele, woreda)
    VALUES (new.rowid, new.full_name, new.phone, new.village, new.kebele, new.woreda);
  END
`;

// After DELETE: remove old row from FTS index
export const CREATE_FTS_TRIGGER_DELETE = `
  CREATE TRIGGER IF NOT EXISTS patients_fts_ad
  AFTER DELETE ON patients BEGIN
    INSERT INTO patients_fts(patients_fts, rowid, full_name, phone, village, kebele, woreda)
    VALUES ('delete', old.rowid, old.full_name, old.phone, old.village, old.kebele, old.woreda);
  END
`;

// After UPDATE: delete old entry, insert new entry
export const CREATE_FTS_TRIGGER_UPDATE = `
  CREATE TRIGGER IF NOT EXISTS patients_fts_au
  AFTER UPDATE ON patients BEGIN
    INSERT INTO patients_fts(patients_fts, rowid, full_name, phone, village, kebele, woreda)
    VALUES ('delete', old.rowid, old.full_name, old.phone, old.village, old.kebele, old.woreda);
    INSERT INTO patients_fts(rowid, full_name, phone, village, kebele, woreda)
    VALUES (new.rowid, new.full_name, new.phone, new.village, new.kebele, new.woreda);
  END
`;

// ─── All DDL in creation order ────────────────────────────────────────────────

export const ALL_DDL = [
  CREATE_PATIENTS,
  CREATE_VISITS,
  CREATE_VISIT_VITALS,
  CREATE_VISIT_ASSESSMENT,
  CREATE_VISIT_DIAGNOSIS,
  CREATE_VISIT_TREATMENT,
  CREATE_VISIT_REFERRAL,
  CREATE_LOCAL_AUDIT_LOG,
  CREATE_SYNC_QUEUE,
  CREATE_SYNC_STATE,
  ...CREATE_INDEXES,
  // FTS (must come after patients table)
  CREATE_PATIENTS_FTS,
  CREATE_FTS_TRIGGER_INSERT,
  CREATE_FTS_TRIGGER_DELETE,
  CREATE_FTS_TRIGGER_UPDATE,
];

// ─── FTS population helper (used in migration v1→v2) ─────────────────────────
// Backfills the FTS index from existing patients rows.
export const FTS_BACKFILL_SQL =
  `INSERT INTO patients_fts(rowid, full_name, phone, village, kebele, woreda)
   SELECT rowid, full_name, phone, village, kebele, woreda FROM patients`;

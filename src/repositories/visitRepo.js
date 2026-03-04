/**
 * visitRepo.js — Local CRUD for visits and all visit sub-tables
 *
 * Sub-tables written in the same transaction as the visit:
 *   visit_vitals, visit_assessment, visit_diagnosis, visit_treatment, visit_referral
 *
 * Each write audit-logs and enqueues an op for sync.
 */

import { getDb, newId, now } from '../lib/db/database';
import { auditLogRepo } from './auditLogRepo';
import { syncQueueRepo } from './syncQueueRepo';

// ─── Read ─────────────────────────────────────────────────────────────────────

export const getVisitsByPatient = async (patientId, { limit = 20 } = {}) => {
  const db = getDb();
  const visits = await db.getAllAsync(
    `SELECT v.*,
       (SELECT json_object('bp_systolic', vv.bp_systolic, 'bp_diastolic', vv.bp_diastolic,
          'temperature', vv.temperature, 'weight_kg', vv.weight_kg, 'spo2_pct', vv.spo2_pct)
        FROM visit_vitals vv WHERE vv.visit_id = v.id LIMIT 1) AS vitals_json,
       (SELECT json_group_array(json_object('display_name', vd.display_name, 'icd_code', vd.icd_code))
        FROM visit_diagnosis vd WHERE vd.visit_id = v.id) AS diagnoses_json
     FROM visits v
     WHERE v.patient_id = ? AND v.deleted_at IS NULL
     ORDER BY v.visit_date DESC
     LIMIT ?`,
    [patientId, limit]
  );
  return visits.map((v) => ({
    ...v,
    vitals: v.vitals_json ? JSON.parse(v.vitals_json) : null,
    diagnoses: v.diagnoses_json ? JSON.parse(v.diagnoses_json) : [],
  }));
};

export const getVisitById = async (visitId) => {
  const db = getDb();
  const [visit, vitals, assessment, diagnoses, treatments, referral] = await Promise.all([
    db.getFirstAsync(`SELECT * FROM visits WHERE id = ? AND deleted_at IS NULL`, [visitId]),
    db.getFirstAsync(`SELECT * FROM visit_vitals WHERE visit_id = ?`, [visitId]),
    db.getFirstAsync(`SELECT * FROM visit_assessment WHERE visit_id = ?`, [visitId]),
    db.getAllAsync(`SELECT * FROM visit_diagnosis WHERE visit_id = ?`, [visitId]),
    db.getAllAsync(`SELECT * FROM visit_treatment WHERE visit_id = ?`, [visitId]),
    db.getFirstAsync(`SELECT * FROM visit_referral WHERE visit_id = ?`, [visitId]),
  ]);
  if (!visit) return null;
  return { ...visit, vitals, assessment, diagnoses, treatments, referral };
};

// ─── Create full visit ────────────────────────────────────────────────────────

/**
 * Create a visit with all sub-records in a single transaction.
 *
 * @param {object} opts
 * @param {object} opts.visitData     — visit header fields
 * @param {object} [opts.vitals]      — visit_vitals fields (optional)
 * @param {object} [opts.assessment]  — visit_assessment fields (optional)
 * @param {Array}  [opts.diagnoses]   — array of visit_diagnosis objects
 * @param {Array}  [opts.treatments]  — array of visit_treatment objects
 * @param {object} [opts.referral]    — visit_referral fields (optional)
 * @param {string} opts.actorUserId
 */
export const createVisit = async ({
  visitData, vitals, assessment, diagnoses = [], treatments = [], referral, actorUserId,
}) => {
  const db = getDb();
  const visitId = visitData.id ?? newId();
  const ts = now();

  const visit = {
    id: visitId,
    patient_id:     visitData.patient_id,
    facility_id:    visitData.facility_id,
    tenant_id:      visitData.tenant_id,
    clinician_id:   actorUserId,
    visit_date:     visitData.visit_date ?? ts,
    visit_type:     visitData.visit_type ?? 'outpatient',
    status:         visitData.status ?? 'draft',
    chief_complaint: visitData.chief_complaint ?? null,
    outcome:        visitData.outcome ?? null,
    follow_up_date: visitData.follow_up_date ?? null,
    notes:          visitData.notes ?? null,
    synced_at:      null,
    deleted_at:     null,
    created_at:     ts,
    updated_at:     ts,
  };

  await db.withTransactionAsync(async () => {
    // Visit header
    await db.runAsync(
      `INSERT INTO visits (id,patient_id,facility_id,tenant_id,clinician_id,visit_date,visit_type,
         status,chief_complaint,outcome,follow_up_date,notes,synced_at,deleted_at,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [visit.id, visit.patient_id, visit.facility_id, visit.tenant_id, visit.clinician_id,
       visit.visit_date, visit.visit_type, visit.status, visit.chief_complaint, visit.outcome,
       visit.follow_up_date, visit.notes, null, null, ts, ts]
    );

    // Vitals
    if (vitals) {
      const vId = newId();
      await db.runAsync(
        `INSERT INTO visit_vitals (id,visit_id,bp_systolic,bp_diastolic,heart_rate,temperature,
           weight_kg,height_cm,spo2_pct,respiratory_rate,muac_mm,recorded_at,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [vId, visitId, vitals.bp_systolic ?? null, vitals.bp_diastolic ?? null,
         vitals.heart_rate ?? null, vitals.temperature ?? null, vitals.weight_kg ?? null,
         vitals.height_cm ?? null, vitals.spo2_pct ?? null, vitals.respiratory_rate ?? null,
         vitals.muac_mm ?? null, ts, ts, ts]
      );
    }

    // Assessment
    if (assessment) {
      const aId = newId();
      await db.runAsync(
        `INSERT INTO visit_assessment (id,visit_id,history_text,examination_text,assessment_text,plan_text,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?)`,
        [aId, visitId, assessment.history_text ?? null, assessment.examination_text ?? null,
         assessment.assessment_text ?? null, assessment.plan_text ?? null, ts, ts]
      );
    }

    // Diagnoses
    for (const dx of diagnoses) {
      await db.runAsync(
        `INSERT INTO visit_diagnosis (id,visit_id,icd_code,display_name,diagnosis_type,certainty,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?)`,
        [dx.id ?? newId(), visitId, dx.icd_code ?? null, dx.display_name,
         dx.diagnosis_type ?? 'primary', dx.certainty ?? 'confirmed', ts, ts]
      );
    }

    // Treatments
    for (const tx of treatments) {
      await db.runAsync(
        `INSERT INTO visit_treatment (id,visit_id,drug_name,dose,route,frequency,duration_days,quantity,instructions,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [tx.id ?? newId(), visitId, tx.drug_name, tx.dose, tx.route ?? 'oral',
         tx.frequency ?? null, tx.duration_days ?? null, tx.quantity ?? null,
         tx.instructions ?? null, ts, ts]
      );
    }

    // Referral
    if (referral) {
      await db.runAsync(
        `INSERT INTO visit_referral (id,visit_id,is_referred,destination,destination_id,urgency,reason,transport,status,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [newId(), visitId, referral.is_referred ? 1 : 0, referral.destination ?? null,
         referral.destination_id ?? null, referral.urgency ?? 'routine',
         referral.reason ?? null, referral.transport ?? null, 'pending', ts, ts]
      );
    }

    // Audit + sync
    await auditLogRepo.log({
      userId: actorUserId, action: 'create_visit',
      entityType: 'visits', entityId: visitId, newValue: visit,
    });

    await syncQueueRepo.enqueue({
      entityType: 'visits', entityId: visitId,
      opType: 'upsert',
      payload: { ...visit, vitals, assessment, diagnoses, treatments, referral },
    });
  });

  return getVisitById(visitId);
};

/**
 * Update visit status / outcome / notes (common partial update).
 */
export const updateVisit = async ({ id, updates, actorUserId }) => {
  const db = getDb();
  const ts = now();
  const existing = await db.getFirstAsync(
    `SELECT * FROM visits WHERE id = ? AND deleted_at IS NULL`, [id]
  );
  if (!existing) throw new Error(`Visit ${id} not found`);

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE visits SET status=?, outcome=?, follow_up_date=?, notes=?, chief_complaint=?, updated_at=?
       WHERE id=?`,
      [updates.status ?? existing.status, updates.outcome ?? existing.outcome,
       updates.follow_up_date ?? existing.follow_up_date, updates.notes ?? existing.notes,
       updates.chief_complaint ?? existing.chief_complaint, ts, id]
    );

    await auditLogRepo.log({
      userId: actorUserId, action: 'update_visit',
      entityType: 'visits', entityId: id, oldValue: existing,
      newValue: { ...existing, ...updates, updated_at: ts },
    });

    await syncQueueRepo.enqueue({
      entityType: 'visits', entityId: id, opType: 'upsert',
      payload: { ...existing, ...updates, updated_at: ts },
    });
  });

  return getVisitById(id);
};

/**
 * Upsert a visit row received from server sync pull.
 * Mirrors local create/update shape and writes known sub-sections when present.
 * Does NOT enqueue for sync.
 */
export const upsertFromServer = async (serverVisit) => {
  const db = getDb();
  const ts = now();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO visits (id,patient_id,facility_id,tenant_id,clinician_id,visit_date,visit_type,
         status,chief_complaint,outcome,follow_up_date,notes,synced_at,deleted_at,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         patient_id=excluded.patient_id,
         facility_id=excluded.facility_id,
         tenant_id=excluded.tenant_id,
         clinician_id=excluded.clinician_id,
         visit_date=excluded.visit_date,
         visit_type=excluded.visit_type,
         status=excluded.status,
         chief_complaint=excluded.chief_complaint,
         outcome=excluded.outcome,
         follow_up_date=excluded.follow_up_date,
         notes=excluded.notes,
         synced_at=excluded.synced_at,
         deleted_at=excluded.deleted_at,
         updated_at=excluded.updated_at`,
      [
        serverVisit.id,
        serverVisit.patient_id,
        serverVisit.facility_id,
        serverVisit.tenant_id,
        serverVisit.clinician_id ?? 'unknown',
        serverVisit.visit_date ?? ts,
        serverVisit.visit_type ?? 'outpatient',
        serverVisit.status ?? 'draft',
        serverVisit.chief_complaint ?? null,
        serverVisit.outcome ?? null,
        serverVisit.follow_up_date ?? null,
        serverVisit.notes ?? null,
        ts,
        serverVisit.deleted_at ?? null,
        serverVisit.created_at ?? ts,
        serverVisit.updated_at ?? ts,
      ]
    );

    if (serverVisit.vitals && typeof serverVisit.vitals === 'object') {
      const vitals = serverVisit.vitals;
      await db.runAsync(`DELETE FROM visit_vitals WHERE visit_id = ?`, [serverVisit.id]);
      await db.runAsync(
        `INSERT INTO visit_vitals (id,visit_id,bp_systolic,bp_diastolic,heart_rate,temperature,
           weight_kg,height_cm,spo2_pct,respiratory_rate,muac_mm,recorded_at,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          vitals.id ?? newId(),
          serverVisit.id,
          vitals.bp_systolic ?? null,
          vitals.bp_diastolic ?? null,
          vitals.heart_rate ?? null,
          vitals.temperature ?? null,
          vitals.weight_kg ?? null,
          vitals.height_cm ?? null,
          vitals.spo2_pct ?? null,
          vitals.respiratory_rate ?? null,
          vitals.muac_mm ?? null,
          vitals.recorded_at ?? ts,
          vitals.created_at ?? ts,
          vitals.updated_at ?? ts,
        ]
      );
    }

    if (serverVisit.assessment && typeof serverVisit.assessment === 'object') {
      const assessment = serverVisit.assessment;
      await db.runAsync(
        `INSERT INTO visit_assessment (id,visit_id,history_text,examination_text,assessment_text,plan_text,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?)
         ON CONFLICT(visit_id) DO UPDATE SET
           history_text=excluded.history_text,
           examination_text=excluded.examination_text,
           assessment_text=excluded.assessment_text,
           plan_text=excluded.plan_text,
           updated_at=excluded.updated_at`,
        [
          assessment.id ?? newId(),
          serverVisit.id,
          assessment.history_text ?? null,
          assessment.examination_text ?? null,
          assessment.assessment_text ?? null,
          assessment.plan_text ?? null,
          assessment.created_at ?? ts,
          assessment.updated_at ?? ts,
        ]
      );
    }

    if (Array.isArray(serverVisit.diagnoses)) {
      await db.runAsync(`DELETE FROM visit_diagnosis WHERE visit_id = ?`, [serverVisit.id]);
      for (const dx of serverVisit.diagnoses) {
        await db.runAsync(
          `INSERT INTO visit_diagnosis (id,visit_id,icd_code,display_name,diagnosis_type,certainty,created_at,updated_at)
           VALUES (?,?,?,?,?,?,?,?)`,
          [
            dx.id ?? newId(),
            serverVisit.id,
            dx.icd_code ?? null,
            dx.display_name ?? 'Unknown diagnosis',
            dx.diagnosis_type ?? 'primary',
            dx.certainty ?? 'confirmed',
            dx.created_at ?? ts,
            dx.updated_at ?? ts,
          ]
        );
      }
    }

    if (Array.isArray(serverVisit.treatments)) {
      await db.runAsync(`DELETE FROM visit_treatment WHERE visit_id = ?`, [serverVisit.id]);
      for (const tx of serverVisit.treatments) {
        await db.runAsync(
          `INSERT INTO visit_treatment (id,visit_id,drug_name,dose,route,frequency,duration_days,quantity,instructions,created_at,updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          [
            tx.id ?? newId(),
            serverVisit.id,
            tx.drug_name ?? 'Unknown drug',
            tx.dose ?? 'N/A',
            tx.route ?? 'oral',
            tx.frequency ?? null,
            tx.duration_days ?? null,
            tx.quantity ?? null,
            tx.instructions ?? null,
            tx.created_at ?? ts,
            tx.updated_at ?? ts,
          ]
        );
      }
    }

    if (serverVisit.referral && typeof serverVisit.referral === 'object') {
      const referral = serverVisit.referral;
      await db.runAsync(
        `INSERT INTO visit_referral (id,visit_id,is_referred,destination,destination_id,urgency,reason,transport,status,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(visit_id) DO UPDATE SET
           is_referred=excluded.is_referred,
           destination=excluded.destination,
           destination_id=excluded.destination_id,
           urgency=excluded.urgency,
           reason=excluded.reason,
           transport=excluded.transport,
           status=excluded.status,
           updated_at=excluded.updated_at`,
        [
          referral.id ?? newId(),
          serverVisit.id,
          referral.is_referred ? 1 : 0,
          referral.destination ?? null,
          referral.destination_id ?? null,
          referral.urgency ?? 'routine',
          referral.reason ?? null,
          referral.transport ?? null,
          referral.status ?? 'pending',
          referral.created_at ?? ts,
          referral.updated_at ?? ts,
        ]
      );
    }
  });
};

// ─── W2-MOB-013 Performance budget gate ───────────────────────────────────────

/**
 * Hard budget for a full save-visit transaction (visit header + up to 5 sub-tables
 * + audit + sync-queue enqueue) on a low-spec Android device.
 *
 * This is a deterministic gate: any call exceeding the budget emits a
 * console.warn + non-blocking audit event so regressions surface in QA
 * logs before they hit users.  The threshold is intentionally conservative
 * (1 000 ms) to leave headroom on mid-range devices.
 */
export const SAVE_VISIT_PERF_BUDGET_MS = 1_000;

/**
 * Instrumented create-visit entry-point used by all UI callers (W2-MOB-013).
 *
 * Behaviour:
 * - Delegates to `createVisit` unchanged.
 * - On success, measures wall-clock elapsed time.
 * - When elapsed > SAVE_VISIT_PERF_BUDGET_MS:
 *   • Emits console.warn with visit ID, elapsed, and budget.
 *   • Fire-and-forgets a `perf_budget_exceeded` audit event (never blocks).
 * - On error, re-throws immediately (elapsed is still logged as a warn).
 */
export const saveVisit = async ({
  visitData,
  vitals,
  assessment,
  diagnoses,
  treatments,
  referral,
  actorUserId,
}) => {
  const startMs = Date.now();
  let result = null;

  try {
    result = await createVisit({
      visitData,
      vitals,
      assessment,
      diagnoses,
      treatments,
      referral,
      actorUserId,
    });
    return result;
  } catch (err) {
    throw err;
  } finally {
    const elapsedMs = Date.now() - startMs;
    if (elapsedMs > SAVE_VISIT_PERF_BUDGET_MS) {
      const visitId = result?.id ?? 'unknown';
      console.warn(
        `[perf][W2-MOB-013] saveVisit exceeded budget: ` +
        `elapsed=${elapsedMs}ms budget=${SAVE_VISIT_PERF_BUDGET_MS}ms visitId=${visitId}`
      );
      // Fire-and-forget: audit failure must never block or mask the save result.
      auditLogRepo
        .log({
          userId: actorUserId ?? 'system',
          action: 'perf_budget_exceeded',
          entityType: 'visits',
          entityId: visitId,
          newValue: {
            budgetMs: SAVE_VISIT_PERF_BUDGET_MS,
            elapsedMs,
            operation: 'saveVisit',
          },
        })
        .catch(() => {});
    }
  }
};

export const visitRepo = {
  getByPatient: getVisitsByPatient,
  getById: getVisitById,
  create: createVisit,
  save: saveVisit,          // W2-MOB-013: perf-instrumented alias for UI callers
  update: updateVisit,
  upsertFromServer,
};

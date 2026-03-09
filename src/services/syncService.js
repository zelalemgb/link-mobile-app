/**
 * syncService.js — W2-MOB-020/021 sync engine client
 *
 * Responsibilities:
 * - Flush local outbox (`sync_queue`) to `POST /api/sync/push`
 * - Pull remote deltas from `GET /api/sync/pull`
 * - Apply pulled ops/tombstones to local SQLite
 */

import { api } from '../lib/api';
import { getItem, setItem } from '../lib/storage';
import { getDb, newId, now } from '../lib/db/database';
import { syncQueueRepo } from '../repositories/syncQueueRepo';
import { patientRepo } from '../repositories/patientRepo';
import { visitRepo } from '../repositories/visitRepo';

const DEVICE_ID_STORAGE_KEY = 'linkhc_sync_device_id';
const SCOPE_STORAGE_KEY = 'linkhc_sync_scope';
const CONFLICT_AUDIT_STORAGE_KEY = 'linkhc_sync_conflict_audit';
const GLOBAL_CURSOR_KEY = 'global';

const DEFAULT_PUSH_BATCH_SIZE = 50;
const DEFAULT_PUSH_MAX_BATCHES = 20;
const DEFAULT_PULL_LIMIT = 200;
const DEFAULT_PULL_MAX_PAGES = 5;
const DEFAULT_CONFLICT_AUDIT_LIMIT = 100;

const BACKOFF_BASE_MS = 1000;       // 1 second
const BACKOFF_MAX_MS = 5 * 60 * 1000; // 5 minutes max
const BACKOFF_JITTER_FACTOR = 0.3;   // ±30% jitter

const calculateBackoff = (attempt) => {
  const exponential = Math.min(BACKOFF_BASE_MS * Math.pow(2, attempt), BACKOFF_MAX_MS);
  const jitter = exponential * BACKOFF_JITTER_FACTOR * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(exponential + jitter));
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let inFlightSync = null;

const toScope = (candidate) => {
  if (!candidate || typeof candidate !== 'object') return null;
  const facilityId = String(candidate.facilityId || candidate.facility_id || '').trim();
  const tenantId = String(candidate.tenantId || candidate.tenant_id || '').trim();
  const profileId = String(candidate.profileId || candidate.profile_id || candidate.id || '').trim();
  if (!facilityId || !tenantId) return null;
  return { facilityId, tenantId, profileId: profileId || null };
};

const cacheScope = async (scope) => {
  if (!scope) return;
  try {
    await setItem(SCOPE_STORAGE_KEY, scope);
  } catch {
    // Non-fatal cache miss.
  }
};

const loadCachedScope = async () => {
  try {
    const cached = await getItem(SCOPE_STORAGE_KEY, null);
    return toScope(cached);
  } catch {
    return null;
  }
};

const resolveScopeFromAuth = async () => {
  try {
    const response = await api.get('/auth/user');
    const scope = toScope(response?.user);
    if (scope) {
      await cacheScope(scope);
    }
    return scope;
  } catch {
    return null;
  }
};

const resolveScopeFromQueue = async () => {
  const next = await syncQueueRepo.getNextBatch({ limit: 1 });
  if (!next.length) return null;
  const payload = next[0]?.payload;
  const scope = toScope(payload);
  if (scope) {
    await cacheScope(scope);
  }
  return scope;
};

const resolveSyncScope = async () => {
  const fromAuth = await resolveScopeFromAuth();
  if (fromAuth) return fromAuth;

  const cached = await loadCachedScope();
  if (cached) return cached;

  return resolveScopeFromQueue();
};

const getOrCreateDeviceId = async () => {
  const existing = await getItem(DEVICE_ID_STORAGE_KEY, null);
  if (existing && typeof existing === 'string' && existing.trim()) {
    return existing.trim();
  }
  const created = newId();
  await setItem(DEVICE_ID_STORAGE_KEY, created);
  return created;
};

const parsePushResult = (response) => {
  const results = Array.isArray(response?.results) ? response.results : [];
  const map = new Map();
  for (const result of results) {
    if (result?.opId) {
      map.set(String(result.opId), result);
    }
  }
  return map;
};

const normalizeConflictAuditRows = (rows) => {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row) => row && typeof row === 'object' && row.id)
    .map((row) => ({
      id: String(row.id),
      at: String(row.at || now()),
      opId: String(row.opId || ''),
      entityType: String(row.entityType || ''),
      entityId: String(row.entityId || ''),
      conflictReason: String(row.conflictReason || 'Conflict reported by server'),
    }));
};

const loadConflictAuditTrail = async () => {
  try {
    const stored = await getItem(CONFLICT_AUDIT_STORAGE_KEY, []);
    return normalizeConflictAuditRows(stored);
  } catch {
    return [];
  }
};

const saveConflictAuditTrail = async (rows) => {
  const normalized = normalizeConflictAuditRows(rows);
  await setItem(CONFLICT_AUDIT_STORAGE_KEY, normalized.slice(0, DEFAULT_CONFLICT_AUDIT_LIMIT));
};

const appendConflictAuditRows = async (rows) => {
  const normalizedNew = normalizeConflictAuditRows(rows);
  if (!normalizedNew.length) return;
  const existing = await loadConflictAuditTrail();
  await saveConflictAuditTrail([...normalizedNew, ...existing]);
};

export const getConflictAuditTrail = async ({ limit = 20 } = {}) => {
  const all = await loadConflictAuditTrail();
  return all.slice(0, Math.max(0, limit));
};

export const clearConflictAuditTrail = async () => {
  await setItem(CONFLICT_AUDIT_STORAGE_KEY, []);
};

const buildPushOps = (rows) =>
  rows.map((row) => ({
    opId: String(row.op_id),
    entityType: String(row.entity_type),
    entityId: String(row.entity_id),
    opType: row.op_type === 'delete' ? 'delete' : 'upsert',
    data: row.payload ?? null,
    clientCreatedAt: String(row.updated_at || row.created_at || now()),
  }));

const markBatchFailed = async (rows, reason) => {
  for (const row of rows) {
    await syncQueueRepo.markFailed(row.op_id, reason);
  }
};

const pushOneBatch = async ({
  scope,
  deviceId,
  batchSize,
}) => {
  const rows = await syncQueueRepo.getNextBatch({ limit: batchSize });
  if (!rows.length) {
    return { pushed: 0, conflicts: 0, failed: 0, done: true };
  }

  const ops = buildPushOps(rows);
  const payload = {
    facilityId: scope.facilityId,
    deviceId,
    ops,
  };

  try {
    const response = await api.post('/sync/push', payload);
    const resultByOpId = parsePushResult(response);
    const conflictAuditRows = [];

    let pushed = 0;
    let conflicts = 0;
    let failed = 0;

    for (const row of rows) {
      const opId = String(row.op_id);
      const result = resultByOpId.get(opId);

      if (!result) {
        failed += 1;
        await syncQueueRepo.markFailed(opId, 'Missing op result from push response');
        continue;
      }

      const status = String(result.status || '');
      if (status === 'ingested' || status === 'duplicate' || status === 'conflict') {
        await syncQueueRepo.markSynced(opId);
        await syncQueueRepo.setLastPushedAt(String(row.entity_type));
        pushed += 1;
        if (status === 'conflict') {
          conflicts += 1;
          conflictAuditRows.push({
            id: newId(),
            at: now(),
            opId,
            entityType: String(row.entity_type || ''),
            entityId: String(row.entity_id || ''),
            conflictReason: String(result?.conflictReason || 'SERVER_WINS_LWW'),
          });
        }
      } else {
        failed += 1;
        await syncQueueRepo.markFailed(opId, `Unexpected push status: ${status || 'unknown'}`);
      }
    }

    if (conflictAuditRows.length > 0) {
      await appendConflictAuditRows(conflictAuditRows);
    }

    return { pushed, conflicts, failed, done: false };
  } catch (error) {
    const code = String(error?.code || '');
    const message = String(error?.message || 'push failed');
    const reason = code ? `${code}: ${message}` : message;
    await markBatchFailed(rows, reason);
    // Exponential backoff before next retry
    const maxAttempt = Math.max(...rows.map(r => r.attempts || 0));
    const backoffMs = calculateBackoff(maxAttempt);
    if (backoffMs > 0) {
      await sleep(backoffMs);
    }
    return { pushed: 0, conflicts: 0, failed: rows.length, done: false };
  }
};

export const flushOutboxToPushApi = async ({
  scope,
  batchSize = DEFAULT_PUSH_BATCH_SIZE,
  maxBatches = DEFAULT_PUSH_MAX_BATCHES,
} = {}) => {
  const resolvedScope = scope || (await resolveSyncScope());
  if (!resolvedScope) {
    throw new Error('Unable to resolve sync scope (facility/tenant)');
  }

  const deviceId = await getOrCreateDeviceId();

  let pushed = 0;
  let conflicts = 0;
  let failed = 0;
  let batches = 0;

  while (batches < maxBatches) {
    const result = await pushOneBatch({
      scope: resolvedScope,
      deviceId,
      batchSize,
    });

    if (result.done) break;

    pushed += result.pushed;
    conflicts += result.conflicts;
    failed += result.failed;
    batches += 1;

    if (result.failed > 0 && result.pushed === 0) {
      // Stop on fatal batch-level failure; retries are managed by attempt counters.
      break;
    }
  }

  return {
    scope: resolvedScope,
    pushed,
    conflicts,
    failed,
    batches,
  };
};

const applyTombstoneLocally = async (tombstone) => {
  const db = getDb();
  const entityType = String(tombstone?.entityType || '');
  const entityId = String(tombstone?.entityId || '');
  const deletedAt = String(tombstone?.deletedAt || now());

  if (!entityType || !entityId) return false;

  switch (entityType) {
    case 'patients':
      await db.runAsync(
        `UPDATE patients SET deleted_at = ?, updated_at = ? WHERE id = ?`,
        [deletedAt, now(), entityId]
      );
      return true;
    case 'visits':
      await db.runAsync(
        `UPDATE visits SET deleted_at = ?, updated_at = ? WHERE id = ?`,
        [deletedAt, now(), entityId]
      );
      return true;
    default:
      return false;
  }
};

const applyPulledOp = async (op) => {
  const entityType = String(op?.entityType || '').toLowerCase();
  const opType = String(op?.opType || '').toLowerCase();
  const data = op?.data && typeof op.data === 'object' ? op.data : null;

  if (!entityType || !opType) return false;

  if (opType === 'delete') {
    const deletedAt = String(data?.deleted_at || now());
    return applyTombstoneLocally({
      entityType,
      entityId: op?.entityId,
      deletedAt,
    });
  }

  if (!data) return false;

  switch (entityType) {
    case 'patients':
      await patientRepo.upsertFromServer(data);
      return true;
    case 'visits':
      await visitRepo.upsertFromServer(data);
      return true;
    default:
      return false;
  }
};

export const pullSyncDeltas = async ({
  scope,
  limit = DEFAULT_PULL_LIMIT,
  maxPages = DEFAULT_PULL_MAX_PAGES,
} = {}) => {
  const resolvedScope = scope || (await resolveSyncScope());
  if (!resolvedScope) {
    throw new Error('Unable to resolve sync scope (facility/tenant)');
  }

  let cursor = await syncQueueRepo.getPullCursor(GLOBAL_CURSOR_KEY);
  let pages = 0;
  let pulledOps = 0;
  let appliedOps = 0;
  let appliedTombstones = 0;

  while (pages < maxPages) {
    const query = new URLSearchParams({
      facilityId: resolvedScope.facilityId,
      limit: String(limit),
    });
    if (cursor) query.set('cursor', cursor);

    let response;
    let pullAttempt = 0;
    const maxPullRetries = 3;
    while (pullAttempt < maxPullRetries) {
      try {
        response = await api.get(`/sync/pull?${query.toString()}`);
        break; // Success, exit retry loop
      } catch (err) {
        pullAttempt += 1;
        if (pullAttempt >= maxPullRetries) throw err;
        const backoffMs = calculateBackoff(pullAttempt);
        await sleep(backoffMs);
      }
    }

    const ops = Array.isArray(response?.ops) ? response.ops : [];
    const tombstones = Array.isArray(response?.tombstones) ? response.tombstones : [];

    for (const op of ops) {
      pulledOps += 1;
      const applied = await applyPulledOp(op);
      if (applied) appliedOps += 1;
    }

    for (const tombstone of tombstones) {
      const applied = await applyTombstoneLocally(tombstone);
      if (applied) appliedTombstones += 1;
    }

    if (response?.cursor) {
      cursor = String(response.cursor);
      await syncQueueRepo.setPullCursor(GLOBAL_CURSOR_KEY, cursor);
    }

    pages += 1;
    if (!response?.hasMore) break;
  }

  return {
    scope: resolvedScope,
    cursor: cursor || null,
    pages,
    pulledOps,
    appliedOps,
    appliedTombstones,
  };
};

const runSyncInternal = async ({
  includePull = true,
  pushBatchSize = DEFAULT_PUSH_BATCH_SIZE,
  pushMaxBatches = DEFAULT_PUSH_MAX_BATCHES,
  pullLimit = DEFAULT_PULL_LIMIT,
  pullMaxPages = DEFAULT_PULL_MAX_PAGES,
} = {}) => {
  const scope = await resolveSyncScope();
  if (!scope) {
    return {
      ok: false,
      error: 'SYNC_SCOPE_UNAVAILABLE',
      message: 'Could not determine facility/tenant sync scope.',
      push: null,
      pull: null,
    };
  }

  const push = await flushOutboxToPushApi({
    scope,
    batchSize: pushBatchSize,
    maxBatches: pushMaxBatches,
  });

  let pull = null;
  if (includePull) {
    try {
      pull = await pullSyncDeltas({
        scope,
        limit: pullLimit,
        maxPages: pullMaxPages,
      });
    } catch (error) {
      pull = {
        scope,
        error: String(error?.message || 'pull failed'),
        pages: 0,
        pulledOps: 0,
        appliedOps: 0,
        appliedTombstones: 0,
      };
    }
  }

  return {
    ok: true,
    at: now(),
    scope,
    push,
    pull,
  };
};

export const runSyncNow = async (options = {}) => {
  if (inFlightSync) return inFlightSync;
  inFlightSync = runSyncInternal(options).finally(() => {
    inFlightSync = null;
  });
  return inFlightSync;
};

export const getSyncStateSnapshot = async () => {
  const db = getDb();
  const pending = await syncQueueRepo.getPendingCount();
  const stuck = await syncQueueRepo.getStuckCount();
  const queue = await syncQueueRepo.getAllQueued();
  const allConflictAudit = await loadConflictAuditTrail();
  const conflictAudit = allConflictAudit.slice(0, 20);
  const stateRows = await db.getAllAsync(
    `SELECT entity_type, pull_cursor, last_pushed_at, last_pulled_at, updated_at
     FROM sync_state
     ORDER BY entity_type ASC`
  );

  return {
    pending,
    stuck,
    queue,
    conflictCount: allConflictAudit.length,
    conflictAudit,
    state: stateRows || [],
  };
};

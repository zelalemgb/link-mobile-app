/**
 * visitRepo.perf.test.js — W2-MOB-013 performance budget gate tests
 *
 * Strategy:
 * - Mock the SQLite db and repo dependencies so tests run deterministically
 *   in Jest without a native SQLite binary.
 * - Test the budget-gate logic directly by controlling elapsed time via a
 *   mocked Date.now().
 * - Verify no warnings fire for fast saves and that warnings + audit events
 *   fire correctly for slow saves.
 */

// ─── Module mocks must be declared before any imports ────────────────────────

jest.mock('../lib/db/database', () => ({
  getDb: jest.fn(),
  newId: jest.fn(() => 'test-visit-id'),
  now: jest.fn(() => '2026-03-04T00:00:00.000Z'),
}));

jest.mock('./auditLogRepo', () => ({
  auditLogRepo: {
    log: jest.fn().mockResolvedValue(undefined),
  },
}), { virtual: true });

jest.mock('../repositories/auditLogRepo', () => ({
  auditLogRepo: {
    log: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../repositories/syncQueueRepo', () => ({
  syncQueueRepo: {
    enqueue: jest.fn().mockResolvedValue(undefined),
  },
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import { getDb } from '../lib/db/database';
import { auditLogRepo } from '../repositories/auditLogRepo';
import {
  saveVisit,
  SAVE_VISIT_PERF_BUDGET_MS,
} from '../repositories/visitRepo';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeDb = ({ transactionDelayMs = 0 } = {}) => ({
  withTransactionAsync: jest.fn().mockImplementation(async (fn) => {
    if (transactionDelayMs > 0) {
      await new Promise((res) => setTimeout(res, transactionDelayMs));
    }
    await fn();
  }),
  runAsync: jest.fn().mockResolvedValue(undefined),
  getFirstAsync: jest.fn().mockResolvedValue({
    id: 'test-visit-id',
    patient_id: 'patient-1',
    facility_id: 'facility-1',
    tenant_id: 'tenant-1',
    clinician_id: 'clinician-1',
    visit_date: '2026-03-04T00:00:00.000Z',
    visit_type: 'outpatient',
    status: 'draft',
    chief_complaint: null,
    outcome: null,
    follow_up_date: null,
    notes: null,
    synced_at: null,
    deleted_at: null,
    created_at: '2026-03-04T00:00:00.000Z',
    updated_at: '2026-03-04T00:00:00.000Z',
  }),
  getAllAsync: jest.fn().mockResolvedValue([]),
});

const minimalVisitArgs = () => ({
  visitData: {
    patient_id: 'patient-1',
    facility_id: 'facility-1',
    tenant_id: 'tenant-1',
  },
  actorUserId: 'clinician-1',
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SAVE_VISIT_PERF_BUDGET_MS', () => {
  it('is exactly 1000 ms (the committed budget)', () => {
    expect(SAVE_VISIT_PERF_BUDGET_MS).toBe(1_000);
  });
});

describe('saveVisit — fast path (within budget)', () => {
  let warnSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    getDb.mockReturnValue(makeDb({ transactionDelayMs: 0 }));
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('returns a visit object on success', async () => {
    const result = await saveVisit(minimalVisitArgs());
    expect(result).toBeDefined();
    expect(result?.id).toBe('test-visit-id');
  });

  it('does NOT emit a console.warn when save completes in < 1 000 ms', async () => {
    await saveVisit(minimalVisitArgs());
    const budgetWarns = warnSpy.mock.calls.filter((args) =>
      args[0]?.includes('[perf][W2-MOB-013]')
    );
    expect(budgetWarns).toHaveLength(0);
  });

  it('does NOT fire an audit perf event for a fast save', async () => {
    await saveVisit(minimalVisitArgs());
    const perfCalls = auditLogRepo.log.mock.calls.filter(
      (args) => args[0]?.action === 'perf_budget_exceeded'
    );
    expect(perfCalls).toHaveLength(0);
  });
});

describe('saveVisit — slow path (over budget)', () => {
  let warnSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    // Simulate a DB transaction that exceeds the 1 000 ms budget.
    getDb.mockReturnValue(makeDb({ transactionDelayMs: SAVE_VISIT_PERF_BUDGET_MS + 50 }));
  }, 5_000);

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it(
    'still returns the visit on a slow save (budget breach does not cause failure)',
    async () => {
      const result = await saveVisit(minimalVisitArgs());
      expect(result?.id).toBe('test-visit-id');
    },
    SAVE_VISIT_PERF_BUDGET_MS * 3
  );

  it(
    'emits a console.warn containing "W2-MOB-013" and "budget" when save is slow',
    async () => {
      await saveVisit(minimalVisitArgs());
      const budgetWarns = warnSpy.mock.calls.filter(
        (args) => typeof args[0] === 'string' && args[0].includes('[perf][W2-MOB-013]')
      );
      expect(budgetWarns.length).toBeGreaterThanOrEqual(1);
      expect(budgetWarns[0][0]).toMatch(/budget/i);
      expect(budgetWarns[0][0]).toMatch(/elapsed=/);
    },
    SAVE_VISIT_PERF_BUDGET_MS * 3
  );

  it(
    'fires a non-blocking perf_budget_exceeded audit event on slow save',
    async () => {
      await saveVisit(minimalVisitArgs());
      // Allow fire-and-forget microtasks to flush.
      await new Promise((res) => setImmediate(res));
      const perfCalls = auditLogRepo.log.mock.calls.filter(
        (args) => args[0]?.action === 'perf_budget_exceeded'
      );
      expect(perfCalls.length).toBeGreaterThanOrEqual(1);
      const payload = perfCalls[0][0];
      expect(payload.newValue?.budgetMs).toBe(SAVE_VISIT_PERF_BUDGET_MS);
      expect(payload.newValue?.elapsedMs).toBeGreaterThan(SAVE_VISIT_PERF_BUDGET_MS);
      expect(payload.newValue?.operation).toBe('saveVisit');
    },
    SAVE_VISIT_PERF_BUDGET_MS * 3
  );
});

describe('saveVisit — error path', () => {
  let warnSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorDb = makeDb();
    errorDb.withTransactionAsync.mockRejectedValue(new Error('DB write failed'));
    getDb.mockReturnValue(errorDb);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('re-throws errors from createVisit without swallowing them', async () => {
    await expect(saveVisit(minimalVisitArgs())).rejects.toThrow('DB write failed');
  });
});

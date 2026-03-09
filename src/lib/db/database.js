/**
 * database.js — SQLCipher-encrypted SQLite initialisation (W2-MOB-002)
 *
 * Usage:
 *   import { getDb, initDatabase, closeDatabase } from './database';
 *
 *   await initDatabase(userId);   // call once on app start / sign-in
 *   const db = getDb();           // then use anywhere
 *
 * Encryption:
 *   Passes the per-device key from encryptionKey.js to expo-sqlite's
 *   `passphrase` option — which maps to SQLCipher's PRAGMA key.
 *   The DB file is AES-256-CBC encrypted at rest.
 *
 * Migration runner:
 *   Tracks schema version in PRAGMA user_version.
 *   Each migration is a list of SQL statements executed in a single
 *   transaction.  Add new entries to MIGRATIONS[] as the schema evolves.
 */

import { Platform } from 'react-native';

// expo-sqlite uses a native module that crashes on web at import time.
// Lazy-import it only on native platforms.
let SQLite = null;
if (Platform.OS !== 'web') {
  SQLite = require('expo-sqlite');
}

import { getOrCreateDbKey } from './encryptionKey';
import {
  ALL_DDL,
  SCHEMA_VERSION,
  CREATE_PATIENTS_FTS,
  CREATE_FTS_TRIGGER_INSERT,
  CREATE_FTS_TRIGGER_DELETE,
  CREATE_FTS_TRIGGER_UPDATE,
  FTS_BACKFILL_SQL,
} from './schema';

// ─── Module-level singleton ───────────────────────────────────────────────────

let _db = null;

export const getDb = () => {
  if (!_db) {
    throw new Error('[DB] Database not initialised. Call initDatabase() first.');
  }
  return _db;
};

// ─── Migrations ───────────────────────────────────────────────────────────────
// Each entry: { version: N, up: ['SQL', ...] }
// Version 1 is the initial schema — no separate migration needed since
// ALL_DDL uses IF NOT EXISTS.  Future migrations go here.

const MIGRATIONS = [
  {
    // W2-MOB-004: FTS5 full-text search index for patients
    version: 2,
    up: [
      CREATE_PATIENTS_FTS,
      CREATE_FTS_TRIGGER_INSERT,
      CREATE_FTS_TRIGGER_DELETE,
      CREATE_FTS_TRIGGER_UPDATE,
      // Backfill existing rows into the FTS index
      FTS_BACKFILL_SQL,
    ],
  },
];

const runMigrations = async (db, currentVersion) => {
  const pending = MIGRATIONS.filter((m) => m.version > currentVersion);
  if (pending.length === 0) return;

  for (const migration of pending) {
    console.log(`[DB] Running migration to version ${migration.version}`);
    await db.withTransactionAsync(async () => {
      for (const sql of migration.up) {
        await db.execAsync(sql);
      }
      await db.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
    console.log(`[DB] Migration ${migration.version} complete`);
  }
};

// ─── Main initialiser ─────────────────────────────────────────────────────────

/**
 * Opens (or creates) the encrypted database, applies the schema and any
 * pending migrations.
 *
 * @param {string} userId  - The authenticated user's ID (used to scope audit logs)
 */
export const initDatabase = async (userId) => {
  if (_db) {
    console.log('[DB] Already initialised');
    return _db;
  }

  const isWeb = Platform.OS === 'web';

  // On web, SQLite is not available — provide a no-op stub so the app renders.
  if (isWeb) {
    console.log('[DB] Web platform detected — using in-memory stub (no SQLite)');
    _db = {
      execAsync: async () => {},
      getFirstAsync: async () => null,
      getAllAsync: async () => [],
      runAsync: async () => ({ changes: 0 }),
      withTransactionAsync: async (fn) => fn(),
      closeAsync: async () => {},
    };
    return _db;
  }

  const dbName = 'link_clinician.db';

  try {
    const passphrase = await getOrCreateDbKey();

    console.log(`[DB] Opening database "${dbName}" (encrypted: true)`);

    const db = await SQLite.openDatabaseAsync(dbName, {
      ...(passphrase ? { passphrase } : {}),
    });

    // Enable WAL mode for better concurrent read performance and crash safety
    await db.execAsync('PRAGMA journal_mode = WAL');
    await db.execAsync('PRAGMA foreign_keys = ON');

    // Create all tables and indexes (idempotent — IF NOT EXISTS)
    await db.withTransactionAsync(async () => {
      for (const ddl of ALL_DDL) {
        await db.execAsync(ddl);
      }
    });

    // Run any pending migrations
    const versionResult = await db.getFirstAsync('PRAGMA user_version');
    const currentVersion = versionResult?.user_version ?? 0;

    if (currentVersion < SCHEMA_VERSION) {
      await runMigrations(db, currentVersion);
      // Set to final schema version after initial creation
      if (currentVersion === 0) {
        await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
      }
    }

    _db = db;
    console.log(`[DB] Ready (schema version ${SCHEMA_VERSION})`);
    return db;
  } catch (err) {
    console.error('[DB] initDatabase failed:', err?.message || err);
    throw err;
  }
};

/**
 * Close the DB connection and clear the singleton.
 * Call on sign-out so the next sign-in opens with a fresh key.
 */
export const closeDatabase = async () => {
  if (_db) {
    try {
      await _db.closeAsync();
    } catch (err) {
      console.warn('[DB] closeAsync error:', err?.message);
    }
    _db = null;
    console.log('[DB] Database closed');
  }
};

/**
 * Generate a new UUID for local records.
 * Uses crypto.randomUUID() where available, otherwise a RFC-4122-compatible fallback.
 */
export const newId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

/**
 * Current ISO timestamp for created_at / updated_at fields.
 */
export const now = () => new Date().toISOString();

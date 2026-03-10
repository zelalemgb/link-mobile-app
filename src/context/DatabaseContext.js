/**
 * DatabaseContext.js — Initialises the encrypted SQLite DB after sign-in
 *
 * Lifecycle:
 *   1. User signs in → AuthContext sets token + user
 *   2. DatabaseProvider detects authenticated user and calls initDatabase()
 *   3. Once ready, children render normally
 *   4. On sign-out, closeDatabase() is called and the key is wiped
 *
 * Consumers can call useDatabase() to check readiness or surface errors.
 */

import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { initDatabase, closeDatabase } from '../lib/db/database';
import { wipeDbKey } from '../lib/db/encryptionKey';
import { useAuth } from './AuthContext';

const DatabaseContext = React.createContext(null);

export const DatabaseProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [dbReady, setDbReady]   = React.useState(false);
  const [dbError, setDbError]   = React.useState(null);

  React.useEffect(() => {
    if (!isAuthenticated || !user) {
      // Not signed in — close DB if it was open
      closeDatabase().catch(() => {});
      setDbReady(false);
      setDbError(null);
      return;
    }

    let cancelled = false;

    const open = async () => {
      try {
        setDbError(null);
        await initDatabase(user.id ?? 'unknown');
        if (!cancelled) setDbReady(true);
      } catch (err) {
        console.error('[DB] Failed to open database:', err?.message);
        if (!cancelled) setDbError(err?.message ?? 'Database failed to open');
      }
    };

    open();
    return () => { cancelled = true; };
  }, [isAuthenticated, user]);

  // Sign-out: close DB and wipe key so local PHI is inaccessible
  const previouslyAuthenticated = React.useRef(false);
  React.useEffect(() => {
    if (previouslyAuthenticated.current && !isAuthenticated) {
      closeDatabase().catch(() => {});
      wipeDbKey().catch(() => {});
      setDbReady(false);
    }
    previouslyAuthenticated.current = isAuthenticated;
  }, [isAuthenticated]);

  if (isAuthenticated && !dbReady && !dbError) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#0f766e" />
        <Text style={styles.loadingText}>Opening secure database…</Text>
      </View>
    );
  }

  if (dbError) {
    return (
      <View style={styles.error}>
        <Text style={styles.errorTitle}>Database error</Text>
        <Text style={styles.errorBody}>{dbError}</Text>
      </View>
    );
  }

  return (
    <DatabaseContext.Provider value={{ dbReady, dbError }}>
      {children}
    </DatabaseContext.Provider>
  );
};

export const useDatabase = () => {
  const ctx = React.useContext(DatabaseContext);
  if (!ctx) throw new Error('useDatabase must be used within DatabaseProvider');
  return ctx;
};

const styles = StyleSheet.create({
  loading: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f7f5fb', gap: 12,
  },
  loadingText: { fontSize: 14, color: '#6b7280' },
  error: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff1f2', padding: 32,
  },
  errorTitle: { fontSize: 16, fontWeight: '700', color: '#b91c1c', marginBottom: 8 },
  errorBody:  { fontSize: 13, color: '#6b7280', textAlign: 'center' },
});

export default DatabaseContext;

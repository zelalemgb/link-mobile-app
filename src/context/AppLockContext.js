/**
 * AppLockContext — W2-MOB-005
 *
 * Manages the device-level PHI gate:
 *   - 4-digit PIN stored in SecureStore (hardware-backed keychain/keystore)
 *   - Biometric unlock via expo-local-authentication (fingerprint / face)
 *   - Auto-lock after LOCK_TIMEOUT_MS of background time (default 5 min)
 *   - Hard lock on cold start when PIN is set
 *
 * Provider must sit inside AuthProvider + DatabaseProvider so it can
 * gate access to authenticated PHI screens without touching DB init.
 *
 * State machine:
 *   loading          → initialising SecureStore + hardware checks
 *   no PIN set       → show PIN setup screen (first run / after reset)
 *   PIN set, locked  → show PIN entry / biometric prompt
 *   PIN set, unlocked → show role-based navigation
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { AppState, Platform } from 'react-native';

// Native-only modules — lazy-load to avoid web crash
let SecureStore = null;
let LocalAuthentication = null;
if (Platform.OS !== 'web') {
  SecureStore = require('expo-secure-store');
  LocalAuthentication = require('expo-local-authentication');
}

// Web stubs for SecureStore
const WebStore = {
  _data: {},
  getItemAsync: async (key) => WebStore._data[key] ?? null,
  setItemAsync: async (key, value) => { WebStore._data[key] = value; },
  deleteItemAsync: async (key) => { delete WebStore._data[key]; },
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 0,
};
const SS = Platform.OS === 'web' ? WebStore : SecureStore;

// ─── Constants ────────────────────────────────────────────────────────────────

const PIN_STORE_KEY = 'link:app_pin_v1';
const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes background → auto-lock

// ─── Context ──────────────────────────────────────────────────────────────────

const AppLockContext = createContext(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppLockProvider({ children }) {
  const isWeb = Platform.OS === 'web';
  // On web, skip PIN/lock entirely — not needed for browser-based dev/testing
  const [loading, setLoading]                     = useState(!isWeb);
  const [isLocked, setIsLocked]                   = useState(false);
  const [hasPinSet, setHasPinSet]                 = useState(isWeb); // true on web → skip PIN setup
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [failedAttempts, setFailedAttempts]        = useState(0);

  const backgroundTimestamp = useRef(null);
  const appStateRef         = useRef(AppState.currentState);

  // ── Initialise on mount ───────────────────────────────────────────────────
  useEffect(() => {
    if (isWeb) return; // Web skips PIN/lock — already initialised above
    (async () => {
      try {
        // Check PIN existence
        const storedPin = await SS.getItemAsync(PIN_STORE_KEY);
        const pinExists = Boolean(storedPin);
        setHasPinSet(pinExists);

        // If a PIN exists, lock on cold start (user must re-authenticate)
        if (pinExists) {
          setIsLocked(true);
        }

        // Check biometric hardware availability (native only)
        if (Platform.OS !== 'web') {
          const hasHardware = await LocalAuthentication.hasHardwareAsync();
          const isEnrolled  = await LocalAuthentication.isEnrolledAsync();
          setBiometricsAvailable(hasHardware && isEnrolled);
        }
      } catch (err) {
        console.warn('[AppLock] Init error:', err?.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Background → foreground timeout ──────────────────────────────────────
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const prev = appStateRef.current;

      // App going to background — record time
      if (prev === 'active' && nextState.match(/inactive|background/)) {
        backgroundTimestamp.current = Date.now();
      }

      // App returning to foreground — check elapsed time
      if (nextState === 'active' && backgroundTimestamp.current !== null) {
        const elapsed = Date.now() - backgroundTimestamp.current;
        backgroundTimestamp.current = null;

        if (elapsed >= LOCK_TIMEOUT_MS && hasPinSet) {
          console.log('[AppLock] Background timeout — locking app');
          setIsLocked(true);
        }
      }

      appStateRef.current = nextState;
    });

    return () => subscription.remove();
  }, [hasPinSet]);

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * Save a new PIN. Overwrites any existing PIN.
   * Unlocks the app after setup.
   */
  const setPin = useCallback(async (pin) => {
    await SS.setItemAsync(PIN_STORE_KEY, pin, {
      requireAuthentication: false,
      keychainAccessible: SS.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    setHasPinSet(true);
    setIsLocked(false);
    setFailedAttempts(0);
    console.log('[AppLock] PIN set');
  }, []);

  /**
   * Verify entered PIN and unlock if correct.
   * Returns true on success, false on failure.
   * Tracks failed attempts for UI feedback.
   */
  const unlock = useCallback(async (enteredPin) => {
    try {
      const stored = await SS.getItemAsync(PIN_STORE_KEY);
      if (stored === enteredPin) {
        setIsLocked(false);
        setFailedAttempts(0);
        return true;
      } else {
        setFailedAttempts((n) => n + 1);
        return false;
      }
    } catch (err) {
      console.warn('[AppLock] unlock error:', err?.message);
      return false;
    }
  }, []);

  /**
   * Unlock using device biometrics (fingerprint / face ID).
   * Falls back to PIN if biometrics fail or are unavailable.
   * Returns true if biometric auth succeeded.
   */
  const unlockWithBiometrics = useCallback(async () => {
    if (!biometricsAvailable) return false;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock LINK',
        cancelLabel: 'Use PIN',
        disableDeviceFallback: true, // we handle PIN ourselves
        fallbackLabel: '', // hides the "Enter Password" fallback
      });
      if (result.success) {
        setIsLocked(false);
        setFailedAttempts(0);
        console.log('[AppLock] Biometric unlock succeeded');
        return true;
      }
      return false;
    } catch (err) {
      console.warn('[AppLock] biometric error:', err?.message);
      return false;
    }
  }, [biometricsAvailable]);

  /**
   * Manually lock the app (e.g., from a "Lock" button in settings).
   */
  const lock = useCallback(() => {
    if (hasPinSet) setIsLocked(true);
  }, [hasPinSet]);

  /**
   * Delete the PIN and unlock.
   * Used for "Remove app lock" in settings (requires re-authentication first).
   */
  const clearPin = useCallback(async () => {
    await SS.deleteItemAsync(PIN_STORE_KEY);
    setHasPinSet(false);
    setIsLocked(false);
    setFailedAttempts(0);
    console.log('[AppLock] PIN cleared');
  }, []);

  // ── Context value ─────────────────────────────────────────────────────────

  return (
    <AppLockContext.Provider
      value={{
        loading,
        isLocked,
        hasPinSet,
        biometricsAvailable,
        failedAttempts,
        setPin,
        unlock,
        unlockWithBiometrics,
        lock,
        clearPin,
      }}
    >
      {children}
    </AppLockContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useAppLock = () => {
  const ctx = useContext(AppLockContext);
  if (!ctx) throw new Error('[AppLock] useAppLock must be used inside AppLockProvider');
  return ctx;
};

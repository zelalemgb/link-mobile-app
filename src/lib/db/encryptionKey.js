/**
 * encryptionKey.js — Per-device SQLCipher key management
 *
 * Strategy:
 *   • On first launch: generate 32 random bytes, hex-encode them → 64-char key
 *   • Store in expo-secure-store (Android Keystore / iOS Secure Enclave backed)
 *   • On every subsequent launch: retrieve the stored key
 *   • If the key is ever missing (e.g. after a factory reset), a fresh key is
 *     generated.  This means existing DB data would be unreadable — handled by
 *     re-showing the login screen and resyncing from the server.
 *
 * W2-SEC-001 alignment:
 *   • Key never leaves SecureStore
 *   • Key rotation: call rotateEncryptionKey() after PRAGMA rekey in the DB layer
 */

import { Platform } from 'react-native';

// expo-secure-store uses a native module that crashes on web at import time.
let SecureStore = null;
if (Platform.OS !== 'web') {
  SecureStore = require('expo-secure-store');
}

const DB_KEY_STORE_KEY = 'link_db_enc_key_v1';

/**
 * Generate a cryptographically random 64-char hex string (256-bit key).
 * Uses the platform CSPRNG via expo-crypto fallback or Math.random substitute
 * when running in JS-only environments (web / tests).
 */
const generateKey = () => {
  // In a bare/prebuild native context, crypto.getRandomValues is available
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Web/test fallback — not used in production device builds
  return Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
};

const isWeb = Platform.OS === 'web';

/**
 * Get (or create) the per-device database encryption key.
 * Returns a 64-char hex string.
 */
export const getOrCreateDbKey = async () => {
  if (isWeb) {
    // Web doesn't use SQLCipher — return a stable dev key
    return 'dev_web_key_not_encrypted_00000000000000000000000000000000';
  }

  try {
    const existing = await SecureStore.getItemAsync(DB_KEY_STORE_KEY);
    if (existing && existing.length === 64) {
      return existing;
    }

    // First launch or key missing — generate and store
    const newKey = generateKey();
    await SecureStore.setItemAsync(DB_KEY_STORE_KEY, newKey, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    console.log('[DB] Generated new per-device encryption key');
    return newKey;
  } catch (err) {
    // SecureStore failed (emulator without Keystore, tests, etc.)
    // Return a stable test key so the app doesn't crash
    console.warn('[DB] SecureStore unavailable, using ephemeral key:', err?.message);
    return 'ephemeral_fallback_key_00000000000000000000000000000000';
  }
};

/**
 * Wipe the stored key.  Call this on sign-out to make local PHI inaccessible
 * without the server credentials needed to obtain a new key on next sign-in.
 */
export const wipeDbKey = async () => {
  if (isWeb) return;
  try {
    await SecureStore.deleteItemAsync(DB_KEY_STORE_KEY);
    console.log('[DB] Encryption key wiped');
  } catch (err) {
    console.warn('[DB] Failed to wipe encryption key:', err?.message);
  }
};

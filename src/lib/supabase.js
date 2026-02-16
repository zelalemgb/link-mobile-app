import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./env";

const isWeb = Platform.OS === "web";

const SecureStoreAdapter = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

const WebStorageAdapter = {
  getItem: (key) => {
    try {
      return globalThis?.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      globalThis?.localStorage?.setItem(key, value);
    } catch {
      // ignore storage failures (private mode, disabled, etc.)
    }
  },
  removeItem: (key) => {
    try {
      globalThis?.localStorage?.removeItem(key);
    } catch {
      // ignore storage failures
    }
  },
};

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "supabaseUrl is required. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY."
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: isWeb ? WebStorageAdapter : SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

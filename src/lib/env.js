import Constants from "expo-constants";

const fallbackApiBase = "https://api.linkhc.org/api";
const extra = Constants.expoConfig?.extra || Constants.manifest?.extra || {};

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  extra.EXPO_PUBLIC_API_BASE_URL ||
  fallbackApiBase;

export const MEDGEMMA_API_URL =
  process.env.EXPO_PUBLIC_MEDGEMMA_API_URL ||
  extra.EXPO_PUBLIC_MEDGEMMA_API_URL ||
  `${API_BASE_URL}/ai/analyze`;

export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  extra.EXPO_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  extra.EXPO_PUBLIC_SUPABASE_ANON_KEY;

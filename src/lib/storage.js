import AsyncStorage from "@react-native-async-storage/async-storage";

export const getItem = async (key, fallback = null) => {
  const raw = await AsyncStorage.getItem(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

export const setItem = async (key, value) => {
  const payload = typeof value === "string" ? value : JSON.stringify(value);
  return AsyncStorage.setItem(key, payload);
};

export const removeItem = async (key) => {
  return AsyncStorage.removeItem(key);
};

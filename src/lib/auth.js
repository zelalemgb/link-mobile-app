import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "linkhc_auth_token";

// Platform-specific storage: SecureStore for native, localStorage for web
const isWeb = Platform.OS === "web";

export const getAuthToken = async () => {
  if (isWeb) {
    return localStorage.getItem(TOKEN_KEY);
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
};

export const setAuthToken = async (token) => {
  if (!token) {
    if (isWeb) {
      localStorage.removeItem(TOKEN_KEY);
      return;
    }
    return SecureStore.deleteItemAsync(TOKEN_KEY);
  }

  if (isWeb) {
    localStorage.setItem(TOKEN_KEY, token);
    return;
  }
  return SecureStore.setItemAsync(TOKEN_KEY, token);
};

export const clearAuthToken = async () => {
  if (isWeb) {
    localStorage.removeItem(TOKEN_KEY);
    return;
  }
  return SecureStore.deleteItemAsync(TOKEN_KEY);
};

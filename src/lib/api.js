import { API_BASE_URL } from "./env";
import { error as logError } from "./logger";
import { getAuthToken } from "./auth";

const DEFAULT_TIMEOUT_MS = 15000;

const withTimeout = (promise, timeoutMs) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return Promise.race([
    promise(controller.signal),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out")), timeoutMs)
    ),
  ]).finally(() => clearTimeout(timeoutId));
};

const buildUrl = (path) => {
  if (path.startsWith("http")) return path;
  const base = API_BASE_URL.endsWith("/api")
    ? API_BASE_URL
    : `${API_BASE_URL.replace(/\/$/, "")}/api`;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
};

const request = async (path, { method = "GET", body, headers, auth = true } = {}) => {
  const url = buildUrl(path);
  const token = auth ? await getAuthToken() : null;
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await withTimeout(
      (signal) => fetch(url, { ...options, signal }),
      DEFAULT_TIMEOUT_MS
    );

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const message = payload.error || `Request failed (${response.status})`;
      throw new Error(message);
    }

    if (response.status === 204) return null;
    return response.json();
  } catch (err) {
    logError("API request failed", method, url, err?.message || err);
    throw err;
  }
};

const retryable = async (fn, attempts = 2) => {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
};

export const api = {
  get: (path, options) => retryable(() => request(path, { ...options })),
  post: (path, body, options) =>
    request(path, { ...options, method: "POST", body }),
  put: (path, body, options) =>
    request(path, { ...options, method: "PUT", body }),
  patch: (path, body, options) =>
    request(path, { ...options, method: "PATCH", body }),
  delete: (path, options) =>
    request(path, { ...options, method: "DELETE" }),
};

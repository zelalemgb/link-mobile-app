const DEFAULT_FEATURE_FLAGS = {
  providerSelfServeSignup: false,
  clinicOnboardingV2: false,
  patientRecordsSync: false,
  hewGuidedAssessments: false,
  linkAgentMvp: false,
};

const ENV_FLAG_KEYS = {
  providerSelfServeSignup: "EXPO_PUBLIC_FF_PROVIDER_SELF_SERVE_SIGNUP",
  clinicOnboardingV2: "EXPO_PUBLIC_FF_CLINIC_ONBOARDING_V2",
  patientRecordsSync: "EXPO_PUBLIC_FF_PATIENT_RECORDS_SYNC",
  hewGuidedAssessments: "EXPO_PUBLIC_FF_HEW_GUIDED_ASSESSMENTS",
  linkAgentMvp: "EXPO_PUBLIC_FF_LINK_AGENT_MVP",
};

const ENABLED_VALUES = new Set(["1", "true", "yes", "on", "enabled"]);
const DISABLED_VALUES = new Set(["0", "false", "no", "off", "disabled"]);

const normalizeBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;

  const normalized = value.trim().toLowerCase();
  if (ENABLED_VALUES.has(normalized)) return true;
  if (DISABLED_VALUES.has(normalized)) return false;
  return undefined;
};

const extractOverrides = (source) => {
  const overrides = {};

  if (!source) return overrides;

  for (const key of Object.keys(DEFAULT_FEATURE_FLAGS)) {
    const normalized = normalizeBoolean(source[key]);
    if (normalized !== undefined) {
      overrides[key] = normalized;
    }
  }

  return overrides;
};

const readEnvOverrides = (env) => {
  if (!env) return {};

  const overrides = {};
  for (const key of Object.keys(ENV_FLAG_KEYS)) {
    const normalized = normalizeBoolean(env[ENV_FLAG_KEYS[key]]);
    if (normalized !== undefined) {
      overrides[key] = normalized;
    }
  }

  return overrides;
};

const readRuntimeOverrides = () => {
  const runtimeFlags = globalThis.__LINK_FEATURE_FLAGS__;
  return extractOverrides(runtimeFlags);
};

export const resolveFeatureFlags = ({ env, runtimeOverrides } = {}) => ({
  ...DEFAULT_FEATURE_FLAGS,
  ...readEnvOverrides(env),
  ...extractOverrides(runtimeOverrides),
});

export const resolveInitialFeatureFlags = () =>
  resolveFeatureFlags({
    env: typeof process !== "undefined" ? process.env : {},
    runtimeOverrides: readRuntimeOverrides(),
  });

export { DEFAULT_FEATURE_FLAGS };

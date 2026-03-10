import { DEFAULT_FEATURE_FLAGS, resolveFeatureFlags } from "../featureFlags";

describe("mobile featureFlags", () => {
  it("defaults all rollout controls to false", () => {
    expect(resolveFeatureFlags()).toEqual(DEFAULT_FEATURE_FLAGS);
  });

  it("reads environment and runtime overrides", () => {
    expect(
      resolveFeatureFlags({
        env: {
          EXPO_PUBLIC_FF_LINK_AGENT_MVP: "true",
          EXPO_PUBLIC_FF_PATIENT_RECORDS_SYNC: "1",
          EXPO_PUBLIC_FF_HEW_GUIDED_ASSESSMENTS: "no",
        },
        runtimeOverrides: {
          hewGuidedAssessments: true,
          clinicOnboardingV2: true,
        },
      })
    ).toEqual({
      providerSelfServeSignup: false,
      clinicOnboardingV2: true,
      patientRecordsSync: true,
      hewGuidedAssessments: true,
      linkAgentMvp: true,
    });
  });
});

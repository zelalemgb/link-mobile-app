import {
  buildDangerSignMapFromAnswers,
  getHewGuidedProtocolById,
  getHewGuidedProtocols,
  summarizeHewGuidedAssessment,
} from "../services/hewGuidedAssessmentService";

describe("hewGuidedAssessmentService", () => {
  it("ships top HEW protocol scenarios for guided assessment", () => {
    const protocols = getHewGuidedProtocols();
    expect(protocols).toHaveLength(6);
    expect(protocols.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "fever",
        "respiratory",
        "maternal_followup",
        "child_danger_signs",
        "adherence_followup",
        "referral_followup",
      ])
    );
  });

  it("summarizes positive answers and escalation level deterministically", () => {
    const result = summarizeHewGuidedAssessment({
      protocolId: "respiratory",
      answers: {
        chest_indrawing: true,
        fast_breathing: true,
      },
      freeText: "Patient worsening overnight",
    });

    expect(result.protocol?.id).toBe("respiratory");
    expect(result.positiveAnswers.length).toBeGreaterThanOrEqual(2);
    expect(result.shouldEscalate).toBe(true);
    expect(result.escalationLevel).toBe("emergency");
    expect(result.summaryText).toMatch(/Guided protocol:/);
  });

  it("maps protocol answers to danger-sign chip keys for provider pre-visit context", () => {
    const dangerSigns = buildDangerSignMapFromAnswers("child_danger_signs", {
      convulsion: true,
      fast_breathing_or_indrawing: true,
    });

    expect(dangerSigns.convulsion).toBe(true);
    expect(dangerSigns.breathing_problem).toBe(true);
  });

  it("returns null for unknown protocol lookups", () => {
    expect(getHewGuidedProtocolById("unknown")).toBeNull();
  });
});

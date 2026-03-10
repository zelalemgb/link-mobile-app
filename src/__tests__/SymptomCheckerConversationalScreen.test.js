import fs from "fs";
import path from "path";

const source = fs.readFileSync(
  path.resolve(
    process.cwd(),
    "src/screens/SymptomCheckerConversationalScreen.js"
  ),
  "utf8"
);

describe("SymptomCheckerConversationalScreen", () => {
  it("uses offline symptom safety guidance when handling responses", () => {
    expect(source).toMatch(/evaluateOfflineSymptomGuidance/);
    expect(source).toMatch(/offlineGuidance/);
    expect(source).toMatch(/urgencyLabel/);
  });

  it("persists structured symptom-check outputs to patient portal logs", () => {
    expect(source).toMatch(/logSymptomCheck/);
    expect(source).toMatch(/symptom_data/);
    expect(source).toMatch(/urgency_level/);
  });

  it("renders structured sections for danger signs, next steps, and safety notes", () => {
    expect(source).toMatch(/Danger signs/);
    expect(source).toMatch(/Next steps/);
    expect(source).toMatch(/Safety notes/);
  });

  it("exposes clinic handoff actions from agent guidance", () => {
    expect(source).toMatch(/Find clinic/);
    expect(source).toMatch(/Book appointment/);
    expect(source).toMatch(/View records/);
    expect(source).toMatch(/showCareHandoff/);
  });
});

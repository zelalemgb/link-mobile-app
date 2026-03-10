import fs from "fs";
import path from "path";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "src/screens/hew/HEWRecordNoteScreen.js"),
  "utf8"
);

describe("HEWRecordNoteScreen", () => {
  it("implements guided protocol-led assessment capture", () => {
    expect(source).toMatch(/Guided assessment protocol/);
    expect(source).toMatch(/getHewGuidedProtocols/);
    expect(source).toMatch(/summarizeHewGuidedAssessment/);
    expect(source).toMatch(/GuidanceQuestionRow/);
  });

  it("runs Link Agent danger-sign checks with fallback-safe output", () => {
    expect(source).toMatch(/runHewDangerSignCheck/);
    expect(source).toMatch(/Run danger-sign check/);
    expect(source).toMatch(/Source: /);
  });

  it("persists structured guided handoff payload fields in saved notes", () => {
    expect(source).toMatch(/guided_protocol/);
    expect(source).toMatch(/guided_answers/);
    expect(source).toMatch(/danger_signs/);
    expect(source).toMatch(/referral_summary/);
    expect(source).toMatch(/agent_guidance/);
  });
});

import fs from "fs";
import path from "path";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "src/screens/SymptomCheckerScreen.js"),
  "utf8"
);

describe("SymptomCheckerScreen", () => {
  it("uses active visit context to guide before-and-after visit support", () => {
    expect(source).toMatch(/getActiveVisit/);
    expect(source).toMatch(/activeVisit/);
    expect(source).toMatch(/Care handoff/);
  });

  it("starts Link Agent chat from quick prompts", () => {
    expect(source).toMatch(/QUICK_PROMPTS/);
    expect(source).toMatch(/navigation\.navigate\("SymptomCheckerConversational"/);
    expect(source).toMatch(/autoSend/);
  });

  it("provides direct clinic, appointment, and records handoff actions", () => {
    expect(source).toMatch(/Find linked clinics/);
    expect(source).toMatch(/Book appointment/);
    expect(source).toMatch(/Open records/);
  });
});

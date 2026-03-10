import fs from "fs";
import path from "path";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "src/services/hewService.js"),
  "utf8"
);

describe("hewService", () => {
  it("runs HEW danger-sign checks via Link Agent with offline fallback", () => {
    expect(source).toMatch(/runHewDangerSignCheck/);
    expect(source).toMatch(/requestLinkAgentInteraction/);
    expect(source).toMatch(/evaluateOfflineHewDangerAssessment/);
    expect(source).toMatch(/offline_fallback/);
  });
});

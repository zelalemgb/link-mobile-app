import fs from "fs";
import path from "path";

const appSource = fs.readFileSync(path.resolve(process.cwd(), "src/App.js"), "utf8");

describe("Link mobile App role shell baseline", () => {
  it("routes HEW users to the dedicated HEW navigator", () => {
    expect(appSource).toMatch(/if \(role === "hew"\)/);
    expect(appSource).toMatch(/<HEWNavigator \/>/);
  });

  it("routes clinician roles to the clinician navigator", () => {
    expect(appSource).toMatch(/const CLINICIAN_ROLES = \["nurse", "doctor", "admin", "clinician", "health_officer", "clinical_officer"\]/);
    expect(appSource).toMatch(/<ClinicianNavigator /);
  });

  it("routes solo provider workspaces through the clinician shell", () => {
    expect(appSource).toMatch(/isSoloProviderWorkspace/);
    expect(appSource).toMatch(/shellMode=\{isSoloProviderWorkspace \? "solo_provider" : "default"\}/);
  });

  it("routes patient and default users to MainTabs", () => {
    expect(appSource).toMatch(/component=\{MainTabs\}/);
    expect(appSource).toMatch(/name="Main"/);
  });
});

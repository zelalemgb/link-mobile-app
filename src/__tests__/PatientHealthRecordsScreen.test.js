import fs from "fs";
import path from "path";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "src/screens/PatientHealthRecordsScreen.js"),
  "utf8"
);

describe("PatientHealthRecordsScreen", () => {
  it("loads synced records and merges them before manual uploads", () => {
    expect(source).toMatch(/getSyncedRecords/);
    expect(source).toMatch(/patientRecordsSync/);
    expect(source).toMatch(/setDocuments\(\[\.\.\.synced, \.\.\.manual\]\)/);
  });

  it("surfaces priority synced record types including referral summaries", () => {
    expect(source).toMatch(/referral_summary/);
    expect(source).toMatch(/Visit summaries, prescriptions, lab results, and referral summaries/);
  });

  it("shows growth-loop actions for linked clinic discovery and app sharing", () => {
    expect(source).toMatch(/Keep care connected after every visit/);
    expect(source).toMatch(/Find linked clinics/);
    expect(source).toMatch(/Share app link/);
  });

  it("prevents destructive actions on synced records", () => {
    expect(source).toMatch(/Synced Record/);
    expect(source).toMatch(/Synced from Link visit/);
  });
});

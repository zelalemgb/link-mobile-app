import fs from "fs";
import path from "path";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "src/screens/hew/HEWHomeScreen.js"),
  "utf8"
);

describe("HEWHomeScreen", () => {
  it("adds direct guided assessment launch from patient cards", () => {
    expect(source).toMatch(/showGuidedFlow/);
    expect(source).toMatch(/Start guided assessment/);
    expect(source).toMatch(/Guided/);
  });

  it("routes guided launch into HEWRecordNote with protocol context", () => {
    expect(source).toMatch(/navigation\.navigate\('HEWRecordNote', \{ patient, protocolId: 'fever' \}\)/);
  });

  it("keeps existing log-visit workflow available", () => {
    expect(source).toMatch(/goLog/);
    expect(source).toMatch(/Log visit/);
    expect(source).toMatch(/Log/);
  });
});

import fs from "fs";
import path from "path";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "src/screens/FacilityFinderScreen.js"),
  "utf8"
);

describe("FacilityFinderScreen", () => {
  it("loads data from the live public directory service", () => {
    expect(source).toMatch(/getPublicDirectoryFacilities/);
    expect(source).toMatch(/searchTerm/);
    expect(source).toMatch(/filterType/);
  });

  it("exposes connected care CTAs for booking, directions, and calls", () => {
    expect(source).toMatch(/Book appointment/);
    expect(source).toMatch(/PatientAppointments/);
    expect(source).toMatch(/Directions/);
    expect(source).toMatch(/tel:/);
  });
});

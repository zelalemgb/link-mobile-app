import fs from "fs";
import path from "path";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "src/services/backgroundSyncService.js"),
  "utf8"
);

describe("backgroundSyncService", () => {
  it("includes HEW offline queue flushing in background sync runs", () => {
    expect(source).toMatch(/includeHewQueue: true/);
    expect(source).toMatch(/hewFlushed/);
    expect(source).toMatch(/task-result hewFlushed=/);
  });
});

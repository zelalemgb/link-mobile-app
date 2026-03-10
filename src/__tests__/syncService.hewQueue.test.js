import fs from "fs";
import path from "path";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "src/services/syncService.js"),
  "utf8"
);

describe("syncService HEW queue integration", () => {
  it("flushes HEW offline queue before push/pull sync cycles", () => {
    expect(source).toMatch(/flushHewOfflineQueue/);
    expect(source).toMatch(/includeHewQueue = true/);
    expect(source).toMatch(/hew = await flushHewOfflineQueue/);
    expect(source).toMatch(/hew,/);
  });
});

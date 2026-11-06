import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDirectory } from "../scripts/build-output.mjs";
test("build isolation accepts named project directories and rejects escaping paths", () => {
  assert.equal(buildDirectory(undefined, ".next-build"), ".next-build");
  assert.equal(buildDirectory(".next-preview", ".next-build"), ".next-preview");
  for (const value of [
    "../.next",
    "C:/tmp/output",
    ".next/../other",
    "public",
    ".next\\nested",
  ])
    assert.throws(() => buildDirectory(value, ".next-build"));
});

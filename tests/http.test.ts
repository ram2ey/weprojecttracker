import test from "node:test";
import assert from "node:assert/strict";
import { smallJson } from "../src/lib/security/http";
test("authentication forms bound declared and streamed JSON bodies", async () => {
  assert.deepEqual(
    await smallJson(
      new Request("http://localhost", {
        method: "POST",
        body: '{"action":"verify","code":"123456"}',
      }),
    ),
    { action: "verify", code: "123456" },
  );
  assert.equal(
    await smallJson(
      new Request("http://localhost", {
        method: "POST",
        body: "x".repeat(17000),
      }),
    ),
    null,
  );
  assert.equal(
    await smallJson(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Length": "2000000" },
        body: "{}",
      }),
    ),
    null,
  );
  assert.equal(
    await smallJson(
      new Request("http://localhost", { method: "POST", body: "{" }),
    ),
    null,
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";

test("external monitor process detects outage, migration mismatch, and recovery", async () => {
  let mode = "healthy";
  const server = createServer((request, response) => {
    if (mode === "outage") {
      response.writeHead(503);
      response.end();
      return;
    }
    response.setHeader("Content-Type", "application/json");
    response.end(
      JSON.stringify({
        ready: true,
        migrated: mode !== "unmigrated",
        release: `sha-${"b".repeat(40)}-1-1`,
      }),
    );
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const [state, expected] of [
      ["healthy", 0],
      ["outage", 1],
      ["unmigrated", 1],
      ["healthy", 0],
    ]) {
      mode = state;
      const child = spawn(process.execPath, ["scripts/monitor.mjs"], {
        env: { ...process.env, PUBLIC_APP_URL: origin },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let diagnostic = "";
      child.stderr.on("data", (chunk) => {
        diagnostic += chunk;
      });
      const [code] = await once(child, "exit");
      assert.equal(code, expected, state + ": " + diagnostic);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

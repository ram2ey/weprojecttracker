import { config } from "dotenv";
import { spawn } from "node:child_process";
import { cpSync } from "node:fs";
import { resolve, join } from "node:path";
import assert from "node:assert/strict";
config({ path: ".env.local", quiet: true });
const database = new URL(process.env.DATABASE_URL);
assert.ok(
  database.hostname === "127.0.0.1" && database.port === "55432",
  "Production smoke checks must use local development infrastructure.",
);
const connection = {
  DATABASE_URL: "",
  PGHOST: database.hostname,
  PGPORT: database.port,
  PGDATABASE: decodeURIComponent(database.pathname.slice(1)),
  PGUSER: decodeURIComponent(database.username),
  PGPASSWORD: decodeURIComponent(database.password),
};
// Uses local development infrastructure only; never connects to a live deployment.
const standalone = resolve(".next-ci/standalone");
cpSync("public", join(standalone, "public"), { recursive: true });
cpSync(".next-ci/static", join(standalone, ".next-ci/static"), {
  recursive: true,
});
const server = spawn(process.execPath, [join(standalone, "server.js")], {
  env: {
    ...process.env,
    ...connection,
    NODE_ENV: "production",
    HOSTNAME: "127.0.0.1",
    PORT: "3200",
    NEXT_DIST_DIR: ".next-ci",
    APP_ENV: "production",
    ENABLE_DESIGN_PREVIEW: "false",
    ENABLE_BROWSER_PUSH: "false",
    BETTER_AUTH_URL: "https://localhost:3200",
    NEXT_TELEMETRY_DISABLED: "1",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      ready = (await fetch("http://127.0.0.1:3200/api/health")).ok;
    } catch {}
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, "Production-mode server did not become ready.");
  const home = await (await fetch("http://127.0.0.1:3200/")).text();
  assert.ok(!home.includes("Sample records and illustrations"));
  assert.ok(!home.includes("A better place to learn"));
  assert.equal(
    (await fetch("http://127.0.0.1:3200/preview/console")).status,
    404,
  );
  assert.equal(
    (await fetch("http://127.0.0.1:3200/projects/classroom-block")).status,
    404,
  );
  for (const path of [
    "/projects",
    "/announcements",
    "/reports",
    "/sitemap.xml",
    "/following",
    "/manifest.webmanifest",
    "/icons/icon-192.png",
    "/sw.js",
    "/api/ready",
  ]) {
    const response = await fetch(`http://127.0.0.1:3200${path}`);
    assert.equal(
      response.status,
      200,
      `${path} should load in production mode`,
    );
  }
  assert.equal((await fetch("http://127.0.0.1:3200/contact")).status, 404);
  const robots = await (await fetch("http://127.0.0.1:3200/robots.txt")).text();
  assert.ok(robots.includes("Allow: /api/og"));
  assert.ok(robots.includes("Disallow: /staff"));
  const image = await fetch("http://127.0.0.1:3200/api/og");
  assert.equal(image.status, 200);
  assert.ok(image.headers.get("content-type")?.includes("image/png"));
  assert.ok(image.headers.get("cache-control")?.includes("no-store"));
  const push = await (
    await fetch("http://127.0.0.1:3200/api/public/push/config")
  ).json();
  assert.deepEqual(push, { enabled: false, publicKey: null });
  for (const path of [
    "/api/staff/inbox",
    "/api/staff/engagement",
    "/api/staff/reports?format=pdf",
  ]) {
    const response = await fetch(`http://127.0.0.1:3200${path}`);
    assert.equal(response.status, 403);
    assert.ok(response.headers.get("cache-control")?.includes("no-store"));
  }
  console.log(
    "Production isolation passed: no fixtures/design routes; public discovery, metadata, PWA assets and following feed work; staff APIs are protected, live push stays disabled, Contact remains omitted.",
  );
} finally {
  server.kill();
}
// Liveness remains separate from readiness when the database is unreachable.
const unavailable = spawn(process.execPath, [join(standalone, "server.js")], {
  env: {
    ...process.env,
    ...connection,
    NODE_ENV: "production",
    APP_ENV: "production",
    ENABLE_DESIGN_PREVIEW: "false",
    ENABLE_BROWSER_PUSH: "false",
    BETTER_AUTH_URL: "https://localhost:3201",
    HOSTNAME: "127.0.0.1",
    PORT: "3201",
    PGPORT: "1",
    NEXT_DIST_DIR: ".next-ci",
    NEXT_TELEMETRY_DISABLED: "1",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
try {
  let up = false;
  for (let i = 0; i < 100; i++) {
    try {
      up = (await fetch("http://127.0.0.1:3201/api/health")).ok;
    } catch {}
    if (up) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(up, "Unconnected readiness fixture did not start.");
  const response = await fetch("http://127.0.0.1:3201/api/ready", {
    signal: AbortSignal.timeout(12000),
  });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { ready: false });
  assert.equal((await fetch("http://127.0.0.1:3201/api/health")).status, 200);
  console.log(
    "Readiness failure passed: unavailable database returns 503 without exposing connection details; liveness remains 200.",
  );
} finally {
  unavailable.kill();
}

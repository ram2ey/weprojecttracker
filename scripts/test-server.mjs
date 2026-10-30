import "./build-sw.mjs";
import { config } from "dotenv";
import { spawn } from "node:child_process";
import { cpSync } from "node:fs";
import { resolve, join } from "node:path";
import pg from "pg";
config({ path: ".env.local", quiet: true });
const url = new URL(process.env.DATABASE_URL);
if (url.hostname !== "127.0.0.1" || url.port !== "55432")
  throw new Error(
    "Browser tests require the isolated local PostgreSQL cluster.",
  );
const pool = new pg.Pool({ connectionString: url.toString() });
const result = await pool.query(
  "SELECT 1 FROM pg_database WHERE datname = 'wassa_test'",
);
if (!result.rowCount) await pool.query('CREATE DATABASE "wassa_test"');
await pool.end();
url.pathname = "/wassa_test";
const env = {
  ...process.env,
  DATABASE_URL: url.toString(),
  APP_ENV: "development",
  BETTER_AUTH_URL: "http://localhost:3100",
  NEXT_PUBLIC_APP_URL: "http://localhost:3100",
  NEXT_DIST_DIR: ".next-test",
  NEXT_TELEMETRY_DISABLED: "1",
  ENABLE_DESIGN_PREVIEW: "true",
  ENABLE_BROWSER_PUSH: "false",
  VAPID_SUBJECT: "",
  VAPID_PUBLIC_KEY: "",
  VAPID_PRIVATE_KEY: "",
  MEDIA_ROOT: resolve(".local/test-media"),
};
const migrate = spawn(
  process.execPath,
  ["node_modules/tsx/dist/cli.mjs", "scripts/migrate.ts"],
  { env, stdio: "inherit" },
);
const code = await new Promise((resolve) => migrate.on("exit", resolve));
if (code !== 0) process.exit(code || 1);
// Test the built server rather than HMR, so parallel local development and
// generated-file changes cannot repeatedly navigate the browser mid-test.
const build = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "build"],
  {
    env: { ...env, NODE_ENV: "production" },
    stdio: "inherit",
  },
);
const buildCode = await new Promise((resolve) => build.on("exit", resolve));
if (buildCode !== 0) process.exit(buildCode || 1);
const standalone = resolve(".next-test/standalone");
cpSync("public", join(standalone, "public"), { recursive: true });
cpSync(".next-test/static", join(standalone, ".next-test/static"), {
  recursive: true,
});
const server = spawn(process.execPath, [join(standalone, "server.js")], {
  env: { ...env, NODE_ENV: "production", HOSTNAME: "127.0.0.1", PORT: "3100" },
  stdio: "inherit",
});
server.on("exit", (code) => process.exit(code || 0));
process.on("SIGTERM", () => server.kill());
process.on("SIGINT", () => server.kill());

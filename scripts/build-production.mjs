import "./build-sw.mjs";
import { spawn } from "node:child_process";
// Deliberately empty values prevent Next's dotenv loader from importing local
// credentials. Public pages are dynamic and must not query a database at build.
const env = {
  ...process.env,
  NODE_ENV: "production",
  NEXT_DIST_DIR: ".next-ci",
  NEXT_TELEMETRY_DISABLED: "1",
};
for (const name of [
  "DATABASE_URL",
  "PGHOST",
  "PGPORT",
  "PGDATABASE",
  "PGUSER",
  "PGPASSWORD",
  "BETTER_AUTH_SECRET",
  "MFA_ENCRYPTION_KEY",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GEOAPIFY_API_KEY",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
  "ENABLE_BROWSER_PUSH",
])
  env[name] = "";
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "build"],
  { env, stdio: "inherit" },
);
child.on("error", () => process.exit(1));
child.on("exit", (code) => process.exit(code ?? 1));

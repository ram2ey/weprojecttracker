import { execFileSync } from "node:child_process";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { parse, stringify } from "yaml";
import assert from "node:assert/strict";
import { smokePublicApp } from "./public-smoke.mjs";

// CI-owned Docker daemon only; never use this command on a shared production host.
assert.equal(
  process.env.CI,
  "true",
  "Container rehearsal is limited to disposable CI runners.",
);
assert.match(process.env.RELEASE_ID || "", /^sha-[a-f0-9]{40}-\d+-\d+$/);
const project = "wassa-ci-" + process.env.GITHUB_RUN_ID;
assert.match(project, /^wassa-ci-\d+$/);
const file = `.local/${project}.yaml`;
const config = parse(await readFile("compose.coolify.yaml", "utf8"));
delete config.services.migrate.exclude_from_hc;
config.services.web.ports = ["127.0.0.1:3210:3000"];
const env = {
  ...process.env,
  WEB_IMAGE: "wassa-ci-web:check",
  TOOLS_IMAGE: "wassa-ci-tools:check",
  APP_URL: "https://ci.example.invalid",
  POSTGRES_PASSWORD: "disposable-postgres-password-for-ci",
  BETTER_AUTH_SECRET: "disposable-auth-secret-for-container-ci-2026",
};
const args = ["compose", "-p", project, "-f", file];
const docker = (extra, stdio = "inherit") =>
  execFileSync("docker", [...args, ...extra], { env, stdio, timeout: 240000 });
try {
  const failing = structuredClone(config);
  failing.services.migrate.command = ["node", "-e", "process.exit(17)"];
  await writeFile(file, stringify(failing));
  let failed = false;
  try {
    docker(["up", "-d", "--wait", "--wait-timeout", "120"], "pipe");
  } catch {
    failed = true;
  }
  assert.ok(failed, "A failed migration must fail the rollout.");
  const running = JSON.parse(
    docker(["ps", "--format", "json", "web"], "pipe").toString() || "null",
  );
  assert.ok(
    !running || running.State !== "running",
    "Web must not start after migration failure.",
  );
  docker(["down", "--volumes", "--remove-orphans"]); // this generated CI project only
  await writeFile(file, stringify(config));
  docker(["up", "-d", "--wait", "--wait-timeout", "120"]);
  await smokePublicApp("http://127.0.0.1:3210", {
    release: process.env.RELEASE_ID,
  });
  docker([
    "exec",
    "-T",
    "web",
    "node",
    "-e",
    "const fs=require('node:fs');if(process.getuid()!==1001)process.exit(1);fs.writeFileSync('/data/media/.permission-check','ok');fs.unlinkSync('/data/media/.permission-check')",
  ]);
  // Backup rehearsal: a real nightly backup into a container-local restic
  // repository, then a full restore check including a scratch database whose
  // row counts must match. Proves the shipped tools image can back up and
  // restore, not just that a backup command exits successfully.
  docker([
    "exec",
    "-T",
    "web",
    "node",
    "-e",
    "require('node:fs').mkdirSync('/data/media/ci-probe',{recursive:true});require('node:fs').writeFileSync('/data/media/ci-probe/photo.webp','probe')",
  ]);
  docker([
    "run",
    "--rm",
    "--no-deps",
    "-e",
    "RESTIC_REPOSITORY=/tmp/ci-restic",
    "-e",
    "RESTIC_PASSWORD=disposable-ci-backup-password",
    "-e",
    "RESTORE_CHECK_DATABASE=1",
    "backup",
    "sh",
    "-c",
    "node scripts/backup.mjs once && node scripts/backup.mjs restore-check",
  ]);
  const ready = await (await fetch("http://127.0.0.1:3210/api/ready")).json();
  assert.equal(ready.backup, "ok", "A completed backup must be reported.");
  console.log(
    "Container rollout passed: failed migration blocks web; successful migration, exact release, public smoke, non-root persistent media access, and encrypted backup with verified database/media restore.",
  );
} finally {
  docker(["down", "--volumes", "--remove-orphans"]);
  await unlink(file);
}

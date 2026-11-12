import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { backupConfigured, nextRun, retention } from "../scripts/backup.mjs";

test("nightly backups run at the configured UTC time, strictly in the future", () => {
  const at = (iso) => nextRun(new Date(iso), "02:00").toISOString();
  assert.equal(at("2026-11-10T01:59:59Z"), "2026-11-10T02:00:00.000Z");
  // Exactly at, or after, the run time waits for the next day.
  assert.equal(at("2026-11-10T02:00:00Z"), "2026-11-11T02:00:00.000Z");
  assert.equal(at("2026-11-10T23:30:00Z"), "2026-11-11T02:00:00.000Z");
  assert.equal(at("2026-12-31T03:00:00Z"), "2027-01-01T02:00:00.000Z");
  for (const bad of ["2:00", "24:00", "02:60", "noon"])
    assert.throws(() => nextRun(new Date(), bad), /BACKUP_TIME/);
});

test("backups stay idle until both repository and password are set", () => {
  assert.equal(backupConfigured({}), false);
  assert.equal(backupConfigured({ RESTIC_REPOSITORY: "s3:x/y" }), false);
  assert.equal(backupConfigured({ RESTIC_PASSWORD: "secret" }), false);
  assert.equal(
    backupConfigured({ RESTIC_REPOSITORY: "  ", RESTIC_PASSWORD: "secret" }),
    false,
  );
  assert.equal(
    backupConfigured({
      RESTIC_REPOSITORY: "s3:x/y",
      RESTIC_PASSWORD: "secret",
    }),
    true,
  );
});

test("retention keeps 14 daily, 8 weekly and 6 monthly copies", () => {
  assert.deepEqual(retention, [
    "--keep-daily",
    "14",
    "--keep-weekly",
    "8",
    "--keep-monthly",
    "6",
  ]);
});

test("backup credentials come only from deployment settings", () => {
  for (const file of ["compose.coolify.yaml", "compose.coolify-demo.yaml"]) {
    const compose = readFileSync(file, "utf8");
    for (const variable of [
      "RESTIC_REPOSITORY: ${BACKUP_REPOSITORY:-}",
      "RESTIC_PASSWORD: ${BACKUP_PASSWORD:-}",
      "AWS_ACCESS_KEY_ID: ${BACKUP_KEY_ID:-}",
      "AWS_SECRET_ACCESS_KEY: ${BACKUP_APPLICATION_KEY:-}",
    ])
      assert.ok(compose.includes(variable), file + " maps " + variable);
  }
});

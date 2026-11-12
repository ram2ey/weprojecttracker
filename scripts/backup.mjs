// Nightly encrypted off-site backups: PostgreSQL dump + media volume, stored
// with restic (client-side encryption, deduplication, retention).
//
//   node scripts/backup.mjs schedule        run every night at BACKUP_TIME (UTC)
//   node scripts/backup.mjs once            one backup now
//   node scripts/backup.mjs restore-check   restore the latest snapshot to a
//        temporary directory and verify it; with RESTORE_CHECK_DATABASE=1 also
//        restore the dump into a throwaway database and compare row counts.
//
// Configuration (never printed): RESTIC_REPOSITORY, RESTIC_PASSWORD and, for
// Backblaze B2's S3 API, AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY.
// Database access uses the standard PGHOST/PGUSER/PGPASSWORD/PGDATABASE.
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const retention = [
  "--keep-daily",
  "14",
  "--keep-weekly",
  "8",
  "--keep-monthly",
  "6",
];
const host = "wassa-east";
const tag = "nightly";
const work = "/tmp/wassa-backup";
// Tables whose row counts must survive a restore unchanged.
export const checkedTables = [
  "user",
  "staff",
  "content_record",
  "content_revision",
  "media_file",
  "news_story",
  "project_comment",
  "audit_log",
];

export function backupConfigured(env = process.env) {
  return Boolean(env.RESTIC_REPOSITORY?.trim() && env.RESTIC_PASSWORD);
}

// Next run strictly after `now`, at HH:MM UTC (Ghana uses GMT all year).
export function nextRun(now, time = "02:00") {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) throw new Error("BACKUP_TIME must be HH:MM in UTC.");
  const next = new Date(now);
  next.setUTCHours(Number(match[1]), Number(match[2]), 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

function run(command, args, { capture = false, env = process.env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: ["ignore", capture ? "pipe" : "inherit", "pipe"],
    });
    let out = "";
    let err = "";
    child.stdout?.on("data", (chunk) => (out += chunk));
    child.stderr.on("data", (chunk) => {
      err += chunk;
      if (!capture) process.stderr.write(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve(out)
        : reject(
            Object.assign(
              new Error(`${command} ${args[0]} exited with ${code}`),
              {
                detail: err.slice(-500),
              },
            ),
          ),
    );
  });
}

async function countFiles(dir) {
  let total = 0;
  for (const entry of await readdir(dir, { withFileTypes: true }).catch(
    () => [],
  )) {
    if (entry.isDirectory()) total += await countFiles(join(dir, entry.name));
    else if (entry.isFile()) total += 1;
  }
  return total;
}

async function record(action, details) {
  const { default: pg } = await import("pg");
  const client = new pg.Client();
  await client.connect();
  try {
    await client.query(
      "INSERT INTO audit_log (id, action, subject_id, details) VALUES ($1, $2, $3, $4)",
      [randomUUID(), action, process.env.RELEASE_ID || "local", details],
    );
  } finally {
    await client.end();
  }
}

async function ensureRepository() {
  try {
    await run("restic", ["cat", "config"], { capture: true });
  } catch {
    await run("restic", ["init"]);
  }
}

export async function backupOnce({ now = new Date() } = {}) {
  const media = process.env.MEDIA_ROOT || "/data/media";
  await rm(work, { recursive: true, force: true });
  await mkdir(work, { recursive: true, mode: 0o700 });
  try {
    const dump = join(work, "database.dump");
    // Database first, then media: a photo uploaded meanwhile is at worst an
    // unreferenced extra file, never a database row without its file.
    await run("pg_dump", [
      "--format=custom",
      "--no-owner",
      "--no-acl",
      "--file",
      dump,
    ]);
    await run("pg_restore", ["--list", dump], { capture: true });
    const mediaFiles = await countFiles(media);
    const databaseBytes = (await stat(dump)).size;
    await writeFile(
      join(work, "manifest.json"),
      JSON.stringify(
        {
          created: now.toISOString(),
          release: process.env.RELEASE_ID || "local",
          databaseBytes,
          mediaFiles,
        },
        null,
        2,
      ),
    );
    await ensureRepository();
    const summary = (
      await run(
        "restic",
        ["backup", "--json", "--host", host, "--tag", tag, work, media],
        { capture: true },
      )
    )
      .trim()
      .split("\n")
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .find((line) => line?.message_type === "summary");
    await run("restic", [
      "forget",
      "--host",
      host,
      "--tag",
      tag,
      ...retention,
      "--prune",
    ]);
    // A weekly integrity check of the repository structure.
    if (now.getUTCDay() === 0) await run("restic", ["check"]);
    const details = {
      snapshot: String(summary?.snapshot_id ?? "").slice(0, 8),
      databaseBytes: String(databaseBytes),
      mediaFiles: String(mediaFiles),
    };
    await record("backup.completed", details);
    return details;
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

export async function restoreCheck({ database = false } = {}) {
  const target = await mkdtemp(join(tmpdir(), "wassa-restore-"));
  try {
    await run("restic", [
      "restore",
      "latest",
      "--host",
      host,
      "--tag",
      tag,
      "--target",
      target,
    ]);
    const restoredWork = join(target, work);
    const manifest = JSON.parse(
      await readFile(join(restoredWork, "manifest.json"), "utf8"),
    );
    const dump = join(restoredWork, "database.dump");
    if ((await stat(dump)).size !== manifest.databaseBytes)
      throw new Error(
        "Restored database dump size does not match its manifest.",
      );
    await run("pg_restore", ["--list", dump], { capture: true });
    const mediaFiles = await countFiles(
      join(target, process.env.MEDIA_ROOT || "/data/media"),
    );
    if (mediaFiles !== manifest.mediaFiles)
      throw new Error(
        `Restored ${mediaFiles} media files; the manifest lists ${manifest.mediaFiles}.`,
      );
    const result = {
      created: manifest.created,
      mediaFiles,
      databaseBytes: manifest.databaseBytes,
    };
    if (database) result.tables = await restoreIntoScratchDatabase(dump);
    return result;
  } finally {
    await rm(target, { recursive: true, force: true });
  }
}

// Restores into a uniquely named throwaway database and compares row counts
// with the live database. The live database is only read.
async function restoreIntoScratchDatabase(dump) {
  const { default: pg } = await import("pg");
  const scratch = "wassa_restore_check_" + randomUUID().slice(0, 8);
  const admin = new pg.Client();
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE ${scratch}`);
    await run("pg_restore", [
      "--no-owner",
      "--no-acl",
      "--exit-on-error",
      "--dbname",
      scratch,
      dump,
    ]);
    const restored = new pg.Client({ database: scratch });
    await restored.connect();
    const tables = {};
    try {
      for (const table of checkedTables) {
        const query = `SELECT count(*)::int AS n FROM "${table}"`;
        const [live, copy] = await Promise.all([
          admin.query(query),
          restored.query(query),
        ]);
        // The live audit log may gain rows (e.g. this check) after the dump.
        const ok =
          table === "audit_log"
            ? copy.rows[0].n <= live.rows[0].n
            : copy.rows[0].n === live.rows[0].n;
        if (!ok)
          throw new Error(
            `Restored ${table} has ${copy.rows[0].n} rows; live has ${live.rows[0].n}.`,
          );
        tables[table] = copy.rows[0].n;
      }
    } finally {
      await restored.end();
    }
    return tables;
  } finally {
    await admin.query(`DROP DATABASE IF EXISTS ${scratch}`).catch(() => {});
    await admin.end();
  }
}

async function attempt() {
  const started = Date.now();
  try {
    const details = await backupOnce();
    console.log(
      `Backup completed: snapshot ${details.snapshot}, ${details.mediaFiles} media files, ${Math.round((Date.now() - started) / 1000)}s.`,
    );
    return true;
  } catch (error) {
    console.error("Backup failed:", error.message);
    await record("backup.failed", { error: error.message.slice(0, 200) }).catch(
      () => {},
    );
    return false;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function schedule() {
  const time = process.env.BACKUP_TIME || "02:00";
  nextRun(new Date(), time); // validate before waiting
  for (;;) {
    if (!backupConfigured()) {
      console.log(
        "Backups are not configured yet (BACKUP_REPOSITORY / BACKUP_PASSWORD). Checking again in one hour.",
      );
      await sleep(60 * 60 * 1000);
      continue;
    }
    const next = nextRun(new Date(), time);
    console.log(`Next backup at ${next.toISOString()}.`);
    // Wake at least hourly so clock changes or long sleeps cannot drift far.
    while (Date.now() < next.getTime())
      await sleep(Math.min(next.getTime() - Date.now(), 60 * 60 * 1000));
    if (!(await attempt())) {
      // One retry after 30 minutes for transient network or storage errors.
      await sleep(30 * 60 * 1000);
      await attempt();
    }
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const mode = process.argv[2] || "schedule";
  // The non-root container user has no home directory; keep restic's cache in
  // container-private temporary storage.
  process.env.RESTIC_CACHE_DIR ||= join(tmpdir(), "restic-cache");
  try {
    if (mode !== "schedule" && !backupConfigured())
      throw new Error("Set RESTIC_REPOSITORY and RESTIC_PASSWORD first.");
    if (mode === "schedule") await schedule();
    else if (mode === "once") process.exitCode = (await attempt()) ? 0 : 1;
    else if (mode === "restore-check") {
      const result = await restoreCheck({
        database: process.env.RESTORE_CHECK_DATABASE === "1",
      });
      console.log("Restore check passed:", JSON.stringify(result));
    } else throw new Error("Use: schedule | once | restore-check");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

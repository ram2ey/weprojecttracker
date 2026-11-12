import "server-only";
import { getPool } from "@/db";

// A nightly backup older than this is reported as stale.
export const backupGraceHours = 36;

// Written by scripts/backup.mjs after each successful nightly backup.
export async function backupStatus(): Promise<"none" | "ok" | "stale"> {
  const latest = await getPool().query<{ fresh: boolean }>(
    `SELECT created_at > NOW() - $1 * INTERVAL '1 hour' AS fresh FROM audit_log
     WHERE action='backup.completed' ORDER BY created_at DESC LIMIT 1`,
    [backupGraceHours],
  );
  if (!latest.rowCount) return "none";
  return latest.rows[0].fresh ? "ok" : "stale";
}

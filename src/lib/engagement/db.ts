import type { PoolClient } from "pg";
import { getPool } from "@/db";
export type Tx = PoolClient;
export async function transaction<T>(run: (tx: Tx) => Promise<T>) {
  const tx = await getPool().connect();
  try {
    await tx.query("BEGIN");
    const result = await run(tx);
    await tx.query("COMMIT");
    return result;
  } catch (error) {
    await tx.query("ROLLBACK");
    throw error;
  } finally {
    tx.release();
  }
}
export async function audit(
  tx: Tx,
  actorId: string | null,
  action: string,
  subjectId: string,
  details: Record<string, string> = {},
) {
  await tx.query(
    "INSERT INTO audit_log (id,actor_id,action,subject_id,details) VALUES ($1,$2,$3,$4,$5)",
    [crypto.randomUUID(), actorId, action, subjectId, JSON.stringify(details)],
  );
}
export async function notify(
  tx: Tx,
  kind: string,
  subjectId: string,
  recordId: string | null = null,
  excludeId: string | null = null,
) {
  await tx.query(
    `INSERT INTO staff_notice (id,recipient_id,record_id,kind,dedupe_key,subject_id) SELECT gen_random_uuid()::text,user_id,$3,$1,$1||':'||$2||':'||user_id,$2 FROM staff WHERE active=true AND ($4::text IS NULL OR user_id<>$4) ON CONFLICT (dedupe_key) DO NOTHING`,
    [kind, subjectId, recordId, excludeId],
  );
}

import webpush from "web-push";
import { getPool } from "@/db";
import { encrypt, decrypt, hashToken } from "@/lib/security/crypto";
import { ContentError } from "@/lib/content/service";
import { transaction, notify } from "./db";
import { allowedPushEndpoint, pushSchema } from "./validation";
import type { Guest } from "./guest";
import type { z } from "zod";
export function pushConfigured() {
  return (
    process.env.ENABLE_BROWSER_PUSH === "true" &&
    !!process.env.VAPID_PUBLIC_KEY &&
    !!process.env.VAPID_PRIVATE_KEY &&
    /^(https:\/\/|mailto:)/.test(process.env.VAPID_SUBJECT || "") &&
    !/localhost|example\.(invalid|com)/i.test(process.env.VAPID_SUBJECT || "")
  );
}
export async function savePush(
  guest: Guest,
  input: z.infer<typeof pushSchema>,
) {
  if (!pushConfigured())
    throw new ContentError(
      503,
      "Browser push is not configured yet. In-app updates remain available.",
    );
  return transaction(async (tx) => {
    const hash = hashToken(input.subscription.endpoint);
    const old = await tx.query<{ id: string; device_id: string }>(
      "SELECT id,device_id FROM push_subscription WHERE endpoint_hash=$1 FOR UPDATE",
      [hash],
    );
    if (old.rows[0] && old.rows[0].device_id !== guest.id)
      throw new ContentError(
        409,
        "This browser subscription belongs to another device session. Disable it in browser settings and try again.",
      );
    const live = await tx.query<{ id: string }>(
      "SELECT r.id FROM content_record r JOIN content_revision v ON v.id=r.published_revision_id AND v.record_id=r.id WHERE r.id=ANY($1::text[]) AND r.kind='project' AND r.withdrawn_at IS NULL AND v.state='approved'",
      [input.recordIds],
    );
    const ids = [...new Set(live.rows.map((r) => r.id))],
      id = old.rows[0]?.id || crypto.randomUUID();
    await tx.query(
      "INSERT INTO push_subscription (id,device_id,endpoint_hash,credentials,record_ids) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (endpoint_hash) DO UPDATE SET credentials=excluded.credentials,record_ids=excluded.record_ids,enabled=true,updated_at=NOW(),last_status=NULL WHERE push_subscription.device_id=excluded.device_id",
      [
        id,
        guest.id,
        hash,
        encrypt(JSON.stringify(input.subscription)),
        JSON.stringify(ids),
      ],
    );
    await tx.query("UPDATE guest_device SET last_seen_at=NOW() WHERE id=$1", [
      guest.id,
    ]);
    return { id, enabled: true };
  });
}
export type PushTransport = (
  subscription: webpush.PushSubscription,
  payload: string,
) => Promise<unknown>;
export async function dispatchPush(transport?: PushTransport) {
  if (!transport && !pushConfigured())
    return { sent: 0, failed: 0, disabled: true };
  await getPool().query(
    "UPDATE push_job SET state='retry',next_attempt_at=NOW(),updated_at=NOW() WHERE state='sending' AND updated_at<NOW()-INTERVAL '5 minutes'",
  );
  await getPool().query(
    `INSERT INTO push_job (id,subscription_id,record_id,revision_id) SELECT gen_random_uuid()::text,p.id,r.id,v.id FROM push_subscription p JOIN content_record r ON p.record_ids ? r.id JOIN content_revision v ON v.id=r.published_revision_id AND v.record_id=r.id WHERE p.enabled=true AND r.kind='project' AND r.withdrawn_at IS NULL AND v.state='approved' AND v.decided_at>p.created_at ON CONFLICT (subscription_id,revision_id) DO NOTHING`,
  );
  const claimed = await transaction(async (tx) => {
    const result = await tx.query<{
      id: string;
      subscription_id: string;
      record_id: string;
      revision_id: string;
      attempts: number;
    }>(
      "SELECT id,subscription_id,record_id,revision_id,attempts FROM push_job WHERE state IN ('pending','retry') AND next_attempt_at<=NOW() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 10",
    );
    if (result.rows.length)
      await tx.query(
        "UPDATE push_job SET state='sending',attempts=attempts+1,updated_at=NOW() WHERE id=ANY($1::text[])",
        [result.rows.map((r) => r.id)],
      );
    return result.rows;
  });
  let sent = 0,
    failed = 0;
  const send: PushTransport =
    transport ||
    ((sub, payload) =>
      webpush.sendNotification(sub, payload, {
        vapidDetails: {
          subject: process.env.VAPID_SUBJECT!,
          publicKey: process.env.VAPID_PUBLIC_KEY!,
          privateKey: process.env.VAPID_PRIVATE_KEY!,
        },
        TTL: 3600,
        urgency: "normal",
        timeout: 10000,
      }));
  for (const job of claimed) {
    const live = await getPool().query<{ credentials: string }>(
      "SELECT p.credentials FROM push_subscription p JOIN content_record r ON r.id=$2 WHERE p.id=$1 AND p.enabled=true AND p.record_ids ? r.id AND r.withdrawn_at IS NULL AND r.published_revision_id=$3",
      [job.subscription_id, job.record_id, job.revision_id],
    );
    if (!live.rows[0]) {
      await getPool().query(
        "UPDATE push_job SET state='cancelled',updated_at=NOW() WHERE id=$1",
        [job.id],
      );
      continue;
    }
    try {
      const sub = JSON.parse(
        decrypt(live.rows[0].credentials),
      ) as webpush.PushSubscription;
      if (!allowedPushEndpoint(sub.endpoint)) throw { statusCode: 410 };
      await send(
        sub,
        JSON.stringify({
          title: "Wassa East Projects",
          body: "A project you follow has an approved update.",
          tag: "wassa-public-update",
          url: "/following",
        }),
      );
      await getPool().query(
        "UPDATE push_job SET state='sent',last_status=201,updated_at=NOW() WHERE id=$1",
        [job.id],
      );
      sent++;
    } catch (error) {
      const status =
        typeof (error as { statusCode?: number })?.statusCode === "number"
          ? (error as { statusCode: number }).statusCode
          : 0;
      const expired = [404, 410].includes(status),
        exhausted = job.attempts + 1 >= 5;
      await transaction(async (tx) => {
        await tx.query(
          "UPDATE push_job SET state=$2,last_status=$3,next_attempt_at=NOW()+$4*INTERVAL '1 minute',updated_at=NOW() WHERE id=$1",
          [
            job.id,
            expired ? "cancelled" : exhausted ? "failed" : "retry",
            status,
            Math.min(360, Math.pow(5, job.attempts)),
          ],
        );
        await tx.query(
          "UPDATE push_subscription SET last_status=$2,enabled=CASE WHEN $3 THEN false ELSE enabled END WHERE id=$1",
          [job.subscription_id, status, expired],
        );
        if (expired)
          await tx.query("DELETE FROM push_subscription WHERE id=$1", [
            job.subscription_id,
          ]);
        else if (exhausted)
          await notify(tx, "push_failure", job.id, job.record_id);
      });
      failed++;
    }
  }
  return { sent, failed, disabled: false };
}

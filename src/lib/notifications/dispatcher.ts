import { randomUUID } from "node:crypto";
import { getPool } from "@/db";
import { transaction } from "./service";
import { eventJoins, matchingFollow, visibleEvent } from "./events";
import {
  decryptSubscription,
  deliveryOutcome,
  maxAttempts,
  pushConfiguration,
  retrySeconds,
  type Subscription,
} from "./policy";
import { sendPush, type SendResult } from "./transport";

export async function fanoutEvents() {
  let enabled = false;
  try {
    enabled = pushConfiguration().enabled;
  } catch {
    /* Keep inbox fanout working during a push configuration fault. */
  }
  return transaction(async (client) => {
    const events = await client.query<{
      id: string;
    }>(`SELECT e.id FROM notification_event e
      WHERE e.fanout_at IS NULL ORDER BY e.created_at,e.id LIMIT 25 FOR UPDATE SKIP LOCKED`);
    for (const { id } of events.rows) {
      await client.query(
        `INSERT INTO notification_receipt(event_id,device_id,generation,state)
        SELECT DISTINCT e.id,d.id,s.generation,
          CASE WHEN $2::boolean AND s.device_id IS NOT NULL AND s.created_at<=e.created_at
            AND e.created_at>NOW()-INTERVAL '24 hours' THEN 'pending' ELSE 'skipped' END
        FROM notification_event e ${eventJoins}
        JOIN notification_follow f ON ${matchingFollow} AND f.created_at<=e.created_at
        JOIN notification_device d ON d.id=f.device_id AND d.expires_at>NOW()
        LEFT JOIN notification_subscription s ON s.device_id=d.id
        WHERE e.id=$1 AND ${visibleEvent} ON CONFLICT DO NOTHING`,
        [id, enabled],
      );
      await client.query(
        "UPDATE notification_event SET fanout_at=NOW() WHERE id=$1",
        [id],
      );
    }
    return events.rowCount ?? 0;
  });
}
type Job = {
  event_id: string;
  device_id: string;
  generation: string;
  attempts: number;
  claim_token: string;
};
export async function claimJob(): Promise<Job | null> {
  return transaction(async (client) => {
    const selected =
      await client.query<Job>(`SELECT r.* FROM notification_receipt r WHERE
      (r.state IN ('pending','retry') AND r.next_attempt_at<=NOW()) OR
      (r.state='sending' AND r.lease_until<NOW())
      ORDER BY r.next_attempt_at,r.event_id,r.device_id LIMIT 1 FOR UPDATE SKIP LOCKED`);
    const row = selected.rows[0];
    if (!row) return null;
    const claim = randomUUID();
    await client.query(
      `UPDATE notification_receipt SET state='sending',attempts=attempts+1,
      claim_token=$3,lease_until=NOW()+INTERVAL '60 seconds' WHERE event_id=$1 AND device_id=$2`,
      [row.event_id, row.device_id, claim],
    );
    return { ...row, attempts: row.attempts + 1, claim_token: claim };
  });
}
export async function deliverJob(
  job: Job,
  send: (s: Subscription, payload: string) => Promise<SendResult> = sendPush,
) {
  const eligible = await getPool().query<{
    credentials: string;
    kind: string;
    title: string;
    url: string;
  }>(
    `SELECT s.credentials,e.title,e.kind,
      CASE WHEN e.record_id IS NOT NULL THEN '/projects/'||c.slug ELSE '/news/'||n.id END AS url
    FROM notification_receipt r JOIN notification_event e ON e.id=r.event_id ${eventJoins}
    JOIN notification_device d ON d.id=r.device_id AND d.expires_at>NOW()
    JOIN notification_subscription s ON s.device_id=d.id AND s.generation=r.generation AND s.created_at<=e.created_at
    WHERE r.event_id=$1 AND r.device_id=$2 AND r.claim_token=$3 AND r.state='sending'
      AND ${visibleEvent} AND e.created_at>NOW()-INTERVAL '24 hours'
      AND EXISTS(SELECT 1 FROM notification_follow f WHERE f.device_id=d.id AND f.created_at<=e.created_at AND ${matchingFollow})`,
    [job.event_id, job.device_id, job.claim_token],
  );
  const data = eligible.rows[0];
  if (!pushConfiguration().enabled || !data || job.attempts > maxAttempts) {
    await finish(job, "cancelled");
    return "cancelled";
  }
  let result: SendResult | undefined;
  try {
    const subscription = decryptSubscription(data.credentials, job.device_id);
    result = await send(
      subscription,
      JSON.stringify({
        title: data.kind.startsWith("news-")
          ? "Wassa East news"
          : "Wassa East project update",
        body: data.title,
        url: data.url,
        tag: job.event_id,
      }),
    );
  } catch {
    /* Provider errors and encrypted credentials must not enter logs. */
  }
  const outcome = deliveryOutcome(result?.status, job.attempts);
  if (outcome === "expired") {
    await transaction(async (client) => {
      // An old in-flight response must never delete a newer subscription.
      await client.query(
        "DELETE FROM notification_subscription WHERE device_id=$1 AND generation=$2",
        [job.device_id, job.generation],
      );
      await client.query(
        `UPDATE notification_receipt SET state='cancelled',claim_token=NULL,lease_until=NULL,last_status=$3
        WHERE device_id=$1 AND generation=$2 AND state IN ('pending','retry','sending')`,
        [job.device_id, job.generation, result!.status],
      );
    });
  } else
    await finish(
      job,
      outcome,
      result?.status,
      retrySeconds(job.attempts, result?.retryAfter),
    );
  return outcome;
}
async function finish(job: Job, state: string, status?: number, delay = 0) {
  await getPool().query(
    `UPDATE notification_receipt SET state=$4,last_status=$5,
    next_attempt_at=NOW()+$6*INTERVAL '1 second',lease_until=NULL,claim_token=NULL
    WHERE event_id=$1 AND device_id=$2 AND claim_token=$3 AND state='sending'`,
    [
      job.event_id,
      job.device_id,
      job.claim_token,
      state,
      status ?? null,
      delay,
    ],
  );
}
export async function cleanupNotifications() {
  await getPool().query(
    "DELETE FROM notification_device WHERE expires_at<=NOW()",
  );
  await getPool().query(
    "DELETE FROM notification_event WHERE created_at<NOW()-INTERVAL '90 days'",
  );
}
export async function dispatchBatch() {
  const events = await fanoutEvents();
  let deliveries = 0;
  const outcomes: Record<string, number> = {};
  let push: "enabled" | "disabled" | "misconfigured" = "disabled";
  try {
    if (pushConfiguration().enabled) push = "enabled";
  } catch {
    push = "misconfigured";
  }
  if (push === "enabled")
    for (let i = 0; i < 5; i++) {
      const job = await claimJob();
      if (!job) break;
      const outcome = await deliverJob(job);
      outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
      deliveries++;
    }
  else
    await getPool().query(
      "UPDATE notification_receipt SET state='cancelled',claim_token=NULL,lease_until=NULL WHERE state IN ('pending','retry','sending')",
    );
  await cleanupNotifications();
  return { events, deliveries, outcomes, push };
}

import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getPool } from "@/db";
import { fixedCategories } from "@/lib/content/validation";
import {
  deviceDays,
  hash,
  newToken,
  encryptSubscription,
  type Follow,
  type Subscription,
} from "./policy";
import { eventJoins, matchingFollow, visibleEvent } from "./events";

export class NotificationError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function transaction<T>(work: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function deviceFor(token: string | null, client = getPool()) {
  if (!token) return null;
  return (
    (
      await client.query<{ id: string }>(
        "SELECT id FROM notification_device WHERE token_hash=$1 AND expires_at>NOW()",
        [hash(token)],
      )
    ).rows[0]?.id ?? null
  );
}
async function lockedDevice(client: PoolClient, token: string) {
  const row = (
    await client.query<{ id: string }>(
      "SELECT id FROM notification_device WHERE token_hash=$1 AND expires_at>NOW() FOR UPDATE",
      [hash(token)],
    )
  ).rows[0];
  if (!row)
    throw new NotificationError(
      401,
      "Follow a project or topic to start receiving updates.",
    );
  return row.id;
}
async function validateFollow(client: PoolClient, follow: Follow) {
  if (follow.kind === "news") return;
  if (follow.kind === "category") {
    if (!fixedCategories.some((c) => c.id === follow.target))
      throw new NotificationError(404, "Category unavailable.");
    return;
  }
  const result =
    follow.kind === "project"
      ? await client.query(
          `SELECT c.id FROM content_record c JOIN content_revision r ON r.id=c.published_revision_id AND r.record_id=c.id
      WHERE c.id=$1 AND c.kind='project' AND c.withdrawn_at IS NULL AND r.state='approved'`,
          [follow.target],
        )
      : await client.query(
          "SELECT id FROM taxonomy WHERE id=$1 AND kind='community' AND active=true",
          [follow.target],
        );
  if (!result.rowCount)
    throw new NotificationError(
      404,
      "This project or community is unavailable.",
    );
}
export async function followTopic(token: string | null, follow: Follow) {
  return transaction(async (client) => {
    await validateFollow(client, follow);
    let id: string | undefined;
    let createdToken: string | undefined;
    if (token) {
      const row = (
        await client.query<{ id: string }>(
          "SELECT id FROM notification_device WHERE token_hash=$1 AND expires_at>NOW() FOR UPDATE",
          [hash(token)],
        )
      ).rows[0];
      id = row?.id;
    }
    if (!id) {
      createdToken = newToken();
      id = randomUUID();
      await client.query(
        "INSERT INTO notification_device(id,token_hash,expires_at) VALUES($1,$2,NOW()+$3*INTERVAL '1 day')",
        [id, hash(createdToken), deviceDays],
      );
    }
    const count = await client.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM notification_follow WHERE device_id=$1",
      [id],
    );
    const existing = await client.query(
      "SELECT 1 FROM notification_follow WHERE device_id=$1 AND kind=$2 AND target=$3",
      [id, follow.kind, follow.target],
    );
    if (count.rows[0].count >= 100 && !existing.rowCount)
      throw new NotificationError(
        400,
        "You can follow up to 100 projects and topics.",
      );
    await client.query(
      "INSERT INTO notification_follow(device_id,kind,target) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
      [id, follow.kind, follow.target],
    );
    return { createdToken };
  });
}
export async function unfollowTopic(token: string, follow: Follow) {
  await transaction(async (client) => {
    const id = await lockedDevice(client, token);
    await client.query(
      "DELETE FROM notification_follow WHERE device_id=$1 AND kind=$2 AND target=$3",
      [id, follow.kind, follow.target],
    );
    // Preserve an overlapping follow, but cancel everything that no longer matches.
    await client.query(
      `UPDATE notification_receipt r SET state='cancelled', claim_token=NULL, lease_until=NULL
      FROM notification_event e WHERE r.event_id=e.id AND r.device_id=$1 AND r.state IN ('pending','retry','sending')
      AND NOT EXISTS (SELECT 1 FROM notification_follow f WHERE f.device_id=r.device_id AND ${matchingFollow})`,
      [id],
    );
  });
}
export async function saveSubscription(token: string, value: Subscription) {
  await transaction(async (client) => {
    const id = await lockedDevice(client, token);
    const follows = await client.query(
      "SELECT 1 FROM notification_follow WHERE device_id=$1 LIMIT 1",
      [id],
    );
    if (!follows.rowCount)
      throw new NotificationError(400, "Follow a project or topic first.");
    const endpointHash = hash(value.endpoint);
    const old = (
      await client.query<{ endpoint_hash: string; credentials: string }>(
        "SELECT endpoint_hash,credentials FROM notification_subscription WHERE device_id=$1",
        [id],
      )
    ).rows[0];
    // Each explicit re-subscription starts fresh: no queued historical push.
    // Idempotent submission of identical credentials keeps its generation.
    if (old?.endpoint_hash === endpointHash) {
      const { decryptSubscription } = await import("./policy");
      const prior = decryptSubscription(old.credentials, id);
      if (
        prior.keys.auth === value.keys.auth &&
        prior.keys.p256dh === value.keys.p256dh
      )
        return;
    }
    const owner = await client.query(
      "SELECT device_id FROM notification_subscription WHERE endpoint_hash=$1 AND device_id<>$2",
      [endpointHash, id],
    );
    if (owner.rowCount)
      throw new NotificationError(
        409,
        "This browser subscription is already registered. Reset its browser permission before subscribing again.",
      );
    await client.query(
      `INSERT INTO notification_subscription(device_id,endpoint_hash,credentials,generation)
      VALUES($1,$2,$3,$4) ON CONFLICT(device_id) DO UPDATE SET endpoint_hash=excluded.endpoint_hash,
      credentials=excluded.credentials,generation=excluded.generation,created_at=NOW()`,
      [id, endpointHash, encryptSubscription(value, id), randomUUID()],
    );
    await cancelDeviceJobs(client, id);
  });
}
async function cancelDeviceJobs(client: PoolClient, id: string) {
  await client.query(
    "UPDATE notification_receipt SET state='cancelled',claim_token=NULL,lease_until=NULL WHERE device_id=$1 AND state IN ('pending','retry','sending')",
    [id],
  );
}
export async function removeSubscription(token: string) {
  await transaction(async (client) => {
    const id = await lockedDevice(client, token);
    await client.query(
      "DELETE FROM notification_subscription WHERE device_id=$1",
      [id],
    );
    await cancelDeviceJobs(client, id);
  });
}
export async function deleteDevice(token: string) {
  await getPool().query("DELETE FROM notification_device WHERE token_hash=$1", [
    hash(token),
  ]);
}
export async function inbox(
  token: string | null,
  view: "all" | "for-you",
  page: number,
) {
  const id = await deviceFor(token);
  const follows = id
    ? (
        await getPool().query(
          "SELECT kind,target FROM notification_follow WHERE device_id=$1 ORDER BY kind,target",
          [id],
        )
      ).rows
    : [];
  const subscribed = id
    ? !!(
        await getPool().query(
          "SELECT 1 FROM notification_subscription WHERE device_id=$1",
          [id],
        )
      ).rowCount
    : false;
  const result = await getPool().query(
    `SELECT e.id,e.kind,e.title,e.created_at AS "createdAt",r.read_at AS "readAt",
    CASE WHEN e.record_id IS NOT NULL THEN '/projects/'||c.slug ELSE '/news/'||n.id END AS url,
    count(*) OVER()::int AS total
    FROM notification_event e ${eventJoins}
    LEFT JOIN notification_receipt r ON r.event_id=e.id AND r.device_id=$1
    WHERE ${visibleEvent} AND ($2='all' OR (r.device_id IS NOT NULL AND EXISTS
      (SELECT 1 FROM notification_follow f WHERE f.device_id=$1 AND ${matchingFollow})))
    ORDER BY e.created_at DESC,e.id DESC LIMIT 50 OFFSET $3`,
    [id, view, (page - 1) * 50],
  );
  const unread = id
    ? (
        await getPool().query<{ count: number }>(
          `SELECT count(*)::int AS count FROM notification_receipt r
    JOIN notification_event e ON e.id=r.event_id ${eventJoins} WHERE r.device_id=$1 AND r.read_at IS NULL AND ${visibleEvent}
    AND EXISTS(SELECT 1 FROM notification_follow f WHERE f.device_id=$1 AND ${matchingFollow})`,
          [id],
        )
      ).rows[0].count
    : 0;
  return {
    follows,
    subscribed,
    deviceRegistered: !!id,
    unread,
    items: result.rows.map(({ id, kind, title, createdAt, readAt, url }) => ({
      id,
      kind,
      title,
      createdAt,
      readAt,
      url,
    })),
    page,
    hasMore: (result.rows[0]?.total ?? 0) > page * 50,
  };
}
export async function markRead(token: string, ids: string[], before?: string) {
  await transaction(async (client) => {
    const id = await lockedDevice(client, token);
    await client.query(
      `UPDATE notification_receipt r SET read_at=NOW() FROM notification_event e
      WHERE r.event_id=e.id AND r.device_id=$1 AND r.read_at IS NULL AND
      (e.id=ANY($2::text[]) OR ($3::timestamp IS NOT NULL AND e.created_at<=LEAST($3::timestamp,NOW())))`,
      [id, ids, before ?? null],
    );
  });
}

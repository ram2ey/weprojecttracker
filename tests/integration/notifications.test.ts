import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { config } from "dotenv";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import webpush from "web-push";
import { testDatabaseUrl } from "../../scripts/test-database.mjs";
import { getDb, getPool } from "../../src/db";
import {
  createRecord,
  createRevision,
  saveRevision,
  submitRevision,
  decideRevision,
  withdrawRecord,
  type Actor,
} from "../../src/lib/content/service";
import { changeNews } from "../../src/lib/news/service";
import { launchPayload } from "../../src/lib/content/validation";
import { emptyPayload } from "../../src/lib/content/types";
import {
  followTopic,
  saveSubscription,
  inbox,
  markRead,
  unfollowTopic,
  removeSubscription,
  deleteDevice,
  deviceFor,
} from "../../src/lib/notifications/service";
import {
  fanoutEvents,
  claimJob,
  deliverJob,
  cleanupNotifications,
  dispatchBatch,
} from "../../src/lib/notifications/dispatcher";
import { publishEvent } from "../../src/lib/notifications/events";
import { notificationsApi } from "../../src/lib/notifications/api";

test(
  "notification foundation on an isolated disposable database",
  { timeout: 120000 },
  async (t) => {
    if (process.env.CI !== "true") config({ path: ".env.local", quiet: true });
    const base = testDatabaseUrl();
    const name = "wassa_notifications_" + randomUUID().replaceAll("-", "");
    assert.match(name, /^wassa_notifications_[a-f0-9]{32}$/);
    const maintenance = new URL(base);
    maintenance.pathname = "/postgres";
    const admin = new Pool({ connectionString: maintenance.toString() });
    base.pathname = "/" + name;
    process.env.DATABASE_URL = base.toString();
    process.env.BETTER_AUTH_URL = "https://tracker.example.test";
    process.env.BETTER_AUTH_SECRET =
      "disposable-notification-test-secret-not-production";
    const keys = webpush.generateVAPIDKeys();
    process.env.ENABLE_BROWSER_PUSH = "true";
    process.env.VAPID_PUBLIC_KEY = keys.publicKey;
    process.env.VAPID_PRIVATE_KEY = keys.privateKey;
    process.env.VAPID_SUBJECT = "https://tracker.example.test";
    process.env.NOTIFICATION_ENCRYPTION_KEY =
      randomBytes(32).toString("base64url");
    let created = false;
    try {
      await admin.query(`CREATE DATABASE "${name}"`);
      created = true;
      await migrate(drizzle(getPool()), { migrationsFolder: "drizzle" });
      const pool = getPool();
      const author: Actor = { id: randomUUID(), role: "officer" };
      const reviewer: Actor = { id: randomUUID(), role: "approver" };
      for (const actor of [author, reviewer])
        await pool.query('INSERT INTO "user"(id,name,email) VALUES($1,$1,$2)', [
          actor.id,
          actor.id + "@example.invalid",
        ]);
      const community = randomUUID();
      await pool.query(
        "INSERT INTO taxonomy(id,kind,name) VALUES($1,'community','Notification test community')",
        [community],
      );
      const category = {
        kind: "category" as const,
        target: "category-education",
      };
      const token = (await followTopic(null, category)).createdToken!;
      const device = (await deviceFor(token))!;
      const subscription = () => ({
        endpoint: "https://fcm.googleapis.com/fcm/send/" + randomUUID(),
        keys: {
          p256dh: webpush.generateVAPIDKeys().publicKey,
          auth: randomBytes(16).toString("base64url"),
        },
      });
      await saveSubscription(token, subscription());
      let project: { recordId: string; revisionId: string };
      let lastEvent = "";
      const payload = (
        title: string,
        status: "Planned" | "Ongoing" = "Planned",
      ) =>
        launchPayload({
          ...emptyPayload,
          title,
          description:
            "A synthetic publication for the notification integration test.",
          categoryId: category.target,
          communityId: community,
          source: "Synthetic test office",
          status,
        });
      async function prepareRevision(
        title: string,
        status: "Planned" | "Ongoing" = "Planned",
        fresh = false,
      ) {
        const r = fresh
          ? await createRecord(author, "project", title)
          : await createRevision(author, project.recordId);
        const saved = await saveRevision(author, r.recordId, r.revisionId, {
          payload: payload(title, status),
          lockVersion: 0,
        });
        await submitRevision(
          author,
          r.recordId,
          r.revisionId,
          saved.lockVersion,
        );
        return { ...r, lockVersion: saved.lockVersion + 1 };
      }
      async function publish(
        title: string,
        status: "Planned" | "Ongoing" = "Planned",
        major = true,
      ) {
        const r = await prepareRevision(title, status);
        await decideRevision(reviewer, r.recordId, r.revisionId, {
          action: "approve",
          evidenceReviewed: true,
          reason: "",
          notifyFollowers: major,
          lockVersion: r.lockVersion,
        });
        await fanoutEvents();
        lastEvent = (
          await pool.query(
            "SELECT id FROM notification_event WHERE dedupe_key=$1",
            ["project:" + r.revisionId],
          )
        ).rows[0]?.id;
        return r;
      }
      await t.test(
        "only independent committed approvals create events and overlapping follows deduplicate",
        async () => {
          const r = await prepareRevision(
            "First notification project",
            "Planned",
            true,
          );
          project = r;
          assert.equal(
            (await pool.query("SELECT 1 FROM notification_event")).rowCount,
            0,
          );
          await assert.rejects(() =>
            decideRevision(author, r.recordId, r.revisionId, {
              action: "approve",
              evidenceReviewed: true,
              reason: "",
              lockVersion: r.lockVersion,
            }),
          );
          await followTopic(token, { kind: "community", target: community });
          await decideRevision(reviewer, r.recordId, r.revisionId, {
            action: "approve",
            evidenceReviewed: true,
            reason: "",
            lockVersion: r.lockVersion,
          });
          await Promise.all([fanoutEvents(), fanoutEvents()]);
          assert.equal(
            (await pool.query("SELECT 1 FROM notification_event")).rowCount,
            1,
          );
          assert.equal(
            (await pool.query("SELECT 1 FROM notification_receipt")).rowCount,
            1,
          );
          assert.equal((await inbox(token, "for-you", 1)).unread, 1);
          const jobs = await Promise.all([claimJob(), claimJob()]);
          assert.equal(jobs.filter(Boolean).length, 1);
          const job = jobs.find(Boolean)!;
          assert.equal(
            await deliverJob(job, async (_sub, body) => {
              assert.equal(JSON.parse(body).tag, job.event_id);
              return { status: 201 };
            }),
            "sent",
          );
          await markRead(token, [job.event_id]);
          assert.equal((await inbox(token, "for-you", 1)).unread, 0);
        },
      );
      await t.test(
        "minor corrections stay quiet; status and major updates create events",
        async () => {
          await publish("Minor title correction", "Planned", false);
          assert.equal(
            (await pool.query("SELECT 1 FROM notification_event")).rowCount,
            1,
          );
          await publish("Work has started", "Ongoing", false);
          assert.equal(
            (
              await pool.query(
                "SELECT kind FROM notification_event WHERE id=$1",
                [lastEvent],
              )
            ).rows[0].kind,
            "status-changed",
          );
          const job = await claimJob();
          assert.ok(job);
          await deliverJob(job, async () => ({ status: 201 }));
          await publish("Significant new evidence", "Ongoing", true);
          assert.equal(
            (
              await pool.query(
                "SELECT kind FROM notification_event WHERE id=$1",
                [lastEvent],
              )
            ).rows[0].kind,
            "project-updated",
          );
        },
      );
      await t.test(
        "transient provider failures back off, expired leases recover, and stale claims cannot complete",
        async () => {
          const job = (await claimJob())!;
          assert.ok(job);
          assert.equal(
            await deliverJob(job, async () => ({
              status: 429,
              retryAfter: "300",
            })),
            "retry",
          );
          const delay = await pool.query(
            "SELECT next_attempt_at>NOW()+INTERVAL '290 seconds' AS ok FROM notification_receipt WHERE event_id=$1",
            [job.event_id],
          );
          assert.equal(delay.rows[0].ok, true);
          await pool.query(
            "UPDATE notification_receipt SET next_attempt_at=NOW()-INTERVAL '1 second' WHERE event_id=$1",
            [job.event_id],
          );
          const claimed = (await claimJob())!;
          await pool.query(
            "UPDATE notification_receipt SET lease_until=NOW()-INTERVAL '1 second' WHERE event_id=$1",
            [job.event_id],
          );
          const recovered = (await claimJob())!;
          assert.notEqual(claimed.claim_token, recovered.claim_token);
          let sends = 0;
          await deliverJob(claimed, async () => {
            sends++;
            return { status: 201 };
          });
          assert.equal(sends, 0);
          await deliverJob(recovered, async () => ({ status: 201 }));
        },
      );
      await t.test(
        "an old 410 response cannot delete a new subscription",
        async () => {
          await publish("Subscription rotation test", "Ongoing");
          const job = (await claimJob())!;
          assert.ok(job);
          await deliverJob(job, async () => {
            await saveSubscription(token, subscription());
            return { status: 410 };
          });
          assert.equal((await inbox(token, "for-you", 1)).subscribed, true);
          await publish("Expired endpoint test", "Ongoing");
          const expired = (await claimJob())!;
          assert.ok(expired);
          await deliverJob(expired, async () => ({ status: 410 }));
          assert.equal((await inbox(token, "for-you", 1)).subscribed, false);
        },
      );
      await t.test(
        "inbox works without push and later opt-in does not replay old alerts",
        async () => {
          await publish("Inbox only publication", "Ongoing");
          assert.equal(
            (
              await pool.query(
                "SELECT state FROM notification_receipt WHERE event_id=$1",
                [lastEvent],
              )
            ).rows[0].state,
            "skipped",
          );
          await saveSubscription(token, subscription());
          assert.equal(await claimJob(), null);
          const later = (await followTopic(null, category)).createdToken!;
          assert.equal((await inbox(later, "for-you", 1)).items.length, 0);
          await deleteDevice(later);
        },
      );
      await t.test(
        "unfollow preserves overlapping matches; complete opt-out blocks queued delivery",
        async () => {
          await publish("Unfollow test", "Ongoing");
          await unfollowTopic(token, category);
          const job = (await claimJob())!;
          assert.ok(job);
          await deliverJob(job, async () => ({ status: 201 }));
          await publish("Cancel queued test", "Ongoing");
          const cancelled = (await claimJob())!;
          assert.ok(cancelled);
          await removeSubscription(token);
          let sends = 0;
          await deliverJob(cancelled, async () => {
            sends++;
            return { status: 201 };
          });
          assert.equal(sends, 0);
        },
      );
      await t.test(
        "withdrawal hides inbox events and cancels claimed delivery",
        async () => {
          await saveSubscription(token, subscription());
          await publish("Withdrawal test", "Ongoing");
          const job = (await claimJob())!;
          assert.ok(job);
          await withdrawRecord(
            reviewer,
            project.recordId,
            "Synthetic withdrawal for integration test.",
          );
          let sends = 0;
          await deliverJob(job, async () => {
            sends++;
            return { status: 201 };
          });
          assert.equal(sends, 0);
          assert.equal((await inbox(token, "all", 1)).items.length, 0);
        },
      );
      await t.test(
        "news requires its own opt-in and is emitted only after approval",
        async () => {
          const id = randomUUID();
          await followTopic(token, { kind: "news", target: "all" });
          const news = {
            action: "submit",
            id,
            version: 0,
            removePhoto: false,
            fields: {
              kind: "News",
              title: "Synthetic news",
              summary: "Synthetic summary",
              detail: "Synthetic detail",
              project: "",
              caption: "",
            },
          };
          await changeNews(author, news);
          const before = (
            await pool.query("SELECT count(*) FROM notification_event")
          ).rows[0].count;
          await assert.rejects(() =>
            changeNews(author, { action: "approve", id, version: 1 }),
          );
          assert.equal(
            (await pool.query("SELECT count(*) FROM notification_event"))
              .rows[0].count,
            before,
          );
          await changeNews(reviewer, { action: "approve", id, version: 1 });
          await fanoutEvents();
          assert.equal((await inbox(token, "for-you", 1)).items.length, 1);
          const job = (await claimJob())!;
          assert.ok(job);
          await deliverJob(job, async () => ({ status: 201 }));
          await changeNews(author, {
            ...news,
            version: 2,
            fields: { ...news.fields, title: "Minor news correction" },
          });
          await changeNews(reviewer, { action: "approve", id, version: 3 });
          await fanoutEvents();
          assert.equal(
            (
              await pool.query(
                "SELECT 1 FROM notification_event WHERE story_id=$1",
                [id],
              )
            ).rowCount,
            1,
          );
          assert.equal(await claimJob(), null);
          await changeNews(reviewer, { action: "withdraw", id, version: 4 });
          assert.equal((await inbox(token, "all", 1)).items.length, 0);
        },
      );
      await t.test(
        "event insertion rolls back with the publication transaction",
        async () => {
          const dedupe = "rollback:" + randomUUID();
          await assert.rejects(() =>
            getDb().transaction(async (tx) => {
              await publishEvent(tx, {
                dedupeKey: dedupe,
                recordId: project.recordId,
                kind: "project-updated",
                title: "Must not escape",
              });
              throw new Error("rollback");
            }),
          );
          assert.equal(
            (
              await pool.query(
                "SELECT 1 FROM notification_event WHERE dedupe_key=$1",
                [dedupe],
              )
            ).rowCount,
            0,
          );
        },
      );
      await t.test(
        "API enforces same-origin writes, small JSON, device ownership and private responses",
        async () => {
          const url = "https://tracker.example.test/api/public/notifications";
          assert.equal(
            (
              await notificationsApi(
                new Request(url, {
                  method: "POST",
                  headers: { Origin: "https://evil.test" },
                }),
              )
            ).status,
            403,
          );
          const make = (body: unknown, cookie = "") =>
            new Request(url, {
              method: "POST",
              headers: {
                Origin: "https://tracker.example.test",
                "Content-Type": "application/json",
                Cookie: cookie,
              },
              body: JSON.stringify(body),
            });
          assert.equal(
            (
              await notificationsApi(
                make({
                  action: "follow",
                  follow: category,
                  padding: "x".repeat(20000),
                }),
              )
            ).status,
            400,
          );
          const response = await notificationsApi(
            make({ action: "follow", follow: category }),
          );
          assert.equal(response.status, 200);
          const cookie = response.headers.get("set-cookie")!;
          assert.match(cookie, /HttpOnly/);
          assert.match(cookie, /Secure/);
          assert.match(cookie, /SameSite=Strict/);
          const guestRead = await notificationsApi(new Request(url));
          assert.equal(guestRead.headers.get("set-cookie"), null);
          assert.match(guestRead.headers.get("cache-control")!, /no-store/);
          assert.equal((await guestRead.json()).deviceRegistered, false);
          const body = await (
            await notificationsApi(
              new Request(url, { headers: { Cookie: cookie.split(";")[0] } }),
            )
          ).json();
          assert.equal(body.deviceRegistered, true);
          assert.equal(
            JSON.stringify(body).includes(process.env.VAPID_PRIVATE_KEY!),
            false,
          );
          const deletion = await notificationsApi(
            new Request(url, {
              method: "DELETE",
              headers: {
                Origin: "https://tracker.example.test",
                Cookie: cookie.split(";")[0],
              },
            }),
          );
          assert.equal(deletion.status, 200);
        },
      );
      await t.test(
        "disabled or misconfigured push keeps inbox fanout working and cancels pending phone jobs",
        async () => {
          async function story(title: string) {
            const id = randomUUID();
            await changeNews(author, {
              action: "submit",
              id,
              version: 0,
              removePhoto: false,
              fields: {
                kind: "News",
                title,
                summary: "Test summary",
                detail: "Test detail",
                project: "",
                caption: "",
              },
            });
            await changeNews(reviewer, { action: "approve", id, version: 1 });
          }
          await story("Configuration failure test");
          const key = process.env.NOTIFICATION_ENCRYPTION_KEY;
          process.env.NOTIFICATION_ENCRYPTION_KEY = "invalid";
          const invalid = await dispatchBatch();
          assert.equal(invalid.push, "misconfigured");
          assert.equal((await inbox(token, "for-you", 1)).items.length, 1);
          assert.equal(await claimJob(), null);
          process.env.NOTIFICATION_ENCRYPTION_KEY = key;
          await story("Disable phone delivery test");
          await fanoutEvents();
          process.env.ENABLE_BROWSER_PUSH = "false";
          const disabled = await dispatchBatch();
          assert.equal(disabled.push, "disabled");
          assert.equal((await inbox(token, "for-you", 1)).items.length, 2);
          assert.equal(await claimJob(), null);
          process.env.ENABLE_BROWSER_PUSH = "true";
        },
      );
      await t.test(
        "dispatcher command and health check work without browser push enabled",
        async () => {
          const health = join(
            tmpdir(),
            `wassa-notifications-test-${randomUUID()}.json`,
          );
          const env = {
            ...process.env,
            ENABLE_BROWSER_PUSH: "false",
            NOTIFICATION_HEALTH_FILE: health,
          };
          try {
            const out = execFileSync(
              process.execPath,
              ["--import", "tsx", "scripts/notification-worker.ts", "--once"],
              { env, encoding: "utf8", timeout: 30000 },
            );
            assert.equal(JSON.parse(out.trim()).push, "disabled");
            execFileSync(
              process.execPath,
              ["--import", "tsx", "scripts/notification-worker.ts", "--health"],
              { env, timeout: 30000 },
            );
          } finally {
            await unlink(health).catch(() => {});
          }
        },
      );
      await t.test(
        "expired devices and events are pruned and device deletion cascades",
        async () => {
          await pool.query(
            "UPDATE notification_device SET expires_at=NOW()-INTERVAL '1 second' WHERE id=$1",
            [device],
          );
          await cleanupNotifications();
          assert.equal(await deviceFor(token), null);
          assert.equal(
            (
              await pool.query(
                "SELECT 1 FROM notification_follow WHERE device_id=$1",
                [device],
              )
            ).rowCount,
            0,
          );
          assert.equal(
            (
              await pool.query(
                "SELECT 1 FROM notification_subscription WHERE device_id=$1",
                [device],
              )
            ).rowCount,
            0,
          );
          await pool.query(
            "UPDATE notification_event SET created_at=NOW()-INTERVAL '91 days'",
          );
          await cleanupNotifications();
          assert.equal(
            (await pool.query("SELECT 1 FROM notification_event")).rowCount,
            0,
          );
        },
      );
    } finally {
      await getPool().end();
      if (created) await admin.query(`DROP DATABASE "${name}"`);
      await admin.end();
    }
  },
);

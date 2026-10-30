import {
  test,
  expect,
  request as requests,
  type APIRequestContext,
} from "@playwright/test";
import { config } from "dotenv";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import ExcelJS from "exceljs";
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { encrypt, hashToken, newTotp } from "../../src/lib/security/crypto";
import {
  emptyPayload,
  emptyFinancials,
  type AdminRecord,
} from "../../src/lib/content/types";
config({ path: ".env.local", quiet: true });
const dburl = new URL(process.env.DATABASE_URL!);
dburl.pathname = "/wassa_test";
if (dburl.hostname !== "127.0.0.1" || dburl.port !== "55432")
  throw new Error("Isolated database required");
process.env.DATABASE_URL = dburl.toString();
process.env.ENABLE_BROWSER_PUSH = "false";
const pool = new Pool({ connectionString: dburl.toString() }),
  origin = "http://localhost:3100",
  headers = { Origin: origin };
const people: string[] = [],
  records: string[] = [],
  devices: string[] = [],
  submissions: string[] = [];
let officer: APIRequestContext,
  operator: APIRequestContext,
  approver: APIRequestContext,
  guest: APIRequestContext,
  other: APIRequestContext;
let project: string,
  revision: string,
  slug: string,
  officerId: string,
  operatorId: string;
async function ok<T = Record<string, unknown>>(
  response: Awaited<ReturnType<APIRequestContext["get"]>>,
): Promise<T> {
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()) as T;
}
async function account(role: string, hash: string) {
  const id = randomUUID(),
    email = `phase4-${id}@example.invalid`;
  people.push(id);
  const totp = newTotp(email);
  await pool.query(
    'INSERT INTO "user" (id,name,email,email_verified) VALUES ($1,$2,$3,true)',
    [id, `Phase 4 ${role}`, email],
  );
  await pool.query(
    "INSERT INTO staff (user_id,role,mfa_secret,mfa_enabled,recovery_hashes) VALUES ($1,$2,$3,true,$4)",
    [
      id,
      role,
      encrypt(totp.secret.base32),
      JSON.stringify([hashToken("phase4-recovery")]),
    ],
  );
  await pool.query(
    "INSERT INTO account (id,account_id,provider_id,user_id,password) VALUES ($1,$2,'credential',$2,$3)",
    [randomUUID(), id, hash],
  );
  const api = await requests.newContext({
    baseURL: origin,
    extraHTTPHeaders: headers,
  });
  await ok(
    await api.post("/api/auth/sign-in/email", {
      data: { email, password: "Phase4-test-password-2026!" },
    }),
  );
  await ok(
    await api.post("/api/staff/mfa", {
      data: { action: "verify", code: "phase4-recovery" },
    }),
  );
  return { api, id };
}
async function fixture(title = "Phase 4 approved project") {
  const id = randomUUID(),
    v = randomUUID(),
    s = `phase4-${id}`;
  records.push(id);
  await pool.query(
    "INSERT INTO content_record (id,kind,slug,created_by) VALUES ($1,'project',$2,$3)",
    [id, s, officerId],
  );
  await pool.query(
    "INSERT INTO content_revision (id,record_id,number,state,author_id,contributors,decided_by,decided_at,payload,financials,base_version) VALUES ($1,$2,1,'approved',$3,$4,$5,NOW()-INTERVAL '40 days',$6,$7,0)",
    [
      v,
      id,
      officerId,
      JSON.stringify([officerId]),
      operatorId,
      JSON.stringify({
        ...emptyPayload,
        title,
        description:
          "Approved community information for phase four verification.",
        categoryId: "category-education",
        categoryName: "Education",
        communityName: "Phase 4 community",
        status: "Ongoing",
        progress: 45,
        progressExplanation: "Construction is progressing as reviewed.",
        source: "Reviewed field information",
        reportingOffice: "Constituency office",
      }),
      JSON.stringify({
        ...emptyFinancials,
        budget: "987654321.12",
        expenditure: "12345.67",
        fundingSource: "PHASE4-PRIVATE-FUNDING",
      }),
    ],
  );
  await pool.query(
    "UPDATE content_record SET published_revision_id=$2 WHERE id=$1",
    [id, v],
  );
  return { id, v, slug: s };
}
async function challenge(api: APIRequestContext) {
  const c = await ok<{ challengeId: string; question: string }>(
    await api.get("/api/public/engagement/session"),
  );
  const nums = c.question.match(/\d+/g)!.map(Number);
  await pool.query(
    "UPDATE guest_challenge SET created_at=NOW()-INTERVAL '3 seconds' WHERE id=$1",
    [c.challengeId],
  );
  const d = await pool.query<{ device_id: string }>(
    "SELECT device_id FROM guest_challenge WHERE id=$1",
    [c.challengeId],
  );
  devices.push(d.rows[0].device_id);
  return { ...c, answer: String(nums[0] + nums[1]) };
}
async function send(
  api: APIRequestContext,
  kind = "comment",
  body = `A useful visitor message ${randomUUID()}`,
  extra: Record<string, unknown> = {},
) {
  const c = await challenge(api);
  const r = await api.post("/api/public/engagement/submissions", {
    data: {
      recordId: project,
      kind,
      body,
      displayName: "Neighbour",
      challengeId: c.challengeId,
      answer: c.answer,
      ...extra,
    },
  });
  if (r.status() === 200) submissions.push((await r.json()).id);
  return r;
}
const decision = (action: string, version = 0) => ({
  action,
  version,
  reason: "Reviewed for accuracy, relevance and privacy.",
  reviewed: true,
});
test.beforeAll(async () => {
  await pool.query("DELETE FROM auth_rate_limit");
  await pool.query("DELETE FROM app_rate_limit");
  const hash = await hashPassword("Phase4-test-password-2026!");
  const o = await account("officer", hash);
  officer = o.api;
  officerId = o.id;
  const op = await account("super_admin", hash);
  operator = op.api;
  operatorId = op.id;
  approver = (await account("approver", hash)).api;
  guest = await requests.newContext({
    baseURL: origin,
    extraHTTPHeaders: headers,
  });
  other = await requests.newContext({
    baseURL: origin,
    extraHTTPHeaders: headers,
  });
  const f = await fixture();
  project = f.id;
  revision = f.v;
  slug = f.slug;
});
test.afterAll(async () => {
  await pool.query(
    "DELETE FROM report_source WHERE report_record_id=ANY($1::text[]) OR source_record_id=ANY($1::text[])",
    [records],
  );
  await pool.query(
    "UPDATE content_record SET published_revision_id=NULL WHERE id=ANY($1::text[])",
    [records],
  );
  await pool.query("DELETE FROM media_file WHERE record_id=ANY($1::text[])", [
    records,
  ]);
  await pool.query(
    "DELETE FROM content_revision WHERE record_id=ANY($1::text[])",
    [records],
  );
  await pool.query("DELETE FROM content_record WHERE id=ANY($1::text[])", [
    records,
  ]);
  await pool.query("DELETE FROM guest_device WHERE id=ANY($1::text[])", [
    devices,
  ]);
  await pool.query(
    "DELETE FROM audit_log WHERE actor_id=ANY($1::text[]) OR subject_id=ANY($2::text[])",
    [people, [...records, ...submissions]],
  );
  await pool.query('DELETE FROM "user" WHERE id=ANY($1::text[])', [people]);
  await Promise.all(
    [officer, operator, approver, guest, other]
      .filter(Boolean)
      .map((c) => c.dispose()),
  );
  await pool.end();
});
test("guest moderation, independent replies, private device visibility and withdrawal", async () => {
  const comment = await ok<{ id: string }>(await send(guest));
  expect(
    (
      await ok<{ comments: unknown[] }>(
        await other.get(`/api/public/engagement/${project}`),
      )
    ).comments,
  ).toHaveLength(0);
  expect(
    (
      await officer.post(`/api/staff/engagement/${comment.id}`, {
        data: decision("approve"),
      })
    ).status(),
  ).toBe(403);
  await ok(
    await approver.post(`/api/staff/engagement/${comment.id}`, {
      data: decision("approve"),
    }),
  );
  expect(
    (
      await approver.post(`/api/staff/engagement/${comment.id}`, {
        data: decision("approve"),
      })
    ).status(),
  ).toBe(409);
  const reply = await ok<{ id: string }>(
    await operator.post(`/api/staff/engagement/${comment.id}`, {
      data: {
        action: "respond",
        body: "The team has checked this comment and will include it in the next site visit.",
      },
    }),
  );
  expect(
    (
      await operator.post(`/api/staff/engagement/replies/${reply.id}`, {
        data: decision("approve"),
      })
    ).status(),
  ).toBe(403);
  await ok(
    await approver.post(`/api/staff/engagement/replies/${reply.id}`, {
      data: decision("approve"),
    }),
  );
  let publicData = await ok<{
    comments: { id: string; replies: unknown[] }[];
    own: unknown[];
  }>(await other.get(`/api/public/engagement/${project}`));
  expect(publicData.comments[0].replies).toHaveLength(1);
  expect(publicData.own).toHaveLength(0);
  const feedback = await ok<{ id: string }>(
    await send(
      guest,
      "feedback",
      "PRIVATE-FEEDBACK-MARKER for this project only.",
    ),
  );
  const response = await ok<{ id: string }>(
    await officer.post(`/api/staff/engagement/${feedback.id}`, {
      data: {
        action: "respond",
        body: "PRIVATE-RESPONSE-MARKER received by the constituency team.",
      },
    }),
  );
  await ok(
    await approver.post(`/api/staff/engagement/replies/${response.id}`, {
      data: decision("approve"),
    }),
  );
  expect(
    await (await other.get(`/api/public/engagement/${project}`)).text(),
  ).not.toContain("PRIVATE-");
  expect(
    await (await guest.get(`/api/public/engagement/${project}`)).text(),
  ).toContain("PRIVATE-RESPONSE-MARKER");
  expect(
    (
      await other.delete(`/api/public/engagement/submissions/${feedback.id}`)
    ).status(),
  ).toBe(403);
  await ok(
    await guest.delete(`/api/public/engagement/submissions/${feedback.id}`),
  );
  expect(
    await (await guest.get(`/api/public/engagement/${project}`)).text(),
  ).not.toContain("PRIVATE-RESPONSE-MARKER");
  await ok(
    await guest.delete(`/api/public/engagement/submissions/${comment.id}`),
  );
  publicData = await ok(await other.get(`/api/public/engagement/${project}`));
  expect(publicData.comments).toHaveLength(0);
});
test("origin, challenges, spam, replay, closed comments and staff self-review", async () => {
  expect(
    (
      await other.post("/api/public/engagement/submissions", {
        headers: { Origin: "https://foreign.invalid" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await send(
        other,
        "comment",
        "A normal visitor message with a filled trap.",
        { website: "https://spam.invalid" },
      )
    ).status(),
  ).toBe(400);
  const c = await challenge(other);
  const data = {
    recordId: project,
    kind: "comment",
    body: "A single use arithmetic challenge is required.",
    challengeId: c.challengeId,
    answer: c.answer,
  };
  const result = await ok<{ id: string }>(
    await other.post("/api/public/engagement/submissions", { data }),
  );
  submissions.push(result.id);
  expect(
    (
      await other.post("/api/public/engagement/submissions", {
        data: {
          ...data,
          body: "A second attempt with the same challenge fails.",
        },
      })
    ).status(),
  ).toBe(400);
  const settings = {
    commentsEnabled: false,
    reminderDays: 60,
    version: 0,
    reason: "Pause comments while the team reviews the backlog.",
  };
  expect(
    (
      await officer.patch(`/api/staff/content/${project}/engagement`, {
        data: settings,
      })
    ).status(),
  ).toBe(403);
  await ok(
    await approver.patch(`/api/staff/content/${project}/engagement`, {
      data: settings,
    }),
  );
  expect((await send(other)).status()).toBe(409);
  expect(
    (
      await approver.patch(`/api/staff/content/${project}/engagement`, {
        data: settings,
      })
    ).status(),
  ).toBe(409);
  await ok(
    await approver.patch(`/api/staff/content/${project}/engagement`, {
      data: {
        ...settings,
        commentsEnabled: true,
        reminderDays: 30,
        version: 1,
      },
    }),
  );
  const own = await ok<{ id: string }>(await send(operator));
  expect(
    (
      await operator.post(`/api/staff/engagement/${own.id}`, {
        data: decision("approve"),
      })
    ).status(),
  ).toBe(403);
  await ok(
    await approver.post(`/api/staff/engagement/${own.id}`, {
      data: decision("reject"),
    }),
  );
});
test("staff inbox is recipient-scoped and live push stays disabled", async () => {
  const data = await ok<{
    items: { id: string; read_at: string | null }[];
    unread: number;
  }>(await approver.get("/api/staff/inbox"));
  expect(data.unread).toBeGreaterThan(0);
  const id = data.items[0].id;
  await ok(await officer.post("/api/staff/inbox", { data: { ids: [id] } }));
  expect(
    (await pool.query("SELECT read_at FROM staff_notice WHERE id=$1", [id]))
      .rows[0].read_at,
  ).toBeNull();
  await ok(await approver.post("/api/staff/inbox", { data: { ids: [id] } }));
  expect(
    (await pool.query("SELECT read_at FROM staff_notice WHERE id=$1", [id]))
      .rows[0].read_at,
  ).not.toBeNull();
  const config = await ok<{ enabled: boolean; publicKey: null }>(
    await guest.get("/api/public/push/config"),
  );
  expect(config).toEqual({ enabled: false, publicKey: null });
  expect((await guest.get("/api/staff/reports?format=csv")).status()).toBe(403);
});
test("internal exports reopen, public report drafts exclude financials and require independent publication", async () => {
  const filter = "q=Phase%204%20approved";
  const csv = await officer.get(`/api/staff/reports?${filter}&format=csv`);
  expect(csv.status(), await csv.text()).toBe(200);
  expect(await csv.text()).toContain("PHASE4-PRIVATE-FUNDING");
  const xlsx = await officer.get(`/api/staff/reports?${filter}&format=xlsx`);
  expect(xlsx.status()).toBe(200);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(Uint8Array.from(await xlsx.body()).buffer);
  expect(book.worksheets[0].getCell("F5").value).toBe(45);
  expect(book.worksheets[0].getCell("L5").value).toBe(987654321.12);
  const pdf = await officer.get(`/api/staff/reports?${filter}&format=pdf`);
  expect(pdf.status(), await pdf.text()).toBe(200);
  await mkdir(resolve(".local/phase4-verification"), { recursive: true });
  await writeFile(
    resolve(".local/phase4-verification/internal.pdf"),
    await pdf.body(),
  );
  await writeFile(
    resolve(".local/phase4-verification/internal.xlsx"),
    await xlsx.body(),
  );
  const draft = await ok<{ recordId: string; revisionId: string }>(
    await officer.post("/api/staff/reports", {
      data: {
        title: "Phase 4 public project summary",
        reportingOffice: "Constituency reporting office",
        filters: { q: "Phase 4 approved" },
      },
    }),
  );
  records.push(draft.recordId);
  const record = await ok<AdminRecord>(
    await officer.get(`/api/staff/content/${draft.recordId}`),
  );
  const file = record.files[0];
  expect((await guest.get(`/api/media/${file.id}`)).status()).toBe(404);
  const publicPdf = await officer.get(`/api/media/${file.id}`);
  expect(publicPdf.status()).toBe(200);
  await writeFile(
    resolve(".local/phase4-verification/public.pdf"),
    await publicPdf.body(),
  );
  const endpoint = `/api/staff/content/${draft.recordId}/revisions/${draft.revisionId}`;
  await ok(
    await officer.post(endpoint, {
      data: { action: "submit", lockVersion: 1 },
    }),
  );
  expect(
    (
      await officer.post(endpoint, {
        data: {
          action: "approve",
          lockVersion: 2,
          reason: "Reviewed the public-only report data.",
          evidenceReviewed: true,
        },
      })
    ).status(),
  ).toBe(403);
  const withdrawing = await pool.connect();
  try {
    await withdrawing.query("BEGIN");
    await withdrawing.query(
      "SELECT id FROM content_record WHERE id=$1 FOR UPDATE",
      [project],
    );
    const approval = approver.post(endpoint, {
      data: {
        action: "approve",
        lockVersion: 2,
        reason: "Reviewed the public-only report data.",
        evidenceReviewed: true,
      },
    });
    await expect
      .poll(async () =>
        Number(
          (
            await pool.query(
              "SELECT count(*) AS total FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%report_source%FOR SHARE OF source%'",
            )
          ).rows[0].total,
        ),
      )
      .toBeGreaterThan(0);
    await withdrawing.query(
      "UPDATE content_record SET withdrawn_at=NOW() WHERE id=$1",
      [project],
    );
    await withdrawing.query("COMMIT");
    expect((await approval).status()).toBe(409);
  } finally {
    await withdrawing.query("ROLLBACK");
    withdrawing.release();
    await pool.query(
      "UPDATE content_record SET withdrawn_at=NULL WHERE id=$1",
      [project],
    );
  }
  await ok(
    await approver.post(endpoint, {
      data: {
        action: "approve",
        lockVersion: 2,
        reason: "Reviewed the public-only report data.",
        evidenceReviewed: true,
      },
    }),
  );
  expect((await guest.get(`/api/media/${file.id}`)).status()).toBe(200);
  expect((await guest.get(`/information/${record.slug}`)).status()).toBe(200);
  await pool.query("UPDATE content_record SET withdrawn_at=NOW() WHERE id=$1", [
    project,
  ]);
  expect((await guest.get(`/api/media/${file.id}`)).status()).toBe(404);
  expect((await guest.get(`/information/${record.slug}`)).status()).toBe(404);
  expect((await guest.get(`/api/public/engagement/${project}`)).status()).toBe(
    404,
  );
  await pool.query("UPDATE content_record SET withdrawn_at=NULL WHERE id=$1", [
    project,
  ]);
});
test("reminders and retention are idempotent; push retries use a fake transport only", async () => {
  const { runMaintenance } = await import("../../src/worker/maintenance");
  const { dispatchPush } = await import("../../src/lib/engagement/push");
  const { getPool } = await import("../../src/db");
  const db = getPool();
  const device = randomUUID();
  devices.push(device);
  await db.query("INSERT INTO guest_device (id,token_hash) VALUES ($1,$2)", [
    device,
    hashToken(randomUUID()),
  ]);
  const oldIds = [randomUUID(), randomUUID()];
  await db.query(
    "INSERT INTO guest_submission (id,record_id,device_id,kind,body,state,created_at) VALUES ($1,$3,$4,'comment','Old approved comment remains available.','approved',NOW()-INTERVAL '13 months'),($2,$3,$4,'feedback','Old private feedback is expired.','resolved',NOW()-INTERVAL '13 months')",
    [...oldIds, project, device],
  );
  submissions.push(...oldIds);
  await runMaintenance();
  await runMaintenance();
  expect(
    (
      await db.query(
        "SELECT id FROM guest_submission WHERE id=ANY($1::text[])",
        [oldIds],
      )
    ).rows.map((r) => r.id),
  ).toEqual([oldIds[0]]);
  const notices = await db.query(
    "SELECT recipient_id,count(*)::int AS n FROM staff_notice WHERE record_id=$1 AND kind='overdue_update' GROUP BY recipient_id",
    [project],
  );
  expect(notices.rows.length).toBeGreaterThanOrEqual(3);
  expect(notices.rows.every((r) => r.n === 1)).toBe(true);
  expect(
    (
      await db.query(
        "SELECT payload->>'status' AS status FROM content_revision WHERE id=$1",
        [revision],
      )
    ).rows[0].status,
  ).toBe("Ongoing");
  await db.query("UPDATE content_record SET reminder_days=0 WHERE id=$1", [
    project,
  ]);
  await db.query(
    "DELETE FROM staff_notice WHERE record_id=$1 AND kind='overdue_update'",
    [project],
  );
  await runMaintenance();
  expect(
    (
      await db.query(
        "SELECT 1 FROM staff_notice WHERE record_id=$1 AND kind='overdue_update'",
        [project],
      )
    ).rowCount,
  ).toBe(0);
  await db.query("UPDATE content_record SET reminder_days=30 WHERE id=$1", [
    project,
  ]);
  expect((await dispatchPush()).disabled).toBe(true);
  const subscription = randomUUID();
  await db.query(
    "INSERT INTO push_subscription (id,device_id,endpoint_hash,credentials,record_ids,created_at) VALUES ($1,$2,$3,$4,$5,NOW()-INTERVAL '50 days')",
    [
      subscription,
      device,
      hashToken(randomUUID()),
      encrypt(
        JSON.stringify({
          endpoint: "https://fcm.googleapis.com/fake-phase4",
          keys: { p256dh: "fake", auth: "fake" },
        }),
      ),
      JSON.stringify([project]),
    ],
  );
  let payload = "";
  await dispatchPush(async (_sub, p) => {
    payload = p;
    throw { statusCode: 503 };
  });
  const job = (
    await db.query("SELECT * FROM push_job WHERE subscription_id=$1", [
      subscription,
    ])
  ).rows[0];
  expect(job.state).toBe("retry");
  expect(job.attempts).toBe(1);
  expect(payload).not.toContain("Phase 4 approved");
  expect(JSON.parse(payload).url).toBe("/following");
  await db.query("UPDATE push_job SET next_attempt_at=NOW() WHERE id=$1", [
    job.id,
  ]);
  await dispatchPush(async () => {
    throw { statusCode: 410 };
  });
  expect(
    (
      await db.query("SELECT 1 FROM push_subscription WHERE id=$1", [
        subscription,
      ])
    ).rowCount,
  ).toBe(0);
  const exhausted = randomUUID(),
    cancelled = randomUUID();
  for (const id of [exhausted, cancelled])
    await db.query(
      "INSERT INTO push_subscription (id,device_id,endpoint_hash,credentials,record_ids,created_at) VALUES ($1,$2,$3,$4,$5,NOW()-INTERVAL '50 days')",
      [
        id,
        device,
        hashToken(id),
        encrypt(
          JSON.stringify({
            endpoint: "https://fcm.googleapis.com/fake-phase4",
            keys: { p256dh: "fake", auth: "fake" },
          }),
        ),
        JSON.stringify([project]),
      ],
    );
  await db.query(
    "INSERT INTO push_job (id,subscription_id,record_id,revision_id,attempts) VALUES ($1,$2,$3,$4,4)",
    [randomUUID(), exhausted, project, revision],
  );
  await dispatchPush(async () => {
    throw { statusCode: 503 };
  });
  expect(
    (
      await db.query("SELECT state FROM push_job WHERE subscription_id=$1", [
        exhausted,
      ])
    ).rows[0].state,
  ).toBe("failed");
  await db.query(
    "UPDATE push_job SET next_attempt_at=NOW() WHERE subscription_id=$1",
    [cancelled],
  );
  await db.query("UPDATE content_record SET withdrawn_at=NOW() WHERE id=$1", [
    project,
  ]);
  let calls = 0;
  await dispatchPush(async () => {
    calls++;
  });
  expect(calls).toBe(0);
  expect(
    (
      await db.query("SELECT state FROM push_job WHERE subscription_id=$1", [
        cancelled,
      ])
    ).rows[0].state,
  ).toBe("cancelled");
  await db.query("UPDATE content_record SET withdrawn_at=NULL WHERE id=$1", [
    project,
  ]);
  await db.end();
});
test("device follows and offline copies work without caching private routes", async ({
  page,
  context,
}) => {
  await page.goto(`/projects/${slug}`);
  await page
    .getByRole("button", { name: "Follow this project", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Following on this device" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goto("/following");
  await expect(
    page.getByRole("heading", {
      name: "Phase 4 approved project",
      exact: true,
    }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page
    .getByRole("button", { name: "Enable offline reading", exact: true })
    .click();
  await expect(
    page.getByText("Offline reading enabled.", { exact: false }),
  ).toBeVisible();
  await page.goto(`/projects/${slug}`);
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        const c = await caches.open("wassa-public-v1-pages");
        return (await c.keys()).some((k) => k.url === location.href);
      }),
    )
    .toBe(true);
  await page.request.get(`/api/public/engagement/${project}`);
  await context.addCookies((await officer.storageState()).cookies);
  await page.goto(`/admin/content/${project}`);
  await expect(
    page.getByRole("heading", { name: "Comments & update reminders" }),
  ).toBeVisible();
  await page.goto("/admin?view=engagement&state=all");
  await expect(
    page.getByRole("heading", { name: "Comments & feedback" }),
  ).toBeVisible();
  await page.goto("/admin?view=inbox");
  await expect(
    page.getByRole("heading", { name: "Inbox", exact: true }),
  ).toBeVisible();
  await page.goto("/admin?view=reports");
  await expect(
    page.getByRole("heading", { name: "Reports", exact: true }),
  ).toBeVisible();
  const image = await sharp({
    create: { width: 40, height: 40, channels: 3, background: "#35724e" },
  })
    .png()
    .toBuffer();
  await ok(
    await officer.post(`/api/staff/content/${project}`, {
      data: { action: "revise" },
    }),
  );
  const privateFile = await ok<{ id: string }>(
    await officer.post(`/api/staff/content/${project}/media`, {
      multipart: {
        file: { name: "private.png", mimeType: "image/png", buffer: image },
        internalOnly: "true",
      },
    }),
  );
  expect(
    (
      await page.request.get(`/api/public/thumbnails/${privateFile.id}`)
    ).status(),
  ).toBe(404);
  await page.evaluate(async (id) => {
    const response = await fetch(`/api/media/${id}`);
    if (!response.ok)
      throw new Error("Private fixture was unavailable to verified staff");
    await response.arrayBuffer();
  }, privateFile.id);
  await page.goto("/staff/login");
  await page.goto(`/projects/${slug}`);
  const keys = await page.evaluate(async () => {
    const all = [];
    for (const n of await caches.keys())
      for (const k of await (await caches.open(n)).keys()) all.push(k.url);
    return all;
  });
  expect(
    keys.some((k) =>
      /\/staff\/|\/admin|\/api\/media|\/engagement|\/inbox/.test(k),
    ),
  ).toBe(false);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Phase 4 approved project",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText(/Offline reading · Copy saved/)).toBeVisible();
  await context.setOffline(false);
  await pool.query("UPDATE content_record SET withdrawn_at=NOW() WHERE id=$1", [
    project,
  ]);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: /page could not be found|not found/i }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      async () =>
        !!(await (
          await caches.open("wassa-public-v1-pages")
        ).match(location.href)),
    ),
  ).toBe(false);
  await pool.query("UPDATE content_record SET withdrawn_at=NULL WHERE id=$1", [
    project,
  ]);
});
test("visitors can submit through the form and rate limits reject excess attempts", async ({
  page,
}) => {
  await page.goto(`/projects/${slug}`);
  await page
    .getByRole("button", { name: "Write a comment", exact: true })
    .click();
  await page
    .getByLabel("Your message", { exact: true })
    .fill("The community would appreciate the next approved progress update.");
  const input = page.getByLabel(/What is \d+ \+ \d+\?/);
  await expect(input).toBeVisible();
  const question = await input.locator("..").innerText();
  const nums = question.match(/\d+/g)!.map(Number);
  await input.fill(String(nums[0] + nums[1]));
  await page
    .getByRole("button", { name: "Send for review", exact: true })
    .click();
  await expect(
    page.getByText("Your comment is awaiting review. It is not public yet."),
  ).toBeVisible();
  await page.getByText("Your messages on this device", { exact: true }).click();
  await expect(
    page.getByText("comment · pending", { exact: true }),
  ).toBeVisible();
  const limited = await requests.newContext({
    baseURL: origin,
    extraHTTPHeaders: headers,
  });
  try {
    const c = await challenge(limited);
    for (let i = 0; i < 6; i++)
      expect(
        (
          await limited.post("/api/public/engagement/submissions", {
            data: {
              recordId: project,
              kind: "comment",
              body: "This message uses an incorrect challenge answer.",
              challengeId: c.challengeId,
              answer: "wrong",
            },
          })
        ).status(),
      ).toBe(400);
    expect(
      (
        await limited.post("/api/public/engagement/submissions", {
          data: {
            recordId: project,
            kind: "comment",
            body: "This message must now be rate limited.",
            challengeId: c.challengeId,
            answer: c.answer,
          },
        })
      ).status(),
    ).toBe(429);
  } finally {
    await limited.dispose();
  }
});

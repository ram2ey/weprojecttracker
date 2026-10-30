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
import sharp from "sharp";
import { PDFDocument, PDFName, PDFString } from "pdf-lib";
import { encrypt, hashToken, newTotp } from "../../src/lib/security/crypto";
import {
  emptyPayload,
  emptyFinancials,
  type ContentPayload,
  type ContentKind,
  type AdminRecord,
  type AdminFile,
  type PublicContent,
} from "../../src/lib/content/types";
config({ path: ".env.local", quiet: true });
const url = new URL(process.env.DATABASE_URL!);
url.pathname = "/wassa_test";
if (url.hostname !== "127.0.0.1" || url.port !== "55432")
  throw new Error("Isolated test database required.");
const pool = new Pool({ connectionString: url.toString() });
const origin = "http://localhost:3100";
const headers = { Origin: origin };
const users: string[] = [],
  records: string[] = [],
  terms: string[] = [];
let officer: APIRequestContext,
  operator: APIRequestContext,
  approver: APIRequestContext,
  anon: APIRequestContext;
let community: string, png: Buffer, pdf: Buffer;
async function account(role: string, passwordHash: string) {
  const id = randomUUID(),
    email = `phase2-${id}@example.invalid`,
    secret = newTotp(email).secret.base32;
  users.push(id);
  await pool.query(
    'INSERT INTO "user" (id,name,email,email_verified) VALUES ($1,$2,$3,true)',
    [id, `Test ${role}`, email],
  );
  await pool.query(
    "INSERT INTO staff (user_id,role,mfa_secret,mfa_enabled,recovery_hashes) VALUES ($1,$2,$3,true,$4)",
    [
      id,
      role,
      encrypt(secret),
      JSON.stringify([hashToken("phase2-recovery-code")]),
    ],
  );
  await pool.query(
    "INSERT INTO account (id,account_id,provider_id,user_id,password) VALUES ($1,$2,'credential',$2,$3)",
    [randomUUID(), id, passwordHash],
  );
  const api = await requests.newContext({
    baseURL: origin,
    extraHTTPHeaders: headers,
  });
  const login = await api.post("/api/auth/sign-in/email", {
    data: { email, password: "Phase2-test-password-2026!" },
  });
  expect(login.status(), await login.text()).toBe(200);
  const mfa = await api.post("/api/staff/mfa", {
    data: { action: "verify", code: "phase2-recovery-code" },
  });
  expect(mfa.status(), await mfa.text()).toBe(200);
  return api;
}
async function ok<T = unknown>(
  response: Awaited<ReturnType<APIRequestContext["get"]>>,
): Promise<T> {
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()) as T;
}
type Draft = {
  recordId: string;
  revisionId: string;
  lockVersion: number;
  payload: ContentPayload;
};
async function create(
  api = officer,
  kind: ContentKind = "project",
  title = "A reviewed constituency project",
): Promise<Draft> {
  const result = await ok<{ recordId: string; revisionId: string }>(
    await api.post("/api/staff/content", { data: { kind, title } }),
  );
  records.push(result.recordId);
  return {
    ...result,
    lockVersion: 0,
    payload: {
      ...emptyPayload,
      title,
      description: "A documented project description for independent review.",
      objectives: "Improve the local service.",
      categoryId: "category-education",
      communityId: community,
      source: "Verified field visit",
      reportingOffice: "Constituency project office",
      progressExplanation: "Work has not started; the baseline is recorded.",
      attachments: [],
      milestones: [],
      references: [],
      videoLinks: [],
      tags: [],
    },
  };
}
const endpoint = (d: Draft) =>
  `/api/staff/content/${d.recordId}/revisions/${d.revisionId}`;
async function save(d: Draft, api = officer) {
  const r = await ok<{ lockVersion: number }>(
    await api.patch(endpoint(d), {
      data: {
        payload: d.payload,
        financials: {
          ...emptyFinancials,
          budget: "987654321.12",
          expenditure: "123456.78",
          fundingSource: "PRIVATE-FUNDING-MARKER",
          internalNotes: "PRIVATE-NOTES-MARKER",
        },
        lockVersion: d.lockVersion,
      },
    }),
  );
  d.lockVersion = r.lockVersion;
}
async function submit(d: Draft, api = officer) {
  await ok(
    await api.post(endpoint(d), {
      data: { action: "submit", lockVersion: d.lockVersion },
    }),
  );
  d.lockVersion++;
}
async function decide(d: Draft, action = "approve", api = approver) {
  const r = await api.post(endpoint(d), {
    data: {
      action,
      reason: "Verified information and supporting evidence.",
      evidenceReviewed: true,
      lockVersion: d.lockVersion,
    },
  });
  return r;
}
async function detail(d: Draft) {
  return ok<AdminRecord>(await officer.get(`/api/staff/content/${d.recordId}`));
}
async function revise(d: Draft): Promise<Draft> {
  const result = await ok<{ recordId: string; revisionId: string }>(
    await officer.post(`/api/staff/content/${d.recordId}`, {
      data: { action: "revise" },
    }),
  );
  const data = await detail(d);
  const r = data.revisions.find(
    (r: { id: string }) => r.id === result.revisionId,
  );
  if (!r) throw new Error("Created revision missing.");
  return { ...result, lockVersion: r.lockVersion, payload: r.payload };
}
async function upload(
  d: Draft,
  bytes = png,
  name = "site.png",
  mimeType = "image/png",
  internalOnly = false,
) {
  return ok<AdminFile>(
    await officer.post(`/api/staff/content/${d.recordId}/media`, {
      multipart: {
        file: { name, mimeType, buffer: bytes },
        internalOnly: String(internalOnly),
      },
    }),
  );
}
test.beforeAll(async () => {
  await pool.query("DELETE FROM auth_rate_limit");
  await pool.query("DELETE FROM app_rate_limit");
  const hash = await hashPassword("Phase2-test-password-2026!");
  officer = await account("officer", hash);
  operator = await account("super_admin", hash);
  approver = await account("approver", hash);
  anon = await requests.newContext({ baseURL: origin });
  const term = await ok<{ id: string }>(
    await operator.post("/api/staff/taxonomy", {
      data: {
        kind: "community",
        name: `Test community ${randomUUID().slice(0, 8)}`,
        active: true,
        parentId: null,
      },
    }),
  );
  community = term.id;
  terms.push(community);
  png = await sharp({
    create: { width: 120, height: 80, channels: 3, background: "#447755" },
  })
    .png()
    .withMetadata()
    .toBuffer();
  const doc = await PDFDocument.create();
  doc.addPage().drawText("Public supporting report.");
  pdf = Buffer.from(await doc.save());
});
test.afterAll(async () => {
  if (records.length) {
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
  }
  await pool.query(
    "DELETE FROM audit_log WHERE actor_id=ANY($1::text[]) OR subject_id=ANY($2::text[])",
    [users, [...records, ...terms]],
  );
  if (terms.length)
    await pool.query("DELETE FROM taxonomy WHERE id=ANY($1::text[])", [terms]);
  if (users.length)
    await pool.query('DELETE FROM "user" WHERE id=ANY($1::text[])', [users]);
  for (const api of [officer, operator, approver, anon]) await api?.dispose();
  await pool.end();
});
test("taxonomy and staff mutations enforce role and origin boundaries", async () => {
  expect(
    (
      await officer.post("/api/staff/taxonomy", {
        data: { kind: "community", name: "Unauthorised", active: true },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await approver.post("/api/staff/content", {
        data: { kind: "project", title: "Unauthorised project" },
      })
    ).status(),
  ).toBe(403);
  expect((await anon.get("/api/staff/content")).status()).toBe(403);
  expect(
    (
      await officer.post("/api/staff/content", {
        headers: { Origin: "https://untrusted.invalid" },
        data: { kind: "project", title: "Wrong origin" },
      })
    ).status(),
  ).toBe(403);
  const name = `Test category ${randomUUID()}`;
  const term = await ok<{ id: string }>(
    await operator.post("/api/staff/taxonomy", {
      data: { kind: "category", name, active: true },
    }),
  );
  terms.push(term.id);
  expect(
    (
      await operator.post("/api/staff/taxonomy", {
        data: { kind: "category", name, active: true },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await operator.post("/api/staff/taxonomy", {
        data: {
          kind: "subcategory",
          name: "Invalid parent",
          parentId: community,
          active: true,
        },
      })
    ).status(),
  ).toBe(400);
  await ok(
    await operator.post("/api/staff/taxonomy", {
      data: { id: term.id, kind: "category", name, active: false },
    }),
  );
});
test("two staff members publish through the real editor and public evidence stays protected", async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    storageState: await officer.storageState(),
  });
  const page = await ctx.newPage();
  await page.goto(origin + "/admin?view=new");
  await page
    .getByLabel("Title", { exact: true })
    .fill("Community learning space browser test");
  await page.getByRole("button", { name: "Create private draft" }).click();
  await expect(page).toHaveURL(/\/admin\/content\//);
  const id = page.url().split("/content/")[1].split("?")[0];
  records.push(id);
  await page
    .getByLabel("Description", { exact: true })
    .fill("A learning space with independently reviewed project information.");
  await page
    .getByLabel("Objectives", { exact: true })
    .fill("Provide a suitable learning space.");
  await page
    .getByLabel("Category", { exact: true })
    .selectOption("category-education");
  await page.getByLabel("Community", { exact: true }).selectOption(community);
  await page.getByLabel("Information source").fill("Field report");
  await page
    .getByLabel("Authorised reporting office")
    .fill("Constituency project office");
  await page
    .getByLabel("How is progress measured?")
    .fill("Baseline prepared before construction.");
  await page
    .getByLabel("Add image or PDF", { exact: true })
    .setInputFiles({ name: "site.png", mimeType: "image/png", buffer: png });
  await expect(page.getByLabel("Attachment 1 caption")).toBeVisible();
  await page
    .getByLabel("Attachment 1 caption")
    .fill("Reviewed site photograph");
  await page.getByLabel("Attachment 1 visibility").selectOption("public");
  await page.getByLabel("Approved budget (GHS)").fill("987654321.12");
  await page.getByRole("button", { name: "Save & send for review" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Submitted for independent review",
  );
  const data = await ok<AdminRecord>(
    await officer.get(`/api/staff/content/${id}`),
  );
  const image = data.revisions[0].payload.attachments[0].id;
  expect((await anon.get(`/api/media/${image}`)).status()).toBe(404);
  expect((await anon.get(`/api/public/content/${data.slug}`)).status()).toBe(
    404,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".local/phase2-editor-mobile.png",
    fullPage: true,
  });
  const reviewCtx = await browser.newContext({
    storageState: await approver.storageState(),
  });
  const review = await reviewCtx.newPage();
  await review.goto(origin + `/admin/content/${id}`);
  await review
    .getByLabel("Review or withdrawal reason")
    .fill("Reviewed attribution and the site photograph.");
  await review
    .getByRole("checkbox", { name: /I checked the attribution/ })
    .check();
  await review.getByRole("button", { name: "Approve & publish" }).click();
  await expect(review.getByRole("status")).toContainText(
    "Approved and published",
  );
  await page.goto(origin + `/projects/${data.slug}`);
  await expect(
    page.getByRole("heading", {
      name: "Community learning space browser test",
      level: 1,
    }),
  ).toBeVisible();
  expect(await page.content()).not.toContain("987654321.12");
  await expect(
    page
      .getByText("Baseline prepared before construction.", { exact: true })
      .first(),
  ).toBeVisible();
  await expect(
    page.getByText("Reviewed site photograph", { exact: true }).first(),
  ).toBeVisible();
  await page.screenshot({
    path: ".local/phase2-published-mobile.png",
    fullPage: true,
  });
  const imageResponse = await anon.get(`/api/media/${image}`);
  expect(imageResponse.status()).toBe(200);
  expect(imageResponse.headers()["cache-control"]).toContain("no-store");
  const metadata = await sharp(await imageResponse.body()).metadata();
  expect(metadata.format).toBe("webp");
  expect(metadata.exif).toBeUndefined();
  await ctx.close();
  await reviewCtx.close();
});
test("frozen snapshots, independent approval and atomic decisions preserve the last public version", async () => {
  const d = await create(operator);
  await save(d, operator);
  await submit(d, operator);
  expect((await decide(d, "approve", operator)).status()).toBe(403);
  expect(
    (
      await officer.patch(endpoint(d), {
        data: {
          payload: d.payload,
          financials: emptyFinancials,
          lockVersion: d.lockVersion,
        },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await anon.get(
        "/api/public/content?q=" + encodeURIComponent(d.payload.title),
      )
    ).ok(),
  ).toBe(true);
  const decisions = await Promise.all([decide(d), decide(d)]);
  expect(decisions.map((r) => r.status()).sort()).toEqual([200, 409]);
  const data = await detail(d);
  const url = `/api/public/content/${data.slug}`;
  const original = await ok<PublicContent>(await anon.get(url));
  expect(original.payload.title).toBe(d.payload.title);
  const privateBytes = JSON.stringify(original);
  for (const forbidden of [
    "financials",
    "budget",
    "expenditure",
    "fundingSource",
    "internalNotes",
    "PRIVATE-FUNDING-MARKER",
    "PRIVATE-NOTES-MARKER",
    "987654321.12",
    "storageKey",
    "authorId",
    "decidedBy",
  ])
    expect(privateBytes).not.toContain(forbidden);
  const amendment = await revise(d);
  amendment.payload.title = "Revised approved project title";
  amendment.payload.changeSummary =
    "A documented change for independent review.";
  await save(amendment);
  await submit(amendment);
  expect((await ok<PublicContent>(await anon.get(url))).payload.title).toBe(
    d.payload.title,
  );
  await ok(await decide(amendment, "return"));
  expect((await detail(d)).revisions[0].state).toBe("returned");
  const corrected = await revise(d);
  corrected.payload.changeSummary = "Corrected after the independent review.";
  await save(corrected);
  await submit(corrected);
  await ok(await decide(corrected));
  const published = await ok<PublicContent>(await anon.get(url));
  expect(published.payload.title).toBe(amendment.payload.title);
  expect(published.history).toHaveLength(2);
  expect(published.history[1].payload.title).toBe(d.payload.title);
  const audit = await pool.query(
    "SELECT action FROM audit_log WHERE subject_id=$1",
    [d.recordId],
  );
  expect(audit.rows.map((r) => r.action)).toEqual(
    expect.arrayContaining([
      "content.created",
      "content.draft_saved",
      "content.submitted",
      "content.approved",
      "content.returned",
    ]),
  );
});
test("all contributors are excluded from review and cross-record evidence is rejected", async () => {
  const source = await create();
  const sourceFile = await upload(source);
  const d = await create();
  d.payload.attachments = [
    {
      id: sourceFile.id,
      caption: "Cross-record attachment",
      capturedOn: "",
      visibility: "public",
      purpose: "evidence",
    },
  ];
  expect(
    (
      await officer.patch(endpoint(d), {
        data: {
          payload: d.payload,
          financials: emptyFinancials,
          lockVersion: d.lockVersion,
        },
      })
    ).status(),
  ).toBe(400);
  d.payload.attachments = [];
  await save(d, operator);
  await submit(d);
  expect((await decide(d, "approve", operator)).status()).toBe(403);
  const record = await detail(d);
  expect(
    (
      await ok<{ items: PublicContent[] }>(
        await anon.get(
          `/api/public/content?q=${encodeURIComponent(record.slug)}`,
        ),
      )
    ).items,
  ).toHaveLength(0);
  await ok(await decide(d, "reject"));
});
test("conflicting edits, completed records and withdrawn publication cannot bypass checks", async () => {
  const d = await create();
  const stale = d.lockVersion;
  await save(d);
  expect(
    (
      await officer.patch(endpoint(d), {
        data: {
          payload: d.payload,
          financials: emptyFinancials,
          lockVersion: stale,
        },
      })
    ).status(),
  ).toBe(409);
  d.payload.status = "Completed";
  d.payload.progress = 100;
  await save(d);
  expect(
    (
      await officer.post(endpoint(d), {
        data: { action: "submit", lockVersion: d.lockVersion },
      })
    ).status(),
  ).toBe(400);
  const file = await upload(d);
  d.payload.actualCompletionDate = "2026-10-28";
  d.payload.completionSummary = "The completed work was inspected on site.";
  d.payload.attachments = [
    {
      id: file.id,
      caption: "Completion evidence",
      capturedOn: "2026-10-28",
      visibility: "public",
      purpose: "evidence",
    },
  ];
  await save(d);
  await submit(d);
  await ok(await decide(d));
  const data = await detail(d);
  const pending = await revise(d);
  pending.payload.changeSummary = "An additional correction after publication.";
  await save(pending);
  await submit(pending);
  await ok(
    await approver.post(`/api/staff/content/${d.recordId}`, {
      data: {
        action: "withdraw",
        reason: "Withdrawn pending verification of the source.",
      },
    }),
  );
  expect((await anon.get(`/api/public/content/${data.slug}`)).status()).toBe(
    404,
  );
  expect((await anon.get(`/api/media/${file.id}`)).status()).toBe(404);
  expect((await decide(pending)).status()).toBe(409);
  await ok(await decide(pending, "reject"));
  const fresh = await revise(d);
  fresh.payload.changeSummary =
    "Fresh verification supports publication again.";
  await save(fresh);
  await submit(fresh);
  await ok(await decide(fresh));
  expect((await anon.get(`/api/public/content/${data.slug}`)).status()).toBe(
    200,
  );
});
test("uploads reject spoofing and active PDFs, and financial files never become public", async () => {
  const d = await create();
  expect(
    (
      await officer.post(`/api/staff/content/${d.recordId}/media`, {
        multipart: {
          file: {
            name: "payload.png",
            mimeType: "image/png",
            buffer: Buffer.from("<script>unsafe</script>"),
          },
        },
      })
    ).status(),
  ).toBe(400);
  const active = await PDFDocument.create();
  active.addPage();
  active.catalog.set(
    PDFName.of("OpenAction"),
    active.context.obj({ S: "JavaScript", JS: PDFString.of("alert(1)") }),
  );
  expect(
    (
      await officer.post(`/api/staff/content/${d.recordId}/media`, {
        multipart: {
          file: {
            name: "active.pdf",
            mimeType: "application/pdf",
            buffer: Buffer.from(await active.save()),
          },
        },
      })
    ).status(),
  ).toBe(400);
  const financial = await upload(
    d,
    pdf,
    "financial.pdf",
    "application/pdf",
    true,
  );
  const photo = await upload(d);
  d.payload.attachments = [
    {
      id: financial.id,
      caption: "Internal financial evidence",
      capturedOn: "",
      visibility: "public",
      purpose: "evidence",
    },
  ];
  expect(
    (
      await officer.patch(endpoint(d), {
        data: {
          payload: d.payload,
          financials: emptyFinancials,
          lockVersion: d.lockVersion,
        },
      })
    ).status(),
  ).toBe(400);
  d.payload.attachments = [
    {
      id: financial.id,
      caption: "Internal financial evidence",
      capturedOn: "",
      visibility: "internal",
      purpose: "financial",
    },
    {
      id: photo.id,
      caption: "Public site evidence",
      capturedOn: "",
      visibility: "public",
      purpose: "evidence",
    },
  ];
  await save(d);
  await submit(d);
  await ok(await decide(d));
  const data = await detail(d);
  const result = await ok<PublicContent>(
    await anon.get(`/api/public/content/${data.slug}`),
  );
  expect(result.payload.attachments).toHaveLength(1);
  expect(JSON.stringify(result)).not.toContain(financial.id);
  expect((await anon.get(`/api/media/${financial.id}`)).status()).toBe(404);
  expect((await officer.get(`/api/media/${financial.id}`)).status()).toBe(200);
  const pending = await revise(d);
  pending.payload.changeSummary =
    "Update prepared before an evidence withdrawal.";
  await save(pending);
  await submit(pending);
  await ok(
    await approver.post(`/api/media/${photo.id}/withdraw`, {
      data: { reason: "Withdrawn while the photograph is rechecked." },
    }),
  );
  expect((await anon.get(`/api/media/${photo.id}`)).status()).toBe(404);
  expect(
    (
      await ok<PublicContent>(
        await anon.get(`/api/public/content/${data.slug}`),
      )
    ).payload.attachments,
  ).toHaveLength(0);
  expect((await decide(pending)).status()).toBe(409);
  await ok(await decide(pending, "return"));
});
test("announcements and public PDF reports use the same approval process", async () => {
  for (const kind of ["announcement", "report"] as const) {
    const d = await create(officer, kind, `Reviewed ${kind}`);
    if (kind === "report") {
      await save(d);
      expect(
        (
          await officer.post(endpoint(d), {
            data: { action: "submit", lockVersion: d.lockVersion },
          })
        ).status(),
      ).toBe(400);
      const file = await upload(d, pdf, "report.pdf", "application/pdf");
      d.payload.attachments = [
        {
          id: file.id,
          caption: "Approved public report",
          capturedOn: "",
          visibility: "public",
          purpose: "evidence",
        },
      ];
    }
    await save(d);
    await submit(d);
    await ok(await decide(d));
    const data = await detail(d);
    const response = await anon.get(`/information/${data.slug}`);
    expect(response.status()).toBe(200);
    expect(await response.text()).not.toContain("PRIVATE-FUNDING-MARKER");
    if (kind === "report") {
      const file = await anon.get(`/api/media/${d.payload.attachments[0].id}`);
      expect(file.status()).toBe(200);
      expect(file.headers()["content-disposition"]).toContain("attachment");
    }
  }
});

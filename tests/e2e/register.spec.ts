import {
  test,
  expect,
  request as requests,
  type APIRequestContext,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { config } from "dotenv";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { hashPassword } from "better-auth/crypto";
import { emptyPayload, emptyFinancials } from "../../src/lib/content/types";
import { testDatabaseUrl } from "../../scripts/test-database.mjs";
if (process.env.CI !== "true") config({ path: ".env.local", quiet: true });
const database = testDatabaseUrl();
const pool = new Pool({ connectionString: database.toString() }),
  origin = "http://localhost:3100",
  headers = { Origin: origin },
  tag = randomUUID().slice(0, 8),
  prefix = "Launch fixture " + tag,
  people: string[] = [],
  records: string[] = [];
const password = "Launch-test-password-2026!";
let operator: APIRequestContext,
  editor: APIRequestContext,
  approver: APIRequestContext,
  editorId: string,
  operatorId: string,
  community: string,
  firstSlug: string;
async function login(username: string, pw = password) {
  // Keep unrelated fixture logins out of the real sign-in throttle's shared IP window.
  await pool.query("DELETE FROM auth_rate_limit");
  const api = await requests.newContext({
    baseURL: origin,
    extraHTTPHeaders: headers,
  });
  expect(
    (
      await api.post("/api/auth/sign-in/username", {
        data: { username, password: pw },
      })
    ).status(),
  ).toBe(200);
  return api;
}
async function person(role: string, hash: string, mustChange = false) {
  const id = randomUUID(),
    username = "launch_" + role + "_" + randomUUID().slice(0, 8);
  people.push(id);
  await pool.query(
    'INSERT INTO "user" (id,name,username,email,email_verified) VALUES ($1,$2,$3,$4,true)',
    [id, role, username, id + "@example.invalid"],
  );
  await pool.query(
    "INSERT INTO staff (user_id,role,must_change_password) VALUES ($1,$2,$3)",
    [id, role, mustChange],
  );
  await pool.query(
    "INSERT INTO account (id,account_id,provider_id,user_id,password) VALUES ($1,$2,'credential',$2,$3)",
    [randomUUID(), id, hash],
  );
  return { id, username };
}
function payload(title: string) {
  return {
    title,
    description: "A documented community project reviewed for publication.",
    categoryId: "category-education",
    communityId: community,
    status: "Ongoing",
    source: "Verified constituency field notes",
    actualCompletionDate: "",
    completionSummary: "",
    attachments: [],
  };
}
async function draft() {
  const r = await editor.post("/api/staff/content", {
    data: { kind: "project", title: "New learning space " + tag },
  });
  expect(r.status()).toBe(200);
  const data = await r.json();
  records.push(data.recordId);
  return data as { recordId: string; revisionId: string };
}
async function save(id: string, rid: string, p: object, lockVersion = 0) {
  return editor.patch("/api/staff/content/" + id + "/revisions/" + rid, {
    data: { payload: p, lockVersion },
  });
}
test.beforeAll(async () => {
  await pool.query("DELETE FROM auth_rate_limit");
  const hash = await hashPassword(password),
    op = await person("super_admin", hash),
    ed = await person("officer", hash),
    ap = await person("approver", hash);
  operatorId = op.id;
  editorId = ed.id;
  operator = await login(op.username);
  editor = await login(ed.username);
  approver = await login(ap.username);
  community = randomUUID();
  await pool.query(
    "INSERT INTO taxonomy (id,kind,name) VALUES ($1,'community',$2)",
    [community, "Launch community " + tag],
  );
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let i = 0; i < 200; i++) {
      const id = randomUUID(),
        rid = randomUUID(),
        slug = "launch-" + tag + "-" + i;
      records.push(id);
      if (i === 0) firstSlug = slug;
      const p = {
        ...emptyPayload,
        ...payload(prefix + " " + String(i + 1).padStart(3, "0")),
        categoryName: "Education",
        communityName: "Launch community " + tag,
        objectives: "LEGACY-PRIVATE-MARKER",
        progress: 76,
      };
      await client.query(
        "INSERT INTO content_record (id,kind,slug,created_by) VALUES ($1,'project',$2,$3)",
        [id, slug, editorId],
      );
      await client.query(
        "INSERT INTO content_revision (id,record_id,number,state,base_version,author_id,contributors,payload,financials,decided_by,decided_at) VALUES ($1,$2,1,'approved',0,$3,$4,$5,$6,$7,NOW())",
        [
          rid,
          id,
          editorId,
          JSON.stringify([editorId]),
          JSON.stringify(p),
          JSON.stringify({
            ...emptyFinancials,
            internalNotes: "LEGACY-PRIVATE-FINANCE",
          }),
          operatorId,
        ],
      );
      await client.query(
        "UPDATE content_record SET published_revision_id=$2 WHERE id=$1",
        [id, rid],
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
});
test.afterAll(async () => {
  await pool.query(
    "DELETE FROM analytics_daily WHERE path IN (SELECT '/projects/' || slug FROM content_record WHERE id=ANY($1::text[]))",
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
  await pool.query("DELETE FROM taxonomy WHERE id=$1", [community]);
  await pool.query(
    "DELETE FROM audit_log WHERE actor_id=ANY($1::text[]) OR subject_id=ANY($2::text[])",
    [people, records],
  );
  await pool.query('DELETE FROM "user" WHERE id=ANY($1::text[])', [people]);
  await Promise.all(
    [operator, editor, approver].filter(Boolean).map((a) => a.dispose()),
  );
  await pool.end();
});
test("additive migration preserves legacy credentials and data while revoking old sessions", async () => {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("CREATE SCHEMA migration_check");
    await c.query("SET LOCAL search_path TO migration_check");
    await c.query(
      'CREATE TABLE "user" (id text,name text,email text,created_at timestamp);CREATE TABLE staff (user_id text,active boolean,mfa_secret text);CREATE TABLE session (id text);',
    );
    await c.query(
      "INSERT INTO \"user\" VALUES ('one','One','Same@example.invalid',NOW()),('two','Two','same@other.invalid',NOW());INSERT INTO staff VALUES ('one',true,'preserved-secret');INSERT INTO session VALUES ('old')",
    );
    await c.query(
      readFileSync("drizzle/0004_minimal_register.sql", "utf8").replaceAll(
        "--> statement-breakpoint",
        "",
      ),
    );
    const users = await c.query('SELECT username FROM "user"');
    expect(new Set(users.rows.map((r) => r.username)).size).toBe(2);
    expect((await c.query("SELECT * FROM staff")).rows[0]).toMatchObject({
      must_change_password: true,
      mfa_secret: "preserved-secret",
    });
    expect((await c.query("SELECT * FROM session")).rowCount).toBe(0);
    await c.query(
      "CREATE TABLE account (password text); INSERT INTO account VALUES ('preserved-password-hash')",
    );
    await c.query(
      readFileSync(
        "drizzle/0005_temporary_password_expiry.sql",
        "utf8",
      ).replaceAll("--> statement-breakpoint", ""),
    );
    const expires = (
      await c.query("SELECT temporary_password_expires_at FROM staff")
    ).rows[0].temporary_password_expires_at;
    expect(expires.getTime()).toBeGreaterThan(Date.now() + 23 * 60 * 60 * 1000);
    await c.query(
      readFileSync("drizzle/0006_staff_access_version.sql", "utf8"),
    );
    expect(
      (await c.query("SELECT access_version FROM staff")).rows[0]
        .access_version,
    ).toBe(0);
    expect(
      (await c.query("SELECT password FROM account")).rows[0].password,
    ).toBe("preserved-password-hash");
  } finally {
    await c.query("ROLLBACK");
    c.release();
  }
});
test("200-project register supports combined filters, code search, pagination and safe DTOs", async ({
  page,
  request,
}) => {
  const response = await request.get(
    "/api/public/content?q=" + encodeURIComponent(prefix),
  );
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.total).toBe(200);
  expect(data.items).toHaveLength(24);
  const item = data.items[0];
  expect(JSON.stringify(data)).not.toContain("LEGACY-PRIVATE");
  expect(item.payload).not.toHaveProperty("progress");
  expect(item).not.toHaveProperty("history");
  const found = await request.get(
    "/api/public/content?q=" +
      item.code +
      "&category=Education&status=Ongoing&community=" +
      encodeURIComponent("Launch community " + tag),
  );
  expect((await found.json()).total).toBe(1);
  await page.goto("/?q=" + encodeURIComponent(prefix));
  await expect(page.locator(".project-card")).toHaveCount(24);
  await page.getByRole("link", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByLabel("Search projects", { exact: true })).toHaveValue(
    prefix,
  );
  await expect(
    page.getByRole("navigation", { name: "Active filters" }),
  ).toContainText(prefix);
  const redirect = await request.get("/projects?q=school&status=Ongoing", {
    maxRedirects: 0,
  });
  expect(redirect.status()).toBe(308);
  expect(redirect.headers().location).toBe("/?q=school&status=Ongoing");
});
test("public and authenticated pages remain accessible and fit phone and desktop screens", async ({
  page,
  context,
}) => {
  for (const route of [
    "/",
    "/about",
    "/contact",
    "/privacy",
    "/projects/" + firstSlug,
    "/staff/login",
  ]) {
    await page.goto(route);
    await expect(page.locator("h1")).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  }
  await context.addCookies((await operator.storageState()).cookies);
  for (const route of [
    "/admin",
    "/admin?view=review",
    "/admin?view=team",
    "/admin?view=taxonomy",
    "/admin?view=audit",
    "/admin/content/" + records[0],
  ]) {
    await page.goto(route);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: ".local/minimal-" + test.info().project.name + "-staff.png",
    fullPage: true,
  });
});
test("public navigation stays available on phones and supports dismissal, focus and resizing", async ({
  page,
}) => {
  await page.goto("/?q=" + encodeURIComponent(prefix));
  await expect(
    page.getByRole("heading", { name: "Project Tracker", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(
      ".site-header a[href='/staff/login'], .site-footer a[href='/staff/login']",
    ),
  ).toHaveCount(0);
  const header = page.locator(".site-header");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  const toggle = page.getByRole("button", { name: /^(Open|Close) menu$/ });
  const width = page.viewportSize()!.width;
  if (width <= 800) {
    await expect(nav).toBeHidden();
    expect((await toggle.boundingBox())!.height).toBeGreaterThanOrEqual(48);
    await page.evaluate(() => scrollTo(0, 650));
    await expect.poll(async () => (await header.boundingBox())!.y).toBe(0);
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Tab");
    await expect(
      nav.getByRole("link", { name: "Projects", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(toggle).toBeFocused();
    await expect(nav).toBeHidden();
    await toggle.click();
    await page.getByLabel("Search projects", { exact: true }).click();
    await expect(nav).toBeHidden();
    await toggle.click();
    for (let i = 0; i < 4; i++) await page.keyboard.press("Tab");
    await expect(nav).toBeHidden();
    await expect(
      page.getByLabel("Search projects", { exact: true }),
    ).toBeFocused();
    const headerBottom = (await header.boundingBox())!;
    expect(
      (await page.getByLabel("Search projects", { exact: true }).boundingBox())!
        .y,
    ).toBeGreaterThanOrEqual(headerBottom.y + headerBottom.height);
    await toggle.click();
    await nav.getByRole("link", { name: "Contact Us", exact: true }).click();
    await expect(page).toHaveURL(origin + "/contact");
    await expect(nav).toBeHidden();
    await toggle.click();
    await header
      .getByRole("link", { name: "Wassa East Constituency Project tracker" })
      .click();
    await expect(page).toHaveURL(origin + "/");
    await expect(nav).toBeHidden();
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    await toggle.click();
    await expect(
      nav.getByRole("link", { name: "Contact Us", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "";
    });
    await toggle.click();
    await page.setViewportSize({ width: 1100, height: 900 });
    await expect(toggle).toBeHidden();
    await expect(nav).toBeVisible();
    await nav.getByRole("link", { name: "Projects", exact: true }).focus();
    await page.setViewportSize({ width: 800, height: 900 });
    await expect(toggle).toBeVisible();
    await expect(toggle).toBeFocused();
    await expect(nav).toBeHidden();
  } else {
    await expect(toggle).toBeHidden();
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link")).toHaveCount(3);
  }
});

test("contact and privacy expose approved contact links without a live form or public staff links", async ({
  page,
  request,
}) => {
  await page.goto("/contact");
  await expect(
    page.getByRole("heading", { name: "Contact Us", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "+233 54 298 5346", exact: true }),
  ).toHaveAttribute("href", "tel:+233542985346");
  const whatsapp = page.getByRole("link", { name: /Contact us on WhatsApp/ });
  await expect(whatsapp).toHaveAttribute("href", "https://wa.me/233542985346");
  await expect(whatsapp).toHaveAttribute("rel", "noopener noreferrer");
  await expect(page.locator("form, iframe, a[href^='mailto:']")).toHaveCount(0);
  await expect(page.locator("a[href='/staff/login']")).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Footer", exact: true })
    .getByRole("link", { name: "Privacy & Cookies", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Privacy & Cookies", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Optional page-view statistics",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText(/90 days after closure/)).toBeVisible();
  await expect(page.locator("form, iframe")).toHaveCount(0);
  const sitemap = await request.get("/sitemap.xml");
  expect(await sitemap.text()).toContain("/contact</loc>");
  expect(await sitemap.text()).toContain("/privacy</loc>");
  await page.goto("/staff/login");
  await expect(
    page.getByRole("heading", { name: "Staff sign-in", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Username", { exact: true })).toBeVisible();
});

test("optional analytics requires consent, remembers rejection and stops after withdrawal across tabs", async ({
  page,
  context,
}) => {
  const path = "/projects/" + firstSlug;
  const views = async () =>
    Number(
      (
        await pool.query(
          "SELECT coalesce(sum(views),0)::int AS n FROM analytics_daily WHERE path=$1",
          [path],
        )
      ).rows[0].n,
    );
  const before = await views();
  let requests = 0;
  page.on("request", (req) => {
    if (req.url().endsWith("/api/public/analytics")) requests++;
  });
  await page.goto(path + "?q=do-not-store-this");
  const banner = page.getByRole("region", {
    name: "Cookie preferences",
    exact: true,
  });
  await expect(banner).toBeVisible();
  await page
    .getByRole("button", { name: "Reject analytics", exact: true })
    .click();
  await expect(banner).toBeHidden();
  await page.reload();
  await expect(banner).toBeHidden();
  expect(requests).toBe(0);
  expect(await views()).toBe(before);
  await page
    .getByRole("button", { name: "Cookie settings", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Cookie settings",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  const checkbox = dialog.getByRole("checkbox");
  await expect(checkbox).not.toBeChecked();
  await checkbox.check();
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/api/public/analytics") && r.status() === 204,
  );
  await dialog
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await response;
  await expect.poll(views).toBe(before + 1);
  expect(requests).toBe(1);
  const cookie = (await context.cookies()).find(
    (c) => c.name === "wassa_cookie_consent",
  )!;
  expect(cookie.value).toBe("v1.accepted");
  expect(cookie.sameSite).toBe("Lax");
  expect(cookie.expires - Date.now() / 1000).toBeGreaterThan(179 * 86400);
  const otherTab = await context.newPage();
  await otherTab.goto("/about");
  await page
    .getByRole("button", { name: "Cookie settings", exact: true })
    .click();
  await dialog.getByRole("checkbox").uncheck();
  await dialog
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await otherTab
    .getByRole("button", { name: "Cookie settings", exact: true })
    .click();
  await expect(
    otherTab.getByRole("dialog").getByRole("checkbox"),
  ).not.toBeChecked();
  await otherTab.keyboard.press("Escape");
  await otherTab.goto(path);
  await page.reload();
  await expect(banner).toBeHidden();
  expect(await views()).toBe(before + 1);
  expect(
    (
      await pool.query(
        "SELECT count(*)::int AS n FROM analytics_daily WHERE path LIKE '%do-not-store-this%'",
      )
    ).rows[0].n,
  ).toBe(0);
  await otherTab.close();
});

test("analytics validates consent and public paths, excludes staff, expires old counts and restricts the dashboard", async ({
  request,
  page,
  context,
}) => {
  const endpoint = "/api/public/analytics";
  const path = "/projects/" + firstSlug;
  const accepted = { ...headers, Cookie: "wassa_cookie_consent=v1.accepted" };
  expect(
    (await request.post(endpoint, { headers, data: { path } })).status(),
  ).toBe(403);
  expect(
    (
      await request.post(endpoint, {
        headers: { ...accepted, Origin: "https://untrusted.example" },
        data: { path },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post(endpoint, {
        headers: { ...accepted, "Sec-GPC": "1" },
        data: { path },
      })
    ).status(),
  ).toBe(403);
  for (const data of [
    { path: "/staff/login" },
    { path: "/?q=private" },
    { path: "/projects/not-published" },
    { path, visitor: "private-id" },
  ]) {
    expect(
      (await request.post(endpoint, { headers: accepted, data })).status(),
    ).toBe(400);
  }
  expect(
    (
      await request.post(endpoint, {
        headers: accepted,
        data: { path: "/" + "x".repeat(600) },
      })
    ).status(),
  ).toBe(400);
  expect((await request.get(endpoint)).status()).toBe(405);
  const expired = "/projects/expired-" + tag;
  await pool.query(
    "INSERT INTO analytics_daily (day,path,views) VALUES ((NOW() AT TIME ZONE 'UTC')::date - 100,$1,10)",
    [expired],
  );
  expect(
    (
      await request.post(endpoint, { headers: accepted, data: { path } })
    ).status(),
  ).toBe(204);
  expect(
    (
      await pool.query(
        "SELECT count(*)::int AS n FROM analytics_daily WHERE path=$1",
        [expired],
      )
    ).rows[0].n,
  ).toBe(0);
  const before = (
    await pool.query(
      "SELECT sum(views)::int AS n FROM analytics_daily WHERE path=$1",
      [path],
    )
  ).rows[0].n;
  const operatorCookie = (await operator.storageState()).cookies
    .map((c) => c.name + "=" + c.value)
    .join("; ");
  expect(
    (
      await operator.post(endpoint, {
        headers: {
          ...headers,
          Cookie: operatorCookie + "; wassa_cookie_consent=v1.accepted",
        },
        data: { path },
      })
    ).status(),
  ).toBe(204);
  expect(
    (
      await pool.query(
        "SELECT sum(views)::int AS n FROM analytics_daily WHERE path=$1",
        [path],
      )
    ).rows[0].n,
  ).toBe(before);
  for (const actor of [editor, approver]) {
    expect((await actor.get("/admin?view=analytics")).url()).toBe(
      origin + "/admin",
    );
  }
  expect((await request.get("/admin?view=analytics")).url()).toBe(
    origin + "/staff/login",
  );
  await context.addCookies((await operator.storageState()).cookies);
  await page.goto("/admin?view=analytics");
  await expect(
    page.getByRole("heading", { name: "Website statistics", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Popular pages", exact: true }),
  ).toContainText(path);
  await expect(
    page.getByRole("button", { name: "Accept analytics", exact: true }),
  ).toHaveCount(0);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("browser privacy signals suppress analytics and cookie settings remain accessible at large text", async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: "wassa_cookie_consent", value: "v1.accepted", url: origin },
  ]);
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "globalPrivacyControl", {
      get: () => true,
    }),
  );
  let requests = 0;
  page.on("request", (req) => {
    if (req.url().endsWith("/api/public/analytics")) requests++;
  });
  await page.goto("/contact");
  await page
    .getByRole("button", { name: "Cookie settings", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("checkbox")).toBeDisabled();
  await expect(dialog.getByRole("checkbox")).not.toBeChecked();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await dialog
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  expect(requests).toBe(0);
});

test("editor and independent approver can publish through the real screens", async ({
  page,
  context,
  browser,
}) => {
  await context.addCookies((await editor.storageState()).cookies);
  await page.goto("/admin?view=new");
  await page
    .getByLabel("Title", { exact: true })
    .fill("Phone learning space " + tag);
  await page.getByRole("button", { name: "Create private draft" }).click();
  await expect(page).toHaveURL(/\/admin\/content\//);
  const id = new URL(page.url()).pathname.split("/").pop()!;
  records.push(id);
  await page
    .getByLabel("Description", { exact: true })
    .fill("A documented learning space for children in the local community.");
  await page
    .getByLabel("Category", { exact: true })
    .selectOption("category-education");
  await page.getByLabel("Community", { exact: true }).selectOption(community);
  await page
    .getByLabel("Information source", { exact: true })
    .fill("Verified community field notes");
  await page.getByRole("button", { name: "Save & send for review" }).click();
  await expect(
    page.getByText("Submitted for independent review.", { exact: true }),
  ).toBeVisible();
  const reviewer = await browser.newContext({
      baseURL: origin,
      storageState: await approver.storageState(),
      viewport: page.viewportSize()!,
    }),
    review = await reviewer.newPage();
  await review.goto("/admin/content/" + id);
  await review
    .getByLabel("Decision or withdrawal reason")
    .fill("Reviewed the field notes and project details.");
  await review.getByRole("checkbox").check();
  await review.getByRole("button", { name: "Approve & publish" }).click();
  await expect(
    review.getByText("Approved and published.", { exact: true }),
  ).toBeVisible();
  await reviewer.close();
  const record = await (await editor.get("/api/staff/content/" + id)).json();
  await page.goto("/projects/" + record.slug);
  await expect(
    page.getByRole("heading", {
      name: "Phone learning space " + tag,
      exact: true,
    }),
  ).toBeVisible();
});
test("concurrent writes and self-approval are rejected; previous publication survives review and withdrawal hides it", async ({
  request,
}) => {
  const d = await draft(),
    url = "/api/staff/content/" + d.recordId + "/revisions/" + d.revisionId;
  expect(
    (
      await save(d.recordId, d.revisionId, payload("Reviewed learning space"))
    ).status(),
  ).toBe(200);
  expect(
    (await save(d.recordId, d.revisionId, payload("Stale overwrite"))).status(),
  ).toBe(409);
  expect(
    (
      await editor.post(url, { data: { action: "submit", lockVersion: 1 } })
    ).status(),
  ).toBe(200);
  const decision = {
    action: "approve",
    reason: "Reviewed project information carefully.",
    evidenceReviewed: true,
    lockVersion: 2,
  };
  expect((await editor.post(url, { data: decision })).status()).toBe(403);
  expect((await approver.post(url, { data: decision })).status()).toBe(200);
  const record = await (
      await editor.get("/api/staff/content/" + d.recordId)
    ).json(),
    next = await (
      await editor.post("/api/staff/content/" + d.recordId, {
        data: { action: "revise" },
      })
    ).json();
  expect(
    (
      await save(
        d.recordId,
        next.revisionId,
        payload("Unpublished replacement"),
      )
    ).status(),
  ).toBe(200);
  expect((await request.get("/projects/" + record.slug)).status()).toBe(200);
  expect(
    await (await request.get("/projects/" + record.slug)).text(),
  ).not.toContain("Unpublished replacement");
  expect(
    (
      await approver.post("/api/staff/content/" + d.recordId, {
        data: {
          action: "withdraw",
          reason: "Withdraw pending verification of details.",
        },
      })
    ).status(),
  ).toBe(200);
  expect((await request.get("/projects/" + record.slug)).status()).toBe(404);
  expect((await request.get("/api/og?slug=" + record.slug)).status()).toBe(404);
  expect(await (await request.get("/sitemap.xml")).text()).not.toContain(
    record.slug,
  );
  expect(
    (
      await editor.post("/api/staff/content/" + d.recordId, {
        data: { action: "revise" },
      })
    ).status(),
  ).toBe(200);
});
test("return preserves the private revision and permits a corrected draft", async () => {
  const d = await draft(),
    url = "/api/staff/content/" + d.recordId + "/revisions/" + d.revisionId;
  await save(d.recordId, d.revisionId, payload("Return this learning space"));
  await editor.post(url, { data: { action: "submit", lockVersion: 1 } });
  expect(
    (
      await approver.post(url, {
        data: {
          action: "return",
          reason: "Please verify the community information.",
          evidenceReviewed: false,
          lockVersion: 2,
        },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await save(d.recordId, d.revisionId, payload("Cannot edit returned"), 3)
    ).status(),
  ).toBe(409);
  expect(
    (
      await editor.post("/api/staff/content/" + d.recordId, {
        data: { action: "revise" },
      })
    ).status(),
  ).toBe(200);
});
test("strict project inputs and image access reject excluded fields and historical attachments", async ({
  request,
}) => {
  const d = await draft();
  expect(
    (
      await save(d.recordId, d.revisionId, {
        ...payload("Bad extra fields"),
        progress: 99,
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await editor.post("/api/staff/content", {
        data: { kind: "report", title: "Removed report" },
      })
    ).status(),
  ).toBe(400);
  const complete = {
    ...payload("Completed project"),
    status: "Completed",
    actualCompletionDate: "2026-01-01",
    completionSummary: "The work was completed and checked.",
  };
  expect((await save(d.recordId, d.revisionId, complete)).status()).toBe(200);
  expect(
    (
      await editor.post(
        "/api/staff/content/" + d.recordId + "/revisions/" + d.revisionId,
        { data: { action: "submit", lockVersion: 1 } },
      )
    ).status(),
  ).toBe(400);
  const pdf = await editor.post("/api/staff/content/" + d.recordId + "/media", {
    multipart: {
      file: {
        name: "document.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.7 invalid"),
      },
    },
  });
  expect(pdf.status()).toBe(400);
  const sharp = (await import("sharp")).default,
    buffer = await sharp({
      create: { width: 80, height: 80, channels: 3, background: "#006b3f" },
    })
      .png()
      .toBuffer();
  const upload = await editor.post(
    "/api/staff/content/" + d.recordId + "/media",
    {
      multipart: {
        file: { name: "school.png", mimeType: "image/png", buffer },
      },
    },
  );
  expect(upload.status()).toBe(200);
  const image = await upload.json();
  expect((await request.get("/api/media/" + image.id)).status()).toBe(404);
  await save(
    d.recordId,
    d.revisionId,
    {
      ...complete,
      attachments: [{ id: image.id, caption: "Completed school" }],
    },
    1,
  );
  await editor.post(
    "/api/staff/content/" + d.recordId + "/revisions/" + d.revisionId,
    { data: { action: "submit", lockVersion: 2 } },
  );
  expect(
    (
      await approver.post(
        "/api/staff/content/" + d.recordId + "/revisions/" + d.revisionId,
        {
          data: {
            action: "approve",
            reason: "Checked completion and photograph evidence.",
            evidenceReviewed: true,
            lockVersion: 3,
          },
        },
      )
    ).status(),
  ).toBe(200);
  expect((await request.get("/api/media/" + image.id)).status()).toBe(200);
  const next = await (
    await editor.post("/api/staff/content/" + d.recordId, {
      data: { action: "revise" },
    })
  ).json();
  await save(d.recordId, next.revisionId, payload("Revised ongoing work"));
  await editor.post(
    "/api/staff/content/" + d.recordId + "/revisions/" + next.revisionId,
    { data: { action: "submit", lockVersion: 1 } },
  );
  await approver.post(
    "/api/staff/content/" + d.recordId + "/revisions/" + next.revisionId,
    {
      data: {
        action: "approve",
        reason: "Checked revised scope of the ongoing work.",
        evidenceReviewed: true,
        lockVersion: 2,
      },
    },
  );
  expect((await request.get("/api/media/" + image.id)).status()).toBe(404);
  expect(
    (await request.get("/api/public/thumbnails/" + image.id)).status(),
  ).toBe(404);
  expect((await editor.get("/api/media/" + image.id)).status()).toBe(200);
});
test("temporary passwords gate all staff operations; resets and deactivation revoke sessions", async () => {
  const username = "new_" + randomUUID().slice(0, 8);
  const created = await operator.post("/api/staff/accounts", {
    data: { action: "create", username, name: "New editor", role: "officer" },
  });
  expect(created.status()).toBe(200);
  const person = await created.json();
  people.push(person.id);
  const temp = await login(username, person.temporaryPassword);
  expect((await temp.get("/api/staff/content")).status()).toBe(403);
  expect(
    (
      await temp.post("/api/staff/accounts", {
        data: {
          action: "create",
          username: "forbidden",
          name: "No access",
          role: "officer",
        },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await temp.post("/api/staff/password", {
        data: {
          currentPassword: person.temporaryPassword,
          newPassword: password,
        },
      })
    ).status(),
  ).toBe(200);
  await temp.dispose();
  const active = await login(username);
  expect((await active.get("/api/staff/content")).status()).toBe(200);
  expect(
    (
      await active.post("/api/staff/taxonomy", {
        data: { name: "Forbidden community", active: true },
      })
    ).status(),
  ).toBe(403);
  const reset = await operator.post("/api/staff/accounts", {
    data: { action: "reset", id: person.id },
  });
  expect(reset.status()).toBe(200);
  expect((await active.get("/api/staff/content")).status()).toBe(403);
  await active.dispose();
  const newTemp = await login(username, (await reset.json()).temporaryPassword);
  expect((await newTemp.get("/api/staff/content")).status()).toBe(403);
  await operator.post("/api/staff/accounts", {
    data: { action: "deactivate", id: person.id },
  });
  expect(
    (
      await newTemp.post("/api/staff/password", {
        data: { currentPassword: "anything", newPassword: password },
      })
    ).status(),
  ).toBe(403);
  await newTemp.dispose();
  expect(
    (
      await operator.post("/api/staff/accounts", {
        data: { action: "deactivate", id: operatorId },
      })
    ).status(),
  ).toBe(409);
});
test("unsaved edits require confirmation and conflicts offer a copy", async ({
  page,
  context,
}) => {
  const d = await draft();
  await context.addCookies((await editor.storageState()).cookies);
  await page.goto("/admin/content/" + d.recordId);
  await page
    .getByLabel("Description", { exact: true })
    .fill("Unsaved local text that must be preserved.");
  const dialog = page.waitForEvent("dialog");
  const click = page
    .getByRole("link", { name: "Projects", exact: true })
    .click();
  await (await dialog).dismiss();
  await click;
  await expect(page.getByLabel("Description", { exact: true })).toHaveValue(
    "Unsaved local text that must be preserved.",
  );
  const backDialog = page.waitForEvent("dialog");
  await page.evaluate(() => history.back());
  await (await backDialog).dismiss();
  await expect(page.getByLabel("Description", { exact: true })).toHaveValue(
    "Unsaved local text that must be preserved.",
  );
  await save(d.recordId, d.revisionId, payload("Concurrent server change"));
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Preserve your changes" }),
  ).toContainText("Preserve your changes");
  await page.getByRole("button", { name: "Preserve my changes" }).click();
  await expect(page.getByLabel(/Copy of your current edits/)).toHaveValue(
    /Unsaved local text/,
  );
});
test("retired routes and mutations are unavailable; worker only retires app caches", async ({
  request,
}) => {
  for (const url of [
    "/following",
    "/updates",
    "/announcements",
    "/reports",
    "/preview/console",
    "/staff/security",
    "/staff/setup",
    "/manifest.webmanifest",
    "/api/public/engagement/session",
    "/api/public/updates",
    "/api/public/projects/map",
    "/api/public/push/config",
    "/api/staff/inbox",
    "/api/staff/reports",
  ]) {
    expect((await request.get(url)).status(), url).toBe(404);
  }
  for (const url of [
    "/api/staff/mfa",
    "/api/staff/setup",
    "/api/staff/links",
    "/api/staff/engagement",
    "/api/public/engagement/submissions",
    "/api/auth/sign-in/email",
    "/api/auth/sign-in/social",
    "/api/auth/sign-up/email",
  ]) {
    expect((await operator.post(url, { data: {} })).status(), url).toBe(404);
  }
  const sw = await request.get("/sw.js");
  expect(sw.status()).toBe(200);
  expect(await sw.text()).toContain('startsWith("wassa-public-")');
  expect(await sw.text()).toContain("unregister");
  expect(sw.headers()["cache-control"]).toContain("no-store");
});

test("phone filters are usable and show removable choices", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  if (isMobile)
    await page.getByText("Filter projects", { exact: true }).click();
  await page.getByLabel("Search projects", { exact: true }).fill(prefix);
  await page.getByLabel("Category", { exact: true }).selectOption("Education");
  await page
    .getByLabel("Community", { exact: true })
    .selectOption("Launch community " + tag);
  await page.getByLabel("Status", { exact: true }).selectOption("Ongoing");
  await page
    .getByRole("button", { name: "Search projects", exact: true })
    .click();
  await expect(
    page.getByRole("navigation", { name: "Active filters" }),
  ).toContainText("Education");
  await page
    .getByRole("link", {
      name: "Remove category filter: Education",
      exact: true,
    })
    .click();
  await expect(page).not.toHaveURL(/category=/);
  await expect(page.getByLabel("Category", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Community", { exact: true })).toHaveValue(
    "Launch community " + tag,
  );
  await expect(page.getByLabel("Status", { exact: true })).toHaveValue(
    "Ongoing",
  );
  await expect(
    page.getByRole("navigation", { name: "Active filters" }),
  ).toContainText("Launch community " + tag);
  await page.goBack();
  await expect(page).toHaveURL(/category=Education/);
  await expect(page.getByLabel("Category", { exact: true })).toHaveValue(
    "Education",
  );
  await page.goForward();
  await expect(page).not.toHaveURL(/category=/);
  await expect(page.getByLabel("Category", { exact: true })).toHaveValue("");
  await page.getByRole("link", { name: "Clear all", exact: true }).click();
  for (const label of ["Search projects", "Category", "Community", "Status"])
    await expect(page.getByLabel(label, { exact: true })).toHaveValue("");
  await expect(
    page.getByRole("navigation", { name: "Active filters" }),
  ).toHaveCount(0);
});

test("tracked register links retain real results and reject invalid supported filters", async ({
  page,
  request,
}) => {
  const query = new URLSearchParams({
    q: prefix,
    category: "Education",
    utm_source: "newsletter",
    utm_campaign: "launch",
    fbclid: "social-click",
  });
  await page.goto("/?" + query);
  await expect(page.locator(".form-error")).toHaveCount(0);
  await expect(page.locator(".project-card")).toHaveCount(24);
  await expect(page.getByRole("status")).toHaveText("200 projects");
  const canonical = await page
    .locator('link[rel="canonical"]')
    .getAttribute("href");
  expect(new URL(canonical!).href).toBe(new URL("/", origin).href);
  await page.getByRole("link", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator(".project-card")).toHaveCount(24);
  expect(
    (await request.get("/api/public/content?utm_source=newsletter")).status(),
  ).toBe(400);
  await page.goto("/?status=invalid&utm_source=newsletter");
  await expect(page.locator(".form-error")).toContainText(
    "Please check your filters.",
  );
});

test("both sign-out controls handle HTTP and network failures before allowing a retry", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const accountName = await pool.query<{ username: string }>(
    'SELECT username FROM "user" WHERE id=$1',
    [editorId],
  );
  const isolatedSession = await login(accountName.rows[0].username);
  await context.addCookies((await isolatedSession.storageState()).cookies);
  for (const path of ["/admin", "/staff/password"]) {
    await page.goto(path);
    const routePattern = "**/api/auth/sign-out";
    await page.route(routePattern, (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "Temporary failure" }),
      }),
    );
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(
      page.getByText(
        "Unable to sign out. Check your connection and try again.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(page).toHaveURL(origin + path);
    expect((await context.request.get("/api/staff/content")).status()).toBe(
      200,
    );
    await page.unroute(routePattern);
    await page.route(routePattern, (route) => route.abort("failed"));
    const failed = page.waitForEvent("requestfailed", {
      predicate: (r) => r.url().endsWith("/api/auth/sign-out"),
    });
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await failed;
    await expect(
      page.getByText(
        "Unable to sign out. Check your connection and try again.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(page).toHaveURL(origin + path);
    expect((await context.request.get("/api/staff/content")).status()).toBe(
      200,
    );
    await page.unroute(routePattern);
  }
  expect(errors).toEqual([]);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(origin + "/staff/login");
  expect((await context.request.get("/api/staff/content")).status()).toBe(403);
  await isolatedSession.dispose();
});
test("real username sign-in requires a temporary password change before opening the workspace", async ({
  page,
  browser,
}) => {
  const username = "ui_" + randomUUID().slice(0, 8),
    created = await operator.post("/api/staff/accounts", {
      data: { action: "create", name: "UI editor", username, role: "officer" },
    });
  expect(created.status()).toBe(200);
  const p = await created.json();
  people.push(p.id);
  await pool.query("DELETE FROM auth_rate_limit");
  await page.goto("/staff/login");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(p.temporaryPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(new RegExp("staff.password"));
  await page
    .getByLabel("Current password", { exact: true })
    .fill(p.temporaryPassword);
  await page.getByLabel("New password", { exact: true }).fill(password);
  await page.getByLabel("Confirm new password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Change password", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp("staff.login"));
  await pool.query("DELETE FROM auth_rate_limit");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(new RegExp("/admin"));
  const other = await browser.newContext({
    baseURL: origin,
    storageState: await operator.storageState(),
  });
  expect(
    (
      await other.request.post("/api/staff/accounts", {
        headers,
        data: { action: "revoke", id: p.id },
      })
    ).status(),
  ).toBe(200);
  await page.goto("/admin");
  await expect(page).toHaveURL(new RegExp("staff.login"));
  await other.close();
});
test("temporary expiry blocks sign-in and an already-open password-change session; reset restores access", async ({
  request,
}) => {
  const username = "expires_" + randomUUID().slice(0, 8);
  const created = await operator.post("/api/staff/accounts", {
    data: {
      action: "create",
      username,
      name: "Expiry editor",
      role: "officer",
    },
  });
  expect(created.status()).toBe(200);
  const p = await created.json();
  people.push(p.id);
  expect(
    new Date(p.temporaryPasswordExpiresAt).getTime() - Date.now(),
  ).toBeGreaterThan(23 * 60 * 60 * 1000);
  const temp = await login(username, p.temporaryPassword);
  await pool.query(
    "UPDATE staff SET temporary_password_expires_at=NOW()-INTERVAL '1 second' WHERE user_id=$1",
    [p.id],
  );
  expect(
    (
      await temp.post("/api/staff/password", {
        data: { currentPassword: p.temporaryPassword, newPassword: password },
      })
    ).status(),
  ).toBe(403);
  await pool.query("DELETE FROM auth_rate_limit");
  expect(
    (
      await request.post("/api/auth/sign-in/username", {
        headers,
        data: { username, password: p.temporaryPassword },
      })
    ).status(),
  ).toBe(403);
  const reset = await operator.post("/api/staff/accounts", {
    data: { action: "reset", id: p.id },
  });
  expect(reset.status()).toBe(200);
  const next = await reset.json();
  expect(
    (
      await temp.post("/api/staff/password", {
        data: {
          currentPassword: next.temporaryPassword,
          newPassword: password,
        },
      })
    ).status(),
  ).toBe(403);
  const fresh = await login(username, next.temporaryPassword);
  expect(
    (
      await fresh.post("/api/staff/password", {
        data: {
          currentPassword: next.temporaryPassword,
          newPassword: password,
        },
      })
    ).status(),
  ).toBe(200);
  const state = (
    await pool.query(
      "SELECT must_change_password,temporary_password_expires_at FROM staff WHERE user_id=$1",
      [p.id],
    )
  ).rows[0];
  expect(state).toMatchObject({
    must_change_password: false,
    temporary_password_expires_at: null,
  });
  await pool.query("DELETE FROM auth_rate_limit");
  expect(
    (
      await request.post("/api/auth/sign-in/username", {
        headers,
        data: { username, password: next.temporaryPassword },
      })
    ).status(),
  ).toBe(401);
  const permanent = await login(username);
  expect((await permanent.get("/api/staff/content")).status()).toBe(200);
  await Promise.all([temp.dispose(), fresh.dispose(), permanent.dispose()]);
});

test("CSP blocks injected scripts while fonts, filters and keyboard navigation work", async ({
  page,
  request,
}) => {
  const response = await page.goto("/?q=" + encodeURIComponent(prefix));
  const policy = response!.headers()["content-security-policy"];
  expect(policy).toContain("default-src 'self'");
  expect(policy).not.toContain("unsafe-eval");
  const nonce = policy.match(/'nonce-([^']+)'/)![1];
  const next = await request.get("/about");
  expect(next.headers()["content-security-policy"]).not.toContain(
    "'nonce-" + nonce + "'",
  );
  await expect(page.locator(".project-card")).toHaveCount(24);
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(() =>
      Array.from(document.fonts).some(
        (font) =>
          font.status === "loaded" &&
          !font.family.toLowerCase().includes("fallback") &&
          getComputedStyle(document.body).fontFamily.includes(
            font.family.replaceAll('"', ""),
          ),
      ),
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() =>
      Array.from(document.scripts)
        .filter((s) => s.src || s.textContent)
        .every((s) => !!s.nonce),
    ),
  ).toBe(true);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  for (const control of await page
    .locator(
      ".site-header nav a, .register-filters input, .register-filters button, .active-filters a, .pagination a",
    )
    .all()) {
    if (await control.isVisible())
      expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(48);
  }
  await page.goto("/?q=no-results-" + tag);
  expect(
    (await page.locator(".empty-state a").boundingBox())!.height,
  ).toBeGreaterThanOrEqual(48);
  await page.locator(".empty-state a").click();
  await expect(page).toHaveURL(origin + "/");
  // Parser-inserted untrusted HTML must be blocked. DevTools-created scripts
  // inherit the debugging context's trust and are not a valid injection test.
  await page.route("**/about?csp-fixture=1", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()).replace(
        "</head>",
        "<script>document.documentElement.dataset.injected='yes'</script></head>",
      ),
    });
  });
  await page.goto("/about?csp-fixture=1");
  expect(
    await page.evaluate(() => document.documentElement.dataset.injected),
  ).toBeUndefined();
});

test("unfinished drafts save privately and explain all submission requirements", async ({
  page,
  context,
}) => {
  const d = await draft();
  await context.addCookies((await editor.storageState()).cookies);
  await page.goto("/admin/content/" + d.recordId);
  await page.getByLabel("Description", { exact: true }).fill("");
  await page.getByLabel("Status", { exact: true }).selectOption("Completed");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page.getByText("Draft saved privately.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save & send for review", exact: true })
    .click();
  await expect(page.locator(".form-error[role=alert]")).toContainText(
    "Before submission:",
  );
  await expect(page.locator(".form-error[role=alert]")).toContainText(
    "description of at least 20 characters",
  );
  await expect(page.locator(".form-error[role=alert]")).toContainText(
    "Identify the information source",
  );
  await expect(page.locator(".form-error[role=alert]")).toContainText(
    "Completed projects need",
  );
  expect(
    (await (await editor.get("/api/staff/content/" + d.recordId)).json())
      .revisions[0].state,
  ).toBe("draft");
});

test("long public text, source links, full-photo Back and text scaling remain usable", async ({
  page,
}) => {
  const d = await draft();
  const sharp = (await import("sharp")).default;
  const buffer = await sharp({
    create: { width: 100, height: 80, channels: 3, background: "#006b3f" },
  })
    .png()
    .toBuffer();
  const upload = await editor.post(
    "/api/staff/content/" + d.recordId + "/media",
    {
      multipart: {
        file: { name: "phase1.png", mimeType: "image/png", buffer },
      },
    },
  );
  expect(upload.status()).toBe(200);
  const image = await upload.json();
  const title = "CommunityLearning".repeat(9);
  await save(d.recordId, d.revisionId, {
    ...payload(title),
    source:
      "Office notes: https://example.org/report. javascript:alert(1) <script>alert(2)</script>",
    attachments: [{ id: image.id, caption: "PhotographCaption".repeat(28) }],
  });
  const endpoint =
    "/api/staff/content/" + d.recordId + "/revisions/" + d.revisionId;
  expect(
    (
      await editor.post(endpoint, {
        data: { action: "submit", lockVersion: 1 },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await approver.post(endpoint, {
        data: {
          action: "approve",
          lockVersion: 2,
          reason: "Checked long-layout fixture for publication.",
          evidenceReviewed: true,
        },
      })
    ).status(),
  ).toBe(200);
  await pool.query(
    "UPDATE content_revision SET payload=jsonb_set(payload,'{communityName}',to_jsonb($1::text)) WHERE id=$2",
    ["LongCommunityName".repeat(8), d.revisionId],
  );
  const record = await (
    await editor.get("/api/staff/content/" + d.recordId)
  ).json();
  await page.goto("/?q=" + title);
  await expect(page.locator(".project-card")).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page
    .getByRole("heading", { name: title, exact: true })
    .getByRole("link")
    .click();
  await expect(page).toHaveURL(origin + "/projects/" + record.slug);
  await expect(page.locator(".source-text a")).toHaveAttribute(
    "href",
    "https://example.org/report",
  );
  await expect(page.locator(".source-text")).toContainText(
    "<script>alert(2)</script>",
  );
  await page.getByRole("link", { name: /^Open full photograph:/ }).click();
  await expect(page).toHaveURL(origin + "/api/media/" + image.id);
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".local/phase1-" + test.info().project.name + "-detail.png",
    fullPage: true,
  });
});

test("reload and revision switching preserve unsaved work when leaving is cancelled", async ({
  page,
  context,
}) => {
  const d = await draft();
  await save(d.recordId, d.revisionId, payload("Unsaved recovery fixture"));
  const endpoint =
    "/api/staff/content/" + d.recordId + "/revisions/" + d.revisionId;
  await editor.post(endpoint, { data: { action: "submit", lockVersion: 1 } });
  expect(
    (
      await approver.post(endpoint, {
        data: {
          action: "approve",
          lockVersion: 2,
          reason: "Checked fixture before testing revision guards.",
          evidenceReviewed: true,
        },
      })
    ).status(),
  ).toBe(200);
  const revised = await (
    await editor.post("/api/staff/content/" + d.recordId, {
      data: { action: "revise" },
    })
  ).json();
  await context.addCookies((await editor.storageState()).cookies);
  await page.goto(
    "/admin/content/" + d.recordId + "?revision=" + revised.revisionId,
  );
  const description = page.getByLabel("Description", { exact: true });
  const text =
    "Keep this unsaved text through both cancelled navigation attempts.";
  await description.fill(text);
  const switchingDialog = page.waitForEvent("dialog");
  const switching = page
    .getByLabel("Revision history", { exact: true })
    .selectOption(d.revisionId);
  await (await switchingDialog).dismiss();
  await switching;
  await expect(description).toHaveValue(text);
  await expect(
    page.getByLabel("Revision history", { exact: true }),
  ).toHaveValue(revised.revisionId);
  const reloadDialog = page.waitForEvent("dialog");
  // Chromium may keep the protocol reload waiting when beforeunload is
  // cancelled; bound that wait and verify the actual document/edits below.
  const reloading = page.reload({ timeout: 3000 }).catch(() => null);
  const dialog = await reloadDialog;
  expect(dialog.type()).toBe("beforeunload");
  await dialog.dismiss();
  await reloading;
  await expect(description).toHaveValue(text);
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page.getByText("Draft saved privately.", { exact: true }),
  ).toBeVisible();
});

test("in-flight sign-ins cannot outlive password resets or access revocation", async () => {
  for (const action of ["reset", "revoke", "deactivate"] as const) {
    const target = await person("officer", await hashPassword(password));
    const agent = "stale-sign-in-" + tag;
    const stale = await requests.newContext({
      baseURL: origin,
      extraHTTPHeaders: { ...headers, "User-Agent": agent },
    });
    const hold = await pool.connect();
    const lock = 9186452;
    let pending: ReturnType<APIRequestContext["post"]> | undefined;
    let fresh: APIRequestContext | undefined;
    try {
      await hold.query("SELECT pg_advisory_lock($1)", [lock]);
      await pool.query(
        `CREATE FUNCTION phase1_signin_barrier() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock(${lock}); RETURN NEW; END $$`,
      );
      await pool.query(
        `CREATE TRIGGER phase1_signin_barrier BEFORE INSERT ON session FOR EACH ROW WHEN (NEW.user_id='${target.id}' AND NEW.user_agent='${agent}') EXECUTE FUNCTION phase1_signin_barrier()`,
      );
      await pool.query("DELETE FROM auth_rate_limit");
      pending = stale.post("/api/auth/sign-in/username", {
        data: { username: target.username, password },
      });
      await expect
        .poll(async () =>
          Number(
            (
              await pool.query(
                "SELECT count(*) FROM pg_locks WHERE locktype='advisory' AND objid=$1 AND NOT granted",
                [lock],
              )
            ).rows[0].count,
          ),
        )
        .toBe(1);
      const reset = await operator.post("/api/staff/accounts", {
        data: { action, id: target.id },
      });
      expect(reset.status()).toBe(200);
      if (action === "reset") {
        const replacement = await reset.json();
        fresh = await login(target.username, replacement.temporaryPassword);
        expect(
          (
            await fresh.post("/api/staff/password", {
              data: {
                currentPassword: replacement.temporaryPassword,
                newPassword: password + "-changed",
              },
            })
          ).status(),
        ).toBe(200);
      } else if (action === "deactivate") {
        expect(
          (
            await operator.post("/api/staff/accounts", {
              data: { action: "reactivate", id: target.id },
            })
          ).status(),
        ).toBe(200);
      }
      await hold.query("SELECT pg_advisory_unlock($1)", [lock]);
      const response = await pending;
      const access = (await stale.get("/api/staff/content")).status();
      expect(response.status()).toBe(403);
      expect(access).toBe(403);
      expect(response.headers()["set-cookie"]).toBeUndefined();
      expect(await response.json()).not.toHaveProperty("token");
      expect(
        Number(
          (
            await pool.query("SELECT count(*) FROM session WHERE user_id=$1", [
              target.id,
            ])
          ).rows[0].count,
        ),
      ).toBe(0);
    } finally {
      await hold.query("SELECT pg_advisory_unlock($1)", [lock]);
      if (pending) await pending.catch(() => null);
      await pool.query(
        "DROP TRIGGER IF EXISTS phase1_signin_barrier ON session",
      );
      await pool.query("DROP FUNCTION IF EXISTS phase1_signin_barrier()");
      hold.release();
      await stale.dispose();
      await fresh?.dispose();
    }
  }
});

test("username sign-in bounds request bodies and rejects incorrect origins", async ({
  request,
}) => {
  expect(
    (
      await request.post("/api/auth/sign-in/username", {
        headers,
        data: { username: "invalid", password: "x".repeat(17000) },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/auth/sign-in/username", {
        headers: { Origin: "https://untrusted.invalid" },
        data: { username: "invalid", password },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/auth/sign-in/username", { headers, data: [] })
    ).status(),
  ).toBe(400);
});

test("login throttling remains enforced", async ({ request }) => {
  await pool.query("DELETE FROM auth_rate_limit");
  for (let i = 0; i < 3; i++)
    await request.post("/api/auth/sign-in/username", {
      headers,
      data: { username: "unknown_fixture_user", password },
    });
  expect(
    (
      await request.post("/api/auth/sign-in/username", {
        headers,
        data: { username: "unknown_fixture_user", password },
      })
    ).status(),
  ).toBe(429);
  await pool.query("DELETE FROM auth_rate_limit");
});

test("retirement worker removes only the app's offline caches and unregisters", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await (
      await caches.open("wassa-public-v1-pages")
    ).put("/offline-fixture", new Response("old copy"));
    await (
      await caches.open("unrelated-fixture")
    ).put("/other-fixture", new Response("keep"));
    await navigator.serviceWorker.register("/sw.js");
  });
  await expect
    .poll(() =>
      page.evaluate(async () => ({
        appCaches: (await caches.keys()).filter((k) =>
          k.startsWith("wassa-public-"),
        ),
        registrations: (await navigator.serviceWorker.getRegistrations())
          .length,
        unrelated: (await caches.keys()).includes("unrelated-fixture"),
      })),
    )
    .toEqual({ appCaches: [], registrations: 0, unrelated: true });
});

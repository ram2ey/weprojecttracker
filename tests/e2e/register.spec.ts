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
import { commentHash, commentCookie } from "../../src/lib/comments/guard";
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
const storyIds: string[] = [];
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
  await pool.query("DELETE FROM news_story WHERE id=ANY($1::text[])",[storyIds]);
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
test("200-project public register supports title/community search, filters and pagination while keeping project codes staff-only", async ({
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
  expect(item).not.toHaveProperty("code");
  const detail = await (
    await request.get("/api/public/content/" + item.slug)
  ).json();
  expect(detail).not.toHaveProperty("code");
  const staffItem = await (
    await editor.get("/api/staff/content/" + item.id)
  ).json();
  expect(staffItem.code).toMatch(/^WE-P\d+$/);
  const found = await request.get(
    "/api/public/content?q=" +
      encodeURIComponent(item.payload.title) +
      "&category=Education&status=Ongoing&community=" +
      encodeURIComponent("Launch community " + tag),
  );
  expect((await found.json()).total).toBe(1);
  expect(
    (
      await (
        await request.get(
          "/api/public/content?q=" +
            encodeURIComponent("Launch community " + tag),
        )
      ).json()
    ).total,
  ).toBe(200);
  expect(
    (
      await (
        await request.get("/api/public/content?q=" + staffItem.code)
      ).json()
    ).total,
  ).toBe(0);
  const staffFound = await (
    await editor.get("/api/staff/content?q=" + staffItem.code)
  ).json();
  expect(staffFound.items.some((r: { id: string }) => r.id === item.id)).toBe(
    true,
  );
  await page.goto("/projects?q=" + encodeURIComponent(prefix));
  await expect(page.locator(".project-card")).toHaveCount(24);
  await expect(
    page.getByLabel("Search projects", { exact: true }),
  ).toHaveAttribute("placeholder", "Project title or community");
  await expect(
    page.locator(".project-card").filter({ hasText: staffItem.code }),
  ).toHaveCount(0);
  await page.goto("/projects/" + item.slug);
  await expect(page.locator("main")).not.toContainText(staffItem.code);
  await page.goto("/projects?q=" + encodeURIComponent(prefix));
  await page.getByRole("link", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByLabel("Search projects", { exact: true })).toHaveValue(
    prefix,
  );
  await expect(
    page.getByRole("navigation", { name: "Active filters" }),
  ).toContainText(prefix);
  const pageTwo = page.url();
  await page.locator(".project-card h2 a").first().click();
  await page.getByRole("link", { name: "Back to results" }).click();
  await expect(page).toHaveURL(pageTwo);
  await page.goto("/projects/" + item.slug);
  await expect(
    page.getByRole("link", { name: "All projects" }),
  ).toHaveAttribute("href", "/projects");
  const redirect = await request.get("/?q=school&status=Ongoing", {
    maxRedirects: 0,
  });
  expect(redirect.status()).toBe(308);
  expect(redirect.headers().location).toBe("/projects?q=school&status=Ongoing");
});
test("public and authenticated pages remain accessible and fit phone and desktop screens", async ({
  page,
  context,
}) => {
  for (const route of [
    "/",
    "/projects",
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
    "/admin?view=comments",
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
  await page.goto("/projects?q=" + encodeURIComponent(prefix));
  await expect(
    page.getByRole("heading", { name: "Projects", exact: true }),
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
  await expect(header.locator("nav [aria-current]")).toHaveText("Projects");
  await page.evaluate(() => scrollTo(0, 650));
  await expect.poll(async () => (await header.boundingBox())!.y).toBe(0);
  if (width <= 800) {
    await expect(nav).toBeHidden();
    expect((await toggle.boundingBox())!.height).toBeGreaterThanOrEqual(48);
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Tab");
    await expect(
      nav.getByRole("link", { name: "Home", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(toggle).toBeFocused();
    await expect(nav).toBeHidden();
    await toggle.click();
    await page
      .getByRole("heading", { name: "Optional website statistics" })
      .click();
    await expect(nav).toBeHidden();
    await toggle.click();
    const menuControls = nav.locator("a, button");
    for (let i = 0; i < await menuControls.count(); i++) {
      await page.keyboard.press("Tab");
      await expect(menuControls.nth(i)).toBeFocused();
    }
    await expect(nav.getByRole("button", { name: "Install tracker", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
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
    await expect(header.locator("nav [aria-current]")).toHaveText("Contact Us");
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
    await expect(nav.getByRole("link")).toHaveCount(5);
    await expect(nav.getByRole("button", { name: "Install tracker", exact: true })).toBeVisible();
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
    page.getByRole("link", { name: "Call us: +233 24 115 2479", exact: true }),
  ).toHaveAttribute("href", "tel:+233241152479");
  const whatsapp = page.getByRole("link", { name: /Contact us on WhatsApp/ });
  await expect(whatsapp).toHaveAttribute("href", "https://wa.me/233241152479");
  await expect(whatsapp).toHaveAttribute("rel", "noopener noreferrer");
  for (const width of [1440, 360]) {
    await page.setViewportSize({ width, height: 900 });
    const office = await page.locator(".office-panel").boundingBox();
    const enquiry = await page.locator(".enquiry-panel").boundingBox();
    if (width === 360) {
      expect(enquiry!.y).toBeGreaterThanOrEqual(office!.y + office!.height);
    } else {
      expect(enquiry!.x).toBeGreaterThanOrEqual(office!.x + office!.width);
    }
  }
  await page.getByLabel("Message", { exact: true }).fill("Preview enquiry");
  await expect(page.getByRole("button", { name: "Send message" })).toBeDisabled();
  await expect(page.locator("#faq details")).toHaveCount(5);
  await page.getByRole("link", { name: "View all questions" }).click();
  await expect(page).toHaveURL(origin + "/faq#contact");
  await expect(page.locator("main details")).toHaveCount(10);
  await page.getByText("How do I suggest a correction?", { exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#contact details[open] p")).toBeVisible();
  const reviewViewport = test.info().project.use.viewport;
  if (reviewViewport) await page.setViewportSize(reviewViewport);
  await page.goto("/about");
  await expect(page.getByRole("heading", { name: "MP and Constituency Executives" })).toBeVisible();
  const portraits = page.locator(".leadership img");
  await expect(portraits).toHaveCount(1);
  for (const portrait of await portraits.all()) {
    await portrait.scrollIntoViewIfNeeded();
    await expect.poll(() => portrait.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  }
  await page.goto("/contact");
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
  await page.getByRole("button", { name: "Deny", exact: true }).click();
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
    page.getByRole("button", { name: "Accept", exact: true }),
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
    .getByLabel("Review decision reason")
    .fill("Reviewed the field notes and project details.");
  await review.getByRole("checkbox").check();
  await review.getByRole("button", { name: "Approve & publish" }).click();
  await expect(
    review.getByText("Approved and published.", { exact: true }),
  ).toBeVisible();
  const record = await (await editor.get("/api/staff/content/" + id)).json();
  await page.goto("/projects/" + record.slug);
  await expect(
    page.getByRole("heading", {
      name: "Phone learning space " + tag,
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Images" })).toHaveCount(0);
  const enquiry = new URL(
    (await page
      .getByRole("link", { name: /Ask on WhatsApp/ })
      .getAttribute("href"))!,
  );
  expect(enquiry.searchParams.get("text")).toContain(
    "Phone learning space " + tag,
  );
  expect(enquiry.searchParams.get("text")).toContain(
    origin + "/projects/" + record.slug,
  );
  await expect(page.getByRole("main").getByRole("link", { name: /Call / })).toHaveAttribute(
    "href",
    "tel:+233241152479",
  );
  await review
    .getByLabel("Withdrawal reason")
    .fill("Withdraw the test project after verification.");
  const withdraw = review.getByRole("button", {
    name: "Withdraw published project",
  });
  const cancel = review.waitForEvent("dialog");
  const cancelClick = withdraw.click();
  const prompt = await cancel;
  expect(prompt.message()).toContain("Phone learning space " + tag);
  await prompt.dismiss();
  await cancelClick;
  expect((await page.request.get("/projects/" + record.slug)).status()).toBe(
    200,
  );
  review.once("dialog", (dialog) => dialog.accept());
  await withdraw.click();
  await expect(
    review.getByText("Project withdrawn from public access."),
  ).toBeVisible();
  expect((await page.request.get("/projects/" + record.slug)).status()).toBe(
    404,
  );
  await reviewer.close();
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
  const staffMenu = page.getByRole("button", { name: "Staff menu" });
  if (await staffMenu.isVisible()) await staffMenu.click();
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

test("Home introduces Wassa East and leads to the project directory with consent open", async ({
  page,
}) => {
  for (let i=0;i<3;i++) {
    const id=randomUUID(); storyIds.push(id);
    const story={kind:i===2?"Feature":"News",title:"Community update "+tag+" "+i,summary:"A published test update.",detail:i===2?"More about this community update.":"",photo:"",caption:"",project:""};
    await pool.query("INSERT INTO news_story(id,state,contributors,draft,published,published_at) VALUES ($1,'published','[]',$2,$2,now())",[id,story]);
  }
  await page.goto("/");
  await page.getByRole("link", { name: "Find my community" }).click();
  const directory = page.getByRole("region", { name: "Browse by community" });
  const name = "Launch community " + tag;
  const { rows: [published] } = await pool.query(
    `SELECT count(*)::int AS total FROM content_record r
     JOIN content_revision v ON v.id = r.published_revision_id
     WHERE r.kind = 'project' AND r.withdrawn_at IS NULL AND v.state = 'approved'
       AND v.payload->>'communityName' = $1`,
    [name],
  );
  const communityLink = directory.getByRole("link", { name: name + " " + published.total + " projects", exact: true });
  if (!(await communityLink.isVisible())) {
    await directory.getByText("All communities", { exact: true }).click();
  }
  await communityLink.click();
  await expect.poll(() => new URL(page.url()).searchParams.get("community")).toBe(name);
  await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
  for (const viewport of [
    { width: 360, height: 740 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const banner = page.getByRole("region", { name: "Cookie preferences" });
    await expect(banner).toBeVisible();
    const news = page.getByRole("region", { name: "News & Features" });
    const stories = news.getByRole("article");
    await expect(stories).toHaveCount(3);
    const firstStory = await stories.nth(0).boundingBox();
    const secondStory = await stories.nth(1).boundingBox();
    expect(secondStory!.y > firstStory!.y).toBe(viewport.width < 800);
    await expect(news.locator("details")).toHaveCount(0);
    const storyTitle = await stories.nth(0).getByRole("heading").innerText();
    await stories.nth(0).getByRole("link", {name: /^Read more about/}).click();
    await expect(page.getByRole("heading", {name:storyTitle,exact:true})).toBeVisible();
    await expect(page.locator(".mobile-app-section")).toHaveCount(1);
    await page.getByRole("link", {name:"Back to News & Features"}).click();
    const faq = page.getByRole("region", { name: "Frequently asked questions" });
    await expect(faq.locator("details")).toHaveCount(5);
    await expect(faq.locator("details[open]")).toHaveCount(0);
    await faq.locator("summary").first().focus();
    await page.keyboard.press("Enter");
    await expect(faq.locator("details[open] p")).toBeVisible();
    const downloads = page.getByRole("region", { name: "Download the Wassa East Project Tracker app" });
    await expect(downloads).toContainText("Google Play");
    await expect(downloads).toContainText("App Store");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate(() => document.fonts.ready);
    await expect
      .poll(async () => {
        const hero = await page.locator(".register-hero").boundingBox();
        return hero ? Math.abs(hero.height - (viewport.height - hero.y) * 0.85) : Infinity;
      })
      .toBeLessThan(viewport.width < 400 ? viewport.height * 0.05 : 2);
    await expect(
      page.getByRole("heading", { name: "Wassa East Project Tracker", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Meet Wassa East" }),
    ).toBeVisible();
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    await expect(
      page.getByRole("link", { name: "Find my community" }),
    ).toHaveAttribute("href", "#communities");
    await expect(
      page.getByRole("link", { name: "Contact the office" }),
    ).toHaveAttribute("href", "/contact");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await expect(page.locator(".register-hero").getByRole("button")).toHaveCount(0);
    await page.getByRole("link", { name: "Explore all projects" }).click();
    await expect(page).toHaveURL(origin + "/projects");
    await expect(page.locator(".register-hero")).toHaveCount(0);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "";
    });
    const search = page.getByRole("button", { name: "Search projects" });
    await search.evaluate((button) =>
      button.scrollIntoView({ block: "center" }),
    );
    await expect
      .poll(async () => {
        const button = await search.boundingBox();
        const notice = await banner.boundingBox();
        return !!button && !!notice && button.y + button.height <= notice.y;
      })
      .toBe(true);
    await page
      .getByLabel("Search projects", { exact: true })
      .fill("no-such-project-" + tag);
    await search.click();
    await expect(
      page.getByRole("heading", { name: "No projects match your search." }),
    ).toBeVisible();
    if (viewport.width === 360)
      await expect(page.locator(".filter-panel summary")).toHaveText(
        "Filter projects",
      );
    await page.getByRole("link", { name: "Clear search", exact: true }).click();
    await expect(
      page.getByLabel("Search projects", { exact: true }),
    ).toHaveValue("");
  }
});
test("staff can draft, independently publish, revise and withdraw a homepage feature with a photo", async ({page,context,request})=>{
  const fields={kind:"Feature",title:"Community feature "+tag,summary:"An approved report from the community.",detail:"Field notes",caption:"Community project site",project:firstSlug};
  const endpoint="/api/staff/news";
  expect((await request.post(endpoint,{headers,data:{}})).status()).toBe(403);
  await context.addCookies((await operator.storageState()).cookies);
  await page.goto("/admin?view=news");
  await page.getByLabel("Headline").fill(fields.title);
  await page.getByLabel("Story type").selectOption("Feature");
  await page.getByLabel("Summary",{exact:true}).fill(fields.summary);
  await page.getByLabel("Full story (optional)").fill(fields.detail);
  await page.getByLabel("Related project",{exact:true}).selectOption(firstSlug);
  await page.getByLabel("Photo (JPEG",{exact:false}).setInputFiles("public/images/school-desks.webp");
  await page.getByLabel("Photo description").fill(fields.caption);
  await page.getByRole("button",{name:"Save draft"}).click();
  await expect(page).toHaveURL(/view=news&id=/);
  const id=new URL(page.url()).searchParams.get("id")!;
  storyIds.push(id);
  await page.getByRole("button",{name:"Submit for review"}).click();
  await expect(page.getByText("pending · Unpublished")).toBeVisible();
  expect((await request.get("/news/"+id)).status()).toBe(404);
  await page.goto("/");
  await expect(page.getByText(fields.title,{exact:true})).toHaveCount(0);
  const approve={id,version:2,action:"approve"};
  expect((await operator.post(endpoint,{data:approve})).status()).toBe(403);
  await context.addCookies((await approver.storageState()).cookies);
  await page.goto("/admin?view=news&id="+id);
  await page.getByRole("button",{name:"Approve and publish"}).click();
  await expect(page.getByText("published · Visible on the website")).toBeVisible();
  await page.goto("/");
  const article=page.getByRole("article").filter({hasText:fields.title});
  await expect(article.getByRole("img",{name:fields.caption})).toBeVisible();
  await expect(article.getByRole("link",{name:"View project"})).toHaveAttribute("href","/projects/"+firstSlug);
  await article.getByRole("link",{name:/^Read more about/}).click();
  await expect(page).toHaveURL(origin+"/news/"+id);
  await expect(page.getByText(fields.detail,{exact:true})).toBeVisible();
  await expect(page.locator(".mobile-app-section")).toHaveCount(1);
  await page.getByRole("link",{name:"Back to News & Features"}).click();
  const revision={id,version:3,action:"submit",removePhoto:false,fields:{...fields,title:"Revised "+tag}};
  expect((await editor.post(endpoint,{data:revision})).status()).toBe(200);
  expect((await editor.post(endpoint,{data:revision})).status()).toBe(409);
  await page.reload(); await expect(article).toBeVisible();
  expect((await approver.post(endpoint,{data:{id,version:4,action:"approve"}})).status()).toBe(200);
  await page.reload();await expect(page.getByText(revision.fields.title,{exact:true})).toBeVisible();
  expect((await approver.post(endpoint,{data:{id,version:5,action:"withdraw"}})).status()).toBe(200);
  expect((await request.get("/news/"+id)).status()).toBe(404);
  await page.reload();await expect(page.getByText(revision.fields.title,{exact:true})).toHaveCount(0);
});

test("phone filters are usable and show removable choices", async ({
  page,
  isMobile,
}) => {
  await page.goto("/projects");
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
  expect(new URL(canonical!).href).toBe(new URL("/projects", origin).href);
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
    const staffMenu = page.getByRole("button", { name: "Staff menu" });
    if (await staffMenu.isVisible()) await staffMenu.click();
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
  const response = await page.goto("/projects?q=" + encodeURIComponent(prefix));
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
  await page.goto("/projects?q=no-results-" + tag);
  expect(
    (await page.locator(".empty-state a").boundingBox())!.height,
  ).toBeGreaterThanOrEqual(48);
  await page.locator(".empty-state a").click();
  await expect(page).toHaveURL(origin + "/projects");
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
  const description = page.getByRole("textbox", {
    name: "Description",
    exact: true,
  });
  await expect(description).toBeFocused();
  await expect(description).toHaveAccessibleDescription(
    "Add a description of at least 20 characters.",
  );
  await expect(
    page.getByLabel("Information source", { exact: true }),
  ).toHaveAccessibleDescription("Identify the information source.");
  await expect(page.locator("input[type=file]")).toHaveAccessibleDescription(
    "Attach at least one photograph of the completed project.",
  );
  await expect(
    page.getByRole("button", { name: "Preserve my changes" }),
  ).toHaveCount(0);
  await description.fill("This project serves the local community.");
  await expect(description).not.toHaveAttribute("aria-invalid", "true");
  expect(
    (await (await editor.get("/api/staff/content/" + d.recordId)).json())
      .revisions[0].state,
  ).toBe("draft");
});

test("staff mobile menu opens the review queue and an empty search can be cleared", async ({
  page,
  context,
}) => {
  await context.addCookies((await operator.storageState()).cookies);
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/admin");
  const menu = page.getByRole("button", { name: "Staff menu" });
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(
    page.getByRole("navigation", { name: "Staff navigation" }),
  ).toBeHidden();
  await menu.click();
  await page.getByRole("link", { name: "Review queue" }).click();
  await expect(
    page.getByRole("heading", { name: "Review queue" }),
  ).toBeVisible();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await page.getByLabel("Search register").fill("no-match-" + tag);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    page.getByText("No submissions match", { exact: false }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Clear search" }).click();
  await expect(page.getByLabel("Search register")).toHaveValue("");
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
  const secondUpload = await editor.post(
    "/api/staff/content/" + d.recordId + "/media",
    {
      multipart: {
        file: { name: "second.png", mimeType: "image/png", buffer },
      },
    },
  );
  expect(secondUpload.status()).toBe(200);
  const secondImage = await secondUpload.json();
  const title = "CommunityLearning".repeat(9);
  await save(d.recordId, d.revisionId, {
    ...payload(title),
    source:
      "Office notes: https://example.org/report. javascript:alert(1) <script>alert(2)</script>",
    status: "Completed",
    actualCompletionDate: "2026-05-01",
    completionSummary: "The work is complete.",
    attachments: [
      { id: image.id, caption: "PhotographCaption".repeat(28) },
      { id: secondImage.id, caption: "Second view" },
    ],
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
  await page.goto("/projects?q=" + title);
  await expect(page.locator(".project-card")).toHaveCount(1);
  const originalSize = page.viewportSize()!;
  for (const width of [360, 430]) {
    await page.setViewportSize({ width, height: 820 });
    await page.getByRole("button", { name: "Grid", exact: true }).click();
    await expect(page.locator(".card-community")).toHaveText(
      "LongCommunityName".repeat(8),
    );
    await expect(page.locator(".project-image")).toBeVisible();
    await expect(page.locator(".card-meta .badge")).toBeVisible();
    await expect(page.locator(".card-meta .badge")).toHaveText("Completed");
    expect(
      await page
        .locator(".project-card-body")
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
  }
  await page.setViewportSize(originalSize);
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
  await expect(
    page.getByText("Completed 1 May 2026", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Open full image:/ }),
  ).toHaveCount(1);
  await page.getByText("View all 2 photos").click();
  await expect(
    page.getByRole("link", { name: /Open full image:/ }),
  ).toHaveCount(2);
  await page
    .getByRole("link", { name: /^Open full image:/ })
    .first()
    .click();
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

async function commentFixture(index: number) {
  const row = (
    await pool.query("SELECT id,slug FROM content_record WHERE id=$1", [
      records[index],
    ])
  ).rows[0];
  await pool.query("DELETE FROM project_comment WHERE record_id=$1", [row.id]);
  await pool.query(
    "UPDATE content_record SET comments_enabled=true,withdrawn_at=NULL WHERE id=$1",
    [row.id],
  );
  await pool.query("DELETE FROM app_rate_limit WHERE key=$1", [
    commentHash("global"),
  ]);
  return { ...row, endpoint: `/api/public/content/${row.slug}/comments` };
}
async function commentVisitor(endpoint: string) {
  const api = await requests.newContext({
    baseURL: origin,
    extraHTTPHeaders: headers,
  });
  expect((await api.post(endpoint + "/session")).status()).toBe(200);
  return api;
}
const commentBody = () => ({
  submissionId: randomUUID(),
  displayName: "Visitor name",
  body: "A public project comment.",
  website: "",
});

test("project comments publish once, stay plain text, paginate and survive failed retries without tracking consent", async ({
  page,
  context,
}) => {
  const fixture = await commentFixture(170);
  await context.addCookies([
    { name: "wassa_cookie_consent", value: "v1.rejected", url: origin },
  ]);
  await page.goto("/projects/" + fixture.slug);
  await expect(
    page.getByRole("button", { name: "Write a comment", exact: true }),
  ).toBeVisible();
  expect((await context.cookies()).some((c) => c.name === commentCookie)).toBe(
    false,
  );
  await page
    .getByRole("button", { name: "Write a comment", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Name", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Comment", exact: true })).toBeFocused();
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("A visitor <b>name</b>");
  const text =
    "<script>alert('plain')</script> https://example.invalid\nA community thought.";
  await page.getByRole("textbox", { name: "Comment", exact: true }).fill(text);
  // Simulate a committed response lost in transit, then retry the same submission.
  let failed = false;
  await page.route("**/comments", async (route) => {
    if (route.request().method() === "POST" && !failed) {
      failed = true;
      await route.fetch();
      await route.abort();
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Post comment", exact: true }).click();
  await expect(
    page.locator(".comments-section").getByRole("alert"),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Comment", exact: true }),
  ).toHaveValue(text);
  await page.getByRole("button", { name: "Post comment", exact: true }).click();
  await expect(
    page.getByText("Your comment is now public.", { exact: true }),
  ).toBeVisible();
  const list = page.getByRole("list", {
    name: "Visitor comments",
    exact: true,
  });
  await expect(list).toContainText(text);
  await expect(list.locator("script,a,b")).toHaveCount(0);
  expect(
    (
      await pool.query(
        "SELECT count(*)::int AS n FROM project_comment WHERE record_id=$1",
        [fixture.id],
      )
    ).rows[0].n,
  ).toBe(1);
  expect(
    (await context.cookies()).find((c) => c.name === "wassa_cookie_consent")
      ?.value,
  ).toBe("v1.rejected");
  for (let i = 0; i < 21; i++)
    await pool.query(
      "INSERT INTO project_comment (id,record_id,submission_key,display_name,body,created_at) VALUES ($1,$2,$1,'Pagination visitor',$3,NOW()+$4*INTERVAL '1 second')",
      [randomUUID(), fixture.id, "Page comment " + i, i + 1],
    );
  await page.reload();
  await expect(list.locator("li")).toHaveCount(20);
  await page.route("**/comments?page=2", (route) =>
    route.fulfill({
      status: 503,
      json: { message: "Temporary comment page failure." },
    }),
  );
  await page
    .getByRole("button", { name: "Older comments", exact: true })
    .click();
  await expect(
    page.locator(".comments-section").getByRole("alert"),
  ).toContainText("Temporary comment page failure.");
  await expect(list.locator("li")).toHaveCount(20);
  await page.unroute("**/comments?page=2");
  await page
    .getByRole("button", { name: "Older comments", exact: true })
    .click();
  await expect(list.locator("li")).toHaveCount(2);
  await expect(list).toContainText(text);
  await page
    .getByRole("button", { name: "Newer comments", exact: true })
    .click();
  await expect(list.locator("li")).toHaveCount(20);
  await page
    .getByRole("button", { name: "Write a comment", exact: true })
    .click();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".local/comments-" + test.info().project.name + "-public.png",
    fullPage: true,
  });
});

test("only operators moderate comments, keep hidden copies, close projects and audit without comment bodies", async ({
  page,
  context,
  request,
}) => {
  const fixture = await commentFixture(171),
    visitor = await commentVisitor(fixture.endpoint);
  try {
    const input = {
      ...commentBody(),
      body: "PRIVATE-MODERATION-CONTENT-" + tag,
    };
    const posted = await (
      await visitor.post(fixture.endpoint, { data: input })
    ).json();
    for (const api of [editor, approver, request]) {
      expect((await api.get("/api/staff/comments")).status()).toBe(403);
      expect(
        (
          await api.patch("/api/staff/comments", {
            headers,
            data: { action: "hide", id: posted.id, version: 0 },
          })
        ).status(),
      ).toBe(403);
      expect(
        (
          await api.patch("/api/staff/comments", {
            headers,
            data: {
              action: "set-enabled",
              id: fixture.id,
              version: 0,
              enabled: false,
            },
          })
        ).status(),
      ).toBe(403);
    }
    await context.addCookies((await operator.storageState()).cookies);
    await page.goto("/admin?view=comments");
    await page.getByLabel("Project or news story", { exact: true }).selectOption(fixture.id);
    await expect(
      page.getByRole("list", { name: "Manage comments" }),
    ).toContainText(input.body);
    await page
      .getByRole("button", { name: "Hide comment", exact: true })
      .click();
    await expect(
      page.getByText(
        "Comment hidden. You can restore it from Hidden comments.",
        { exact: true },
      ),
    ).toBeVisible();
    expect((await (await request.get(fixture.endpoint)).json()).items).toEqual(
      [],
    );
    expect(
      (
        await pool.query(
          "SELECT body,hidden_at,version FROM project_comment WHERE id=$1",
          [posted.id],
        )
      ).rows[0],
    ).toMatchObject({ body: input.body, version: 1 });
    expect(
      (
        await operator.patch("/api/staff/comments", {
          data: { action: "restore", id: posted.id, version: 0 },
        })
      ).status(),
    ).toBe(409);
    await page.getByLabel("Show", { exact: true }).selectOption("hidden");
    await expect(
      page.getByRole("button", { name: "Restore comment", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Restore comment", exact: true })
      .click();
    await expect(
      page.getByText("Comment restored publicly.", { exact: true }),
    ).toBeVisible();
    expect(
      (await (await request.get(fixture.endpoint)).json()).items,
    ).toHaveLength(1);
    await page
      .getByRole("button", { name: "Close new comments", exact: true })
      .click();
    await expect(
      page.getByText("New comments closed.", { exact: true }),
    ).toBeVisible();
    expect(
      (await visitor.post(fixture.endpoint, { data: commentBody() })).status(),
    ).toBe(409);
    const closed = await (await request.get(fixture.endpoint)).json();
    expect(closed.enabled).toBe(false);
    expect(closed.items).toHaveLength(1);
    await page
      .getByRole("button", { name: "Reopen comments", exact: true })
      .click();
    await expect(
      page.getByText("New comments reopened.", { exact: true }),
    ).toBeVisible();
    expect((await (await request.get(fixture.endpoint)).json()).enabled).toBe(
      true,
    );
    const logs = await pool.query(
      "SELECT action,details FROM audit_log WHERE subject_id=ANY($1::text[])",
      [[posted.id, fixture.id]],
    );
    expect(logs.rows.map((r) => r.action)).toEqual(
      expect.arrayContaining([
        "comment.hidden",
        "comment.restored",
        "comments.closed",
        "comments.opened",
      ]),
    );
    expect(JSON.stringify(logs.rows)).not.toContain(input.body);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: ".local/comments-" + test.info().project.name + "-operator.png",
      fullPage: true,
    });
    await pool.query(
      "UPDATE content_record SET withdrawn_at=NOW() WHERE id=$1",
      [fixture.id],
    );
    expect((await request.get(fixture.endpoint)).status()).toBe(404);
    expect(
      (await visitor.post(fixture.endpoint, { data: commentBody() })).status(),
    ).toBe(404);
    expect((await visitor.post(fixture.endpoint + "/session")).status()).toBe(
      404,
    );
  } finally {
    await pool.query(
      "UPDATE content_record SET withdrawn_at=NULL,comments_enabled=true WHERE id=$1",
      [fixture.id],
    );
    await visitor.dispose();
  }
});

test("comment guards, request bounds and posting limits reject abuse without reviving retired submissions", async ({
  request,
}) => {
  const fixture = await commentFixture(172),
    visitor = await commentVisitor(fixture.endpoint);
  try {
    expect(
      (
        await request.post(fixture.endpoint, { headers, data: commentBody() })
      ).status(),
    ).toBe(403);
    expect(
      (
        await visitor.post(fixture.endpoint, {
          headers: { Origin: "https://other.example" },
          data: commentBody(),
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await visitor.post(fixture.endpoint + "/session", {
          headers: { Origin: "https://other.example" },
        })
      ).status(),
    ).toBe(403);
    expect((await request.get(fixture.endpoint + "?page=-1")).status()).toBe(
      400,
    );
    const cookie = (await visitor.storageState()).cookies.find(
      (c) => c.name === commentCookie,
    )!;
    expect(
      (
        await request.post(fixture.endpoint, {
          headers: {
            ...headers,
            Cookie: commentCookie + "=" + cookie.value.slice(0, -2) + "zz",
          },
          data: commentBody(),
        })
      ).status(),
    ).toBe(403);
    const input = commentBody();
    const responses = await Promise.all([
      visitor.post(fixture.endpoint, { data: input }),
      visitor.post(fixture.endpoint, { data: input }),
    ]);
    expect(responses.map((r) => r.status())).toEqual([200, 200]);
    expect((await responses[0].json()).id).toBe((await responses[1].json()).id);
    expect(
      (
        await visitor.post(fixture.endpoint, {
          data: { ...input, body: "Changed retry" },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await visitor.post(fixture.endpoint, {
          data: { ...commentBody(), website: "spam.invalid" },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await visitor.post(fixture.endpoint, {
          data: "x".repeat(20000),
          headers: { "Content-Type": "application/json" },
        })
      ).status(),
    ).toBe(400);
    expect(
      (await visitor.post(fixture.endpoint, { data: commentBody() })).status(),
    ).toBe(429);
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS n FROM project_comment WHERE record_id=$1",
          [fixture.id],
        )
      ).rows[0].n,
    ).toBe(1);
    const keys = (
      await pool.query(
        "SELECT key FROM app_rate_limit WHERE key=ANY($1::text[])",
        [
          [
            commentHash("global"),
            commentHash("browser:" + cookie.value.split(".")[0]),
          ],
        ],
      )
    ).rows;
    expect(keys).toHaveLength(2);
    expect(keys.every((r) => /^[a-f0-9]{64}$/.test(r.key))).toBe(true);
    const other = await commentVisitor(fixture.endpoint);
    try {
      await pool.query(
        "UPDATE app_rate_limit SET count=60,resets_at=NOW()+INTERVAL '1 minute' WHERE key=$1",
        [commentHash("global")],
      );
      expect(
        (await other.post(fixture.endpoint, { data: commentBody() })).status(),
      ).toBe(429);
      await pool.query(
        "UPDATE app_rate_limit SET resets_at=NOW()-INTERVAL '1 second' WHERE key=$1",
        [commentHash("global")],
      );
      expect(
        (await other.post(fixture.endpoint, { data: commentBody() })).status(),
      ).toBe(200);
    } finally {
      await other.dispose();
    }
    const legacyId = randomUUID();
    await pool.query(
      "INSERT INTO guest_submission (id,record_id,kind,display_name,body,state) VALUES ($1,$2,'comment','Old visitor','RETIRED-COMMENT-NOT-RESTORED','approved')",
      [legacyId, fixture.id],
    );
    expect(await (await request.get(fixture.endpoint)).text()).not.toContain(
      "RETIRED-COMMENT-NOT-RESTORED",
    );
    await pool.query("DELETE FROM guest_submission WHERE id=$1", [legacyId]);
  } finally {
    await visitor.dispose();
  }
});

test("closing or withdrawing a project wins against a waiting comment submission", async () => {
  const fixture = await commentFixture(173),
    visitor = await commentVisitor(fixture.endpoint);
  const tx = await pool.connect();
  try {
    await tx.query("BEGIN");
    await tx.query(
      "UPDATE content_record SET comments_enabled=false WHERE id=$1",
      [fixture.id],
    );
    const pending = visitor.post(fixture.endpoint, { data: commentBody() });
    // The pending writer cannot pass the row lock before this closure commits.
    await expect
      .poll(
        async () =>
          (
            await pool.query(
              "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT r.id,r.comments_enabled%FOR UPDATE OF r'",
            )
          ).rows[0].n,
      )
      .toBeGreaterThan(0);
    await tx.query("COMMIT");
    expect((await pending).status()).toBe(409);
    await tx.query("BEGIN");
    await tx.query(
      "UPDATE content_record SET comments_enabled=true,withdrawn_at=NOW() WHERE id=$1",
      [fixture.id],
    );
    const withdrawn = visitor.post(fixture.endpoint, { data: commentBody() });
    await expect
      .poll(
        async () =>
          (
            await pool.query(
              "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT r.id,r.comments_enabled%FOR UPDATE OF r'",
            )
          ).rows[0].n,
      )
      .toBeGreaterThan(0);
    await tx.query("COMMIT");
    expect((await withdrawn).status()).toBe(404);
    expect(
      (
        await pool.query(
          "SELECT count(*)::int AS n FROM project_comment WHERE record_id=$1",
          [fixture.id],
        )
      ).rows[0].n,
    ).toBe(0);
  } finally {
    await tx.query("ROLLBACK");
    tx.release();
    await pool.query(
      "UPDATE content_record SET comments_enabled=true,withdrawn_at=NULL WHERE id=$1",
      [fixture.id],
    );
    await visitor.dispose();
  }
});

test("phone grid, comment shortcuts and browser favourites work across pages and tabs", async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: "wassa_cookie_consent", value: "v1.rejected", url: origin },
  ]);
  const results = "/projects?q=" + encodeURIComponent(prefix) + "&page=2";
  await page.goto(results);
  const card = page.locator(".project-card").first();
  const title = (await card.locator("h2").innerText()).trim();
  const projectPath = (await card.locator("h2 a").getAttribute("href"))!;
  for (const width of [360, 430]) {
    await page.setViewportSize({ width, height: 820 });
    await page.getByRole("button", { name: "Grid", exact: true }).click();
    await expect(card.locator(".card-community")).toBeVisible();
    await expect(card.locator(".card-meta .badge")).toBeVisible();
    await expect(card.locator(".card-meta .badge")).toHaveText("Ongoing");
    const first = (await card.boundingBox())!;
    const second = (await page.locator(".project-card").nth(1).boundingBox())!;
    expect(second.y).toBe(first.y);
    expect(second.x).toBeGreaterThan(first.x + first.width);
    for (const control of [
      card.locator("h2 a"),
      card.getByRole("button"),
      card.getByRole("link", { name: /Write a comment on/ }),
    ]) {
      await control.focus();
      await expect(control).toBeFocused();
      expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
  }
  await card.getByRole("button").click();
  await page.reload();
  await expect(card.getByRole("button")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.getByRole("button", { name: "Grid", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await card.getByRole("link", { name: /Write a comment on/ }).click();
  await expect(page).toHaveURL(
    origin + projectPath + "#write-comment",
  );
  const heading = page.getByRole("textbox", { name: "Comment", exact: true });
  await expect(heading).toBeFocused();
  await expect(heading).toBeInViewport();
  expect((await heading.boundingBox())!.y).toBeGreaterThanOrEqual(
    (await page.locator(".site-header").boundingBox())!.height,
  );
  await expect(page.getByRole("form", { name: "Write a comment" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Favourite " + title, exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "Back to results" }).click();
  await expect(
    page.getByRole("navigation", { name: "Project pages" }),
  ).toContainText("Page 2");
  const secondCard = page.locator(".project-card").nth(1);
  const secondTitle = (await secondCard.locator("h2").innerText()).trim();
  await secondCard.getByRole("button").click();
  const saved = await context.newPage();
  await saved.setViewportSize({ width: 360, height: 820 });
  await saved.goto("/favourites");
  await expect(saved.locator(".project-card h2")).toHaveText([
    secondTitle,
    title,
  ]);
  expect(
    (
      await new AxeBuilder({ page: saved })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations.map((v) => v.id),
  ).toEqual([]);
  await saved.getByRole("button", { name: "List", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "List", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await secondCard.getByRole("button").click();
  await expect(saved.locator(".project-card")).toHaveCount(1);
  await pool.query(
    "UPDATE content_record SET comments_enabled=false WHERE slug=$1",
    [projectPath.split("/").pop()],
  );
  await saved.reload();
  await saved.getByRole("link", { name: "View comments on " + title }).click();
  await expect(
    saved.getByText("New comments are closed for this project."),
  ).toBeVisible();
  await saved.getByRole("link", { name: "Back to favourites" }).click();
  await expect(saved).toHaveURL(origin + "/favourites");
  const api = "**/api/public/content/" + projectPath.split("/").pop();
  await saved.route(api, (route) => route.fulfill({ status: 503, json: {} }));
  await saved.reload();
  await expect(saved.getByRole("main").getByRole("alert")).toContainText(
    "Some favourites could not load",
  );
  await saved.unroute(api);
  await saved.getByRole("button", { name: "Retry loading favourites" }).click();
  await expect(saved.locator(".project-card h2")).toHaveText(title);
  await saved.route(api, (route) => route.fulfill({ status: 404, json: {} }));
  await saved.reload();
  await expect(
    saved.getByRole("heading", { name: "No favourites yet" }),
  ).toBeVisible();
  await saved.unroute(api);
  await saved.reload();
  await saved
    .getByRole("button", { name: "Favourite " + title, exact: true })
    .click();
  await expect(
    saved.getByRole("heading", { name: "No favourites yet" }),
  ).toBeVisible();
  await expect(card.getByRole("button")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await saved.close();
});

test("news discussions share anonymous posting and operator moderation; more news ranks related publications first", async ({
  page,
  context,
  request,
}) => {
  await pool.query("DELETE FROM app_rate_limit");
  async function story(
    title: string,
    project: string,
    date: string,
    live = true,
  ) {
    const id = randomUUID();
    storyIds.push(id);
    const value = {
      kind: "News",
      title: title + " " + tag,
      summary: "Published community news.",
      detail: "A story with its own discussion.",
      project,
      photo: "",
      caption: "",
    };
    await pool.query(
      "INSERT INTO news_story(id,state,contributors,draft,published,published_at) VALUES ($1,$2,'[]',$3,$4,$5)",
      [
        id,
        live ? "published" : "draft",
        value,
        live ? value : null,
        live ? date : null,
      ],
    );
    return { id, title: value.title };
  }
  const main = await story("Main story", firstSlug, "2080-01-01");
  const relatedOld = await story(
    "Older related story",
    firstSlug,
    "2001-01-01",
  );
  const relatedNew = await story(
    "Newer related story",
    firstSlug,
    "2002-01-01",
  );
  const latest = await story("Latest unrelated story", "", "2099-01-01");
  const extra = await story("Other unrelated story", "", "2098-01-01");
  const unpublished = await story(
    "Unpublished story",
    firstSlug,
    "2099-01-01",
    false,
  );
  const endpoint = `/api/public/news/${main.id}/comments`;
  await context.addCookies([
    { name: "wassa_cookie_consent", value: "v1.rejected", url: origin },
  ]);
  await page.goto("/news/" + main.id);
  const more = page.getByRole("region", { name: "More news", exact: true });
  await expect(more.getByRole("link")).toHaveText([
    relatedNew.title + "1 January 2002",
    relatedOld.title + "1 January 2001",
    latest.title + "1 January 2099",
  ]);
  await expect(more.getByRole("link")).toHaveCount(3);
  await pool.query("UPDATE content_record SET withdrawn_at=NOW() WHERE slug=$1", [firstSlug]);
  await page.reload();
  await expect(page.getByRole("link", { name: "View project", exact: true })).toHaveCount(0);
  await expect(more.getByRole("link")).toHaveText([
    relatedNew.title + "1 January 2002", relatedOld.title + "1 January 2001", latest.title + "1 January 2099",
  ]);
  await pool.query("UPDATE content_record SET withdrawn_at=NULL WHERE slug=$1", [firstSlug]);
  expect(
    (await request.get(`/api/public/news/${unpublished.id}/comments`)).status(),
  ).toBe(404);
  expect(
    (
      await request.post(
        `/api/public/news/sample-classroom-roof/comments/session`,
        { headers },
      )
    ).status(),
  ).toBe(404);
  expect(
    (await request.get(`/api/public/news/${extra.id}/comments`)).status(),
  ).toBe(200);
  await page
    .getByRole("button", { name: "Write a comment", exact: true })
    .click();
  await expect(page.getByLabel("Comment", { exact: true })).toBeFocused();
  await page
    .getByLabel("Comment", { exact: true })
    .fill("A visitor’s news comment <b>plain text</b>");
  await page.getByLabel("Name", { exact: true }).fill("News reader");
  await page.getByRole("button", { name: "Post comment", exact: true }).click();
  await expect(
    page.getByText("Your comment is now public.", { exact: true }),
  ).toBeVisible();
  const guard = (await context.cookies()).find(
    (cookie) => cookie.name === commentCookie,
  )!;
  expect(guard).toMatchObject({ httpOnly: true, sameSite: "Strict" });
  const posted = (await (await request.get(endpoint)).json()).items[0];
  expect(posted.body).toContain("<b>plain text</b>");
  await expect(page.locator(".comment-card b")).toHaveCount(0);
  expect(
    (await (await request.get(`/api/public/news/${extra.id}/comments`)).json())
      .items,
  ).toEqual([]);
  expect(
    (
      await editor.patch("/api/staff/comments", {
        data: { action: "hide", id: posted.id, version: 0 },
      })
    ).status(),
  ).toBe(403);
  await context.addCookies((await operator.storageState()).cookies);
  await page.goto("/admin?view=comments");
  await page
    .getByLabel("Project or news story", { exact: true })
    .selectOption("news:" + main.id);
  await expect(
    page.getByRole("list", { name: "Manage comments" }),
  ).toContainText(posted.body);
  await page.getByRole("button", { name: "Hide comment", exact: true }).click();
  await expect(
    page.getByText("Comment hidden. You can restore it from Hidden comments.", {
      exact: true,
    }),
  ).toBeVisible();
  expect((await (await request.get(endpoint)).json()).items).toEqual([]);
  await page.getByLabel("Show", { exact: true }).selectOption("hidden");
  await page
    .getByRole("button", { name: "Restore comment", exact: true })
    .click();
  await expect(
    page.getByText("Comment restored publicly.", { exact: true }),
  ).toBeVisible();
  expect((await (await request.get(endpoint)).json()).items).toHaveLength(1);
  await page
    .getByRole("button", { name: "Close new comments", exact: true })
    .click();
  await expect(
    page.getByText("New comments closed.", { exact: true }),
  ).toBeVisible();
  expect(
    (
      await operator.patch("/api/staff/comments", {
        data: {
          action: "set-enabled",
          id: "news:" + main.id,
          enabled: true,
          version: 0,
        },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await context.request.post(endpoint, {
        headers,
        data: {
          submissionId: randomUUID(),
          displayName: "Reader",
          body: "Closed",
          website: "",
        },
      })
    ).status(),
  ).toBe(409);
  await page.goto("/news/" + main.id + "#write-comment");
  await expect(
    page.getByText("New comments are closed for this story."),
  ).toBeVisible();
  await expect(page.getByRole("form", { name: "Write a comment" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("list", { name: "Visitor comments" }),
  ).toContainText(posted.body);
  await pool.query(
    "UPDATE news_story SET published=NULL,published_at=NULL,state='withdrawn' WHERE id=$1",
    [main.id],
  );
  expect((await request.get(endpoint)).status()).toBe(404);
  expect(
    (
      await context.request.post(endpoint, {
        headers,
        data: {
          submissionId: randomUUID(),
          displayName: "Reader",
          body: "Withdrawn",
          website: "",
        },
      })
    ).status(),
  ).toBe(404);
  await page.goto("/news/" + relatedNew.id);
  await expect(
    page
      .getByRole("region", { name: "More news" })
      .getByRole("link", { name: main.title }),
  ).toHaveCount(0);
});

test("install tracker exposes valid app assets, native prompt outcomes, and iPhone home screen instructions", async ({
  page,
  browser,
  request,
}) => {
  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.status()).toBe(200);
  const manifest = await manifestResponse.json();
  expect(manifest).toMatchObject({
    id: "/",
    name: "Wassa East Projects",
    short_name: "Wassa East",
    start_url: "/",
    scope: "/",
    display: "standalone",
    prefer_related_applications: false,
  });
  const sharp = (await import("sharp")).default;
  for (const icon of manifest.icons) {
    const response = await request.get(icon.src);
    expect(response.status()).toBe(200);
    const metadata = await sharp(await response.body()).metadata();
    expect(`${metadata.width}x${metadata.height}`).toBe(icon.sizes);
  }
  await page.goto("/");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    "href",
    "/brand/apple-touch-icon.png",
  );
  const cdp = await page.context().newCDPSession(page);
  const appManifest = await cdp.send("Page.getAppManifest");
  expect(appManifest.errors).toEqual([]);
  expect(appManifest.url).toBe(origin + "/manifest.webmanifest");
  const installability = await cdp.send("Page.getInstallabilityErrors");
  // Playwright contexts are incognito, which independently prevents installation.
  // Every app/manifest error must still fail this check.
  expect(installability.installabilityErrors.filter((error) => error.errorId !== "in-incognito")).toEqual([]);
  await cdp.detach();
  await expect(page.locator("footer")).toContainText(
    `© ${new Date().getUTCFullYear()} Wassa East Constituency`,
  );
  for (const path of ["/projects", "/favourites", "/about", "/contact", "/faq", "/privacy", "/unavailable-fixture", "/news/unavailable-fixture"]) {
    await page.goto(path);
    await expect(page.locator("footer")).toHaveCount(1);
    await expect(page.locator("footer")).toContainText(`© ${new Date().getUTCFullYear()} Wassa East Constituency`);
  }
  await page.goto("/");
  for (const outcome of ["dismissed", "accepted"]) {
    await page.evaluate((outcome) => {
      const event = new Event("beforeinstallprompt", { cancelable: true });
      Object.assign(event, {
        prompt: async () => {
          document.documentElement.dataset.prompted = "yes";
        },
        userChoice: Promise.resolve({ outcome }),
      });
      window.dispatchEvent(event);
    }, outcome);
    if (
      await page
        .getByRole("button", { name: "Open menu", exact: true })
        .isVisible()
    )
      await page
        .getByRole("button", { name: "Open menu", exact: true })
        .click();
    await page
      .getByRole("button", { name: "Install tracker", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Install tracker" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("requires an internet connection");
    await expect(dialog.getByRole("status")).toContainText(
      outcome === "accepted"
        ? "Installation requested"
        : "Installation cancelled",
    );
    expect(await page.locator("html").getAttribute("data-prompted")).toBe(
      "yes",
    );
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
  }
  await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
  await page
    .getByRole("button", { name: "Install tracker", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("already installed");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  const iphone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
  });
  const phone = await iphone.newPage();
  await phone.goto(origin);
  await phone.getByRole("button", { name: "Open menu", exact: true }).click();
  await phone
    .getByRole("button", { name: "Install tracker", exact: true })
    .click();
  await expect(phone.getByRole("dialog")).toContainText(
    "Share → Add to Home Screen",
  );
  await expect(phone.getByRole("dialog")).toContainText("Open as Web App");
  await phone.screenshot({ path: ".local/install-iphone-" + test.info().project.name + ".png" });
  expect(
    (
      await new AxeBuilder({ page: phone })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations.map((v) => v.id),
  ).toEqual([]);
  await phone
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(
    phone.getByRole("button", { name: "Install tracker", exact: true }),
  ).toBeFocused();
  await iphone.close();
});

import {
  test,
  expect,
  request as requests,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { config } from "dotenv";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { encrypt, hashToken, newTotp } from "../../src/lib/security/crypto";
import { emptyPayload, emptyFinancials } from "../../src/lib/content/types";
config({ path: ".env.local", quiet: true });
const url = new URL(process.env.DATABASE_URL!);
url.pathname = "/wassa_test";
if (url.hostname !== "127.0.0.1" || url.port !== "55432")
  throw new Error("Isolated acceptance database required");
const pool = new Pool({ connectionString: url.toString() }),
  origin = "http://localhost:3100",
  headers = { Origin: origin };
const people: string[] = [],
  records: string[] = [];
let operator: APIRequestContext,
  officer: APIRequestContext,
  approver: APIRequestContext,
  operatorId: string,
  officerId: string,
  community: string,
  project: string,
  slug: string;
async function account(role: string, hash: string) {
  const id = randomUUID(),
    email = `acceptance-${id}@example.invalid`;
  people.push(id);
  await pool.query(
    'INSERT INTO "user" (id,name,email,email_verified) VALUES ($1,$2,$3,true)',
    [id, `Acceptance ${role}`, email],
  );
  await pool.query(
    "INSERT INTO staff (user_id,role,mfa_secret,mfa_enabled,recovery_hashes) VALUES ($1,$2,$3,true,$4)",
    [
      id,
      role,
      encrypt(newTotp(email).secret.base32),
      JSON.stringify([hashToken("acceptance-recovery")]),
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
  expect(
    (
      await api.post("/api/auth/sign-in/email", {
        data: { email, password: "Acceptance-test-password-2026!" },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await api.post("/api/staff/mfa", {
        data: { action: "verify", code: "acceptance-recovery" },
      })
    ).status(),
  ).toBe(200);
  return { id, api };
}
test.beforeAll(async () => {
  await pool.query("DELETE FROM auth_rate_limit");
  await pool.query("DELETE FROM app_rate_limit");
  const hash = await hashPassword("Acceptance-test-password-2026!");
  const a = await account("super_admin", hash);
  operator = a.api;
  operatorId = a.id;
  const o = await account("officer", hash);
  officer = o.api;
  officerId = o.id;
  approver = (await account("approver", hash)).api;
  community = randomUUID();
  await pool.query(
    "INSERT INTO taxonomy (id,kind,name) VALUES ($1,'community',$2)",
    [community, `Acceptance community ${community.slice(0, 6)}`],
  );
  project = randomUUID();
  slug = `acceptance-${project}`;
  records.push(project);
  const revision = randomUUID();
  await pool.query(
    "INSERT INTO content_record (id,kind,slug,created_by) VALUES ($1,'project',$2,$3)",
    [project, slug, officerId],
  );
  const payload = {
    ...emptyPayload,
    title: "A community learning space",
    description:
      "Independently reviewed project information for the local community.",
    objectives: "Improve learning conditions in the community.",
    categoryId: "category-education",
    categoryName: "Education",
    communityId: community,
    communityName: "Acceptance community",
    source: "Reviewed field notes",
    reportingOffice: "Constituency project office",
    status: "Ongoing",
    progress: 45,
    progressExplanation: "The foundation and walls have been checked.",
  };
  await pool.query(
    "INSERT INTO content_revision (id,record_id,number,state,base_version,author_id,contributors,decided_by,decided_at,payload,financials) VALUES ($1,$2,1,'approved',0,$3,$4,$5,NOW(),$6,$7)",
    [
      revision,
      project,
      officerId,
      JSON.stringify([officerId]),
      operatorId,
      JSON.stringify(payload),
      JSON.stringify({
        ...emptyFinancials,
        budget: "9876543.21",
        internalNotes: "ACCEPTANCE-PRIVATE-NOTES",
      }),
    ],
  );
  await pool.query(
    "UPDATE content_record SET published_revision_id=$2 WHERE id=$1",
    [project, revision],
  );
  await pool.query(
    "INSERT INTO guest_submission (id,record_id,kind,display_name,body) VALUES ($1,$2,'comment','A neighbour','Please share the next reviewed community project update.')",
    [randomUUID(), project],
  );
});
test.afterAll(async () => {
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
  await pool.query(
    "DELETE FROM audit_log WHERE actor_id=ANY($1::text[]) OR subject_id=ANY($2::text[])",
    [people, records],
  );
  await pool.query("DELETE FROM taxonomy WHERE id=$1", [community]);
  await pool.query('DELETE FROM "user" WHERE id=ANY($1::text[])', [people]);
  await Promise.all(
    [operator, officer, approver].filter(Boolean).map((c) => c.dispose()),
  );
  await pool.end();
});
async function audit(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator("h1")).toBeVisible();
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
    `Accessibility on ${path}`,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    `No page overflow on ${path}`,
  ).toBe(true);
}
test("public and sign-in pages meet automated accessibility and phone layout checks", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const path of [
    "/",
    "/projects",
    `/projects/${slug}`,
    "/updates",
    "/announcements",
    "/reports",
    "/about",
    "/following",
    "/staff/login",
    "/staff/setup",
  ])
    await audit(page, path);
  expect(errors).toEqual([]);
});
test("real staff pages meet automated accessibility and phone layout checks", async ({
  page,
  context,
}) => {
  await context.addCookies((await operator.storageState()).cookies);
  for (const path of [
    "/admin",
    "/admin?view=projects",
    "/admin?view=new",
    "/admin?view=engagement",
    "/admin?view=inbox",
    "/admin?view=reports",
    "/admin?view=team",
    "/admin?view=taxonomy",
    "/admin?view=audit",
    `/admin/content/${project}`,
  ])
    await audit(page, path);
  await page.screenshot({
    path: `.local/acceptance-${test.info().project.name}-staff.png`,
    fullPage: true,
  });
});
test("phone navigation, guest form and follow controls work with touch", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  if (isMobile) {
    await page.getByRole("button", { name: "Open navigation" }).tap();
    await page
      .getByRole("navigation", { name: "Mobile menu", exact: true })
      .getByRole("link", { name: "Projects", exact: true })
      .tap();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(
      page.getByRole("heading", {
        name: "Every project. Every step.",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Mobile menu", exact: true }),
    ).not.toBeVisible();
  }
  await page.goto(`/projects/${slug}`);
  await page
    .getByRole("button", { name: "Follow this project", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Write a comment", exact: true })
    .click();
  await page
    .getByLabel("Your message", { exact: true })
    .fill(
      "We would appreciate the next approved progress update for this project.",
    );
  await expect(page.getByLabel(/What is \d+ \+ \d+\?/)).toBeVisible();
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    result.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  if (isMobile) {
    const smallInputs = await page
      .locator(
        ".visitor-form input:not([tabindex='-1']),.visitor-form textarea",
      )
      .evaluateAll((nodes) =>
        nodes
          .filter((n) => parseFloat(getComputedStyle(n).fontSize) < 16)
          .map((n) => n.outerHTML.slice(0, 100)),
      );
    expect(
      smallInputs,
      "Phone form controls should use readable 16px text",
    ).toEqual([]);
  }
  await page.screenshot({
    path: `.local/acceptance-${test.info().project.name}-discussion.png`,
    fullPage: true,
  });
});
test("staff can create, submit, approve and sign out from a phone", async ({
  page,
  context,
  browser,
}) => {
  await context.addCookies((await officer.storageState()).cookies);
  await page.goto("/admin?view=new");
  await page
    .getByLabel("Title", { exact: true })
    .fill("Phone workflow learning space");
  await page.getByRole("button", { name: "Create private draft" }).click();
  await expect(page).toHaveURL(/\/admin\/content\//);
  const id = page.url().split("/content/")[1].split("?")[0];
  records.push(id);
  await page
    .getByLabel("Description", { exact: true })
    .fill(
      "A documented learning space project prepared through a phone browser.",
    );
  await page
    .getByLabel("Objectives", { exact: true })
    .fill("Provide a suitable local learning space.");
  await page
    .getByLabel("Category", { exact: true })
    .selectOption("category-education");
  await page.getByLabel("Community", { exact: true }).selectOption(community);
  await page
    .getByLabel("Information source")
    .fill("Reviewed community field notes");
  await page
    .getByLabel("Authorised reporting office")
    .fill("Constituency project office");
  await page
    .getByLabel("How is progress measured?")
    .fill("Baseline recorded before construction starts.");
  await page.getByRole("button", { name: "Save & send for review" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Submitted for independent review",
  );
  const reviewer = await browser.newContext({
    baseURL: origin,
    storageState: await approver.storageState(),
    viewport: page.viewportSize()!,
  });
  const review = await reviewer.newPage();
  await review.goto(`/admin/content/${id}`);
  await review
    .getByLabel("Review or withdrawal reason")
    .fill("Checked the information and public/private boundaries.");
  await review
    .getByRole("checkbox", { name: /I checked the attribution/ })
    .check();
  await review.getByRole("button", { name: "Approve & publish" }).click();
  await expect(review.getByRole("status")).toContainText(
    "Approved and published",
  );
  await reviewer.close();
  const data = (await (
    await officer.get(`/api/staff/content/${id}`)
  ).json()) as { slug: string };
  await page.goto(`/projects/${data.slug}`);
  await expect(
    page.getByRole("heading", {
      name: "Phone workflow learning space",
      exact: true,
    }),
  ).toBeVisible();
  expect(await page.content()).not.toContain("ACCEPTANCE-PRIVATE-NOTES");
  await page.goto("/admin");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/staff\/login/);
  expect((await context.request.get("/api/staff/content")).status()).toBe(403);
});
test("keyboard navigation reaches the main content and controls retain visible focus", async ({
  page,
}) => {
  await page.goto("/projects");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  await page.getByLabel("Search projects", { exact: true }).focus();
  expect(
    await page
      .getByLabel("Search projects", { exact: true })
      .evaluate((node) => {
        const s = getComputedStyle(node);
        return s.outlineStyle !== "none" || s.boxShadow !== "none";
      }),
  ).toBe(true);
});
test("Chrome phone offline reading has a saved-time notice and can be cleared", async ({
  page,
  context,
}) => {
  await page.goto("/following");
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
    .poll(() =>
      page.evaluate(
        async () =>
          !!(await (
            await caches.open("wassa-public-v1-pages")
          ).match(location.href)),
      ),
    )
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "A community learning space",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText(/Offline reading · Copy saved/)).toBeVisible();
  await context.setOffline(false);
  await page.goto("/following");
  await page
    .getByRole("button", { name: "Disable offline reading", exact: true })
    .click();
  await expect(
    page.getByText(
      "Offline reading disabled and saved public copies removed.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(
    await page.evaluate(async () => {
      const names = await caches.keys();
      return (
        names.includes("wassa-public-v1-pages") ||
        names.includes("wassa-public-v1-thumbnails")
      );
    }),
  ).toBe(false);
});

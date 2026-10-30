import { test, expect, type APIRequestContext } from "@playwright/test";
import { config } from "dotenv";
import { Pool } from "pg";
import { randomBytes, randomUUID, createHmac } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import {
  encrypt,
  decrypt,
  hashToken,
  newTotp,
} from "../../src/lib/security/crypto";
config({ path: ".env.local", quiet: true });
const url = new URL(process.env.DATABASE_URL!);
url.pathname = "/wassa_test";
if (url.hostname !== "127.0.0.1" || url.port !== "55432")
  throw new Error("Tests may only use the isolated local test database.");
const pool = new Pool({ connectionString: url.toString() });
const origin = "http://localhost:3100";
const ids: string[] = [];
const password = "A-unique-test-password-2026!";
async function fixture(
  role: "super_admin" | "officer" | "approver" = "officer",
  withMfa = false,
) {
  const id = randomUUID();
  ids.push(id);
  const email = `phase1-${id}@example.invalid`;
  const secret = newTotp(email).secret.base32;
  await pool.query(
    'INSERT INTO "user" (id,name,email,email_verified) VALUES ($1,$2,$3,true)',
    [id, "Test staff", email],
  );
  await pool.query(
    "INSERT INTO staff (user_id,role,mfa_secret,mfa_enabled,recovery_hashes) VALUES ($1,$2,$3,$4,$5)",
    [
      id,
      role,
      withMfa ? encrypt(secret) : null,
      withMfa,
      JSON.stringify(withMfa ? [hashToken("a".repeat(16))] : []),
    ],
  );
  await pool.query(
    "INSERT INTO account (id,account_id,provider_id,user_id,password) VALUES ($1,$2,'credential',$2,$3)",
    [randomUUID(), id, await hashPassword(password)],
  );
  return { id, email, secret };
}
async function signIn(api: APIRequestContext, email: string) {
  const response = await api.post("/api/auth/sign-in/email", {
    headers: { Origin: origin },
    data: { email, password },
  });
  expect(response.status(), await response.text()).toBe(200);
}
test.beforeEach(async () => {
  await pool.query("DELETE FROM auth_rate_limit");
  await pool.query("DELETE FROM app_rate_limit");
});
test.afterAll(async () => {
  if (ids.length) {
    await pool.query(
      "DELETE FROM audit_log WHERE actor_id = ANY($1::text[]) OR subject_id = ANY($1::text[])",
      [ids],
    );
    await pool.query(
      "DELETE FROM staff_link WHERE created_by = ANY($1::text[])",
      [ids],
    );
    await pool.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [ids]);
  }
  await pool.end();
});
test("public preview loads, filters and opens a project", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Our communities. Our progress." }),
  ).toBeVisible();
  await expect(
    page.getByText("Sample records and illustrations", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "View projects", exact: true })
    .first()
    .click();
  await page.getByLabel("Category", { exact: true }).selectOption("Health");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.locator(".project-card")).toHaveCount(1);
  await page
    .getByRole("heading", { name: "Care closer to the community" })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Care closer to the community",
      level: 1,
    }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("mobile home and admin preview fit without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("navigation", { name: "Mobile primary navigation" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(async () => {
    await Promise.all(
      Array.from(document.images).map(async (image) => {
        image.loading = "eager";
        await image.decode().catch(() => undefined);
      }),
    );
  });
  await page.screenshot({ path: ".local/home-mobile.png", fullPage: true });
  await page.goto("/preview/console");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: ".local/admin-mobile.png", fullPage: true });
});
test("administrative design screens are reviewable without real data access", async ({
  page,
}) => {
  await page.goto("/preview/console");
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: ".local/admin-desktop.png", fullPage: true });
  await page.getByRole("link", { name: "New project", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "New project", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Project title").fill("Design review example");
  await page.getByLabel("Category", { exact: true }).selectOption("Education");
  await page.getByLabel("Community", { exact: true }).fill("Sample community");
  await page
    .getByLabel("Description and objectives")
    .fill("Illustrative form entry.");
  await page.getByRole("button", { name: "Preview save draft" }).click();
  await expect(page.getByRole("status")).toContainText("Design preview only");
});
test("anonymous users cannot access admin, staff mutation or public signup", async ({
  page,
  request,
}) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/staff\/login/);
  expect(
    (
      await request.post("/api/staff/links", {
        headers: { Origin: origin },
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect(
    (await request.post("/api/auth/sign-up/email", { data: {} })).status(),
  ).toBe(404);
  expect(
    (
      await request.post("/api/auth/request-password-reset", { data: {} })
    ).status(),
  ).toBe(404);
});
test("password authentication cannot bypass MFA or the operator role", async ({
  page,
}) => {
  const request = page.request;
  const person = await fixture();
  await signIn(request, person.email);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/staff\/security/);
  expect(
    (
      await request.post("/api/staff/links", {
        headers: { Origin: origin },
        data: {},
      })
    ).status(),
  ).toBe(403);
  const enrol = await request.post("/api/staff/mfa", {
    headers: { Origin: origin },
    data: { action: "enrol" },
  });
  expect(enrol.status()).toBe(200);
  const { secret } = await enrol.json();
  const verified = await request.post("/api/staff/mfa", {
    headers: { Origin: origin },
    data: { action: "verify", code: newTotp(person.email, secret).generate() },
  });
  expect(verified.status()).toBe(200);
  expect((await verified.json()).recoveryCodes).toHaveLength(8);
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Content register", exact: true }),
  ).toBeVisible();
  expect(
    (
      await request.post("/api/staff/links", {
        headers: { Origin: origin },
        data: {
          name: "Other staff",
          email: "other@example.invalid",
          role: "approver",
          kind: "setup",
        },
      })
    ).status(),
  ).toBe(403);
});
test("provider-independent social sessions also require MFA and honour deactivation", async ({
  page,
  context,
}) => {
  const person = await fixture("approver", true);
  const token = randomBytes(32).toString("hex");
  const sessionId = randomUUID();
  await pool.query(
    "INSERT INTO account (id,account_id,provider_id,user_id) VALUES ($1,$2,'google',$3)",
    [randomUUID(), `google-${person.id}`, person.id],
  );
  await pool.query(
    "INSERT INTO session (id,token,user_id,expires_at) VALUES ($1,$2,$3,NOW()+INTERVAL '1 hour')",
    [sessionId, token, person.id],
  );
  const signature = createHmac("sha256", process.env.BETTER_AUTH_SECRET!)
    .update(token)
    .digest("base64");
  await context.addCookies([
    {
      name: "better-auth.session_token",
      value: encodeURIComponent(`${token}.${signature}`),
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/staff\/security/);
  await page
    .getByLabel("Authenticator code")
    .fill(newTotp(person.email, person.secret).generate());
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await pool.query("UPDATE staff SET active=false WHERE user_id=$1", [
    person.id,
  ]);
  await page.reload();
  await expect(page).toHaveURL(/\/staff\/login/);
});
test("setup links are single-use and recovery revokes existing sessions", async ({
  request,
}) => {
  const person = await fixture();
  const token = randomBytes(32).toString("base64url");
  await pool.query(
    "INSERT INTO staff_link (id,user_id,token_hash,kind,expires_at) VALUES ($1,$2,$3,'reset',NOW()+INTERVAL '1 hour')",
    [randomUUID(), person.id, hashToken(token)],
  );
  await signIn(request, person.email);
  const body = { token, password: "A-new-unique-password-2026!" };
  expect(
    (
      await request.post("/api/staff/setup", {
        headers: { Origin: origin },
        data: body,
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.post("/api/staff/setup", {
        headers: { Origin: origin },
        data: body,
      })
    ).status(),
  ).toBe(400);
  const sessions = await pool.query(
    "SELECT count(*) FROM session WHERE user_id=$1",
    [person.id],
  );
  expect(Number(sessions.rows[0].count)).toBe(0);
});
test("operator can issue setup links after MFA and no raw token is stored", async ({
  request,
}) => {
  const person = await fixture("super_admin", true);
  await signIn(request, person.email);
  expect(
    (
      await request.post("/api/staff/mfa", {
        headers: { Origin: origin },
        data: {
          action: "verify",
          code: newTotp(person.email, person.secret).generate(),
        },
      })
    ).status(),
  ).toBe(200);
  const email = `phase1-invited-${randomUUID()}@example.invalid`;
  const response = await request.post("/api/staff/links", {
    headers: { Origin: origin },
    data: { name: "Invited staff", email, role: "officer", kind: "setup" },
  });
  expect(response.status()).toBe(200);
  const result = await response.json();
  const raw = new URL(result.url).hash.slice(1);
  const rows = await pool.query(
    'SELECT sl.token_hash,u.id FROM staff_link sl JOIN "user" u ON sl.user_id=u.id WHERE u.email=$1',
    [email],
  );
  ids.push(rows.rows[0].id);
  expect(rows.rows[0].token_hash).toBe(hashToken(raw));
  expect(rows.rows[0].token_hash).not.toBe(raw);
});
test("recovery codes work once and invalid MFA attempts are rate limited", async ({
  request,
}) => {
  const person = await fixture("officer", true);
  await signIn(request, person.email);
  expect(
    (
      await request.post("/api/staff/mfa", {
        headers: { Origin: origin },
        data: { action: "verify", code: "a".repeat(16) },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.post("/api/staff/mfa", {
        headers: { Origin: origin },
        data: { action: "verify", code: "a".repeat(16) },
      })
    ).status(),
  ).toBe(400);
  for (let i = 0; i < 6; i++)
    await request.post("/api/staff/mfa", {
      headers: { Origin: origin },
      data: { action: "verify", code: "invalid" },
    });
  expect(
    (
      await request.post("/api/staff/mfa", {
        headers: { Origin: origin },
        data: { action: "verify", code: "invalid" },
      })
    ).status(),
  ).toBe(429);
  expect(
    (
      await request.post("/api/staff/mfa", {
        headers: { Origin: "https://other.example.invalid" },
        data: { action: "verify", code: "000000" },
      })
    ).status(),
  ).toBe(403);
});
test("an expired session proof does not grant administrative access", async ({
  page,
}) => {
  const request = page.request;
  const person = await fixture("officer", true);
  await signIn(request, person.email);
  expect(
    (
      await request.post("/api/staff/mfa", {
        headers: { Origin: origin },
        data: {
          action: "verify",
          code: newTotp(person.email, person.secret).generate(),
        },
      })
    ).status(),
  ).toBe(200);
  await pool.query(
    "UPDATE staff_session SET expires_at=NOW()-INTERVAL '1 minute' WHERE user_id=$1",
    [person.id],
  );
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/staff\/security/);
});

test("staff can complete setup, password sign-in, and MFA enrolment through the screens", async ({
  page,
}) => {
  const person = await fixture();
  const token = randomBytes(32).toString("base64url");
  await pool.query(
    "INSERT INTO staff_link (id,user_id,token_hash,kind,expires_at) VALUES ($1,$2,$3,'setup',NOW()+INTERVAL '1 hour')",
    [randomUUID(), person.id, hashToken(token)],
  );
  await page.goto(`/staff/setup#${token}`);
  await page.getByLabel("New password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Save password", exact: true })
    .click();
  await page.getByRole("link", { name: "Continue to sign-in" }).click();
  await page.getByLabel("Email address").fill(person.email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/staff\/security/);
  await page.getByRole("button", { name: "Set up authenticator" }).click();
  await expect(
    page.getByAltText("Scan this QR code with your authenticator app"),
  ).toBeVisible();
  const record = await pool.query(
    "SELECT mfa_secret FROM staff WHERE user_id=$1",
    [person.id],
  );
  await page
    .getByLabel("Authenticator code")
    .fill(newTotp(person.email, decrypt(record.rows[0].mfa_secret)).generate());
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await expect(page.locator(".recovery-grid code")).toHaveCount(8);
  await page.getByRole("button", { name: "I've saved my codes" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/staff\/login/);
});

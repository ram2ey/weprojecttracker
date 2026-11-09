import { config } from "dotenv";
import { spawn } from "node:child_process";
import { cpSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import assert from "node:assert/strict";
import { buildDirectory } from "./build-output.mjs";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const output = buildDirectory(process.env.NEXT_DIST_DIR, ".next-build");
config({ path: ".env.local", quiet: true });
const db = new URL(process.env.DATABASE_URL);
assert.ok(
  db.hostname === "127.0.0.1" && db.port === "55432",
  "Only the isolated local cluster may be used.",
);
db.pathname = "/wassa_test";
const standalone = resolve(output, "standalone");
cpSync("public", join(standalone, "public"), { recursive: true });
cpSync(join(output, "static"), join(standalone, output, "static"), {
  recursive: true,
});
const env = {
  ...process.env,
  NODE_ENV: "production",
  APP_ENV: "production",
  DATABASE_URL: db.toString(),
  BETTER_AUTH_URL: "https://localhost:3200",
  ENABLE_DESIGN_PREVIEW: "false",
  MFA_ENCRYPTION_KEY: "",
  GOOGLE_CLIENT_ID: "",
  GOOGLE_CLIENT_SECRET: "",
  NEXT_DIST_DIR: output,
  HOSTNAME: "127.0.0.1",
  PORT: "3200",
  RELEASE_ID: `sha-${"e".repeat(40)}-1-1`,
};
const migration = spawn(
  process.execPath,
  ["node_modules/tsx/dist/cli.mjs", "scripts/migrate.ts"],
  { env, stdio: "inherit" },
);
assert.equal(await new Promise((resolve) => migration.on("exit", resolve)), 0);
async function ready(port) {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch("http://127.0.0.1:" + port + "/api/health")).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error("Server did not start.");
}
const server = spawn(process.execPath, [join(standalone, "server.js")], {
  env,
  stdio: ["ignore", "pipe", "pipe"],
});
try {
  await ready(3200);
  const readiness = await (
    await fetch("http://127.0.0.1:3200/api/ready")
  ).json();
  assert.equal(readiness.release, env.RELEASE_ID);
  assert.equal(readiness.migrated, true);
  for (const path of [
    "/",
    "/about",
    "/contact",
    "/privacy",
    "/sitemap.xml",
    "/robots.txt",
    "/api/health",
    "/api/ready",
    "/api/og",
    "/sw.js",
  ]) {
    const r = await fetch("http://127.0.0.1:3200" + path);
    assert.equal(r.status, 200, path);
  }
  for (const path of [
    "/following",
    "/reports",
    "/announcements",
    "/updates",
    "/staff/security",
    "/staff/setup",
    "/api/staff/reports",
    "/api/public/push/config",
    "/api/public/projects/map",
    "/preview/console",
  ]) {
    assert.equal(
      (await fetch("http://127.0.0.1:3200" + path)).status,
      404,
      path,
    );
  }
  const redirect = await fetch("http://127.0.0.1:3200/?q=school", {
    redirect: "manual",
  });
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get("location"), "/projects?q=school");
  assert.equal(
    (await fetch("http://127.0.0.1:3200/api/staff/content")).status,
    403,
  );
  assert.ok(
    !(await (await fetch("http://127.0.0.1:3200/")).text()).includes(
      "DESIGN PREVIEW",
    ),
  );
  const chrome =
    process.env.CHROME_PATH ||
    "C:/Program Files/Google/Chrome/Application/chrome.exe";
  const browser = await chromium.launch(
    existsSync(chrome) ? { executablePath: chrome } : {},
  );
  try {
    const context = await browser.newContext({
      viewport: { width: 360, height: 800 },
    });
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:3200/projects");
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: ".local/phase1-phone-register.png",
      fullPage: true,
    });
    const missing = await page.goto(
      "http://127.0.0.1:3200/projects/not-a-published-project",
    );
    assert.equal(missing.status(), 404);
    assert.equal(
      await page
        .getByRole("heading", { name: "This page could not be found." })
        .isVisible(),
      true,
    );
    assert.deepEqual(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
      [],
    );
    await page.getByRole("link", { name: "Return home", exact: true }).click();
    await page
      .getByRole("heading", { name: "Wassa East Project Tracker", exact: true })
      .waitFor();
  } finally {
    await browser.close();
  }
  console.log(
    "Production isolation passed: minimal routes, retired endpoints, redirect, readiness and private staff access.",
  );
} finally {
  server.kill();
}
const unmigrated = spawn(process.execPath, [join(standalone, "server.js")], {
  env: { ...env, PORT: "3202", RELEASE_ID: `sha-${"f".repeat(40)}-1-1` },
  stdio: ["ignore", "pipe", "pipe"],
});
try {
  await ready(3202);
  assert.equal((await fetch("http://127.0.0.1:3202/api/ready")).status, 503);
  console.log(
    "Readiness rejects a release without a matching migration-success marker.",
  );
} finally {
  unmigrated.kill();
}
const unavailable = spawn(process.execPath, [join(standalone, "server.js")], {
  env: {
    ...env,
    DATABASE_URL: "",
    PGHOST: db.hostname,
    PGPORT: "1",
    PGDATABASE: "wassa_test",
    PGUSER: decodeURIComponent(db.username),
    PGPASSWORD: decodeURIComponent(db.password),
    PORT: "3201",
    BETTER_AUTH_URL: "https://localhost:3201",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
try {
  await ready(3201);
  assert.equal(
    (
      await fetch("http://127.0.0.1:3201/api/ready", {
        signal: AbortSignal.timeout(12000),
      })
    ).status,
    503,
  );
  console.log("Readiness correctly rejects an unavailable database.");
  const chrome =
    process.env.CHROME_PATH ||
    "C:/Program Files/Google/Chrome/Application/chrome.exe";
  const browser = await chromium.launch(
    existsSync(chrome) ? { executablePath: chrome } : {},
  );
  try {
    const context = await browser.newContext({
      viewport: { width: 360, height: 800 },
    });
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:3201/projects");
    await page
      .getByRole("heading", {
        name: "Published information is temporarily unavailable.",
      })
      .waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Try again", exact: true })
        .isVisible(),
      true,
    );
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await page
      .getByRole("heading", {
        name: "Published information is temporarily unavailable.",
      })
      .waitFor();
    assert.deepEqual(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations.map((v) => v.id),
      [],
    );
    console.log(
      "Public database-failure state, retry control and accessibility passed.",
    );
  } finally {
    await browser.close();
  }
} finally {
  unavailable.kill();
}

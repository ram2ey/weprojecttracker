// Isolated Phase 1 experiment. Never connects to the app database or subscribers.
// Setup: npm install --prefix .local/phase1-push-probe --ignore-scripts web-push@3.6.7
// Run: node --import tsx scripts/probe-web-push.mjs
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { contentSecurityPolicy } from "../src/lib/security/csp.ts";

const foundation = process.argv.includes("--foundation");
const requireProbe = createRequire(
  resolve(
    foundation ? "package.json" : ".local/phase1-push-probe/package.json",
  ),
);
const webpush = requireProbe("web-push");
const keys = webpush.generateVAPIDKeys(); // Ephemeral; never persist or print keys.
const events = [];
const report = {
  at: new Date().toISOString(),
  mode: foundation ? "phase2-foundation" : "phase1-experiment",
  checks: {},
  limitations: [],
};
let workerSource = `
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('push', event => event.waitUntil((async () => {
  const payload = event.data.json();
  await self.registration.showNotification('Tracker feasibility test', {
    body: 'Local test only. No public project was changed.',
    tag: payload.id,
    data: { url: '/target', id: payload.id }
  });
  await fetch('/observed?id=' + encodeURIComponent(payload.id), { method: 'POST' });
})()));
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow('/target'));
});
`;
if (foundation) {
  // Instrument successful display for observation without changing the production handler.
  workerSource =
    `const display = self.registration.showNotification.bind(self.registration);
    self.registration.showNotification = async (title, options) => {
      await display(title, options);
      await fetch('/observed?id=' + encodeURIComponent(options.tag), { method: 'POST' });
    };\n` + (await readFile("public/notification-sw.js", "utf8"));
  Object.assign(process.env, {
    ENABLE_BROWSER_PUSH: "true",
    VAPID_PUBLIC_KEY: keys.publicKey,
    VAPID_PRIVATE_KEY: keys.privateKey,
    VAPID_SUBJECT: "https://wassaeastprojecttracker.com",
    NOTIFICATION_ENCRYPTION_KEY: randomBytes(32).toString("base64url"),
  });
}
const payload = (id) => ({
  id,
  tag: id,
  title: "Tracker feasibility test",
  body: "Local test only. No public project was changed.",
  url: "/projects/notification-probe",
});
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  res.setHeader("Cache-Control", "no-store");
  if (url.pathname === "/probe-sw.js") {
    res.setHeader("Content-Type", "application/javascript");
    res.setHeader("Service-Worker-Allowed", "/");
    res.end(workerSource);
  } else if (url.pathname === "/observed" && req.method === "POST") {
    events.push(url.searchParams.get("id"));
    res.writeHead(204).end();
  } else {
    res.setHeader("Content-Type", "text/html");
    res.setHeader(
      "Content-Security-Policy",
      contentSecurityPolicy("probe-only", false),
    );
    res.end(
      "<!doctype html><title>Isolated tracker push probe</title><h1>Local feasibility test</h1>",
    );
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
async function bounded(promise, milliseconds, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(label)), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
async function observed(id) {
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline && !events.includes(id)) {
    await new Promise((done) => setTimeout(done, 200));
  }
  return events.includes(id);
}
try {
  // Push registration is unavailable in off-the-record contexts. An empty
  // userDataDir creates an isolated temporary normal profile, cleaned on close.
  const context = await chromium.launchPersistentContext("", {
    channel: "chrome",
    headless: true,
    permissions: ["notifications"],
    ignoreDefaultArgs: ["--disable-background-networking"],
  });
  report.backgroundNetworking = "enabled for push transport";
  browser = context;
  report.browser = context.browser()?.version();
  const page = await context.newPage();
  await page.goto(origin);
  report.checks.capabilities = await page.evaluate(() => ({
    secureContext: isSecureContext,
    serviceWorker: "serviceWorker" in navigator,
    pushManager: "PushManager" in window,
    notificationPermission: Notification.permission,
  }));
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/probe-sw.js", {
      updateViaCache: "none",
    });
    await navigator.serviceWorker.ready;
  });
  report.checks.registrationUnderProductionCsp = true;
  const worker = context.serviceWorkers()[0];
  assert.ok(worker);
  // Synthetic smoke check, explicitly separate from real network delivery.
  await worker.evaluate((payload) => {
    self.dispatchEvent(
      new PushEvent("push", { data: JSON.stringify(payload) }),
    );
  }, payload("synthetic"));
  assert.equal(await observed("synthetic"), true);
  report.checks.syntheticPushHandler = true;
  report.checks.notificationRecorded = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return (await registration.getNotifications()).some(
      (n) => n.tag === "synthetic",
    );
  });
  assert.equal(report.checks.notificationRecorded, true);
  try {
    const subscription = await bounded(
      page.evaluate(async (publicKey) => {
        const registration = await navigator.serviceWorker.ready;
        return (
          await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: publicKey,
          })
        ).toJSON();
      }, keys.publicKey),
      20000,
      "Subscription timed out after 20 seconds",
    );
    report.checks.realSubscription = true;
    // Only the fresh isolated browser's subscription is used. Do not log its URL or keys.
    webpush.setVapidDetails(
      "https://wassaeastprojecttracker.com",
      keys.publicKey,
      keys.privateKey,
    );
    await page.close();
    report.checks.appPageClosedBeforeSend = true;
    const result = foundation
      ? await (
          await import("../src/lib/notifications/transport.ts")
        ).sendPush(subscription, JSON.stringify(payload("network")))
      : await webpush.sendNotification(
          subscription,
          JSON.stringify(payload("network")),
          {
            TTL: 60,
            urgency: "high",
            timeout: 10000,
          },
        );
    report.checks.pushServiceStatus = result.statusCode ?? result.status;
    assert.ok(
      report.checks.pushServiceStatus >= 200 &&
        report.checks.pushServiceStatus < 300,
    );
    report.checks.realPushObservedWithPageClosed = await observed("network");
    assert.equal(report.checks.realPushObservedWithPageClosed, true);
  } catch (error) {
    report.checks.realDeliveryError = {
      stage: report.checks.realSubscription ? "delivery" : "subscription",
      name: error.name,
      status: error.statusCode ?? null,
      detail: error.message
        .split("\n")[0]
        .replace(/https?:\/\/[^\s)]+/g, "[URL]")
        .replace(/[A-Za-z0-9_-]{40,}/g, "[redacted]"),
    };
    report.limitations.push(
      "Real browser push subscription/delivery did not complete; synthetic success is not proof of network delivery.",
    );
    process.exitCode = 2;
  }
  const cleanupPage = await context.newPage();
  await cleanupPage.goto(origin);
  report.checks.cleanup = await cleanupPage.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    const unsubscribed = subscription ? await subscription.unsubscribe() : true;
    for (const notification of await registration.getNotifications())
      notification.close();
    return { unsubscribed, unregistered: await registration.unregister() };
  });
  assert.equal(report.checks.cleanup.unsubscribed, true);
  assert.equal(report.checks.cleanup.unregistered, true);
  report.limitations.push(
    "Disposable desktop Chrome with permission pre-granted; does not establish native permission UX, phone installation, OS notification visibility, or phone background delivery.",
  );
} catch (error) {
  report.probeError = {
    name: error.name,
    message: error.message.split("\n")[0],
  };
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await new Promise((done) => server.close(done));
  const reportFolder = foundation
    ? ".local/phase2-push-probe"
    : ".local/phase1-push-probe";
  await mkdir(reportFolder, { recursive: true });
  const serialized = JSON.stringify(report, null, 2) + "\n";
  await writeFile(`${reportFolder}/results.json`, serialized);
  await writeFile(
    `${reportFolder}/results-${report.at.replace(/[:.]/g, "-")}.json`,
    serialized,
  );
  console.log(JSON.stringify(report, null, 2));
}

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { androidPackage, appModeScript, assetLinks } from "../src/lib/app-mode";
import { reportInput } from "../src/lib/comments/policy";

const fingerprint = Array.from({ length: 32 }, (_, i) =>
  i.toString(16).padStart(2, "0").toUpperCase(),
).join(":");

test("assetlinks.json is served only for a valid package and fingerprints", () => {
  assert.equal(assetLinks(undefined, fingerprint), null);
  assert.equal(assetLinks("com.example.app", undefined), null);
  assert.equal(assetLinks("not a package", fingerprint), null);
  assert.equal(assetLinks("com.example.app", "AB:CD"), null);
  // One bad fingerprint invalidates the set instead of silently dropping it.
  assert.equal(assetLinks("com.example.app", `${fingerprint}, nonsense`), null);
  assert.deepEqual(
    assetLinks(
      " com.example.app ",
      `${fingerprint.toLowerCase()}, ${fingerprint}`,
    ),
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "com.example.app",
          sha256_cert_fingerprints: [fingerprint],
        },
      },
    ],
  );
  assert.equal(androidPackage("com.example"), "com.example");
  assert.equal(androidPackage("example"), null);
  assert.equal(androidPackage('com.example";alert(1)//'), null);
});

function launch({
  url,
  referrer = "",
  stored = null,
  packageName = "com.example.app",
}: {
  url: string;
  referrer?: string;
  stored?: string | null;
  packageName?: string | null;
}) {
  const session = new Map<string, string>();
  if (stored) session.set("wassa.app", stored);
  const attributes = new Map<string, string>();
  let replaced: string | null = null;
  const parsed = new URL(url);
  const location = {
    search: parsed.search,
    pathname: parsed.pathname,
    replace: (to: string) => {
      replaced = to;
    },
  };
  const document = {
    referrer,
    documentElement: {
      setAttribute: (name: string, value: string) =>
        attributes.set(name, value),
    },
  };
  const sessionStorage = {
    getItem: (key: string) => session.get(key) ?? null,
    setItem: (key: string, value: string) => session.set(key, value),
  };
  new Function(
    "location",
    "document",
    "sessionStorage",
    appModeScript(packageName),
  )(location, document, sessionStorage);
  return {
    app: attributes.get("data-app") ?? null,
    stored: session.get("wassa.app") ?? null,
    replaced,
  };
}

test("app mode starts only from the app and stays in that tab", () => {
  // Start URL marker; the homepage is not part of the app.
  assert.deepEqual(launch({ url: "https://site.test/?app=android" }), {
    app: "android",
    stored: "android",
    replaced: "/news",
  });
  assert.deepEqual(launch({ url: "https://site.test/news?app=android" }), {
    app: "android",
    stored: "android",
    replaced: null,
  });
  // Deep link from WhatsApp opened by the app: Chrome sends the app referrer.
  assert.equal(
    launch({
      url: "https://site.test/projects/x",
      referrer: "android-app://com.example.app/",
    }).app,
    "android",
  );
  // Later pages in the same tab.
  assert.equal(
    launch({ url: "https://site.test/projects", stored: "android" }).app,
    "android",
  );
  // Ordinary browsing, other apps and look-alike packages stay on the website.
  for (const referrer of [
    "",
    "https://www.google.com/",
    "android-app://com.whatsapp/",
    "android-app://com.example.app.evil/",
  ])
    assert.deepEqual(
      launch({ url: "https://site.test/", referrer }),
      { app: null, stored: null, replaced: null },
      referrer,
    );
  assert.equal(launch({ url: "https://site.test/?app=androidx" }).app, null);
  // Without a configured package only the marker counts.
  assert.equal(
    launch({
      url: "https://site.test/",
      referrer: "android-app://com.example.app/",
      packageName: null,
    }).app,
    null,
  );
});

test("the offline page's inline script matches its CSP hash", () => {
  const page = readFileSync("public/offline.html", "utf8");
  const scripts = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1);
  const hash =
    "sha256-" + createHash("sha256").update(scripts[0][1]).digest("base64");
  assert.match(
    readFileSync("next.config.ts", "utf8"),
    new RegExp(hash.replace(/[+/]/g, "\\$&")),
  );
  const worker = readFileSync("public/notification-sw.js", "utf8");
  assert.match(worker, /OFFLINE_URL = "\/offline\.html"/);
  // Only page loads fall back; content is never cached.
  assert.match(worker, /request\.mode === "navigate"/);
  assert.doesNotMatch(worker, /cache\.put\(/);
});

test("comment reports accept a known reason or none", () => {
  assert.deepEqual(reportInput.parse({}), { reason: null });
  assert.deepEqual(reportInput.parse({ reason: "spam" }), { reason: "spam" });
  assert.equal(reportInput.safeParse({ reason: "boring" }).success, false);
  assert.equal(reportInput.safeParse({ reason: null, x: 1 }).success, false);
});

/// <reference lib="webworker" />
import { Serwist, CacheFirst, ExpirationPlugin } from "serwist";
const sw = globalThis as unknown as ServiceWorkerGlobalScope;
const PREFIX = "wassa-public-v1-",
  PAGES = PREFIX + "pages",
  THUMBS = PREFIX + "thumbnails",
  FEEDS = PREFIX + "feeds",
  SETTINGS = PREFIX + "settings";
const DAY = 86400000,
  configKey = new URL("/__offline_preference", sw.location.origin).href;
const publicPath = (path: string) =>
  /^(\/|\/projects|\/projects\/[^/]+|\/information\/[^/]+|\/updates|\/about|\/announcements|\/reports|\/following)$/.test(
    path,
  );
const notices = new Map<string, { savedAt: string }>();
let storageEpoch = 0;
async function enabled() {
  return (
    (await (await caches.open(SETTINGS)).match(configKey))
      ?.text()
      .then((v) => v === "true") ?? false
  );
}
async function clear() {
  await Promise.all([PAGES, THUMBS, FEEDS].map((n) => caches.delete(n)));
  notices.clear();
}
async function boundedPut(
  name: string,
  request: Request,
  response: Response,
  max: number,
  maxBytes: number,
  epoch = storageEpoch,
) {
  if (!response.ok || epoch !== storageEpoch || !(await enabled())) return;
  const buffer = await response.clone().arrayBuffer();
  if (buffer.byteLength > maxBytes) return;
  const headers = new Headers(response.headers);
  headers.set("X-Offline-Saved-At", new Date().toISOString());
  const cache = await caches.open(name);
  if (epoch !== storageEpoch || !(await enabled())) return;
  await cache.delete(request);
  if (epoch !== storageEpoch) return;
  await cache.put(request, new Response(buffer, { status: 200, headers }));
  const keys = await cache.keys();
  await Promise.all(
    keys.slice(0, Math.max(0, keys.length - max)).map((k) => cache.delete(k)),
  );
}
async function saved(name: string, request: Request, age: number) {
  if (!(await enabled())) return;
  const cache = await caches.open(name),
    copy = await cache.match(request);
  if (!copy) return;
  const at = copy.headers.get("X-Offline-Saved-At");
  if (!at || Date.now() - Date.parse(at) > age) {
    await cache.delete(request);
    return;
  }
  return copy;
}
const keyFor = (url: string) =>
  new Request(url, { credentials: "omit", headers: { Accept: "text/html" } });
async function page(request: Request, client: string) {
  const epoch = storageEpoch;
  const key = keyFor(request.url);
  try {
    const response = await fetch(key, { cache: "no-store" });
    if ([404, 410].includes(response.status))
      await (await caches.open(PAGES)).delete(key);
    if (response.ok) {
      notices.delete(client);
      if (
        response.headers.get("X-Public-Cache") === "public-page-v1" &&
        response.headers.get("Content-Type")?.includes("text/html")
      )
        await boundedPut(PAGES, key, response, 10, 1500000, epoch);
      return response;
    }
    if (response.status < 500) return response;
  } catch {}
  const copy = await saved(PAGES, key, 7 * DAY);
  if (copy) {
    notices.set(client, { savedAt: copy.headers.get("X-Offline-Saved-At")! });
    return copy;
  }
  return new Response(
    '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Connection needed</title><body><main><h1>Connect to read this page</h1><p>No saved public copy is available. Comments, feedback and staff work require a connection.</p><a href="/following">Your following feed</a></main></body></html>',
    {
      status: 503,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}
async function publicResource(
  request: Request,
  name: string,
  marker: string,
  limit: number,
  age: number,
  maxBytes: number,
) {
  const epoch = storageEpoch;
  const key = new Request(request.url, { credentials: "omit" });
  try {
    const response = await fetch(key, { cache: "no-store" });
    if ([404, 410].includes(response.status))
      await (await caches.open(name)).delete(key);
    if (response.ok) {
      if (response.headers.get("X-Public-Cache") === marker)
        await boundedPut(name, key, response, limit, maxBytes, epoch);
      return response;
    }
    if (response.status < 500) return response;
  } catch {}
  return (await saved(name, key, age)) || Response.error();
}
async function validateSaved() {
  const epoch = storageEpoch;
  for (const name of [PAGES, THUMBS, FEEDS]) {
    const cache = await caches.open(name);
    for (const request of await cache.keys()) {
      try {
        const r = await fetch(
          new Request(request, { credentials: "omit", cache: "no-store" }),
        );
        if ([404, 410].includes(r.status)) await cache.delete(request);
        else if (r.ok) {
          const marker =
            name === PAGES
              ? "public-page-v1"
              : name === THUMBS
                ? "public-thumbnail-v1"
                : "public-feed-v1";
          if (r.headers.get("X-Public-Cache") === marker)
            await boundedPut(
              name,
              request,
              r,
              name === THUMBS ? 30 : 10,
              name === THUMBS ? 250000 : 1500000,
              epoch,
            );
          else await cache.delete(request);
        }
      } catch {
        return;
      }
    }
  }
}
const serwist = new Serwist({
  precacheEntries: [],
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: [
    {
      matcher: ({ url }) =>
        url.origin === sw.location.origin &&
        url.pathname.startsWith("/_next/static/"),
      handler: new CacheFirst({
        cacheName: PREFIX + "assets",
        plugins: [
          new ExpirationPlugin({ maxEntries: 120, maxAgeSeconds: 30 * 86400 }),
        ],
      }),
    },
  ],
});
// Explicit routes are handled before Serwist. Its only runtime route is public build assets.
sw.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== sw.location.origin || event.request.method !== "GET")
    return;
  const navigation =
      event.request.mode === "navigate" &&
      publicPath(url.pathname) &&
      !url.searchParams.has("_rsc"),
    thumb = /^\/api\/public\/thumbnails\/[a-f0-9-]{36}$/i.test(url.pathname),
    feed = url.pathname === "/api/public/updates";
  if (navigation || thumb || feed)
    event.respondWith(
      (async () => {
        if (!(await enabled())) return fetch(event.request);
        if (navigation)
          return page(event.request, event.resultingClientId || event.clientId);
        if (thumb)
          return publicResource(
            event.request,
            THUMBS,
            "public-thumbnail-v1",
            30,
            DAY,
            250000,
          );
        return publicResource(
          event.request,
          FEEDS,
          "public-feed-v1",
          10,
          7 * DAY,
          250000,
        );
      })(),
    );
});
serwist.addEventListeners();
sw.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys())
        if (name.startsWith("wassa-public-") && !name.startsWith(PREFIX))
          await caches.delete(name);
    })(),
  ),
);
sw.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data.type !== "string") return;
  event.waitUntil(
    (async () => {
      const source = event.source as Client | null;
      if (!source || new URL(source.url).origin !== sw.location.origin) return;
      let result: unknown = { ok: true };
      switch (data.type) {
        case "SET_OFFLINE":
          storageEpoch++;
          await (
            await caches.open(SETTINGS)
          ).put(
            configKey,
            new Response(data.enabled === true ? "true" : "false"),
          );
          if (!data.enabled) await clear();
          break;
        case "CLEAR_SAVED":
          storageEpoch++;
          await clear();
          break;
        case "SAVE_PUBLIC_PAGE":
          if ((await enabled()) && typeof data.url === "string") {
            const url = new URL(data.url, sw.location.origin);
            if (url.origin === sw.location.origin && publicPath(url.pathname))
              await page(keyFor(url.href), source.id);
          }
          break;
        case "VALIDATE_SAVED":
          if (await enabled()) await validateSaved();
          break;
        case "STATUS": {
          const active = await enabled();
          const copy = active
            ? await (await caches.open(PAGES)).match(keyFor(source.url))
            : undefined;
          result = {
            enabled: await enabled(),
            savedAt: notices.get(source.id)?.savedAt || null,
            lastSaved: copy?.headers.get("X-Offline-Saved-At") || null,
          };
          break;
        }
        default:
          return;
      }
      event.ports[0]?.postMessage(result);
    })(),
  );
});
sw.addEventListener("push", (event) => {
  event.waitUntil(
    sw.registration.showNotification("Wassa East Projects", {
      body: "A project you follow has an approved update.",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: "wassa-public-update",
      data: { url: "/following" },
    }),
  );
});
sw.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const clients = await sw.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const client = clients.find(
        (c) => new URL(c.url).origin === sw.location.origin,
      ) as WindowClient | undefined;
      if (client) {
        await client.navigate("/following");
        await client.focus();
      } else await sw.clients.openWindow("/following");
    })(),
  );
});

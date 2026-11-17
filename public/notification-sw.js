// Notifications and a small offline page. No project or news content is ever
// cached: pages always come from the network, and only a failed page load is
// answered with the stored offline page (which offers Retry).
const OFFLINE_CACHE = "wassa-offline-v1";
const OFFLINE_URL = "/offline.html";
self.addEventListener("install", (event) =>
  event.waitUntil(
    (async () => {
      const cache = await caches.open(OFFLINE_CACHE);
      await cache.addAll([
        new Request(OFFLINE_URL, { cache: "reload" }),
        new Request("/brand/icon-192.png", { cache: "reload" }),
      ]);
      await self.skipWaiting();
    })(),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (
          key.startsWith("wassa-public-") ||
          (key.startsWith("wassa-offline-") && key !== OFFLINE_CACHE)
        )
          await caches.delete(key);
      }
      // Lets the network request start while the worker boots.
      await self.registration.navigationPreload?.enable();
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.mode === "navigate" && request.method === "GET") {
    event.respondWith(
      (async () => {
        try {
          const preloaded = await event.preloadResponse;
          if (preloaded) return preloaded;
          return await fetch(request);
        } catch {
          const offline = await caches.match(OFFLINE_URL, {
            cacheName: OFFLINE_CACHE,
          });
          return offline ?? Response.error();
        }
      })(),
    );
  } else if (
    request.method === "GET" &&
    new URL(request.url).pathname === "/brand/icon-192.png"
  ) {
    // The offline page's logo, network first.
    event.respondWith(
      fetch(request).catch(
        async () =>
          (await caches.match(request, { cacheName: OFFLINE_CACHE })) ??
          Response.error(),
      ),
    );
  }
});
self.addEventListener("push", (event) =>
  event.waitUntil(
    (async () => {
      let payload;
      try {
        payload = event.data?.json();
      } catch {
        return;
      }
      if (
        !payload ||
        typeof payload.title !== "string" ||
        typeof payload.body !== "string"
      )
        return;
      let url;
      try {
        url = new URL(payload.url, self.location.origin);
      } catch {
        return;
      }
      if (
        url.origin !== self.location.origin ||
        !/^\/(projects|news)\/[a-zA-Z0-9-]+$/.test(url.pathname) ||
        url.search ||
        url.hash
      )
        return;
      await self.registration.showNotification(payload.title.slice(0, 100), {
        body: payload.body.slice(0, 200),
        icon: "/brand/icon-192.png",
        tag:
          typeof payload.tag === "string"
            ? payload.tag.slice(0, 100)
            : undefined,
        data: { url: url.pathname },
      });
    })(),
  ),
);
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const url = new URL(
        event.notification.data?.url || "/",
        self.location.origin,
      );
      if (url.origin !== self.location.origin) return;
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const existing = windows.find(
        (client) => new URL(client.url).origin === self.location.origin,
      );
      if (existing) {
        await existing.navigate(url.href);
        await existing.focus();
      } else await self.clients.openWindow(url.href);
    })(),
  );
});

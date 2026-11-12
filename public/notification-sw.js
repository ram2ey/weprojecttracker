// Notifications only: deliberately no fetch interception or offline content cache.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith("wassa-public-")) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  ),
);
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

"use client";
import { useEffect } from "react";
// Registers the site's one service worker for every visitor. It shows a small
// offline page when a page cannot load and handles phone notifications; it
// never caches project or news content. Registering it also replaces any old
// /sw.js offline worker, whose caches it removes on activation.
export function OfflineSupport() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker
      .register("/notification-sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {});
  }, []);
  return null;
}

"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { workerMessage } from "./client";
import { preferences } from "@/components/engagement/device-store";
export function PwaProvider() {
  const path = usePathname(),
    [notice, setNotice] = useState("");
  useEffect(() => {
    let live = true;
    if (!("serviceWorker" in navigator)) return;
    async function start() {
      try {
        const registered = await navigator.serviceWorker.getRegistration();
        if (navigator.onLine || !registered)
          await navigator.serviceWorker.register("/sw.js", {
            scope: "/",
            updateViaCache: "none",
          });
        const status = await workerMessage<{
          enabled: boolean;
          savedAt: string | null;
          lastSaved: string | null;
        }>({ type: "STATUS" });
        if (!live) return;
        const savedAt =
          status.savedAt || (!navigator.onLine ? status.lastSaved : null);
        setNotice(
          !navigator.onLine
            ? `Offline reading${savedAt ? ` · Copy saved ${new Date(savedAt).toLocaleString("en-GB")}` : ""}. Information may be outdated. Connect to check the latest approvals. Comments, feedback and staff work require a connection.`
            : status.savedAt
              ? `Saved public copy from ${new Date(status.savedAt).toLocaleString("en-GB")}. Information may be outdated; reconnect to refresh it.`
              : "",
        );
        if (navigator.onLine && status.enabled && preferences().offline) {
          await workerMessage({ type: "SAVE_PUBLIC_PAGE", url: location.href });
        }
      } catch {
        /* Browsing remains available without service worker support. */
      }
    }
    void start();
    const online = () => {
      setNotice("");
      void workerMessage({ type: "VALIDATE_SAVED" })
        .then(() => start())
        .catch(() => {});
    };
    const offline = () => void start();
    const click = (event: MouseEvent) => {
      if (
        navigator.onLine ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor = (event.target as Element)?.closest("a");
      if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, location.href);
      if (
        url.origin === location.origin &&
        /^(\/|\/projects(?:\/[^/]+)?|\/information\/[^/]+|\/updates|\/about|\/announcements|\/reports|\/following)$/.test(
          url.pathname,
        ) &&
        url.href !== location.href
      ) {
        event.preventDefault();
        event.stopPropagation();
        location.assign(url.href);
      }
    };
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    document.addEventListener("click", click, true);
    return () => {
      live = false;
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      document.removeEventListener("click", click, true);
    };
  }, [path]);
  return notice ? (
    <div className="offline-notice" role="status">
      {notice}
    </div>
  ) : null;
}

"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { usePreferences } from "./device-store";
import { contentRequest } from "@/components/content/client-api";
// Only an existing browser subscription is synchronised. Permissions are asked
// solely by the explicit enable control on the following page.
export function PushSync() {
  const ids = usePreferences().follows.join(","),
    path = usePathname();
  useEffect(() => {
    let live = true;
    async function sync() {
      if (!navigator.onLine || !("serviceWorker" in navigator)) return;
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        const sub = await registration?.pushManager?.getSubscription();
        if (!sub) return;
        const config = await (
          await fetch("/api/public/push/config", { cache: "no-store" })
        ).json();
        if (live && config.enabled)
          await contentRequest("/api/public/push/subscription", "POST", {
            subscription: sub.toJSON(),
            recordIds: ids.split(",").filter(Boolean),
          });
      } catch {
        /* Retry on the next page, follow change or reconnection. */
      }
    }
    void sync();
    window.addEventListener("online", sync);
    return () => {
      live = false;
      window.removeEventListener("online", sync);
    };
  }, [ids, path]);
  return null;
}

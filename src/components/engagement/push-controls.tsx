"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { contentRequest, errorMessage } from "@/components/content/client-api";
import { usePreferences } from "./device-store";
export function PushControls() {
  const p = usePreferences(),
    [config, setConfig] = useState<{
      enabled: boolean;
      publicKey: string | null;
    } | null>(null),
    [active, setActive] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    fetch("/api/public/push/config", { cache: "no-store" })
      .then((r) => r.json())
      .then((c) => {
        if (live) setConfig(c);
      })
      .catch(() => {});
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.getRegistration().then(async (r) => {
        const sub = await r?.pushManager?.getSubscription();
        if (live) setActive(!!sub);
      });
    return () => {
      live = false;
    };
  }, []);
  async function enable() {
    setBusy(true);
    try {
      if (!config?.enabled || !config.publicKey)
        throw new Error(
          "Browser push is awaiting an approved sender identity.",
        );
      if (!("Notification" in window) || !("PushManager" in window))
        throw new Error(
          "This browser does not support push. Use your following feed.",
        );
      if ((await Notification.requestPermission()) !== "granted")
        throw new Error(
          "Notifications were not allowed. Your following feed remains available.",
        );
      const r = await navigator.serviceWorker.ready;
      const padded = config.publicKey.replace(/-/g, "+").replace(/_/g, "/");
      const bytes = Uint8Array.from(
        atob(padded + "=".repeat((4 - (padded.length % 4)) % 4)),
        (c) => c.charCodeAt(0),
      );
      const sub = await r.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: bytes,
      });
      try {
        await contentRequest("/api/public/push/subscription", "POST", {
          subscription: sub.toJSON(),
          recordIds: p.follows,
        });
      } catch (e) {
        await sub.unsubscribe();
        throw e;
      }
      setActive(true);
      setMessage(
        "Notifications enabled for your followed projects on this device.",
      );
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function disable() {
    setBusy(true);
    try {
      await contentRequest("/api/public/push/subscription", "DELETE", {
        all: true,
      });
      const r = await navigator.serviceWorker.getRegistration();
      await (await r?.pushManager?.getSubscription())?.unsubscribe();
      setActive(false);
      setMessage("Browser notifications disabled for this device.");
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="preference-card">
      <h2>Browser notifications</h2>
      <p>
        Optional, generic notifications open your following feed. Project
        details are shown only after you open the website.
      </p>
      {config?.enabled || active ? (
        <Button
          disabled={busy || (!active && !p.follows.length)}
          variant="outline"
          onClick={active ? disable : enable}
        >
          {active ? "Disable notifications" : "Enable notifications"}
        </Button>
      ) : (
        <p className="notice">
          Live push is disabled while the sender identity awaits approval. The
          following feed works without it.
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}

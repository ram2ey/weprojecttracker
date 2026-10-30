"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  usePreferences,
  changePreferences,
} from "@/components/engagement/device-store";
import { workerMessage } from "./client";
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
export function OfflineControls() {
  const p = usePreferences(),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [install, setInstall] = useState<InstallEvent | null>(null);
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  async function toggle() {
    setBusy(true);
    try {
      const next = !p.offline;
      await workerMessage({ type: "SET_OFFLINE", enabled: next });
      changePreferences((p) => ({ ...p, offline: next }));
      if (next)
        await workerMessage({ type: "SAVE_PUBLIC_PAGE", url: location.href });
      setMessage(
        next
          ? "Offline reading enabled. Public pages you visit will be saved with their save time."
          : "Offline reading disabled and saved public copies removed.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="preference-card">
      <h2>Install & offline reading</h2>
      <p>
        Opt in to save up to 10 recently viewed public pages for 7 days and 30
        public thumbnails for 24 hours. Saved copies may become outdated or
        include content withdrawn while you are offline.
      </p>
      <p>
        Private messages and staff pages are never saved. Sending and moderation
        require a connection; submissions are never queued offline.
      </p>
      <div className="action-row">
        <Button
          variant="outline"
          disabled={busy}
          aria-pressed={p.offline}
          onClick={toggle}
        >
          {p.offline ? "Disable offline reading" : "Enable offline reading"}
        </Button>
        {p.offline && (
          <Button
            variant="ghost"
            disabled={busy}
            onClick={async () => {
              try {
                await workerMessage({ type: "CLEAR_SAVED" });
                setMessage("Saved public pages and thumbnails removed.");
              } catch (e) {
                setMessage((e as Error).message);
              }
            }}
          >
            Clear saved copies
          </Button>
        )}
        {install && (
          <Button
            variant="outline"
            onClick={async () => {
              await install.prompt();
              await install.userChoice;
              setInstall(null);
            }}
          >
            Install app
          </Button>
        )}
      </div>
      {!install && (
        <p className="subtle-note">
          You can also use your browser’s Install app or Add to Home Screen menu
          when available.
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}

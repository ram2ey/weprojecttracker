"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";

type InstallPrompt = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function subscribeDisplayMode(update: () => void) {
  const query = matchMedia("(display-mode: standalone)");
  query.addEventListener("change", update);
  return () => query.removeEventListener("change", update);
}
function standaloneMode() {
  return (
    matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
function iphonePlatform() {
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}
const noSubscription = () => () => {};
const serverSnapshot = () => false;

export function InstallTracker() {
  const prompt = useRef<InstallPrompt | null>(null);
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const iphone = useSyncExternalStore(
    noSubscription,
    iphonePlatform,
    serverSnapshot,
  );
  const standalone = useSyncExternalStore(
    subscribeDisplayMode,
    standaloneMode,
    serverSnapshot,
  );
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    function ready(event: Event) {
      event.preventDefault();
      prompt.current = event as InstallPrompt;
      setAvailable(true);
    }
    function complete() {
      prompt.current = null;
      setAvailable(false);
      setInstalled(true);
      setMessage("Tracker installed. Open it from your home screen or apps.");
    }
    window.addEventListener("beforeinstallprompt", ready);
    window.addEventListener("appinstalled", complete);
    return () => {
      window.removeEventListener("beforeinstallprompt", ready);
      window.removeEventListener("appinstalled", complete);
    };
  }, []);

  async function install() {
    const event = prompt.current;
    if (!event || busy) return;
    prompt.current = null;
    setAvailable(false);
    setBusy(true);
    try {
      await event.prompt();
      const choice = await event.userChoice;
      setMessage(
        choice.outcome === "accepted"
          ? "Installation requested. Follow your browser’s instructions, then open the tracker from your home screen or apps."
          : "Installation cancelled. You can keep using the tracker here, or install later from your browser menu.",
      );
    } catch {
      setMessage(
        "The install prompt could not open. Use your browser menu to install the tracker, or try again later.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          className="install-menu-button"
          type="button"
          onClick={() => {
            setMessage("");
            if (prompt.current && !installed && !standalone && !iphone)
              void install();
          }}
        >
          Install App
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="install-overlay" data-install-dialog />
        <Dialog.Content className="install-dialog" data-install-dialog>
          <Dialog.Title>Install App</Dialog.Title>
          <Dialog.Description>
            Add Wassa East Projects to your home screen. This version requires
            an internet connection.
          </Dialog.Description>
          {installed || standalone ? (
            <p>The tracker is already installed in this window.</p>
          ) : iphone ? (
            <p>
              In Safari, tap <strong>Share → Add to Home Screen</strong>, keep{" "}
              <strong>Open as Web App</strong> on if shown, then tap{" "}
              <strong>Add</strong>. Open the Wassa East icon from your home
              screen.
            </p>
          ) : available ? (
            <Button disabled={busy} onClick={() => void install()}>
              Install App
            </Button>
          ) : !busy ? (
            <p>
              Open your browser menu and choose <strong>Install app</strong> or{" "}
              <strong>Add to Home Screen</strong>. If neither appears, try
              opening the tracker in Chrome on Android or Safari on iPhone.
            </p>
          ) : null}
          {busy && <p role="status">Follow the browser’s install prompt…</p>}
          {message && <p role="status">{message}</p>}
          <Dialog.Close asChild>
            <Button variant="outline">Close</Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

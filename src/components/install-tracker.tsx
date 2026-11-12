"use client";

import { useState, useSyncExternalStore } from "react";
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";

type InstallPrompt = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// The browser fires beforeinstallprompt once per page. Every install button
// shares the captured event, so the header and hero controls stay consistent.
let captured: InstallPrompt | null = null;
let installedHere = false;
const listeners = new Set<() => void>();
function notify() {
  for (const listener of listeners) listener();
}
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    captured = event as InstallPrompt;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    captured = null;
    installedHere = true;
    notify();
  });
}
function subscribeInstall(update: () => void) {
  listeners.add(update);
  const query = matchMedia("(display-mode: standalone)");
  query.addEventListener("change", update);
  return () => {
    listeners.delete(update);
    query.removeEventListener("change", update);
  };
}
export function standaloneMode() {
  return (
    matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
export function iphonePlatform() {
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}
type InstallState = "unknown" | "installed" | "iphone" | "prompt" | "manual";
function installSnapshot(): InstallState {
  if (installedHere || standaloneMode()) return "installed";
  if (iphonePlatform()) return "iphone";
  return captured ? "prompt" : "manual";
}
export function useInstallState() {
  return useSyncExternalStore(
    subscribeInstall,
    installSnapshot,
    () => "unknown" as InstallState,
  );
}

export function InstallTracker({
  placement = "menu",
}: {
  placement?: "menu" | "hero";
}) {
  const state = useInstallState();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function install() {
    const event = captured;
    if (!event || busy) return;
    captured = null;
    notify();
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

  // An installed app does not need another invitation in the hero; the menu
  // keeps a help entry instead.
  if (placement === "hero" && state === "installed") return null;
  const label =
    state === "installed"
      ? "App help"
      : placement === "hero"
        ? "Install tracker"
        : "Install App";

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          className={
            placement === "hero"
              ? "button hero-install"
              : "install-menu-button"
          }
          type="button"
          onClick={() => {
            setMessage("");
            if (state === "prompt") void install();
          }}
        >
          {label}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="install-overlay" data-install-dialog />
        <Dialog.Content className="install-dialog" data-install-dialog>
          <Dialog.Title>
            {state === "installed" ? "Wassa East app" : "Install App"}
          </Dialog.Title>
          <Dialog.Description>
            Add Wassa East Projects to your home screen. This version requires
            an internet connection. Installing from this website does not need
            an app store.
          </Dialog.Description>
          {state === "installed" ? (
            <p>
              The tracker is already installed. Open it from your home screen
              or apps. To remove it, press and hold its icon and choose{" "}
              <strong>Uninstall</strong> or <strong>Remove App</strong>.
            </p>
          ) : state === "iphone" ? (
            <p>
              In Safari, tap <strong>Share → Add to Home Screen</strong>, keep{" "}
              <strong>Open as Web App</strong> on if shown, then tap{" "}
              <strong>Add</strong>. Open the Wassa East icon from your home
              screen. Notifications on iPhone work only from the home-screen
              app.
            </p>
          ) : state === "prompt" ? (
            <Button disabled={busy} onClick={() => void install()}>
              Install App
            </Button>
          ) : !busy ? (
            <p>
              On Android, open the Chrome menu <strong>⋮</strong> and choose{" "}
              <strong>Add to Home screen</strong> or{" "}
              <strong>Install app</strong>. On a computer, use the install icon
              in the address bar or the browser menu. If neither appears, try
              Chrome on Android or Safari on iPhone.
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

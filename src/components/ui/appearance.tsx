"use client";

import { useSyncExternalStore } from "react";
import { SunMoon } from "lucide-react";

type Appearance = "system" | "light" | "dark";
const subscribeHydration = () => () => {};
function snapshot(): Appearance {
  const value = document.documentElement.dataset.theme;
  return value === "light" || value === "dark" ? value : "system";
}
function subscribe(callback: () => void) {
  const sync = (event: StorageEvent) => {
    if (event.key === "wassa-appearance" || event.key === null) {
      const value = event.newValue;
      if (value === "light" || value === "dark")
        document.documentElement.dataset.theme = value;
      else delete document.documentElement.dataset.theme;
      callback();
    }
  };
  window.addEventListener("storage", sync);
  window.addEventListener("appearance-change", callback);
  return () => {
    window.removeEventListener("storage", sync);
    window.removeEventListener("appearance-change", callback);
  };
}
export function AppearanceControl() {
  // Keep the server-rendered control inert until its change handler is attached.
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    () => true,
    () => false,
  );
  const value = useSyncExternalStore(
    subscribe,
    snapshot,
    () => "system" as const,
  );
  return (
    <label className="appearance-control">
      <SunMoon size={18} aria-hidden="true" />
      <span className="sr-only">Appearance</span>
      <select
        aria-label="Appearance"
        disabled={!hydrated}
        value={value}
        onChange={(event) => {
          const next = event.target.value;
          if (next === "system") delete document.documentElement.dataset.theme;
          else document.documentElement.dataset.theme = next;
          try {
            localStorage.setItem("wassa-appearance", next);
          } catch {
            /* Session-only fallback. */
          }
          window.dispatchEvent(new Event("appearance-change"));
        }}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}

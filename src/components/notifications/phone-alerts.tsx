"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  disablePhoneAlerts,
  enablePhoneAlerts,
  UpdatesError,
  type Feed,
  type PhoneState,
} from "./notification-client";

export const phoneStateText: Record<PhoneState, string> = {
  checking: "Checking notification settings…",
  "iphone-browser":
    "On iPhone, add the tracker to your Home Screen first (Share → Add to Home Screen). Open it from the new icon, then turn on notifications there.",
  unsupported:
    "This browser cannot show notifications from websites. New updates still appear on the Updates page.",
  unavailable:
    "Phone notifications are not available yet. New updates still appear on the Updates page.",
  blocked:
    "Notifications are blocked for this website. To allow them, open your browser’s site settings for this website (in Chrome on Android, tap the icon beside the address, then Permissions → Notifications), then return here.",
  off: "Get a notification on this device when projects are added or updated and when news is published.",
  on: "Notifications are on for this device.",
};

export function useEnableAlerts() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
      return true;
    } catch (e) {
      setError(
        e instanceof UpdatesError
          ? e.message
          : "Something went wrong. Please try again.",
      );
      return false;
    } finally {
      setBusy(false);
      // Permission or subscription state may have changed either way.
      window.dispatchEvent(new Event("wassa-updates-changed"));
    }
  }
  return { busy, error, run };
}

export function PhoneAlerts({
  feed,
  state,
}: {
  feed: Feed | null;
  state: PhoneState;
}) {
  const { busy, error, run } = useEnableAlerts();
  const [done, setDone] = useState("");
  return (
    <div className="phone-alerts" aria-busy={busy || state === "checking"}>
      <p>{phoneStateText[state]}</p>
      {state === "off" && feed && (
        <Button
          disabled={busy}
          onClick={async () => {
            setDone("");
            if (await run(() => enablePhoneAlerts(feed)))
              setDone("Notifications turned on.");
          }}
        >
          {busy ? "Turning on…" : "Turn on notifications"}
        </Button>
      )}
      {state === "on" && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={async () => {
            setDone("");
            if (await run(disablePhoneAlerts))
              setDone(
                "Notifications turned off. New updates still appear on the Updates page.",
              );
          }}
        >
          {busy ? "Turning off…" : "Turn off notifications"}
        </Button>
      )}
      <p role="status" className="phone-alerts-status">
        {done}
      </p>
      {error && state !== "blocked" && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { BellRing, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readConsent } from "@/lib/analytics-policy";
import {
  dismissInvite,
  enablePhoneAlerts,
  inviteDismissed,
  usePhoneState,
  useSummary,
} from "./notification-client";
import { useEnableAlerts } from "./phone-alerts";

const noSubscription = () => () => {};

// A website cannot turn on phone notifications by itself: browsers require the
// visitor's tap. This small invitation reduces that to a single tap and never
// opens the browser's permission request on its own.
export function NotificationInvite() {
  const { feed } = useSummary();
  const state = usePhoneState(feed);
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [closed, setClosed] = useState(false);
  const [success, setSuccess] = useState(false);
  const { busy, error, run } = useEnableAlerts();
  const heading = useRef<HTMLHeadingElement>(null);
  const dismissed = useSyncExternalStore(
    noSubscription,
    inviteDismissed,
    () => true,
  );
  // Wait until the visitor has answered the cookie banner so panels never stack.
  const consentAnswered = useSyncExternalStore(
    (update) => {
      window.addEventListener("wassa-consent-changed", update);
      return () => window.removeEventListener("wassa-consent-changed", update);
    },
    () => readConsent(document.cookie) !== "unknown",
    () => false,
  );

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  if (success)
    return (
      <section className="notify-invite" aria-label="Notifications">
        <p role="status">
          Notifications are on. You’ll hear about new projects, project updates
          and news.
        </p>
        <Button variant="outline" onClick={() => setSuccess(false)}>
          Close
        </Button>
      </section>
    );
  if (
    !ready ||
    closed ||
    dismissed ||
    !consentAnswered ||
    state !== "off" ||
    !feed ||
    pathname.startsWith("/updates")
  )
    return null;
  return (
    <section
      className="notify-invite"
      aria-labelledby="notify-invite-title"
      data-notify-invite
    >
      <BellRing aria-hidden="true" className="notify-invite-icon" />
      <div>
        <h2 id="notify-invite-title" ref={heading} tabIndex={-1}>
          Get notified about project updates
        </h2>
        <p>
          Be notified when projects are added or updated and when news is
          published. You can turn this off at any time.
        </p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
      </div>
      <div className="notify-invite-actions">
        <Button
          disabled={busy}
          onClick={async () => {
            if (await run(() => enablePhoneAlerts(feed))) setSuccess(true);
          }}
        >
          {busy ? "Turning on…" : "Turn on notifications"}
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            dismissInvite();
            setClosed(true);
          }}
        >
          Not now
        </Button>
      </div>
      <button
        type="button"
        className="notify-invite-close"
        aria-label="Close notification invitation"
        disabled={busy}
        onClick={() => {
          dismissInvite();
          setClosed(true);
        }}
      >
        <X aria-hidden="true" />
      </button>
    </section>
  );
}

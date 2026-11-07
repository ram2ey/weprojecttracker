"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  analyticsPath,
  consentCookie,
  readConsent,
  type Consent,
} from "@/lib/analytics-policy";

const changed = "wassa-consent-changed";
const settings = "wassa-cookie-settings";
function privacySignal() {
  return (
    typeof navigator !== "undefined" &&
    (navigator as Navigator & { globalPrivacyControl?: boolean })
      .globalPrivacyControl === true
  );
}
function snapshot(): Consent {
  return privacySignal() ? "rejected" : readConsent(document.cookie);
}
function subscribe(update: () => void) {
  const channel =
    typeof BroadcastChannel !== "undefined"
      ? new BroadcastChannel(changed)
      : null;
  channel?.addEventListener("message", update);
  window.addEventListener(changed, update);
  window.addEventListener("focus", update);
  document.addEventListener("visibilitychange", update);
  return () => {
    channel?.close();
    window.removeEventListener(changed, update);
    window.removeEventListener("focus", update);
    document.removeEventListener("visibilitychange", update);
  };
}
function save(value: "accepted" | "rejected") {
  const choice = privacySignal() ? "rejected" : value;
  document.cookie = `${consentCookie}=v1.${choice}; Path=/; Max-Age=15552000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  window.dispatchEvent(new Event(changed));
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(changed);
    channel.postMessage(choice);
    channel.close();
  }
}
export function CookieSettingsButton() {
  return (
    <button
      type="button"
      className="cookie-settings-button"
      onClick={() => window.dispatchEvent(new Event(settings))}
    >
      Cookie settings
    </button>
  );
}
export function CookieConsent() {
  const consent = useSyncExternalStore(
    subscribe,
    snapshot,
    () => "unknown" as Consent,
  );
  const blocked = consent !== "unknown" && privacySignal();
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);
  const banner = useRef<HTMLElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState(false);

  useEffect(() => {
    function open() {
      setSelected(snapshot() === "accepted");
      if (!dialog.current?.open) dialog.current?.showModal();
    }
    window.addEventListener(settings, open);
    return () => window.removeEventListener(settings, open);
  }, []);

  useEffect(() => {
    const element = banner.current;
    if (!element) return;
    const observer = new ResizeObserver(() =>
      document.documentElement.style.setProperty(
        "--consent-banner-height",
        `${element.getBoundingClientRect().height}px`,
      ),
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      document.documentElement.style.setProperty(
        "--consent-banner-height",
        "0px",
      );
    };
  }, [consent]);

  useEffect(() => {
    if (consent !== "accepted") {
      lastPath.current = null;
      return;
    }
    const path = analyticsPath(pathname);
    if (!path || lastPath.current === path) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      lastPath.current = path;
      void fetch("/api/public/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
        signal: controller.signal,
        referrerPolicy: "no-referrer",
        credentials: "same-origin",
      }).catch(() => {
        /* Statistics must never interrupt browsing. */
      });
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [consent, pathname]);

  return (
    <>
      {consent === "unknown" && (
        <>
          <div className="cookie-banner-space" aria-hidden="true" />
          <section
            className="cookie-banner"
            aria-label="Cookie preferences"
            ref={banner}
          >
            <div>
              <h2>Optional website statistics</h2>
              <p>
                May we count page views to understand which pages are useful? We
                use no visitor IDs or advertising trackers. Rejecting won’t
                affect your access.{" "}
                <Link href="/privacy">Privacy &amp; Cookies</Link>
              </p>
            </div>
            <div className="cookie-actions">
              <button
                type="button"
                className="button button-outline"
                onClick={() => save("rejected")}
              >
                Reject analytics
              </button>
              <button
                type="button"
                className="button button-outline"
                onClick={() => save("accepted")}
              >
                Accept analytics
              </button>
            </div>
          </section>
        </>
      )}
      <dialog
        className="cookie-dialog"
        ref={dialog}
        aria-labelledby="cookie-settings-title"
      >
        <h2 id="cookie-settings-title">Cookie settings</h2>
        <p>
          Essential cookies support staff sign-in and remember your choice for
          180 days. They are always available.
        </p>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={selected}
            disabled={blocked}
            onChange={(event) => setSelected(event.target.checked)}
          />{" "}
          Allow optional page-view statistics
        </label>
        <p>
          Only daily page totals are stored for up to 90 days. No visitor IDs,
          IP addresses, search text or staff activity are stored in analytics.
        </p>
        {blocked && (
          <p>
            Your browser’s Global Privacy Control signal keeps optional
            analytics off.
          </p>
        )}
        <p>
          You can withdraw permission here at any time. This stops future
          counting; previously collected anonymous totals cannot be linked back
          to you.
        </p>
        <p>
          <Link href="/privacy" onClick={() => dialog.current?.close()}>
            Read Privacy &amp; Cookies
          </Link>
        </p>
        <div className="cookie-actions">
          <button
            type="button"
            className="button button-outline"
            onClick={() => dialog.current?.close()}
          >
            Cancel
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={() => {
              save(selected ? "accepted" : "rejected");
              dialog.current?.close();
            }}
          >
            Save preferences
          </button>
        </div>
      </dialog>
    </>
  );
}

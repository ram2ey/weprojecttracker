"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

export type UpdateItem = {
  id: string;
  kind: string;
  title: string;
  createdAt: string;
  url: string;
};
export type Feed = {
  items: UpdateItem[];
  page: number;
  hasMore: boolean;
  follows: { kind: string; target: string }[];
  subscribed: boolean;
  deviceRegistered: boolean;
  push: { enabled: false } | { enabled: true; publicKey: string };
};
export type PhoneState =
  | "checking"
  | "unsupported"
  | "iphone-browser"
  | "unavailable"
  | "blocked"
  | "off"
  | "on";

const endpoint = "/api/public/notifications";
const seenKey = "wassa.updates.seen";
const readKey = "wassa.updates.read";
const inviteKey = "wassa.notify.invite-dismissed";
const changed = "wassa-updates-changed";
const cacheMs = 5 * 60 * 1000;

export class UpdatesError extends Error {
  constructor(
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}
async function call<T>(method: string, query = "", json?: unknown) {
  let response: Response;
  try {
    response = await fetch(endpoint + query, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: json ? { "Content-Type": "application/json" } : undefined,
      body: json ? JSON.stringify(json) : undefined,
    });
  } catch {
    throw new UpdatesError("Check your internet connection and try again.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new UpdatesError(
      data.message || "Updates are temporarily unavailable. Please try again.",
      response.status,
    );
  return data as T;
}
export const fetchFeed = (page = 1) =>
  call<Feed>("GET", "?view=all&page=" + page);
const post = (json: unknown) => call<{ ok: true }>("POST", "", json);

// One shared copy of the first feed page feeds the bell, invitation and
// settings, refreshed at most every five minutes to respect shared-network
// request limits.
type Summary = { feed: Feed | null; error: boolean; at: number };
let summary: Summary = { feed: null, error: false, at: 0 };
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
function emit() {
  for (const listener of listeners) listener();
}
function subscribe(update: () => void) {
  listeners.add(update);
  window.addEventListener("storage", update);
  window.addEventListener(changed, update);
  return () => {
    listeners.delete(update);
    window.removeEventListener("storage", update);
    window.removeEventListener(changed, update);
  };
}
export function refreshSummary(force = false) {
  if (!force && (loading || Date.now() - summary.at < cacheMs)) return loading;
  loading = fetchFeed(1)
    .then((feed) => {
      summary = { feed, error: false, at: Date.now() };
    })
    .catch(() => {
      summary = { ...summary, error: true, at: Date.now() };
    })
    .finally(() => {
      loading = null;
      emit();
    });
  return loading;
}
export function useSummary() {
  useEffect(() => {
    void refreshSummary();
  }, []);
  return useSyncExternalStore(
    subscribe,
    () => summary,
    () => summary,
  );
}

// Read state belongs to this browser: a "seen through" timestamp plus a short
// list of individually opened updates.
function storage() {
  try {
    return localStorage;
  } catch {
    return null;
  }
}
function readState() {
  const store = storage();
  let seen = store?.getItem(seenKey) ?? null;
  if (store && !seen) {
    // A first visit starts with a clean slate instead of a backlog.
    seen = new Date().toISOString();
    try {
      store.setItem(seenKey, seen);
    } catch {
      /* Treat as all read for this visit. */
    }
  }
  let ids: string[] = [];
  try {
    ids = JSON.parse(store?.getItem(readKey) ?? "[]");
    if (!Array.isArray(ids)) ids = [];
  } catch {
    ids = [];
  }
  return { seen: seen ?? new Date(8.64e15).toISOString(), ids };
}
let readCache = "";
function readSnapshot() {
  const next = JSON.stringify(readState());
  if (next !== readCache) readCache = next;
  return readCache;
}
export function useReadState() {
  const raw = useSyncExternalStore(subscribe, readSnapshot, () => "");
  return raw
    ? (JSON.parse(raw) as { seen: string; ids: string[] })
    : null;
}
export function isUnread(
  item: UpdateItem,
  state: { seen: string; ids: string[] } | null,
) {
  return (
    !!state &&
    new Date(item.createdAt) > new Date(state.seen) &&
    !state.ids.includes(item.id)
  );
}
export function markRead(id: string) {
  const store = storage();
  if (!store) return;
  const { ids } = readState();
  if (ids.includes(id)) return;
  try {
    store.setItem(readKey, JSON.stringify([id, ...ids].slice(0, 200)));
  } catch {
    /* Read state is a convenience. */
  }
  window.dispatchEvent(new Event(changed));
}
export function markAllRead(through: string) {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(seenKey, through);
    store.setItem(readKey, "[]");
  } catch {
    /* Read state is a convenience. */
  }
  window.dispatchEvent(new Event(changed));
}

export function inviteDismissed() {
  const value = Number(storage()?.getItem(inviteKey) ?? 0);
  return Date.now() - value < 30 * 86400 * 1000;
}
export function dismissInvite() {
  try {
    storage()?.setItem(inviteKey, String(Date.now()));
  } catch {
    /* The invitation stays closed for this page. */
  }
  window.dispatchEvent(new Event(changed));
}

// Phone alerts --------------------------------------------------------------

function pushSupported() {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}
function iphoneBrowser() {
  return (
    (/iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) &&
    !(navigator as Navigator & { standalone?: boolean }).standalone
  );
}
async function registration() {
  if (!("serviceWorker" in navigator)) return null;
  const existing = await navigator.serviceWorker.getRegistration("/");
  return existing?.active?.scriptURL.endsWith("/notification-sw.js")
    ? existing
    : null;
}
export async function phoneState(feed: Feed | null): Promise<PhoneState> {
  if (!feed) return "checking";
  if (!pushSupported()) return iphoneBrowser() ? "iphone-browser" : "unsupported";
  if (!feed.push.enabled) return "unavailable";
  if (Notification.permission === "denied") return "blocked";
  if (Notification.permission !== "granted" || !feed.subscribed) return "off";
  const subscription = await (await registration())?.pushManager
    .getSubscription()
    .catch(() => null);
  return subscription ? "on" : "off";
}
export function usePhoneState(feed: Feed | null) {
  const [state, setState] = useState<PhoneState>("checking");
  useEffect(() => {
    let current = true;
    function check() {
      void phoneState(feed)
        .catch(() => "off" as const)
        .then((next) => current && setState(next));
    }
    check();
    // Permission can change in browser settings while the page stays open.
    document.addEventListener("visibilitychange", check);
    window.addEventListener(changed, check);
    return () => {
      current = false;
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener(changed, check);
    };
  }, [feed]);
  return state;
}
function keyBytes(value: string) {
  const base64 = (value + "=".repeat((4 - (value.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}
function sameKey(subscription: PushSubscription, key: Uint8Array) {
  const current = subscription.options.applicationServerKey;
  if (!current) return false;
  const bytes = new Uint8Array(current);
  return bytes.length === key.length && bytes.every((b, i) => b === key[i]);
}
async function browserSubscription(publicKey: string, fresh = false) {
  const reg = await navigator.serviceWorker.register("/notification-sw.js", {
    scope: "/",
    updateViaCache: "none",
  });
  await navigator.serviceWorker.ready;
  const key = keyBytes(publicKey);
  let subscription = await reg.pushManager.getSubscription();
  if (subscription && (fresh || !sameKey(subscription, key))) {
    await subscription.unsubscribe();
    subscription = null;
  }
  return (
    subscription ??
    reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
  );
}

// Must be called directly from a tap: the permission request comes first so
// browsers still treat it as a response to the visitor's action.
export async function enablePhoneAlerts(feed: Feed) {
  if (!pushSupported())
    throw new UpdatesError(
      iphoneBrowser()
        ? "On iPhone, add the tracker to your Home Screen first, then turn on notifications from the home-screen app."
        : "This browser does not support notifications. Try Chrome on Android.",
    );
  if (!feed.push.enabled)
    throw new UpdatesError(
      "Phone notifications are not available yet. Updates still appear on the Updates page.",
    );
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw new UpdatesError(
      permission === "denied"
        ? "Notifications are blocked for this site. Allow them in your browser’s site settings, then try again."
        : "Notifications were not turned on. You can try again at any time.",
    );
  await post({ action: "follow-all" });
  let subscription: PushSubscription;
  try {
    subscription = await browserSubscription(feed.push.publicKey);
  } catch {
    throw new UpdatesError(
      "Your browser could not set up notifications. Please try again shortly.",
    );
  }
  try {
    await post({ action: "subscribe", subscription: subscription.toJSON() });
  } catch (error) {
    if (!(error instanceof UpdatesError) || error.status !== 409) throw error;
    // The browser still holds a subscription registered to older data on the
    // server. Replace it once with a fresh one.
    subscription = await browserSubscription(feed.push.publicKey, true);
    await post({ action: "subscribe", subscription: subscription.toJSON() });
  }
  await refreshSummary(true);
}
async function removeBrowserSubscription() {
  try {
    await (await (await registration())?.pushManager.getSubscription())?.unsubscribe();
  } catch {
    /* The server no longer sends to it either way. */
  }
}
export async function disablePhoneAlerts() {
  await post({ action: "unsubscribe" });
  await removeBrowserSubscription();
  await refreshSummary(true);
}
export async function setTopic(
  follow: { kind: "category" | "news"; target: string },
  on: boolean,
) {
  await post({ action: on ? "follow" : "unfollow", follow });
  await refreshSummary(true);
}
export async function deleteNotificationData() {
  await call("DELETE");
  await removeBrowserSubscription();
  // Local read state is notification data too; saved favourites are separate.
  for (const key of [seenKey, readKey, inviteKey])
    try {
      storage()?.removeItem(key);
    } catch {
      /* Nothing else to remove. */
    }
  window.dispatchEvent(new Event(changed));
  await refreshSummary(true);
}

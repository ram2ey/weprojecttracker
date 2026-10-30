"use client";
import { useSyncExternalStore } from "react";
type Preferences = {
  follows: string[];
  read: Record<string, string>;
  offline: boolean;
};
const key = "wassa-device-v1",
  empty = '{"follows":[],"read":{},"offline":false}';
const uuid = /^[a-f0-9-]{36}$/i;
function snapshot() {
  try {
    return localStorage.getItem(key) || empty;
  } catch {
    return empty;
  }
}
function parsePreferences(value: string): Preferences {
  try {
    const raw = JSON.parse(value);
    return {
      follows: Array.isArray(raw.follows)
        ? raw.follows
            .filter((id: unknown) => typeof id === "string" && uuid.test(id))
            .slice(0, 200)
        : [],
      read: raw.read && typeof raw.read === "object" ? raw.read : {},
      offline: raw.offline === true,
    };
  } catch {
    return JSON.parse(empty);
  }
}
export function preferences() {
  return parsePreferences(snapshot());
}
export function changePreferences(change: (p: Preferences) => Preferences) {
  const next = change(preferences());
  next.follows = [...new Set(next.follows)].slice(0, 200);
  next.read = Object.fromEntries(
    Object.entries(next.read).filter(([id]) => next.follows.includes(id)),
  );
  try {
    localStorage.setItem(key, JSON.stringify(next));
    window.dispatchEvent(new Event(key));
  } catch {
    throw new Error(
      "This browser could not save device preferences. Check its storage settings.",
    );
  }
}
function subscribe(callback: () => void) {
  window.addEventListener(key, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(key, callback);
    window.removeEventListener("storage", callback);
  };
}
export function usePreferences() {
  const value = useSyncExternalStore(subscribe, snapshot, () => empty);
  return { value, ...parsePreferences(value) };
}

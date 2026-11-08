"use client";

import { Heart, LayoutGrid, List } from "lucide-react";
import { useState, useSyncExternalStore, type ReactNode } from "react";

const prefix = "wassa.favourite.";
const layoutKey = "wassa.project-layout";
const changed = "wassa-project-preferences";
const serverSnapshot = () => null;
let sessionLayout = "list";

function subscribe(update: () => void) {
  window.addEventListener("storage", update);
  window.addEventListener(changed, update);
  return () => {
    window.removeEventListener("storage", update);
    window.removeEventListener(changed, update);
  };
}

function savedSnapshot() {
  try {
    const entries = Object.keys(localStorage).filter((key) =>
      key.startsWith(prefix),
    );
    entries.sort(
      (a, b) =>
        Number(localStorage.getItem(b)) - Number(localStorage.getItem(a)) ||
        a.localeCompare(b),
    );
    return JSON.stringify(entries.map((key) => key.slice(prefix.length)));
  } catch {
    return "[]";
  }
}

export function useSavedProjects() {
  return useSyncExternalStore(subscribe, savedSnapshot, serverSnapshot);
}

export function FavouriteButton({
  slug,
  title,
}: {
  slug: string;
  title: string;
}) {
  const [error, setError] = useState("");
  const key = prefix + slug;
  const saved = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(key) !== null;
      } catch {
        return false;
      }
    },
    () => false,
  );
  return (
    <>
      <button
        type="button"
        className="project-action heart-action"
        aria-label={"Favourite " + title}
        aria-pressed={saved}
        onClick={() => {
          try {
            if (localStorage.getItem(key) !== null)
              localStorage.removeItem(key);
            else localStorage.setItem(key, String(Date.now()));
            setError("");
            window.dispatchEvent(new Event(changed));
          } catch {
            setError(
              "Your browser could not save this change. Check your browser storage settings.",
            );
          }
        }}
      >
        <Heart aria-hidden="true" fill={saved ? "currentColor" : "none"} />
      </button>
      {error && <span role="alert">{error}</span>}
    </>
  );
}

function layoutSnapshot() {
  try {
    return localStorage.getItem(layoutKey) ?? sessionLayout;
  } catch {
    return sessionLayout;
  }
}

export function ProjectCollection({
  count,
  children,
}: {
  count: number;
  children: ReactNode;
}) {
  const layout = useSyncExternalStore(subscribe, layoutSnapshot, () => "list");
  return (
    <div data-project-layout={layout}>
      <div className="collection-toolbar">
        <p role="status" className="results-count">
          {count} {count === 1 ? "project" : "projects"}
        </p>
        {count > 0 && (
          <div
            className="layout-options"
            role="group"
            aria-label="Project layout"
          >
            {(["list", "grid"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-label={value === "list" ? "List" : "Grid"}
                aria-pressed={layout === value}
                onClick={() => {
                  sessionLayout = value;
                  try {
                    localStorage.setItem(layoutKey, value);
                  } catch {
                    /* Keep the selection for this session. */
                  }
                  window.dispatchEvent(new Event(changed));
                }}
              >
                {value === "list" ? (
                  <List aria-hidden="true" />
                ) : (
                  <LayoutGrid aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="project-grid">{children}</div>
    </div>
  );
}

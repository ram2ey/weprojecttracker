"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePreferences, changePreferences } from "./device-store";
import { PushControls } from "./push-controls";
import { OfflineControls } from "@/components/pwa/offline-controls";
type Update = {
  id: string;
  slug: string;
  revision_id: string;
  title: string;
  community: string;
  status: string;
  progress: number;
  summary: string;
  published_at: string;
};
export function FollowingFeed() {
  const p = usePreferences(),
    [items, setItems] = useState<Update[]>([]),
    [error, setError] = useState("");
  const ids = p.follows.join(",");
  useEffect(() => {
    let live = true;
    fetch(`/api/public/updates?ids=${encodeURIComponent(ids)}`, {
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok)
          throw new Error(
            "Your feed could not be loaded. Connect and try again.",
          );
        return r.json();
      })
      .then((data) => {
        if (live) {
          setItems(data.items);
          setError("");
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [ids]);
  return (
    <>
      <p>
        Follow projects from their detail pages to keep a reading list here.
        Follows and read preferences stay on this device; clearing browser data
        removes them.
      </p>
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      {!p.follows.length && (
        <p className="empty-state">
          You have no followed projects yet.{" "}
          <Link href="/projects">Explore the project register</Link>
        </p>
      )}
      <div className="following-list">
        {items.map((item) => (
          <article className="preference-card" key={item.id}>
            <span className="eyebrow">
              {p.read[item.id] !== item.revision_id
                ? "NEW APPROVED UPDATE"
                : "READ"}{" "}
              · {item.status}
            </span>
            <h2>
              <Link href={`/projects/${item.slug}`}>{item.title}</Link>
            </h2>
            <p>
              {item.community} · {item.progress}% reported progress
            </p>
            <p>{item.summary}</p>
            <time dateTime={item.published_at}>
              Approved{" "}
              {new Date(item.published_at).toLocaleDateString("en-GB", {
                timeZone: "UTC",
              })}
            </time>
          </article>
        ))}
      </div>
      {p.follows.length > items.length && (
        <p className="subtle-note">
          Some followed projects are currently unavailable or withdrawn.
        </p>
      )}
      {!!p.follows.length && (
        <button
          className="text-link"
          onClick={() =>
            changePreferences((p) => ({ ...p, follows: [], read: {} }))
          }
        >
          Clear this device’s follows
        </button>
      )}
      <div className="preferences-grid">
        <OfflineControls />
        <PushControls />
      </div>
    </>
  );
}

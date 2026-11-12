"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  fetchFeed,
  isUnread,
  markAllRead,
  markRead,
  refreshSummary,
  usePhoneState,
  useReadState,
  useSummary,
  UpdatesError,
  type UpdateItem,
} from "./notification-client";
import { PhoneAlerts } from "./phone-alerts";

export const updateKinds: Record<string, string> = {
  "project-published": "New project",
  "status-changed": "Status change",
  "project-updated": "Project update",
  "news-published": "News",
  "news-updated": "News update",
};
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function UpdatesFeed() {
  const { feed, error } = useSummary();
  const read = useReadState();
  const phone = usePhoneState(feed);
  const [more, setMore] = useState<UpdateItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState<boolean | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState("");
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    // Opening the page always shows the latest list.
    void refreshSummary(true);
  }, []);

  const firstPage = feed?.items ?? [];
  const items = [
    ...firstPage,
    ...more.filter((m) => !firstPage.some((f) => f.id === m.id)),
  ];
  const unread = items.filter((item) => isUnread(item, read)).length;
  const canLoadMore = hasMore ?? feed?.hasMore ?? false;

  async function loadMore() {
    setLoadingMore(true);
    setMoreError("");
    try {
      const next = await fetchFeed(page + 1);
      setMore((old) => [...old, ...next.items]);
      setPage(next.page);
      setHasMore(next.hasMore);
    } catch (e) {
      setMoreError(
        e instanceof UpdatesError ? e.message : "Older updates could not load.",
      );
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="container section updates-page">
      <div className="updates-heading">
        <div>
          <h1>Updates</h1>
          <p className="subtle-note">
            New projects, project changes and news from across Wassa East,
            newest first. Updates from the last 90 days are shown.
          </p>
        </div>
        <div className="action-row">
          <Button
            variant="outline"
            disabled={!unread}
            onClick={() => {
              const newest = items[0]?.createdAt ?? "";
              const now = new Date().toISOString();
              markAllRead(newest > now ? newest : now);
            }}
          >
            Mark all as read
          </Button>
          <Link className="text-link" href="/updates/settings">
            Notification settings
          </Link>
        </div>
      </div>
      <section className="detail-section" aria-labelledby="device-alerts">
        <h2 id="device-alerts">Notifications on this device</h2>
        <PhoneAlerts feed={feed} state={phone} />
      </section>
      <section aria-labelledby="updates-list-title">
        <h2 id="updates-list-title" className="sr-only">
          All updates
        </h2>
        <p role="status" className="results-count">
          {feed
            ? unread
              ? `${unread} unread`
              : items.length
                ? "You’re up to date."
                : ""
            : error
              ? ""
              : "Loading updates…"}
        </p>
        {!feed && error && (
          <div className="empty-state">
            <h3>Updates could not load.</h3>
            <p>Check your internet connection and try again.</p>
            <Button
              disabled={retrying}
              onClick={async () => {
                setRetrying(true);
                await refreshSummary(true);
                setRetrying(false);
              }}
            >
              {retrying ? "Trying again…" : "Try again"}
            </Button>
          </div>
        )}
        {feed && !items.length && (
          <div className="empty-state">
            <h3>No updates yet.</h3>
            <p>New projects, project changes and news will appear here.</p>
            <Link className="button button-outline" href="/projects">
              Browse projects
            </Link>
          </div>
        )}
        {!!items.length && (
          <ol className="updates-list">
            {items.map((item) => {
              const fresh = isUnread(item, read);
              return (
                <li key={item.id} data-unread={fresh || undefined}>
                  <div className="update-meta">
                    <span>{updateKinds[item.kind] ?? "Update"}</span>
                    <time dateTime={item.createdAt}>
                      {dateFormat.format(new Date(item.createdAt))}
                    </time>
                    {fresh && <span className="update-new">New</span>}
                  </div>
                  <Link
                    href={item.url}
                    className="update-link"
                    onClick={() => markRead(item.id)}
                  >
                    {item.title}
                    {fresh && <span className="sr-only"> (unread)</span>}
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
        {canLoadMore && (
          <Button
            variant="outline"
            disabled={loadingMore}
            onClick={() => void loadMore()}
          >
            {loadingMore ? "Loading…" : "Show older updates"}
          </Button>
        )}
        {moreError && (
          <p role="alert" className="form-error">
            {moreError}
          </p>
        )}
      </section>
    </div>
  );
}

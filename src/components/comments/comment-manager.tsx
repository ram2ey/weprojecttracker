"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ManagedPage } from "@/lib/comments/policy";

async function fetchManaged(
  project: string,
  state: string,
  page: number,
  signal?: AbortSignal,
): Promise<ManagedPage> {
  const query = new URLSearchParams({ state, page: String(page) });
  if (project) query.set("project", project);
  const response = await fetch("/api/staff/comments?" + query, {
    cache: "no-store",
    signal,
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.message || "Could not load comments.");
  return result;
}

export function CommentManager() {
  const [data, setData] = useState<ManagedPage | null>(null),
    [project, setProject] = useState(""),
    [state, setState] = useState("visible");
  const [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const locked = useRef(false);
  const load = useCallback(
    async (page = 1, signal?: AbortSignal) => {
      const result = await fetchManaged(project, state, page, signal);
      if (!signal?.aborted) setData(result);
    },
    [project, state],
  );
  const refresh = useCallback(
    async (page = 1) => {
      if (locked.current) return;
      locked.current = true;
      setBusy(true);
      setError("");
      try {
        await load(page);
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Could not load comments.",
        );
      } finally {
        locked.current = false;
        setBusy(false);
      }
    },
    [load],
  );
  useEffect(() => {
    const controller = new AbortController();
    locked.current = true;
    void fetchManaged(project, state, 1, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error ? error.message : "Could not load comments.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          locked.current = false;
          setBusy(false);
        }
      });
    return () => controller.abort();
  }, [project, state]);
  async function action(input: object, message: string) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/staff/comments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message || "Could not update comments.");
      setNotice(message);
      await load(data?.page ?? 1);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not update comments. Reload and retry.",
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  const selected = data?.projects.find((p) => p.id === project);
  return (
    <>
      <h1>Comments</h1>
      <p>
        Visitor comments appear immediately. Only you can hide or restore them
        and close or reopen commenting.
      </p>
      <div className="comment-filters">
        <div>
          <label htmlFor="comments-project-filter">Project or news story</label>
          <select
            id="comments-project-filter"
            value={project}
            disabled={busy}
            onChange={(event) => {
              setBusy(true);
              setError("");
              setData((old) =>
                old ? { ...old, items: [], page: 1, hasMore: false } : null,
              );
              setProject(event.target.value);
              setNotice("");
            }}
          >
            <option value="">All discussions</option>
            {data?.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="comments-state-filter">Show</label>
          <select
            id="comments-state-filter"
            value={state}
            disabled={busy}
            onChange={(event) => {
              setBusy(true);
              setError("");
              setState(event.target.value);
              setNotice("");
            }}
          >
            <option value="visible">Visible comments</option>
            <option value="hidden">Hidden comments</option>
          </select>
        </div>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => void refresh(data?.page ?? 1)}
        >
          Reload comments
        </Button>
      </div>
      {selected && (
        <div className="comment-project-control">
          <p>
            New comments are{" "}
            <strong>{selected.enabled ? "open" : "closed"}</strong> for{" "}
            {selected.title}. Closing keeps existing comments visible.
          </p>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              void action(
                {
                  action: "set-enabled",
                  id: selected.id,
                  enabled: !selected.enabled,
                  version: selected.version,
                },
                selected.enabled
                  ? "New comments closed."
                  : "New comments reopened.",
              )
            }
          >
            {selected.enabled ? "Close new comments" : "Reopen comments"}
          </Button>
        </div>
      )}
      {busy && <p role="status">Updating comments…</p>}
      {error && (
        <p role="alert">
          {error} Use Reload comments to get the latest version.
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {data && (
        <>
          {!data.items.length && <p>No {state} comments on this page.</p>}
          <ul className="comment-list" aria-label="Manage comments">
            {data.items.map((comment) => (
              <li className="comment-card" key={comment.id}>
                <p className="subtle-note">{comment.projectTitle}</p>
                <div className="comment-meta">
                  <strong>{comment.displayName}</strong>
                  <time dateTime={comment.createdAt}>
                    {new Date(comment.createdAt).toLocaleString("en-GB", {
                      timeZone: "UTC",
                    })}{" "}
                    UTC
                  </time>
                </div>
                <p className="preserve-lines">{comment.body}</p>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void action(
                      {
                        action: comment.hiddenAt ? "restore" : "hide",
                        id: comment.id,
                        version: comment.version,
                      },
                      comment.hiddenAt
                        ? "Comment restored publicly."
                        : "Comment hidden. You can restore it from Hidden comments.",
                    )
                  }
                >
                  {comment.hiddenAt ? "Restore comment" : "Hide comment"}
                </Button>
              </li>
            ))}
          </ul>
          {(data.page > 1 || data.hasMore) && (
            <nav aria-label="Moderation pages" className="comment-actions">
              <Button
                variant="outline"
                disabled={busy || data.page === 1}
                onClick={() => void refresh(data.page - 1)}
              >
                Previous comments
              </Button>
              <span>Page {data.page}</span>
              <Button
                variant="outline"
                disabled={busy || !data.hasMore}
                onClick={() => void refresh(data.page + 1)}
              >
                Next comments
              </Button>
            </nav>
          )}
        </>
      )}
      <p className="subtle-note">
        Hidden names and messages remain private and recoverable. Hiding does
        not delete them.
      </p>
    </>
  );
}
